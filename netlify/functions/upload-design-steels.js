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

    // 读取Excel文件 - 尝试多种编码方式
    let workbook, data;
    
    try {
      // 首先尝试UTF-8编码
      workbook = XLSX.read(fileBuffer, { 
        type: 'buffer',
        codepage: 65001, // UTF-8编码
        cellText: false,
        cellDates: true
      });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
      
      console.log('✅ UTF-8编码读取成功');
    } catch (utf8Error) {
      console.log('❌ UTF-8编码失败，尝试GBK编码');
      try {
        // 尝试GBK编码(中文Windows常用)
        workbook = XLSX.read(fileBuffer, { 
          type: 'buffer',
          codepage: 936, // GBK编码
          cellText: false,
          cellDates: true
        });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
        
        console.log('✅ GBK编码读取成功');
      } catch (gbkError) {
        console.log('❌ GBK编码也失败，尝试默认编码');
        // 最后尝试默认方式
        workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
        
        console.log('⚠️ 使用默认编码读取');
      }
    }

    // 获取工作表名称
    const sheetName = workbook.SheetNames[0];
    
    console.log('📊 工作表分析:', {
      工作表名称: sheetName,
      原始行数: data.length,
      列名信息: data.length > 0 ? Object.keys(data[0]) : []
    });

    // 智能列名映射 - 处理编码问题和不同命名方式
    const findColumn = (data, possibleNames, fuzzyMatch = true) => {
      if (!data || data.length === 0) return null;
      
      const columns = Object.keys(data[0]);
      
      // 精确匹配
      for (const name of possibleNames) {
        if (columns.includes(name)) {
          return name;
        }
      }
      
      // 模糊匹配（处理编码问题）
      if (fuzzyMatch) {
        for (const col of columns) {
          // 长度相关
          if ((col.includes('长') || col.includes('Length') || col.toLowerCase().includes('length')) && 
              possibleNames.some(name => name.includes('长度') || name.includes('Length'))) {
            console.log(`🔧 模糊匹配长度列: "${col}" -> 长度`);
            return col;
          }
          // 数量相关
          if ((col.includes('量') || col.includes('Quantity') || col.toLowerCase().includes('quantity')) && 
              possibleNames.some(name => name.includes('数量') || name.includes('Quantity'))) {
            console.log(`🔧 模糊匹配数量列: "${col}" -> 数量`);
            return col;
          }
          // 截面面积相关
          if ((col.includes('面') || col.includes('Section') || col.toLowerCase().includes('section') || 
               col.includes('积') || col.includes('Area') || col.toLowerCase().includes('area')) && 
              possibleNames.some(name => name.includes('截面') || name.includes('面积') || name.includes('Section'))) {
            console.log(`🔧 模糊匹配截面面积列: "${col}" -> 截面面积`);
            return col;
          }
        }
      }
      
      return null;
    };

    // 智能检查列名映射
    let lengthColumn, quantityColumn, crossSectionColumn;
    
    if (data.length > 0) {
      // 使用智能匹配查找列名
      lengthColumn = findColumn(data, ['长度', 'Length', 'length']);
      quantityColumn = findColumn(data, ['数量', 'Quantity', 'quantity']);
      crossSectionColumn = findColumn(data, ['截面面积', 'CrossSection', 'crossSection', '面积', 'Area', 'area']);
      
      const columnMapping = {
        长度: lengthColumn ? `✅ 找到: "${lengthColumn}"` : '❌ 未找到',
        数量: quantityColumn ? `✅ 找到: "${quantityColumn}"` : '❌ 未找到',
        截面面积: crossSectionColumn ? `✅ 找到: "${crossSectionColumn}"` : '❌ 未找到'
      };
      console.log('🔍 智能列名映射结果:', columnMapping);
    }

    // 转换数据格式 - 使用智能映射的列名
    const designSteels = data.map((row, index) => {
      const steel = {
        id: `design_${Date.now()}_${index}`,
        length: parseFloat(row[lengthColumn] || row['长度'] || row['Length'] || row.length || 0),
        quantity: parseInt(row[quantityColumn] || row['数量'] || row['Quantity'] || row.quantity || 0),
        crossSection: parseFloat(row[crossSectionColumn] || row['截面面积'] || row['面积'] || row['CrossSection'] || row.crossSection || 0),
        componentNumber: row['构件编号'] || row['ComponentNumber'] || row.componentNumber || '',
        specification: row['规格'] || row['Specification'] || row.specification || '',
        partNumber: row['部件编号'] || row['PartNumber'] || row.partNumber || '',
        material: row['材质'] || row['Material'] || row.material || '',
        note: row['备注'] || row['Note'] || row.note || ''
      };

      // 调试前3行的详细解析结果
      if (index < 3) {
        console.log(`第${index + 1}行解析结果:`, {
          原始数据: row,
          解析结果: steel,
          长度来源: lengthColumn || '未找到',
          数量来源: quantityColumn || '未找到',
          截面面积来源: crossSectionColumn || '未找到',
          使用的列名: {
            长度: lengthColumn,
            数量: quantityColumn,
            截面面积: crossSectionColumn
          }
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