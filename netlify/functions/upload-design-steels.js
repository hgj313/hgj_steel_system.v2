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
    console.log('=== Netlify Functions: 开始处理Excel文件 ===');
    
    // 获取请求数据
    const contentType = event.headers['content-type'] || '';
    console.log('Content-Type:', contentType);
    
    let fileBuffer;
    let filename = 'uploaded_file.xlsx';

    if (contentType.includes('application/json')) {
      // JSON格式的文件数据
      const body = JSON.parse(event.body);
      if (!body.data) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: '没有文件数据' })
        };
      }
      
      filename = body.filename || filename;
      fileBuffer = Buffer.from(body.data, 'base64');
      console.log('JSON格式文件:', { filename, bufferSize: fileBuffer.length });
      
    } else if (contentType.includes('multipart/form-data')) {
      // 兼容multipart格式（本地开发）
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

      const parts = body.toString('binary').split('--' + boundary);
      for (const part of parts) {
        if (part.includes('Content-Type: application/') && 
            (part.includes('.xlsx') || part.includes('.xls') || part.includes('spreadsheet'))) {
          const lines = part.split('\r\n');
          const dataStartIndex = lines.findIndex(line => line.trim() === '') + 1;
          if (dataStartIndex > 0 && dataStartIndex < lines.length) {
            const fileData = lines.slice(dataStartIndex).join('\r\n');
            fileBuffer = Buffer.from(fileData, 'binary');
            break;
          }
        }
      }
      console.log('Multipart格式文件解析完成');
    }

    if (!fileBuffer) {
      console.error('❌ 未找到有效的Excel文件');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '未找到有效的Excel文件' })
      };
    }

    console.log('📄 文件缓冲区大小:', fileBuffer.length, '字节');

    // 读取Excel文件
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log('📊 工作表分析:', {
      工作表名称: sheetName,
      原始行数: data.length,
      列名信息: data.length > 0 ? Object.keys(data[0]) : []
    });

    // 检查列名映射
    if (data.length > 0) {
      const firstRow = data[0];
      const columnMapping = {
        长度: firstRow.hasOwnProperty('长度') ? '✅ 找到' : (firstRow.hasOwnProperty('Length') ? '✅ 找到(English)' : (firstRow.hasOwnProperty('length') ? '✅ 找到(lowercase)' : '❌ 未找到')),
        数量: firstRow.hasOwnProperty('数量') ? '✅ 找到' : (firstRow.hasOwnProperty('Quantity') ? '✅ 找到(English)' : (firstRow.hasOwnProperty('quantity') ? '✅ 找到(lowercase)' : '❌ 未找到')),
        截面面积: firstRow.hasOwnProperty('截面面积') ? '✅ 找到' : (firstRow.hasOwnProperty('CrossSection') ? '✅ 找到(English)' : (firstRow.hasOwnProperty('crossSection') ? '✅ 找到(lowercase)' : '❌ 未找到'))
      };
      console.log('🔍 列名映射结果:', columnMapping);
    }

    // 转换数据格式
    const designSteels = data.map((row, index) => {
      const steel = {
        id: `design_${Date.now()}_${index}`,
        length: parseFloat(row['长度'] || row['Length'] || row.length || 0),
        quantity: parseInt(row['数量'] || row['Quantity'] || row.quantity || 0),
        crossSection: parseFloat(row['截面面积'] || row['CrossSection'] || row.crossSection || 0),
        specification: row['规格'] || row['Specification'] || row.specification || '',
        material: row['材质'] || row['Material'] || row.material || '',
        note: row['备注'] || row['Note'] || row.note || ''
      };

      // 调试前3行的详细解析结果
      if (index < 3) {
        console.log(`第${index + 1}行解析结果:`, {
          原始数据: row,
          解析结果: steel,
          长度来源: row['长度'] ? '长度' : (row['Length'] ? 'Length' : (row.length ? 'length' : '未找到')),
          数量来源: row['数量'] ? '数量' : (row['Quantity'] ? 'Quantity' : (row.quantity ? 'quantity' : '未找到')),
          截面面积来源: row['截面面积'] ? '截面面积' : (row['CrossSection'] ? 'CrossSection' : (row.crossSection ? 'crossSection' : '未找到'))
        });
      }

      return steel;
    }).filter(steel => {
      const isValid = steel.length > 0 && steel.quantity > 0;
      if (!isValid && data.indexOf(data.find(d => data.indexOf(d) < 3)) < 3) {
        console.log('过滤掉无效数据:', steel);
      }
      return isValid;
    });

    console.log('📈 数据统计:', {
      原始行数: data.length,
      有效数据: designSteels.length,
      过滤掉: data.length - designSteels.length
    });

    // 统计截面面积情况
    const crossSectionStats = {
      有截面面积: designSteels.filter(s => s.crossSection > 0).length,
      无截面面积: designSteels.filter(s => s.crossSection === 0).length,
      最大截面面积: designSteels.length > 0 ? Math.max(...designSteels.map(s => s.crossSection)) : 0,
      最小截面面积: designSteels.filter(s => s.crossSection > 0).length > 0 ? Math.min(...designSteels.filter(s => s.crossSection > 0).map(s => s.crossSection)) : 0
    };
    console.log('📊 截面面积统计:', crossSectionStats);

    console.log('=== Netlify Functions: Excel文件处理完成 ===');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        designSteels: designSteels,
        message: `成功导入 ${designSteels.length} 条设计钢材数据`,
        debugInfo: {
          原始行数: data.length,
          有效数据: designSteels.length,
          截面面积统计: crossSectionStats,
          列名信息: data.length > 0 ? Object.keys(data[0]) : [],
          示例数据: data.slice(0, 2)
        }
      })
    };

  } catch (error) {
    console.error('=== Netlify Functions: 文件处理错误 ===');
    console.error('错误详情:', error);
    console.error('错误堆栈:', error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: '文件处理失败',
        details: error.message,
        debugInfo: {
          errorType: error.name,
          errorMessage: error.message,
          errorStack: error.stack
        }
      })
    };
  }
}; 