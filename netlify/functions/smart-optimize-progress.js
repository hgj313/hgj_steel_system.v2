exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        progress: 50,
        currentStep: '正在计算最优组合...',
        testedCombinations: 25,
        estimatedTimeRemaining: 30
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '获取进度失败' })
    };
  }
};