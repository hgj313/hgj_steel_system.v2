const multiparty = require('multiparty');
const XLSX = require('xlsx');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // 处理multipart/form-data
    const form = new multiparty.Form();
    
    return new Promise((resolve, reject) => {
      form.parse(event, (err, fields, files) => {
        if (err) {
          resolve({
            statusCode: 400,
            body: JSON.stringify({ error: '文件上传失败' })
          });
          return;
        }

        const file = files.file[0];
        const buffer = require('fs').readFileSync(file.path);
        
        try {
          // 读取Excel文件
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(worksheet);

          // 转换数据格式
          const designSteels = data.map((row, index) => ({
            id: index + 1,
            length: parseFloat(row['长度'] || row['Length'] || row.length || 0),
            quantity: parseInt(row['数量'] || row['Quantity'] || row.quantity || 0),
            crossSection: parseFloat(row['截面面积'] || row['CrossSection'] || row.crossSection || 0),
            specification: row['规格'] || row['Specification'] || row.specification || '',
            material: row['材质'] || row['Material'] || row.material || '',
            note: row['备注'] || row['Note'] || row.note || ''
          })).filter(steel => steel.length > 0 && steel.quantity > 0);

          resolve({
            statusCode: 200,
            body: JSON.stringify({
              success: true,
              data: designSteels,
              message: `成功导入 ${designSteels.length} 条设计钢材数据`
            })
          });
        } catch (parseError) {
          resolve({
            statusCode: 400,
            body: JSON.stringify({ 
              error: '文件解析失败，请检查文件格式',
              details: parseError.message 
            })
          });
        }
      });
    });
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: '服务器内部错误',
        details: error.message 
      })
    };
  }
}; 