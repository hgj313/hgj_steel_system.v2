const XLSX = require('xlsx');

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

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { results, moduleSteels, designSteels } = JSON.parse(event.body);

    if (!results || !results.solutions) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '缺少结果数据' })
      };
    }

    // 建立规格映射
    const crossSectionToSpecMapping = buildCrossSectionToSpecMapping(designSteels);

    // 创建工作簿
    const workbook = XLSX.utils.book_new();

    // 创建模数钢材采购清单工作表 - 使用正确的规格信息
    const moduleUsageStats = {};
    
    Object.entries(results.solutions).forEach(([crossSection, solution]) => {
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

    const purchaseData = [];
    purchaseData.push(['钢材规格', '模数钢材长度 (mm)', '采购数量 (钢材条数)', '总长度 (mm)', '截面面积 (mm²)', '采购建议']);

    // 按规格和长度排序
    const sortedStats = Object.values(moduleUsageStats).sort((a, b) => {
      if (a.specification !== b.specification) {
        return a.specification.localeCompare(b.specification);
      }
      return a.length - b.length;
    });

    sortedStats.forEach(stat => {
      purchaseData.push([
        stat.specification,
        stat.length,
        `${stat.count} 根`,
        stat.totalLength,
        stat.crossSection,
        `需采购 ${stat.count} 根钢材，每根长度 ${stat.length.toLocaleString()}mm`
      ]);
    });

    // 按规格分组添加小计
    const specificationTotals = {};
    sortedStats.forEach(stat => {
      if (!specificationTotals[stat.specification]) {
        specificationTotals[stat.specification] = { count: 0, totalLength: 0 };
      }
      specificationTotals[stat.specification].count += stat.count;
      specificationTotals[stat.specification].totalLength += stat.totalLength;
    });

    // 添加规格小计
    Object.entries(specificationTotals).forEach(([specification, totals]) => {
      if (Object.keys(specificationTotals).length > 1) { // 只有多个规格时才显示小计
        purchaseData.push([
          `${specification} 小计`,
          '-',
          `${totals.count} 根`,
          totals.totalLength,
          '-',
          ''
        ]);
      }
    });

    // 添加总计行
    const grandTotal = sortedStats.reduce((acc, stat) => ({
      count: acc.count + stat.count,
      totalLength: acc.totalLength + stat.totalLength
    }), { count: 0, totalLength: 0 });

    purchaseData.push([
      '总计',
      '-',
      `${grandTotal.count} 根`,
      grandTotal.totalLength,
      '-',
      ''
    ]);

    const purchaseSheet = XLSX.utils.aoa_to_sheet(purchaseData);
    XLSX.utils.book_append_sheet(workbook, purchaseSheet, '模数钢材采购清单');

    // 创建简化的汇总信息工作表
    const summaryData = [];
    summaryData.push(['项目', '数值']);
    summaryData.push(['总损耗率(%)', (results.totalLossRate || 0).toFixed(2)]);
    summaryData.push(['模数钢材使用量(根)', results.totalModuleUsed || 0]);
    summaryData.push(['总废料长度(mm)', results.totalWaste || 0]);

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, '汇总信息');

    // 转换为buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const base64 = buffer.toString('base64');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: base64,
        filename: `模数钢材采购清单_${new Date().toISOString().slice(0, 10)}.xlsx`,
        message: 'Excel文件生成成功'
      })
    };
  } catch (error) {
    console.error('Excel导出错误:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Excel导出失败',
        details: error.message 
      })
    };
  }
}; 