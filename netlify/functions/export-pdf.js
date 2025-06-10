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

  // 计算模数钢材采购清单
  const moduleStats = {};
  const cuttingDetails = [];
  
  Object.entries(safeSolutions).forEach(([crossSection, solution]) => {
    const crossSectionValue = parseInt(crossSection);
    
    if (solution.details && Array.isArray(solution.details)) {
      solution.details.forEach(detail => {
        if (detail.sourceType === 'module' && detail.moduleType) {
          const key = `${crossSectionValue}_${detail.moduleLength || detail.sourceLength}`;
          if (!moduleStats[key]) {
            moduleStats[key] = {
              crossSection: crossSectionValue,
              length: detail.moduleLength || detail.sourceLength,
              moduleType: detail.moduleType,
              count: 0,
              totalLength: 0
            };
          }
          moduleStats[key].count += detail.quantity;
          moduleStats[key].totalLength += (detail.moduleLength || detail.sourceLength) * detail.quantity;
        }
      });
    }

    // 收集切割详情
    if (solution.cuttingPlans && Array.isArray(solution.cuttingPlans)) {
      solution.cuttingPlans.forEach((plan, index) => {
        if (plan.sourceType === 'module') {
          cuttingDetails.push({
            crossSection: crossSectionValue,
            planIndex: index + 1,
            sourceLength: plan.sourceLength,
            moduleType: plan.moduleType || `模数-${plan.sourceLength}`,
            cuts: plan.cuts || [],
            waste: plan.waste || 0,
            utilizationRate: plan.sourceLength > 0 ? ((plan.sourceLength - (plan.waste || 0)) / plan.sourceLength * 100).toFixed(2) : 0
          });
        }
      });
    }
  });

  // 按截面面积和长度排序模数钢材
  const sortedModuleStats = Object.values(moduleStats).sort((a, b) => {
    if (a.crossSection !== b.crossSection) {
      return a.crossSection - b.crossSection;
    }
    return a.length - b.length;
  });

  // 按截面面积排序切割详情
  cuttingDetails.sort((a, b) => {
    if (a.crossSection !== b.crossSection) {
      return a.crossSection - b.crossSection;
    }
    return a.planIndex - b.planIndex;
  });

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
    <h2>模数钢材采购清单</h2>
    ${sortedModuleStats.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>截面面积 (mm²)</th>
          <th>模数类型</th>
          <th>长度 (mm)</th>
          <th>采购数量 (根)</th>
          <th>总长度 (mm)</th>
          <th>总长度 (m)</th>
        </tr>
      </thead>
      <tbody>
        ${sortedModuleStats.map(stat => `
          <tr>
            <td>${stat.crossSection}</td>
            <td>${stat.moduleType}</td>
            <td>${stat.length.toLocaleString()}</td>
            <td><strong>${stat.count}</strong></td>
            <td>${stat.totalLength.toLocaleString()}</td>
            <td>${(stat.totalLength / 1000).toFixed(2)}</td>
          </tr>
        `).join('')}
        <tr style="border-top: 2px solid #333; font-weight: bold; background-color: #f0f0f0;">
          <td colspan="3">总计</td>
          <td><strong>${sortedModuleStats.reduce((sum, stat) => sum + stat.count, 0)}</strong></td>
          <td><strong>${sortedModuleStats.reduce((sum, stat) => sum + stat.totalLength, 0).toLocaleString()}</strong></td>
          <td><strong>${(sortedModuleStats.reduce((sum, stat) => sum + stat.totalLength, 0) / 1000).toFixed(2)}</strong></td>
        </tr>
      </tbody>
    </table>
    ` : '<p style="color: #999; font-style: italic;">暂无模数钢材使用数据</p>'}
  </div>

  <div class="section">
    <h2>切割计划详情</h2>
    ${cuttingDetails.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>截面面积</th>
          <th>计划编号</th>
          <th>模数类型</th>
          <th>原材料长度</th>
          <th>切割长度</th>
          <th>废料长度</th>
          <th>利用率</th>
        </tr>
      </thead>
      <tbody>
        ${cuttingDetails.map(detail => `
          <tr>
            <td>${detail.crossSection} mm²</td>
            <td>P${detail.planIndex}</td>
            <td>${detail.moduleType}</td>
            <td>${detail.sourceLength.toLocaleString()} mm</td>
            <td>
              ${detail.cuts.length > 0 ? 
                detail.cuts.map(cut => `${cut.length}mm×${cut.quantity}`).join('<br/>') 
                : '无切割数据'}
            </td>
            <td>${detail.waste.toLocaleString()} mm</td>
            <td class="${detail.utilizationRate >= 90 ? 'satisfied' : detail.utilizationRate >= 80 ? 'status-warning' : 'unsatisfied'}">
              ${detail.utilizationRate}%
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : '<p style="color: #999; font-style: italic;">暂无切割计划数据</p>'}
  </div>

  <div class="section">
    <h2>报告说明</h2>
    <ul>
      <li><strong>优化结果汇总</strong>：显示整体优化效果和计算统计</li>
      <li><strong>需求验证表</strong>：验证所有设计钢材需求是否得到满足</li>
      <li><strong>模数钢材采购清单</strong>：按截面面积和长度分类的采购数量明细</li>
      <li><strong>切割计划详情</strong>：每根模数钢材的具体切割方案和利用率</li>
      <li>损耗率 = 废料长度 / 总材料长度 × 100%</li>
      <li>利用率颜色标识：<span class="satisfied">绿色≥90%</span>，<span class="status-warning">黄色80-89%</span>，<span class="unsatisfied">红色<80%</span></li>
      <li>建议将此报告作为采购和生产的指导文档</li>
    </ul>
  </div>
</body>
</html>`;
}