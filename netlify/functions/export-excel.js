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

    if (!results) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '缺少结果数据' })
      };
    }

    // 创建工作簿
    const workbook = XLSX.utils.book_new();

    // 创建切割方案工作表
    const cuttingData = [];
    cuttingData.push(['截面面积', '模数钢材编号', '长度', '切割清单', '余料长度', '备注']);

    Object.entries(results.results || {}).forEach(([crossSection, groupResult]) => {
      if (groupResult.cuttingPlans) {
        groupResult.cuttingPlans.forEach(plan => {
          const cutsList = plan.cuts?.map(cut => 
            `${cut.specification || cut.id}: ${cut.length}mm × ${cut.quantity}根`
          ).join('; ') || '';
          
          cuttingData.push([
            crossSection,
            plan.moduleId || '',
            plan.moduleLength || '',
            cutsList,
            plan.remainder || 0,
            plan.note || ''
          ]);
        });
      }
    });

    const cuttingSheet = XLSX.utils.aoa_to_sheet(cuttingData);
    XLSX.utils.book_append_sheet(workbook, cuttingSheet, '切割方案');

    // 创建模数钢材统计工作表
    if (moduleSteels && moduleSteels.length > 0) {
      const moduleStats = {};
      
      Object.entries(results.results || {}).forEach(([crossSection, groupResult]) => {
        if (!moduleStats[crossSection]) {
          moduleStats[crossSection] = { sections: {} };
        }
        
        moduleSteels.forEach(module => {
          const key = `${module.length}`;
          if (!moduleStats[crossSection].sections[key]) {
            moduleStats[crossSection].sections[key] = {
              specification: `${module.name || '标准'} ${module.length}mm`,
              crossSection: crossSection,
              length: module.length,
              count: 0,
              totalLength: 0
            };
          }
          
          if (groupResult.totalModuleUsed) {
            moduleStats[crossSection].sections[key].count += groupResult.totalModuleUsed;
            moduleStats[crossSection].sections[key].totalLength += groupResult.totalModuleUsed * module.length;
          }
        });
      });

      const statsData = [];
      statsData.push(['规格', '截面面积', '长度', '使用数量', '总长度', '备注']);

      Object.entries(moduleStats).forEach(([crossSection, data]) => {
        Object.entries(data.sections).forEach(([key, stats]) => {
          if (stats.count > 0) {
            statsData.push([
              stats.specification,
              crossSection,
              stats.length,
              stats.count,
              stats.totalLength,
              ''
            ]);
          }
        });
      });

      const statsSheet = XLSX.utils.aoa_to_sheet(statsData);
      XLSX.utils.book_append_sheet(workbook, statsSheet, '模数钢材统计');
    }

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
        filename: `steel_optimization_${Date.now()}.xlsx`,
        message: 'Excel文件生成成功'
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Excel导出失败',
        details: error.message 
      })
    };
  }
}; 