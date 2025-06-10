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

    const { designSteels } = requestBody;

    if (!designSteels || !Array.isArray(designSteels) || designSteels.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '缺少设计钢材数据' })
      };
    }

    const lengths = designSteels.map(steel => steel.length || 0).filter(length => length > 0);

    if (lengths.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '设计钢材长度数据无效' })
      };
    }

    const maxLength = Math.max(...lengths);
    const standardSpecs = [3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000];
    
    const candidates = standardSpecs.filter(spec => spec >= maxLength + 500 && spec <= maxLength + 4000);
    
    const candidateSpecs = candidates.slice(0, 6).map((length, index) => ({
      length,
      name: `模数-${length}`,
      priority: 100 - index * 10
    }));

    const estimatedTime = Math.min(Math.max(candidateSpecs.length * 2 + lengths.length * 0.1, 5), 300);
    const totalCombinations = candidateSpecs.length + candidateSpecs.length * (candidateSpecs.length - 1) / 2;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        candidateSpecs,
        estimatedTime: Math.round(estimatedTime),
        totalCombinations,
        dataWarning: designSteels.length > 50 ? '数据量较大，建议设置较长的计算时间' : null
      })
    };

  } catch (error) {
    console.error('智能优化预估错误:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: '预估计算失败',
        details: error.message || '未知错误'
      })
    };
  }
};