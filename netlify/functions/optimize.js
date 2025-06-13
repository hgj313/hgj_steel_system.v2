// 复制服务器端的优化算法类
class SteelOptimizer {
  constructor(designSteels, moduleSteels, wasteThreshold, expectedLossRate, timeLimit) {
    this.designSteels = designSteels;
    this.moduleSteels = moduleSteels;
    this.wasteThreshold = wasteThreshold;
    this.expectedLossRate = expectedLossRate;
    this.timeLimit = timeLimit;
    this.startTime = Date.now();
    this.bestSolution = null;
    this.bestLossRate = Infinity;
    
    this.remainderPools = {};
    this.moduleCounters = {};
    this.remainderCounters = {};
  }

  groupByCrossSection() {
    const groups = {};
    this.designSteels.forEach(steel => {
      if (!groups[steel.crossSection]) {
        groups[steel.crossSection] = [];
      }
      groups[steel.crossSection].push(steel);
    });
    return groups;
  }

  generateModuleId(crossSection) {
    if (!this.moduleCounters[crossSection]) {
      this.moduleCounters[crossSection] = 0;
    }
    this.moduleCounters[crossSection]++;
    return `M${this.moduleCounters[crossSection]}`;
  }

  generateRemainderIdFromSource(sourceId, crossSection) {
    if (!this.remainderCounters[crossSection]) {
      this.remainderCounters[crossSection] = { letterIndex: 0, numbers: {} };
    }
    
    const counter = this.remainderCounters[crossSection];
    const letter = String.fromCharCode(97 + counter.letterIndex);
    
    if (!counter.numbers[letter]) {
      counter.numbers[letter] = 0;
    }
    counter.numbers[letter]++;
    
    if (counter.numbers[letter] > 50) {
      counter.letterIndex++;
      const newLetter = String.fromCharCode(97 + counter.letterIndex);
      counter.numbers[newLetter] = 1;
      return `${newLetter}1`;
    }
    
    return `${letter}${counter.numbers[letter]}`;
  }

  initRemainderPool(crossSection) {
    if (!this.remainderPools[crossSection]) {
      this.remainderPools[crossSection] = [];
    }
  }

  addRemainderToPool(remainder, crossSection) {
    this.initRemainderPool(crossSection);
    this.remainderPools[crossSection].push(remainder);
    this.remainderPools[crossSection].sort((a, b) => b.length - a.length);
  }

  findBestRemainderCombination(targetLength, crossSection) {
    this.initRemainderPool(crossSection);
    const pool = this.remainderPools[crossSection];
    
    for (let i = 0; i < pool.length; i++) {
      if (pool[i].length >= targetLength) {
        return {
          type: 'single',
          remainders: [pool[i]],
          totalLength: pool[i].length,
          indices: [i]
        };
      }
    }
    
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const totalLength = pool[i].length + pool[j].length;
        if (totalLength >= targetLength) {
          return {
            type: 'combination',
            remainders: [pool[i], pool[j]],
            totalLength: totalLength,
            indices: [i, j]
          };
        }
      }
    }
    
    return null;
  }

  removeRemaindersFromPool(indices, crossSection) {
    indices.sort((a, b) => b - a);
    indices.forEach(index => {
      this.remainderPools[crossSection].splice(index, 1);
    });
  }

  // 处理过剩余料
  processExcessRemainders(solution, demands, crossSection) {
    const pool = this.remainderPools[crossSection] || [];
    
    if (pool.length > 0) {
      // 检查是否所有当前需求都已满足
      const allDemandsSatisfied = demands.every(d => d.remaining === 0);
      
      if (allDemandsSatisfied) {
        // 所有当前需求已满足，剩余的余料标记为过剩并计入废料
        // 但仍保留为余料，以备后续生产使用
        pool.forEach(remainder => {
          remainder.isExcess = true; // 标记为过剩余料
          remainder.isWasteMarked = true; // 标记为已计入废料
          solution.totalWaste += remainder.length; // 计入损耗率计算
          
          console.log(`♻️ 余料 ${remainder.id} (${remainder.length}mm) 当前生产周期未使用，计入废料但保留为余料`);
        });
        
        // 添加过剩余料信息到切割计划
        if (solution.details.length > 0) {
          const lastDetail = solution.details[solution.details.length - 1];
          if (!lastDetail.excessRemainders) {
            lastDetail.excessRemainders = [];
          }
          lastDetail.excessRemainders.push(...pool);
        }
        
        // 保留余料池不清空，以备后续生产使用
        // this.remainderPools[crossSection] = pool; // 保持不变
        
        console.log(`📊 余料处理结果 - 截面面积 ${crossSection}: ${pool.length} 个余料计入废料但保留为余料`);
      }
    }
  }

  optimize() {
    const groups = this.groupByCrossSection();
    const solutions = {};
    let totalModuleUsed = 0;
    let totalWaste = 0;
    let totalMaterial = 0;

    for (const [crossSection, steels] of Object.entries(groups)) {
      if (Date.now() - this.startTime > this.timeLimit) break;
      
      const groupResult = this.optimizeGroup(steels, crossSection);
      solutions[crossSection] = groupResult;
      totalModuleUsed += groupResult.totalModuleUsed;
      totalWaste += groupResult.totalWaste;
      
      // 计算总材料使用量（模数钢材的总长度）
      groupResult.cuttingPlans?.forEach(plan => {
        if (plan.sourceType === 'module') {
          totalMaterial += plan.sourceLength || plan.moduleLength || 0;
        }
      });
    }

    // 如果没有切割计划，基于模数钢材数量估算总材料
    if (totalMaterial === 0) {
      const avgModuleLength = this.moduleSteels.reduce((sum, m) => sum + m.length, 0) / this.moduleSteels.length || 12000;
      totalMaterial = totalModuleUsed * avgModuleLength;
    }

    // 执行MW-CD交换优化
    const optimizationResults = {
      solutions,
      totalLossRate: 0,
      totalModuleUsed,
      totalWaste,
      totalMaterial,
      executionTime: 0
    };
    
    this.performMWCDInterchange(optimizationResults);

    const finalLossRate = optimizationResults.totalMaterial > 0 ? (optimizationResults.totalWaste / optimizationResults.totalMaterial) * 100 : 0;
    const executionTime = Date.now() - this.startTime;

    return {
      solutions: optimizationResults.solutions,
      totalLossRate: parseFloat(finalLossRate.toFixed(2)),
      totalModuleUsed: optimizationResults.totalModuleUsed,
      totalWaste: optimizationResults.totalWaste,
      totalMaterial: optimizationResults.totalMaterial,
      executionTime
    };
  }

  optimizeGroup(steels, crossSection) {
    steels.sort((a, b) => b.length - a.length);
    
    const solution = {
      cuttingPlans: [],
      totalModuleUsed: 0,
      totalWaste: 0,
      details: []
    };

    const demands = steels.map(steel => ({
      ...steel,
      remaining: steel.quantity
    }));

    this.initRemainderPool(crossSection);

    while (demands.some(d => d.remaining > 0)) {
      if (Date.now() - this.startTime > this.timeLimit) break;

      const activeDemands = demands.filter(d => d.remaining > 0);
      if (activeDemands.length === 0) break;

      const longestDemand = activeDemands[0];
      const remainderCombination = this.findBestRemainderCombination(longestDemand.length, crossSection);

      if (remainderCombination) {
        this.cutFromRemainders(remainderCombination, demands, crossSection, solution);
      } else {
        const bestModule = this.selectBestModule(demands);
        if (!bestModule) break;

        const moduleId = this.generateModuleId(crossSection);
        this.cutModule(bestModule, demands, crossSection, moduleId, solution);
        solution.totalModuleUsed++;
      }
    }

    // 处理剩余的不可用余料
    this.processExcessRemainders(solution, demands, crossSection);

    return solution;
  }

  cutFromRemainders(remainderCombination, demands, crossSection, solution) {
    let availableLength = remainderCombination.totalLength;
    const cuts = [];
    const sourceChain = this.buildSourceChain(remainderCombination.remainders);

    for (const demand of demands) {
      if (demand.remaining <= 0) continue;
      if (availableLength < demand.length) break;

      const cutQuantity = Math.min(
        demand.remaining,
        Math.floor(availableLength / demand.length)
      );

      if (cutQuantity > 0) {
        cuts.push({
          designId: demand.id,
          length: demand.length,
          quantity: cutQuantity
        });

        demand.remaining -= cutQuantity;
        availableLength -= demand.length * cutQuantity;
      }
    }

    const wasteLength = availableLength < this.wasteThreshold ? availableLength : 0;
    solution.totalWaste += wasteLength;

    // 创建切割计划
    const cuttingPlan = {
      sourceType: 'remainder',
      sourceId: remainderCombination.remainders.map(r => r.id).join('+'),
      sourceDescription: `余料组合 ${remainderCombination.remainders.map(r => r.id).join('+')}`,
      sourceLength: remainderCombination.totalLength,
      cuts: cuts,
      waste: wasteLength,
      newRemainders: []
    };

    if (availableLength >= this.wasteThreshold) {
      const newRemainder = {
        id: this.generateRemainderIdFromSource(sourceChain[sourceChain.length - 1], crossSection),
        length: availableLength,
        sourceChain: sourceChain,
        generation: Math.max(...remainderCombination.remainders.map(r => r.generation || 0)) + 1
      };
      this.addRemainderToPool(newRemainder, crossSection);
      cuttingPlan.newRemainders.push(newRemainder);
    }

    solution.cuttingPlans.push(cuttingPlan);
    
    // 添加详情信息
    console.log(`🔧 余料切割 - cuts数组:`, cuts);
    cuts.forEach(cut => {
      console.log(`📝 添加余料详情:`, {
        sourceType: 'remainder',
        sourceId: cuttingPlan.sourceId,
        sourceLength: remainderCombination.totalLength,
        designId: cut.designId,
        length: cut.length,
        quantity: cut.quantity
      });
      solution.details.push({
        sourceType: 'remainder',
        sourceId: cuttingPlan.sourceId,
        sourceLength: remainderCombination.totalLength,
        designId: cut.designId,
        length: cut.length,
        quantity: cut.quantity
      });
    });

    this.removeRemaindersFromPool(remainderCombination.indices, crossSection);
  }

  buildSourceChain(remainders) {
    const chain = [];
    remainders.forEach(remainder => {
      if (remainder.sourceChain && remainder.sourceChain.length > 0) {
        chain.push(...remainder.sourceChain);
      } else {
        chain.push(remainder.sourceId || remainder.id);
      }
    });
    return [...new Set(chain)];
  }

  selectBestModule(demands) {
    const activeDemands = demands.filter(d => d.remaining > 0);
    if (activeDemands.length === 0) return null;

    const modules = this.moduleSteels.filter(m => m.length >= activeDemands[0].length);
    if (modules.length === 0) return null;

    modules.sort((a, b) => a.length - b.length);
    return modules[0];
  }

  cutModule(module, demands, crossSection, moduleId, solution) {
    let availableLength = module.length;
    const cuts = [];

    for (const demand of demands) {
      if (demand.remaining <= 0) continue;
      if (availableLength < demand.length) break;

      const cutQuantity = Math.min(
        demand.remaining,
        Math.floor(availableLength / demand.length)
      );

      if (cutQuantity > 0) {
        cuts.push({
          designId: demand.id,
          length: demand.length,
          quantity: cutQuantity
        });

        demand.remaining -= cutQuantity;
        availableLength -= demand.length * cutQuantity;
      }
    }

    const wasteLength = availableLength < this.wasteThreshold ? availableLength : 0;
    solution.totalWaste += wasteLength;

    // 创建切割计划
    const cuttingPlan = {
      sourceType: 'module',
      sourceId: moduleId,
      sourceDescription: `${module.specification || '模数钢材'} ${module.length}mm`,
      sourceLength: module.length,
      moduleType: module.specification || '标准模数',
      moduleLength: module.length,
      cuts: cuts,
      waste: wasteLength,
      newRemainders: []
    };

    if (availableLength >= this.wasteThreshold) {
      const remainder = {
        id: this.generateRemainderIdFromSource(moduleId, crossSection),
        length: availableLength,
        sourceId: moduleId,
        sourceChain: [moduleId],
        generation: 1
      };
      this.addRemainderToPool(remainder, crossSection);
      cuttingPlan.newRemainders.push(remainder);
    }

    solution.cuttingPlans.push(cuttingPlan);
    
    // 添加详情信息
    console.log(`🔧 模数切割 - cuts数组:`, cuts);
    cuts.forEach(cut => {
      console.log(`📝 添加模数详情:`, {
        sourceType: 'module',
        sourceId: moduleId,
        sourceLength: module.length,
        moduleType: module.specification || '标准模数',
        moduleLength: module.length,
        designId: cut.designId,
        length: cut.length,
        quantity: cut.quantity
      });
      solution.details.push({
        sourceType: 'module',
        sourceId: moduleId,
        sourceLength: module.length,
        moduleType: module.specification || '标准模数',
        moduleLength: module.length,
        designId: cut.designId,
        length: cut.length,
        quantity: cut.quantity
      });
    });
  }

  // MW-CD交换优化算法
  performMWCDInterchange(results) {
    console.log('🔄 开始执行MW-CD交换优化...');
    
    Object.entries(results.solutions).forEach(([crossSection, solution]) => {
      // 收集MW: 标记为余料+废料的余料
      const mwRemainders = [];
      solution.cuttingPlans.forEach((plan, planIndex) => {
        if (plan.newRemainders) {
          plan.newRemainders.forEach((remainder, remainderIndex) => {
            if (remainder.isWasteMarked) {
              mwRemainders.push({
                remainder,
                planIndex,
                remainderIndex,
                length: remainder.length
              });
            }
          });
        }
      });

      // 收集CD: 使用余料组合进行切割的计划
      const cdCombinations = [];
      solution.cuttingPlans.forEach((plan, planIndex) => {
        if (plan.sourceType === 'remainder' && plan.sourceId.includes('+')) {
          cdCombinations.push({
            plan,
            planIndex,
            totalLength: plan.sourceLength,
            cuts: plan.cuts
          });
        }
      });

      // 按长度降序排序
      mwRemainders.sort((a, b) => b.length - a.length);
      cdCombinations.sort((a, b) => b.totalLength - a.totalLength);

      console.log(`截面${crossSection}: MW数量=${mwRemainders.length}, CD数量=${cdCombinations.length}`);

      // 执行交换
      const maxInterchanges = Math.min(mwRemainders.length, cdCombinations.length);
      let interchangeCount = 0;

      for (let i = 0; i < maxInterchanges; i++) {
        const mw = mwRemainders[i];
        const cd = cdCombinations[i];

        // 检查是否可以交换 (MW长度 > CD长度)
        if (mw.length > cd.totalLength) {
          // 验证MW可以切割CD的所有设计钢材
          const totalCutLength = cd.cuts.reduce((sum, cut) => sum + (cut.length * cut.quantity), 0);
          
          if (mw.length >= totalCutLength) {
            console.log(`🔄 执行交换: MW(${mw.length}mm) ↔ CD(${cd.totalLength}mm)`);
            
            // 执行交换
            this.executeInterchange(solution, mw, cd, crossSection);
            interchangeCount++;
          }
        }
      }

      console.log(`截面${crossSection}: 完成${interchangeCount}次交换`);
    });

    // 重新计算总废料量
    this.recalculateTotalWaste(results);
  }

  // 执行单次交换
  executeInterchange(solution, mw, cd, crossSection) {
    // 1. 将MW余料转换为切割源
    const newCuttingPlan = {
      sourceType: 'remainder',
      sourceId: mw.remainder.id,
      sourceDescription: `余料 ${mw.remainder.id}`,
      sourceLength: mw.length,
      cuts: [...cd.cuts], // 复制原有的切割计划
      waste: 0,
      newRemainders: []
    };

    // 2. 计算新的余料长度
    const totalCutLength = cd.cuts.reduce((sum, cut) => sum + (cut.length * cut.quantity), 0);
    const newRemainderLength = mw.length - totalCutLength;

    // 3. 处理新余料
    if (newRemainderLength > 0) {
      if (newRemainderLength >= this.wasteThreshold) {
        // 创建新余料
        const newRemainder = {
          id: this.generateRemainderIdFromSource(mw.remainder.id, crossSection),
          length: newRemainderLength,
          sourceId: mw.remainder.id,
          sourceChain: mw.remainder.sourceChain || [mw.remainder.id],
          crossSection: crossSection,
          generation: (mw.remainder.generation || 0) + 1
        };
        newCuttingPlan.newRemainders.push(newRemainder);
      } else {
        // 标记为废料
        newCuttingPlan.waste = newRemainderLength;
      }
    }

    // 4. 将原CD组合标记为废料
    const wasteRemainder = {
      id: this.generateRemainderIdFromSource('waste_' + cd.plan.sourceId, crossSection),
      length: cd.totalLength,
      sourceId: cd.plan.sourceId,
      sourceChain: [],
      crossSection: crossSection,
      isWasteMarked: true,
      isUnusable: true
    };

    // 5. 更新解决方案
    // 替换原有的切割计划
    solution.cuttingPlans[cd.planIndex] = newCuttingPlan;
    
    // 移除原MW余料，添加废料余料
    const originalPlan = solution.cuttingPlans[mw.planIndex];
    originalPlan.newRemainders[mw.remainderIndex] = wasteRemainder;

    // 6. 更新详情记录
    this.updateDetailsAfterInterchange(solution, cd, newCuttingPlan);
  }

  // 更新详情记录
  updateDetailsAfterInterchange(solution, cd, newCuttingPlan) {
    // 移除原有的详情记录
    solution.details = solution.details.filter(detail => 
      detail.sourceId !== cd.plan.sourceId
    );

    // 添加新的详情记录
    newCuttingPlan.cuts.forEach(cut => {
      solution.details.push({
        sourceType: 'remainder',
        sourceId: newCuttingPlan.sourceId,
        sourceLength: newCuttingPlan.sourceLength,
        designId: cut.designId,
        length: cut.length,
        quantity: cut.quantity
      });
    });
  }

  // 重新计算总废料量
  recalculateTotalWaste(results) {
    results.totalWaste = 0;
    
    Object.values(results.solutions).forEach(solution => {
      solution.totalWaste = 0;
      
      solution.cuttingPlans.forEach(plan => {
        solution.totalWaste += plan.waste || 0;
        
        // 计算标记为废料的余料
        if (plan.newRemainders) {
          plan.newRemainders.forEach(remainder => {
            if (remainder.isWasteMarked && remainder.length < this.wasteThreshold) {
              solution.totalWaste += remainder.length;
            }
          });
        }
      });
      
      results.totalWaste += solution.totalWaste;
    });

    console.log(`🔄 交换后总废料量: ${results.totalWaste}mm`);
  }
}

// 生成设计钢材显示编号 (A1, A2, B1, B2...)
function generateDisplayIds(steels) {
  // 按截面面积分组
  const groups = {};
  steels.forEach(steel => {
    const crossSection = Math.round(steel.crossSection); // 四舍五入处理浮点数
    if (!groups[crossSection]) {
      groups[crossSection] = [];
    }
    groups[crossSection].push(steel);
  });

  // 按截面面积排序
  const sortedCrossSections = Object.keys(groups).map(Number).sort((a, b) => a - b);
  
  const result = [];
  sortedCrossSections.forEach((crossSection, groupIndex) => {
    const letter = String.fromCharCode(65 + groupIndex); // A, B, C...
    const groupSteels = groups[crossSection];
    
    // 按长度排序
    groupSteels.sort((a, b) => a.length - b.length);
    
    groupSteels.forEach((steel, itemIndex) => {
      result.push({
        ...steel,
        displayId: `${letter}${itemIndex + 1}` // A1, A2, B1, B2...
      });
    });
  });

  console.log('🎯 生成显示ID完成:', result.slice(0, 5).map(s => ({ id: s.id, displayId: s.displayId, crossSection: s.crossSection, length: s.length })));
  return result;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { designSteels, moduleSteels, wasteThreshold, expectedLossRate, timeLimit } = JSON.parse(event.body);

    if (!designSteels || !moduleSteels) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '缺少必要参数' })
      };
    }

    // 生成显示ID (A1, A2, B1, B2...)
    const designSteelsWithDisplayIds = generateDisplayIds(designSteels);

    const optimizer = new SteelOptimizer(
      designSteelsWithDisplayIds,
      moduleSteels,
      wasteThreshold || 500,
      expectedLossRate || 5,
      timeLimit || 60000
    );

    const result = optimizer.optimize();

    // 调试：检查最终结果中的details
    console.log('🎯 优化完成，检查最终结果:');
    Object.entries(result.solutions).forEach(([crossSection, solution]) => {
      console.log(`📊 截面面积 ${crossSection} 的详情数量:`, solution.details?.length || 0);
      if (solution.details && solution.details.length > 0) {
        console.log(`📝 前3个详情示例:`, solution.details.slice(0, 3));
      }
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: '优化计算失败',
        details: error.message 
      })
    };
  }
}; 