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

// 建立截面面积到规格的映射
function buildCrossSectionToSpecMapping(designSteels) {
  const mapping = {};
  if (designSteels && Array.isArray(designSteels)) {
    designSteels.forEach(steel => {
      if (steel.crossSection && steel.specification) {
        const crossSectionValue = Math.round(parseFloat(steel.crossSection));
        mapping[crossSectionValue] = steel.specification;
      }
    });
  }
  return mapping;
}

function generatePDFHTML(results, designSteels, moduleSteels) {
  const safeResults = results || {};
  const safeDesignSteels = designSteels || [];
  
  // 建立规格映射
  const crossSectionToSpecMapping = buildCrossSectionToSpecMapping(safeDesignSteels);
  
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

  // 计算模数钢材使用统计
  const moduleUsageStats = {};
  
  if (safeResults.solutions) {
    Object.entries(safeResults.solutions).forEach(([crossSection, solution]) => {
      const crossSectionValue = Math.round(parseFloat(crossSection));
      const specification = crossSectionToSpecMapping[crossSectionValue] || `未知规格(${crossSectionValue}mm²)`;
      
      // Count unique module steel bars by sourceId (not detail records)
      const uniqueModuleBars = {};
      
      if (solution.details && Array.isArray(solution.details)) {
        solution.details.forEach(detail => {
          // Only count raw module steel bars, ignore remainders/remnants
          if (detail.sourceType === 'module' && detail.sourceId) {
            const length = detail.moduleLength || detail.sourceLength;
            const sourceId = detail.sourceId;
            
            // Each unique sourceId represents one physical steel bar
            if (!uniqueModuleBars[sourceId]) {
              uniqueModuleBars[sourceId] = {
                length: length,
                sourceId: sourceId
              };
            }
          }
        });
      }
      
      // Group by length and count unique bars
      const moduleBarCounts = {};
      Object.values(uniqueModuleBars).forEach(bar => {
        if (!moduleBarCounts[bar.length]) {
          moduleBarCounts[bar.length] = 0;
        }
        moduleBarCounts[bar.length] += 1;
      });
      
      // Add to stats
      Object.entries(moduleBarCounts).forEach(([lengthStr, count]) => {
        const length = parseInt(lengthStr);
        const key = `${specification}_${length}`;
        if (!moduleUsageStats[key]) {
          moduleUsageStats[key] = {
            specification: specification,
            crossSection: crossSectionValue,
            length: length,
            count: 0,
            totalLength: 0
          };
        }
        moduleUsageStats[key].count += count;
        moduleUsageStats[key].totalLength += length * count;
      });
    });
  }

  // 按规格和长度排序
  const sortedModuleStats = Object.values(moduleUsageStats).sort((a, b) => {
    if (a.specification !== b.specification) {
      return a.specification.localeCompare(b.specification);
    }
    return a.length - b.length;
  });



  // 计算总计
  const grandTotal = sortedModuleStats.reduce((acc, stat) => ({
    count: acc.count + stat.count,
    totalLength: acc.totalLength + stat.totalLength
  }), { count: 0, totalLength: 0 });

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
    .summary { background-color: #f9f9f9; padding: 15px; border-radius: 5px; }
    .tag { background-color: #1890ff; color: white; padding: 2px 6px; border-radius: 3px; font-size: 12px; }

    .total-row { background-color: #e6f7ff; font-weight: bold; color: #1890ff; }
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
      </table>
    </div>
  </div>

  <div class="section">
    <h2>模数钢材统计</h2>
    <table>
      <thead>
        <tr>
          <th>钢材规格</th>
          <th>模数钢材长度 (mm)</th>
          <th>采购数量 (钢材条数)</th>
          <th>总长度 (mm)</th>
          <th>截面面积 (mm²)</th>
          <th>采购建议</th>
        </tr>
      </thead>
      <tbody>
        ${sortedModuleStats.map(stat => `
          <tr>
            <td><span class="tag">${stat.specification}</span></td>
            <td>${stat.length.toLocaleString()}</td>
            <td><strong>${stat.count} 根</strong></td>
            <td><strong>${stat.totalLength.toLocaleString()}</strong></td>
            <td>${stat.crossSection.toLocaleString()}</td>
            <td>需采购 ${stat.count} 根钢材，每根长度 ${stat.length.toLocaleString()}mm</td>
          </tr>
        `).join('')}

        <tr class="total-row">
          <td>总计</td>
          <td>-</td>
          <td><strong>${grandTotal.count} 根</strong></td>
          <td><strong>${grandTotal.totalLength.toLocaleString()}</strong></td>
          <td>-</td>
          <td>-</td>
        </tr>
      </tbody>
    </table>
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
      <li><strong>模数钢材统计</strong>：按规格分组的模数钢材采购清单，显示需要采购的钢材条数</li>
      <li><strong>设计钢材清单</strong>：按规格分组的设计钢材需求明细</li>
      <li>损耗率 = 废料长度 / 总材料长度 × 100%</li>
      <li>采购数量已考虑切割优化，每根钢材可以切割出多个设计件</li>
      <li>建议将此报告作为生产和采购的指导文档</li>
    </ul>
  </div>
</body>
</html>`;
}