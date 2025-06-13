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

    // 创建模数钢材采购清单工作表
    const moduleStats = {};
    
    Object.entries(results.solutions).forEach(([crossSection, solution]) => {
      if (solution.details && solution.details.length > 0) {
        solution.details.forEach(detail => {
          if (detail.sourceType === 'module' && detail.moduleType) {
            const key = `${detail.moduleType}_${detail.moduleLength || detail.sourceLength}`;
            if (!moduleStats[key]) {
              moduleStats[key] = {
                moduleType: detail.moduleType,
                crossSection: parseInt(crossSection),
                length: detail.moduleLength || detail.sourceLength,
                count: 0,
                totalLength: 0
              };
            }
            moduleStats[key].count += detail.quantity || 1;
            moduleStats[key].totalLength += (detail.moduleLength || detail.sourceLength) * (detail.quantity || 1);
          }
        });
      }
    });

    const purchaseData = [];
    purchaseData.push(['规格', '截面面积(mm²)', '长度(mm)', '采购数量(根)', '总长度(mm)']);

    // 按截面面积和长度排序
    const sortedStats = Object.values(moduleStats).sort((a, b) => {
      if (a.crossSection !== b.crossSection) {
        return a.crossSection - b.crossSection;
      }
      return a.length - b.length;
    });

    sortedStats.forEach(stat => {
      purchaseData.push([
        stat.moduleType,
        stat.crossSection,
        stat.length,
        stat.count,
        stat.totalLength
      ]);
    });

    // 添加总计行
    const grandTotal = sortedStats.reduce((acc, stat) => ({
      count: acc.count + stat.count,
      totalLength: acc.totalLength + stat.totalLength
    }), { count: 0, totalLength: 0 });

    purchaseData.push([
      '总计',
      '-',
      '-',
      grandTotal.count,
      grandTotal.totalLength
    ]);

    const purchaseSheet = XLSX.utils.aoa_to_sheet(purchaseData);
    XLSX.utils.book_append_sheet(workbook, purchaseSheet, '模数钢材采购清单');

    // 创建简化的汇总信息工作表
    const summaryData = [];
    summaryData.push(['项目', '数值']);
    summaryData.push(['总损耗率(%)', (results.totalLossRate || 0).toFixed(2)]);
    summaryData.push(['模数钢材使用量(根)', results.totalModuleUsed || 0]);
    summaryData.push(['总废料长度(mm)', results.totalWaste || 0]);

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
        filename: `模数钢材采购清单_${new Date().toISOString().slice(0, 10)}.xlsx`,
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