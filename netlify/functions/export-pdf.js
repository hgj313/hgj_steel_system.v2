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
  const safeSolutions = safeResults.solutions || {};
  
  // 计算需求验证
  const produced = {};
  Object.values(safeSolutions).forEach(solution => {
    if (solution.details && Array.isArray(solution.details)) {
      solution.details.forEach(detail => {
        if (detail.designId && detail.quantity) {
          produced[detail.designId] = (produced[detail.designId] || 0) + detail.quantity;
        }
      });
    }
  });

  const requirementValidation = designSteels.map(steel => {
    const producedQty = produced[steel.id] || 0;
    return {
      id: steel.displayId || steel.id,
      length: steel.length || 0,
      quantity: steel.quantity || 0,
      produced: producedQty,
      satisfied: producedQty >= steel.quantity
    };
  });

  const allSatisfied = requirementValidation.every(v => v.satisfied);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>钢材优化结果报告</title>
  <style>
    body { font-family: 'SimSun', Arial, sans-serif; margin: 20px; color: #333; line-height: 1.6; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #1890ff; margin: 0; font-size: 28px; }
    .section { margin-bottom: 30px; page-break-inside: avoid; }
    .section h2 { color: #1890ff; border-bottom: 1px solid #1890ff; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 14px; }
    th { background-color: #f5f5f5; font-weight: bold; }
    .satisfied { color: #52c41a; font-weight: bold; }
    .unsatisfied { color: #ff4d4f; font-weight: bold; }
    .summary { background-color: #f9f9f9; padding: 15px; border-radius: 5px; }
    .status-ok { color: #52c41a; font-weight: bold; }
    .status-warning { color: #faad14; font-weight: bold; }
    @media print {
      body { margin: 10px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>钢材优化结果报告</h1>
    <div>生成时间: ${new Date().toLocaleString('zh-CN')}</div>
  </div>

  <div class="section">
    <h2>优化结果汇总</h2>
    <div class="summary">
      <table>
        <tr><td><strong>总损耗率</strong></td><td>${(safeResults.totalLossRate || 0).toFixed(2)}%</td></tr>
        <tr><td><strong>模数钢材使用量</strong></td><td>${safeResults.totalModuleUsed || 0} 根</td></tr>
        <tr><td><strong>总废料长度</strong></td><td>${(safeResults.totalWaste || 0).toLocaleString()} mm</td></tr>
        <tr><td><strong>计算时间</strong></td><td>${safeResults.executionTime || 0} ms</td></tr>
        <tr><td><strong>需求满足状态</strong></td><td class="${allSatisfied ? 'status-ok' : 'status-warning'}">${allSatisfied ? '全部需求已满足' : '存在未满足需求'}</td></tr>
      </table>
    </div>
  </div>

  <div class="section">
    <h2>需求满足情况验证表</h2>
    <table>
      <thead>
        <tr>
          <th>设计钢材ID</th>
          <th>长度 (mm)</th>
          <th>需求数量</th>
          <th>生产数量</th>
          <th>差值</th>
          <th>满足状态</th>
        </tr>
      </thead>
      <tbody>
        ${requirementValidation.map(item => `
          <tr>
            <td>${item.id}</td>
            <td>${item.length.toLocaleString()}</td>
            <td>${item.quantity}</td>
            <td>${item.produced}</td>
            <td>${item.produced - item.quantity}</td>
            <td class="${item.satisfied ? 'satisfied' : 'unsatisfied'}">
              ${item.satisfied ? '✓ 已满足' : '✗ 未满足'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>报告说明</h2>
    <ul>
      <li>本报告基于输入的设计钢材数据进行优化计算生成</li>
      <li>损耗率 = 废料长度 / 总材料长度 × 100%</li>
      <li>绿色✓表示需求已满足，红色✗表示需求未满足</li>
      <li>差值为正数表示超额生产，负数表示生产不足</li>
      <li>建议打印此报告作为生产指导文档</li>
    </ul>
  </div>
</body>
</html>`;
}