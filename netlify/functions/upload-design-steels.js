const XLSX = require('xlsx');

exports.handler = async (event, context) => {
  // 设置CORS头
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // 获取上传的文件数据
    const contentType = event.headers['content-type'] || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '请上传Excel文件' })
      };
    }

    // 解析base64编码的body
    const body = event.isBase64Encoded ? 
      Buffer.from(event.body, 'base64') : 
      Buffer.from(event.body);

    // 简单的multipart解析（查找文件内容）
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '无效的文件格式' })
      };
    }

    // 分割multipart数据
    const parts = body.toString('binary').split('--' + boundary);
    let fileBuffer = null;

    for (const part of parts) {
      if (part.includes('Content-Type: application/') && 
          (part.includes('.xlsx') || part.includes('.xls') || part.includes('spreadsheet'))) {
        // 找到文件部分，提取二进制数据
        const lines = part.split('\r\n');
        const dataStartIndex = lines.findIndex(line => line.trim() === '') + 1;
        if (dataStartIndex > 0 && dataStartIndex < lines.length) {
          const fileData = lines.slice(dataStartIndex).join('\r\n');
          fileBuffer = Buffer.from(fileData, 'binary');
          break;
        }
      }
    }

    if (!fileBuffer) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '未找到有效的Excel文件' })
      };
    }

    // 读取Excel文件
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    // 转换数据格式
    const designSteels = data.map((row, index) => ({
      id: `design_${Date.now()}_${index}`,
      length: parseFloat(row['长度'] || row['Length'] || row.length || 0),
      quantity: parseInt(row['数量'] || row['Quantity'] || row.quantity || 0),
      crossSection: parseFloat(row['截面面积'] || row['CrossSection'] || row.crossSection || 0),
      specification: row['规格'] || row['Specification'] || row.specification || '',
      material: row['材质'] || row['Material'] || row.material || '',
      note: row['备注'] || row['Note'] || row.note || ''
    })).filter(steel => steel.length > 0 && steel.quantity > 0);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        designSteels: designSteels,
        message: `成功导入 ${designSteels.length} 条设计钢材数据`
      })
    };

  } catch (error) {
    console.error('文件处理错误:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: '文件处理失败',
        details: error.message 
      })
    };
  }
}; 