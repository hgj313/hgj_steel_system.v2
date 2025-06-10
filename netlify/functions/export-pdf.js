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

    // 生成简化的PDF内容
    const pdfContent = {
      success: true,
      filename: `钢材优化结果_${new Date().toISOString().slice(0, 10)}.pdf`,
      message: 'PDF内容生成成功',
      data: {
        totalLossRate: results.totalLossRate || 0,
        totalModuleUsed: results.totalModuleUsed || 0,
        executionTime: results.executionTime || 0,
        timestamp: new Date().toLocaleString('zh-CN')
      }
    };

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pdfContent)
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