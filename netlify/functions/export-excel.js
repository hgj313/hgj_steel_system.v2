const XLSX = require('xlsx');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { results, designSteels } = JSON.parse(event.body);

    if (!results || !results.solutions || !designSteels) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '缺少结果数据或设计钢材数据' })
      };
    }

    // 创建工作簿
    const workbook = XLSX.utils.book_new();

    // 创建设计钢材清单工作表 - 只包含基本信息
    const designData = [];
    designData.push(['编号', '规格', '长度(mm)', '数量']);

    // 按规格分组并排序
    const groupedBySpec = {};
    designSteels.forEach(steel => {
      const spec = steel.specification || `截面${steel.crossSection}mm²`;
      if (!groupedBySpec[spec]) {
        groupedBySpec[spec] = [];
      }
      groupedBySpec[spec].push(steel);
    });

    // 按规格排序，每个规格内按长度排序
    Object.keys(groupedBySpec).sort().forEach(spec => {
      groupedBySpec[spec]
        .sort((a, b) => a.length - b.length)
        .forEach(steel => {
          designData.push([
            steel.displayId || steel.id,
            steel.specification || `截面${steel.crossSection}mm²`,
            steel.length,
            steel.quantity
          ]);
        });
    });

    const designSheet = XLSX.utils.aoa_to_sheet(designData);
    XLSX.utils.book_append_sheet(workbook, designSheet, '设计钢材清单');

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