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

    const totalLossRate = totalMaterial > 0 ? (totalWaste / totalMaterial) * 100 : 0;
    const executionTime = Date.now() - this.startTime;

    return {
      solutions,
      totalLossRate: parseFloat(totalLossRate.toFixed(2)),
      totalModuleUsed,
      totalWaste,
      totalMaterial,
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
    cuts.forEach(cut => {
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
    cuts.forEach(cut => {
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

    const optimizer = new SteelOptimizer(
      designSteels,
      moduleSteels,
      wasteThreshold || 500,
      expectedLossRate || 5,
      timeLimit || 60000
    );

    const result = optimizer.optimize();

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