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
        completed: true,
        bestCombination: {
          specs: ['6000', '9000'],
          lossRate: 2.5,
          moduleUsed: 108
        },
        totalTestedCombinations: 15,
        executionTime: 45000,
        result: {
          solutions: {},
          totalLossRate: 2.5,
          totalModuleUsed: 108,
          executionTime: 45000
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '获取结果失败' })
    };
  }
};