const XLSX = require('xlsx');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { results, moduleSteels } = JSON.parse(event.body);

    if (!results || !results.solutions) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '缺少结果数据' })
      };
    }

    // 创建工作簿
    const workbook = XLSX.utils.book_new();

    // 创建切割方案工作表
    const cuttingData = [];
    cuttingData.push(['截面面积', '原料类型', '原料描述', '原料长度', '切割清单', '废料长度', '新余料']);

    Object.entries(results.solutions).forEach(([crossSection, solution]) => {
      if (solution.cuttingPlans && solution.cuttingPlans.length > 0) {
        solution.cuttingPlans.forEach(plan => {
          const cutsList = plan.cuts?.map(cut => 
            `${cut.designId}: ${cut.length}mm × ${cut.quantity}件`
          ).join('; ') || '';
          
          const remaindersList = plan.newRemainders?.map(remainder =>
            `${remainder.id}: ${remainder.length}mm`
          ).join('; ') || '';
          
          cuttingData.push([
            crossSection,
            plan.sourceType === 'module' ? '模数钢材' : '余料',
            plan.sourceDescription || '',
            plan.sourceLength || 0,
            cutsList,
            plan.waste || 0,
            remaindersList
          ]);
        });
      }
    });

    const cuttingSheet = XLSX.utils.aoa_to_sheet(cuttingData);
    XLSX.utils.book_append_sheet(workbook, cuttingSheet, '切割方案');

    // 创建模数钢材统计工作表
    const moduleStats = {};
    
    Object.entries(results.solutions).forEach(([crossSection, solution]) => {
      if (!moduleStats[crossSection]) {
        moduleStats[crossSection] = {};
      }
      
      // 从切割详情中统计模数钢材使用量
      if (solution.details && solution.details.length > 0) {
        solution.details.forEach(detail => {
          if (detail.sourceType === 'module' && detail.moduleType) {
            const key = `${detail.moduleType}_${detail.moduleLength || detail.sourceLength}`;
            if (!moduleStats[crossSection][key]) {
              moduleStats[crossSection][key] = {
                moduleType: detail.moduleType,
                crossSection: parseInt(crossSection),
                length: detail.moduleLength || detail.sourceLength,
                count: 0,
                totalLength: 0
              };
            }
            moduleStats[crossSection][key].count += detail.quantity;
            moduleStats[crossSection][key].totalLength += (detail.moduleLength || detail.sourceLength) * detail.quantity;
          }
        });
      }
    });

    const statsData = [];
    statsData.push(['模数钢材规格', '截面面积(mm²)', '长度(mm)', '使用数量(根)', '总长度(mm)', '备注']);

    // 添加详细统计数据
    Object.entries(moduleStats).forEach(([crossSection, crossSectionData]) => {
      Object.values(crossSectionData).forEach(stats => {
        if (stats.count > 0) {
          statsData.push([
            stats.moduleType,
            stats.crossSection,
            stats.length,
            stats.count,
            stats.totalLength,
            `单根长度${stats.length}mm`
          ]);
        }
      });
      
      // 添加截面小计
      if (Object.keys(crossSectionData).length > 0) {
        const subtotal = Object.values(crossSectionData).reduce((acc, stats) => ({
          count: acc.count + stats.count,
          totalLength: acc.totalLength + stats.totalLength
        }), { count: 0, totalLength: 0 });
        
        statsData.push([
          `截面${crossSection}小计`,
          crossSection,
          '-',
          subtotal.count,
          subtotal.totalLength,
          ''
        ]);
      }
    });

    // 添加总计
    const grandTotal = Object.values(moduleStats).reduce((acc, crossSectionData) => {
      const crossSectionTotal = Object.values(crossSectionData).reduce((subAcc, stats) => ({
        count: subAcc.count + stats.count,
        totalLength: subAcc.totalLength + stats.totalLength
      }), { count: 0, totalLength: 0 });
      
      return {
        count: acc.count + crossSectionTotal.count,
        totalLength: acc.totalLength + crossSectionTotal.totalLength
      };
    }, { count: 0, totalLength: 0 });

    statsData.push([
      '总计',
      '-',
      '-',
      grandTotal.count,
      grandTotal.totalLength,
      ''
    ]);

    const statsSheet = XLSX.utils.aoa_to_sheet(statsData);
    XLSX.utils.book_append_sheet(workbook, statsSheet, '模数钢材统计');

    // 创建汇总信息工作表
    const summaryData = [];
    summaryData.push(['项目', '数值', '单位']);
    summaryData.push(['总损耗率', results.totalLossRate || 0, '%']);
    summaryData.push(['模数钢材使用量', results.totalModuleUsed || 0, '根']);
    summaryData.push(['总废料长度', results.totalWaste || 0, 'mm']);
    summaryData.push(['总材料长度', results.totalMaterial || 0, 'mm']);
    summaryData.push(['计算时间', results.executionTime || 0, 'ms']);

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, '汇总信息');

    // 转换为buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const base64 = buffer.toString('base64');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: base64,
        filename: `钢材优化结果_${new Date().toISOString().slice(0, 10)}.xlsx`,
        message: 'Excel文件生成成功'
      })
    };
  } catch (error) {
    console.error('Excel导出错误:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Excel导出失败',
        details: error.message 
      })
    };
  }
}; 