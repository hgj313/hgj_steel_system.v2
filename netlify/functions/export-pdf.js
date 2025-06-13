exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '请求数据格式错误' })
      };
    }

    const { results, designSteels, moduleSteels } = requestBody;

    if (!results) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '缺少结果数据' })
      };
    }

    // 生成HTML内容用于PDF
    const htmlContent = generatePDFHTML(results, designSteels, moduleSteels);
    
    const pdfResponse = {
      success: true,
      filename: `钢材优化结果_${new Date().toISOString().slice(0, 10)}.pdf`,
      message: 'PDF内容生成成功',
      htmlContent: htmlContent
    };

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pdfResponse)
    };

  } catch (error) {
    console.error('PDF导出错误:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'PDF导出失败',
        details: error.message || '未知错误'
      })
    };
  }
};

function generatePDFHTML(results, designSteels, moduleSteels) {
  const safeResults = results || {};
  const safeDesignSteels = designSteels || [];
  
  // 按规格分组设计钢材
  const groupedBySpec = {};
  safeDesignSteels.forEach(steel => {
    const spec = steel.specification || `截面${steel.crossSection}mm²`;
    if (!groupedBySpec[spec]) {
      groupedBySpec[spec] = [];
    }
    groupedBySpec[spec].push(steel);
  });

  // 按规格排序，每个规格内按长度排序
  const sortedDesignSteels = [];
  Object.keys(groupedBySpec).sort().forEach(spec => {
    groupedBySpec[spec]
      .sort((a, b) => a.length - b.length)
      .forEach(steel => {
        sortedDesignSteels.push({
          id: steel.displayId || steel.id,
          specification: steel.specification || `截面${steel.crossSection}mm²`,
          length: steel.length || 0,
          quantity: steel.quantity || 0
        });
      });
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>设计钢材清单</title>
  <style>
    body { font-family: 'SimSun', Arial, sans-serif; margin: 20px; color: #333; line-height: 1.6; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #1890ff; margin: 0; font-size: 28px; }
    .section { margin-bottom: 30px; page-break-inside: avoid; }
    .section h2 { color: #1890ff; border-bottom: 1px solid #1890ff; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 14px; }
    th { background-color: #f5f5f5; font-weight: bold; }
    .summary { background-color: #f9f9f9; padding: 15px; border-radius: 5px; }
    @media print {
      body { margin: 10px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>设计钢材清单</h1>
    <div>生成时间: ${new Date().toLocaleString('zh-CN')}</div>
  </div>

  <div class="section">
    <h2>优化结果汇总</h2>
    <div class="summary">
      <table>
        <tr><td><strong>总损耗率</strong></td><td>${(safeResults.totalLossRate || 0).toFixed(2)}%</td></tr>
        <tr><td><strong>模数钢材使用量</strong></td><td>${safeResults.totalModuleUsed || 0} 根</td></tr>
        <tr><td><strong>总废料长度</strong></td><td>${(safeResults.totalWaste || 0).toLocaleString()} mm</td></tr>
      </table>
    </div>
  </div>

  <div class="section">
    <h2>设计钢材清单</h2>
    <table>
      <thead>
        <tr>
          <th>编号</th>
          <th>规格</th>
          <th>长度 (mm)</th>
          <th>数量</th>
        </tr>
      </thead>
      <tbody>
        ${sortedDesignSteels.map(steel => `
          <tr>
            <td>${steel.id}</td>
            <td>${steel.specification}</td>
            <td>${steel.length.toLocaleString()}</td>
            <td>${steel.quantity}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>报告说明</h2>
    <ul>
      <li><strong>优化结果汇总</strong>：显示整体优化效果和计算统计</li>
      <li><strong>设计钢材清单</strong>：按规格分组的设计钢材需求明细</li>
      <li>损耗率 = 废料长度 / 总材料长度 × 100%</li>
      <li>建议将此报告作为生产的指导文档</li>
    </ul>
  </div>
</body>
</html>`;
}