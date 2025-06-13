const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs-extra');

const app = express();
const PORT = process.env.PORT || 5000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 确保uploads目录存在
const uploadsDir = path.join(__dirname, 'uploads');
fs.ensureDirSync(uploadsDir);

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持Excel和CSV文件格式'), false);
    }
  }
});

// 钢材优化算法类
class SteelOptimizer {
  constructor(designSteels, moduleSteels, wasteThreshold, expectedLossRate, timeLimit) {
    this.designSteels = designSteels; // [{length, quantity, crossSection, id}]
    this.moduleSteels = moduleSteels; // [{length, name}]
    this.wasteThreshold = wasteThreshold;
    this.expectedLossRate = expectedLossRate;
    this.timeLimit = timeLimit;
    this.startTime = Date.now();
    this.bestSolution = null;
    this.bestLossRate = Infinity;
    
    // 新增：余料管理系统
    this.remainderPools = {}; // 按截面面积分组的余料池
    this.moduleCounters = {}; // 模数钢材计数器
    this.remainderCounters = {}; // 余料计数器
  }

  // 按截面面积分组设计钢材
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

  // 生成模数钢材编号
  generateModuleId(crossSection) {
    if (!this.moduleCounters[crossSection]) {
      this.moduleCounters[crossSection] = 0;
    }
    this.moduleCounters[crossSection]++;
    return `M${this.moduleCounters[crossSection]}`;
  }

  // 生成余料编号
  generateRemainderIdFromSource(sourceId, crossSection) {
    if (!this.remainderCounters[crossSection]) {
      this.remainderCounters[crossSection] = { letterIndex: 0, numbers: {} };
    }
    
    const counter = this.remainderCounters[crossSection];
    const letter = String.fromCharCode(97 + counter.letterIndex); // a, b, c...
    
    if (!counter.numbers[letter]) {
      counter.numbers[letter] = 0;
    }
    counter.numbers[letter]++;
    
    // 如果当前字母用完(超过一定数量)，切换到下一字母
    if (counter.numbers[letter] > 50) {
      counter.letterIndex++;
      const newLetter = String.fromCharCode(97 + counter.letterIndex);
      counter.numbers[newLetter] = 1;
      return `${newLetter}1`;
    }
    
    return `${letter}${counter.numbers[letter]}`;
  }

  // 获取余料的最终来源
  getUltimateSource(remainder) {
    if (remainder.sourceChain && remainder.sourceChain.length > 0) {
      return remainder.sourceChain[0]; // 第一个是最终来源
    }
    return remainder.sourceId;
  }

  // 初始化余料池
  initRemainderPool(crossSection) {
    if (!this.remainderPools[crossSection]) {
      this.remainderPools[crossSection] = [];
    }
  }

  // 添加余料到池中
  addRemainderToPool(remainder, crossSection) {
    this.initRemainderPool(crossSection);
    this.remainderPools[crossSection].push(remainder);
    // 按长度降序排列，优先使用长余料
    this.remainderPools[crossSection].sort((a, b) => b.length - a.length);
  }

  // 寻找最佳余料组合
  findBestRemainderCombination(targetLength, crossSection) {
    this.initRemainderPool(crossSection);
    const pool = this.remainderPools[crossSection];
    
    // 单个余料足够
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
    
    // 两个余料组合（最多两段）
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
    
    return null; // 没有合适的余料组合
  }

  // 从余料池中移除使用的余料
  removeRemaindersFromPool(indices, crossSection) {
    // 按索引降序移除，避免索引变化问题
    indices.sort((a, b) => b - a);
    indices.forEach(index => {
      this.remainderPools[crossSection].splice(index, 1);
    });
  }

  // 为单个截面面积组计算最优切割方案
  optimizeGroup(steels, crossSection) {
    // 按长度降序排列
    steels.sort((a, b) => b.length - a.length);
    
    const solution = {
      cuttingPlans: [],
      totalModuleUsed: 0,
      totalWaste: 0,
      details: []
    };

    // 为每种设计钢材创建需求队列
    const demands = steels.map(steel => ({
      ...steel,
      remaining: steel.quantity
    }));

    // 初始化余料池
    this.initRemainderPool(crossSection);

    // 主循环：满足所有需求
    while (demands.some(d => d.remaining > 0)) {
      if (Date.now() - this.startTime > this.timeLimit) break;

      const activeDemands = demands.filter(d => d.remaining > 0);
      if (activeDemands.length === 0) break;

      // 找到最长的未满足需求
      const longestDemand = activeDemands[0];
      
      // 优先尝试使用余料
      const remainderCombination = this.findBestRemainderCombination(longestDemand.length, crossSection);
      
      let cuttingPlan;
      if (remainderCombination) {
        // 使用余料切割
        cuttingPlan = this.cutFromRemainders(remainderCombination, demands, crossSection);
        this.removeRemaindersFromPool(remainderCombination.indices, crossSection);
      } else {
        // 使用新模数钢材
        const moduleId = this.generateModuleId(crossSection);
        const bestModule = this.selectBestModule(demands);
        cuttingPlan = this.cutModule(bestModule, demands, crossSection, moduleId);
        solution.totalModuleUsed++;
        console.log(`📊 使用模数钢材: ${moduleId}, 当前总数: ${solution.totalModuleUsed}`);
      }

      solution.cuttingPlans.push(cuttingPlan);
      solution.totalWaste += cuttingPlan.waste;
      
      // 关键修复：将cuts中的每个切割记录作为单独的detail添加
      cuttingPlan.cuts.forEach(cut => {
        solution.details.push({
          sourceType: cuttingPlan.sourceType,
          sourceId: cuttingPlan.sourceDescription,
          sourceLength: cuttingPlan.sourceLength,
          moduleType: cuttingPlan.moduleType,
          moduleLength: cuttingPlan.moduleLength,
          designId: cut.designId,
          length: cut.length,
          quantity: cut.quantity
        });
        console.log(`✅ 添加详情记录: designId=${cut.designId}, quantity=${cut.quantity}`);
      });

      // 更新剩余需求
      cuttingPlan.cuts.forEach(cut => {
        const demand = demands.find(d => d.id === cut.designId);
        if (demand) {
          demand.remaining -= cut.quantity;
        }
      });

      // 处理新产生的余料
      if (cuttingPlan.newRemainders && cuttingPlan.newRemainders.length > 0) {
        cuttingPlan.newRemainders.forEach(remainder => {
          this.addRemainderToPool(remainder, crossSection);
        });
      }
    }

    // 处理剩余余料 - 检查是否过剩
    this.processExcessRemainders(solution, demands, crossSection);

    return solution;
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

  // 从余料中切割
  cutFromRemainders(remainderCombination, demands, crossSection) {
    const { remainders, totalLength, type } = remainderCombination;
    
    // 构建原料来源描述
    let sourceDescription;
    let sourceId;
    
    if (type === 'single') {
      const remainder = remainders[0];
      const ultimateSource = this.getUltimateSource(remainder);
      sourceDescription = `${remainder.id}(来自${ultimateSource})`;
      sourceId = remainder.id;
    } else {
      // 组合余料
      const sources = remainders.map(r => {
        const ultimateSource = this.getUltimateSource(r);
        return `${r.id}(来自${ultimateSource})`;
      });
      sourceDescription = sources.join('+');
      sourceId = remainders.map(r => r.id).join('+');
    }

    const plan = {
      sourceType: 'remainder',
      sourceDescription: sourceDescription,
      sourceLength: totalLength,
      cuts: [],
      newRemainders: [],
      waste: 0,
      usedRemainders: remainders
    };

    let remainingLength = totalLength;
    const activeDemands = demands.filter(d => d.remaining > 0).sort((a, b) => b.length - a.length);

    // 使用First Fit Decreasing算法
    for (const demand of activeDemands) {
      if (remainingLength >= demand.length && demand.remaining > 0) {
        const maxCuts = Math.floor(remainingLength / demand.length);
        const actualCuts = Math.min(maxCuts, demand.remaining);
        
        if (actualCuts > 0) {
          plan.cuts.push({
            designId: demand.id,
            length: demand.length,
            quantity: actualCuts
          });
          remainingLength -= demand.length * actualCuts;
        }
      }
    }

    // 处理切割后的余料
    if (remainingLength > 0) {
      if (remainingLength >= this.wasteThreshold) {
        // 生成新余料编号（继承来源）
        const newRemainderId = this.generateRemainderIdFromSource(sourceId, crossSection);
        const newRemainder = {
          id: newRemainderId,
          length: remainingLength,
          sourceId: sourceId,
          sourceChain: this.buildSourceChain(remainders),
          crossSection: crossSection
        };
        plan.newRemainders.push(newRemainder);
      } else {
        plan.waste = remainingLength;
      }
    }

    return plan;
  }

  // 构建来源链
  buildSourceChain(remainders) {
    const chains = [];
    remainders.forEach(remainder => {
      if (remainder.sourceChain && remainder.sourceChain.length > 0) {
        chains.push(...remainder.sourceChain);
      } else if (remainder.sourceId) {
        chains.push(remainder.sourceId);
      }
    });
    // 去重并返回
    return [...new Set(chains)];
  }

  // 选择最佳模数钢材
  selectBestModule(demands) {
    const activeDemands = demands.filter(d => d.remaining > 0);
    if (activeDemands.length === 0) return this.moduleSteels[0];

    // 找到最长的未满足需求
    const longestDemand = activeDemands[0];
    
    // 选择长度最接近但不小于需求的模数钢材
    let bestModule = null;
    let minWaste = Infinity;

    this.moduleSteels.forEach(module => {
      if (module.length >= longestDemand.length) {
        const waste = module.length - longestDemand.length;
        if (waste < minWaste) {
          minWaste = waste;
          bestModule = module;
        }
      }
    });

    // 如果没有找到合适的，选择最长的模数钢材
    if (!bestModule) {
      bestModule = this.moduleSteels.reduce((max, module) => 
        module.length > max.length ? module : max
      );
    }

    return bestModule;
  }

  // 切割单个模数钢材
  cutModule(module, demands, crossSection, moduleId) {
    const plan = {
      sourceType: 'module',
      sourceDescription: moduleId,
      sourceLength: module.length,
      moduleType: module.name,
      moduleLength: module.length,
      cuts: [],
      newRemainders: [],
      waste: 0
    };

    let remainingLength = module.length;
    const activeDemands = demands.filter(d => d.remaining > 0).sort((a, b) => b.length - a.length);

    // 使用First Fit Decreasing算法
    for (const demand of activeDemands) {
      if (remainingLength >= demand.length && demand.remaining > 0) {
        const maxCuts = Math.floor(remainingLength / demand.length);
        const actualCuts = Math.min(maxCuts, demand.remaining);
        
        if (actualCuts > 0) {
          plan.cuts.push({
            designId: demand.id,
            length: demand.length,
            quantity: actualCuts
          });
          remainingLength -= demand.length * actualCuts;
        }
      }
    }

    // 处理余料
    if (remainingLength > 0) {
      if (remainingLength >= this.wasteThreshold) {
        const remainderId = this.generateRemainderIdFromSource(moduleId, crossSection);
        const remainder = {
          id: remainderId,
          length: remainingLength,
          sourceId: moduleId,
          sourceChain: [moduleId],
          crossSection: crossSection
        };
        plan.newRemainders.push(remainder);
      } else {
        plan.waste = remainingLength;
      }
    }

    return plan;
  }

  // 主优化函数
  optimize() {
    const groups = this.groupByCrossSection();
    const results = {
      solutions: {},
      totalLossRate: 0,
      totalModuleUsed: 0,
      totalWaste: 0,
      totalMaterial: 0,
      executionTime: 0
    };

    for (const [crossSection, steels] of Object.entries(groups)) {
      if (Date.now() - this.startTime > this.timeLimit) break;
      
      const groupSolution = this.optimizeGroup(steels, crossSection);
      results.solutions[crossSection] = groupSolution;
      results.totalModuleUsed += groupSolution.totalModuleUsed;
      results.totalWaste += groupSolution.totalWaste;
    }

    // 计算总材料使用量
    Object.values(results.solutions).forEach(solution => {
      solution.cuttingPlans.forEach(plan => {
        if (plan.sourceType === 'module') {
          results.totalMaterial += plan.moduleLength;
        }
      });
    });

    // 调试：检查模数钢材使用统计
    console.log('🔍 模数钢材使用统计:');
    Object.entries(results.solutions).forEach(([crossSection, solution]) => {
      console.log(`截面面积 ${crossSection}: 使用 ${solution.totalModuleUsed} 根模数钢材`);
    });
    console.log(`总模数钢材使用量: ${results.totalModuleUsed}`);

    // 执行MW-CD交换优化
    this.performMWCDInterchange(results);

    // 计算损耗率
    if (results.totalMaterial > 0) {
      results.totalLossRate = (results.totalWaste / results.totalMaterial) * 100;
    }

    results.executionTime = Date.now() - this.startTime;
    return results;
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
    const originalCDPlan = solution.cuttingPlans[cd.planIndex];
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

// 智能优化器类
class SmartSteelOptimizer {
  constructor(designSteels, params) {
    this.designSteels = designSteels;
    this.params = params;
    this.standardSpecs = [3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500, 9000, 9500, 10000, 10500, 11000, 11500, 12000];
    this.candidateSpecs = [];
    this.testedCombinations = [];
    this.bestCombination = null;
    this.isCancelled = false;
    this.startTime = Date.now();
    this.progressCallback = null;
  }

  // 设置进度回调函数
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }

  // 取消优化
  cancel() {
    this.isCancelled = true;
  }

  // 智能预选候选规格
  selectCandidateSpecs() {
    const maxLength = Math.max(...this.designSteels.map(s => s.length));
    const minLength = Math.min(...this.designSteels.map(s => s.length));
    
    // 基于设计钢材长度分布智能预选
    const lowerBound = maxLength + 500; // 最大长度 + 安全余量
    const upperBound = maxLength + 4000; // 最大长度 + 4米
    
    // 筛选候选规格
    const candidates = this.standardSpecs.filter(spec => spec >= lowerBound && spec <= upperBound);
    
    // 如果候选规格太少，扩展范围
    if (candidates.length < 3) {
      const extendedCandidates = this.standardSpecs.filter(spec => spec >= maxLength + 500);
      candidates.push(...extendedCandidates.slice(0, 6 - candidates.length));
    }
    
    // 计算每个规格的优先级分数
    this.candidateSpecs = candidates.map(length => {
      let priority = 0;
      
      // 基于长度适配性计算分数
      this.designSteels.forEach(steel => {
        const utilization = steel.length / length;
        if (utilization > 0.6) priority += utilization * steel.quantity;
      });
      
      // 长度越接近理想范围，分数越高
      const idealLength = maxLength + 2000;
      const lengthScore = 1 - Math.abs(length - idealLength) / 3000;
      priority += lengthScore * 100;
      
      return {
        length,
        name: `模数-${length}`,
        priority: Math.round(priority * 100) / 100
      };
    }).sort((a, b) => b.priority - a.priority);

    return this.candidateSpecs;
  }

  // 预估计算时间
  estimateCalculationTime(strategy) {
    const designCount = this.designSteels.length;
    const candidateCount = this.candidateSpecs.length;
    
    let estimatedSeconds = 0;
    
    if (strategy === 'single-first' || strategy === 'dual-only') {
      // 单规格测试时间
      if (strategy === 'single-first') {
        estimatedSeconds += candidateCount * (designCount * 0.1); // 每个设计钢材0.1秒
      }
      
      // 双规格组合测试时间
      if (strategy === 'dual-only' || strategy === 'single-first') {
        const combinations = candidateCount * (candidateCount - 1) / 2;
        estimatedSeconds += combinations * (designCount * 0.15); // 每个设计钢材0.15秒
      }
    }
    
    return Math.max(5, Math.min(estimatedSeconds, 600)); // 最少5秒，最多600秒
  }

  // 生成测试组合
  generateTestCombinations(strategy) {
    const combinations = [];
    
    if (strategy === 'single-first') {
      // 先测试单规格
      this.candidateSpecs.forEach(spec => {
        combinations.push({ specs: [spec.length] });
      });
    }
    
    if (strategy === 'dual-only' || strategy === 'single-first') {
      // 测试双规格组合
      for (let i = 0; i < this.candidateSpecs.length; i++) {
        for (let j = i + 1; j < this.candidateSpecs.length; j++) {
          const spec1 = this.candidateSpecs[i];
          const spec2 = this.candidateSpecs[j];
          combinations.push({ 
            specs: [spec1.length, spec2.length].sort((a, b) => a - b) 
          });
        }
      }
    }
    
    return combinations;
  }

  // 测试单个组合
  async testCombination(combination) {
    if (this.isCancelled) return null;
    
    // 检查时间限制
    if (this.params.customTimeLimit) {
      const elapsed = (Date.now() - this.startTime) / 1000;
      if (elapsed > this.params.customTimeLimit) {
        this.isCancelled = true;
        return null;
      }
    }
    
    // 构建模数钢材数组
    const moduleSteels = combination.specs.map((length, index) => ({
      id: `SMART_${length}`,
      name: `智能-${length}mm`,
      length: length
    }));
    
    // 创建优化器
    const optimizer = new SteelOptimizer(
      this.designSteels,
      moduleSteels,
      this.params.wasteThreshold,
      this.params.expectedLossRate,
      30000 // 30秒单次计算限制
    );
    
    const startTime = Date.now();
    const result = optimizer.optimize();
    const executionTime = Date.now() - startTime;
    
    return {
      specs: combination.specs,
      lossRate: result.totalLossRate,
      totalModuleUsed: result.totalModuleUsed,
      totalWaste: result.totalWaste,
      executionTime: executionTime,
      result: result
    };
  }

  // 主优化函数
  async optimize() {
    try {
      // 1. 选择候选规格
      this.updateProgress('selecting', 0, 1, Infinity);
      this.selectCandidateSpecs();
      
      // 2. 预估计算时间
      const estimatedTime = this.estimateCalculationTime(this.params.strategy);
      
      // 3. 生成测试组合
      const testCombinations = this.generateTestCombinations(this.params.strategy);
      
      // 4. 开始测试
      let currentIndex = 0;
      let bestLossRate = Infinity;
      const phase = this.params.strategy === 'single-first' ? 'single' : 'dual';
      
      for (const combination of testCombinations) {
        if (this.isCancelled) break;
        
        // 更新进度
        this.updateProgress(phase, currentIndex, testCombinations.length, bestLossRate);
        
        // 测试组合
        const result = await this.testCombination(combination);
        if (result) {
          this.testedCombinations.push(result);
          
          // 更新最佳结果
          if (result.lossRate < bestLossRate) {
            bestLossRate = result.lossRate;
            this.bestCombination = result;
          }
        }
        
        currentIndex++;
        
        // 模拟异步操作，避免阻塞
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      
      // 5. 排序并返回结果
      this.testedCombinations.sort((a, b) => a.lossRate - b.lossRate);
      
      this.updateProgress('completed', testCombinations.length, testCombinations.length, bestLossRate);
      
      return {
        topCombinations: this.testedCombinations.slice(0, 5),
        bestCombination: this.bestCombination,
        totalTestedCombinations: this.testedCombinations.length,
        totalExecutionTime: Date.now() - this.startTime,
        isCancelled: this.isCancelled,
        candidateSpecs: this.candidateSpecs
      };
    } catch (error) {
      console.error('智能优化错误:', error);
      throw error;
    }
  }

  // 更新进度
  updateProgress(phase, current, total, bestLossRate) {
    if (this.progressCallback) {
      const remaining = total - current;
      const avgTimePerCombination = current > 0 ? (Date.now() - this.startTime) / current : 1000;
      const estimatedTimeRemaining = Math.round(remaining * avgTimePerCombination / 1000);
      
      this.progressCallback({
        phase,
        currentCombination: current,
        totalCombinations: total,
        bestLossRate: bestLossRate === Infinity ? 0 : bestLossRate,
        bestCombination: this.bestCombination,
        candidateSpecs: this.candidateSpecs,
        testedCombinations: this.testedCombinations.slice(0, 5),
        estimatedTimeRemaining
      });
    }
  }
}

// 全局智能优化器实例
let globalSmartOptimizer = null;

// API路由

// 上传Excel文件解析设计钢材数据
app.post('/api/upload-design-steels', (req, res) => {
  try {
    console.log('=== Excel文件上传开始 ===');
    console.log('请求类型:', req.headers['content-type']);
    console.log('请求体存在:', !!req.body);
    
    let fileBuffer;
    let filename;
    
    // 检查是否是JSON格式的base64数据 (Netlify函数格式)
    if (req.body && req.body.data && req.body.filename) {
      console.log('检测到JSON格式上传');
      filename = req.body.filename;
      const base64Data = req.body.data;
      fileBuffer = Buffer.from(base64Data, 'base64');
      console.log('Base64文件转换:', {
        filename: filename,
        originalSize: base64Data.length,
        bufferSize: fileBuffer.length
      });
    } 
    // 传统multipart文件上传
    else {
      console.log('尝试multipart文件上传');
      // 使用multer中间件
      upload.single('file')(req, res, (err) => {
        if (err) {
          console.error('Multer错误:', err);
          return res.status(400).json({ error: 'Multer文件处理错误: ' + err.message });
        }
        
        if (!req.file) {
          console.log('错误：没有收到文件');
          return res.status(400).json({ error: '请选择文件' });
        }
        
        console.log('文件信息:', {
          filename: req.file.filename,
          originalname: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        });
        
        filename = req.file.originalname;
        fileBuffer = fs.readFileSync(req.file.path);
        
        // 清理临时文件
        fs.removeSync(req.file.path);
        
        // 继续处理文件
        processExcelFile(fileBuffer, filename, res);
      });
      return; // 等待multer处理完成
    }
    
    // 直接处理JSON上传的文件
    if (fileBuffer) {
      processExcelFile(fileBuffer, filename, res);
    }
  } catch (error) {
    console.error('=== Excel文件上传错误 ===');
    console.error('错误详情:', error);
    res.status(500).json({ 
      error: '文件处理失败: ' + error.message,
      debugInfo: {
        errorType: error.name,
        errorMessage: error.message,
        errorStack: error.stack
      }
    });
  }
});

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

// 提取文件处理逻辑为独立函数
function processExcelFile(fileBuffer, filename, res) {
  try {
    console.log('=== 开始处理Excel文件 ===');
    console.log('文件名:', filename);
    console.log('文件大小:', fileBuffer.length, '字节');

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    console.log('Excel工作簿信息:', {
      sheetNames: workbook.SheetNames,
      totalSheets: workbook.SheetNames.length
    });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    console.log('使用工作表:', sheetName);

    // 获取工作表的范围
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    console.log('工作表范围:', {
      start: `${XLSX.utils.encode_col(range.s.c)}${range.s.r + 1}`,
      end: `${XLSX.utils.encode_col(range.e.c)}${range.e.r + 1}`,
      rows: range.e.r - range.s.r + 1,
      cols: range.e.c - range.s.c + 1
    });

    // 读取原始数据
    const data = XLSX.utils.sheet_to_json(worksheet);
    console.log('原始数据行数:', data.length);
    
    if (data.length > 0) {
      console.log('第一行数据:', data[0]);
      console.log('数据列名:', Object.keys(data[0]));
    }

    // 转换数据格式 - 支持多种列名格式
    const designSteels = data.map((row, index) => {
      const steel = {
        id: `design_${Date.now()}_${index}`,
        length: parseFloat(row['长度'] || row['Length'] || row.length || 0),
        quantity: parseInt(row['数量'] || row['Quantity'] || row.quantity || 0),
        crossSection: parseFloat(row['截面面积'] || row['面积'] || row['CrossSection'] || row.crossSection || 0),
        componentNumber: row['构件编号'] || row['ComponentNumber'] || row.componentNumber || '',
        specification: row['规格'] || row['Specification'] || row.specification || '',
        partNumber: row['部件编号'] || row['PartNumber'] || row.partNumber || '',
        material: row['材质'] || row['Material'] || row.material || '',
        note: row['备注'] || row['Note'] || row.note || ''
      };

      // 调试每一行的数据解析
      if (index < 3) { // 只显示前3行的详细信息
        console.log(`第${index + 1}行解析结果:`, {
          原始数据: row,
          解析结果: steel,
          长度来源: row['长度'] ? '长度' : (row['Length'] ? 'Length' : (row.length ? 'length' : '未找到')),
          数量来源: row['数量'] ? '数量' : (row['Quantity'] ? 'Quantity' : (row.quantity ? 'quantity' : '未找到')),
          截面面积来源: row['截面面积'] ? '截面面积' : (row['CrossSection'] ? 'CrossSection' : (row.crossSection ? 'crossSection' : '未找到')),
          规格来源: row['规格'] ? '规格' : (row['Specification'] ? 'Specification' : (row.specification ? 'specification' : '未找到')),
          规格内容: steel.specification
        });
      }

      return steel;
    }).filter(steel => {
      const isValid = steel.length > 0 && steel.quantity > 0;
      if (!isValid) {
        console.log('过滤掉无效数据:', steel);
      }
      return isValid;
    });

    console.log('最终有效数据:', {
      总行数: data.length,
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
    console.log('截面面积统计:', crossSectionStats);

    // 统计规格情况
    const specificationStats = {
      有规格: designSteels.filter(s => s.specification && s.specification.trim()).length,
      无规格: designSteels.filter(s => !s.specification || !s.specification.trim()).length,
      唯一规格数: [...new Set(designSteels.map(s => s.specification).filter(s => s && s.trim()))].length,
      规格列表: [...new Set(designSteels.map(s => s.specification).filter(s => s && s.trim()))].slice(0, 5)
    };
    console.log('规格统计:', specificationStats);

    // 生成显示ID (A1, A2, B1, B2...)
    const designSteelsWithDisplayIds = generateDisplayIds(designSteels);

    console.log('=== Excel文件处理完成 ===');

    res.json({ 
      designSteels: designSteelsWithDisplayIds,
      debugInfo: {
        原始行数: data.length,
        有效数据: designSteelsWithDisplayIds.length,
        截面面积统计: crossSectionStats,
        规格统计: specificationStats,
        列名信息: data.length > 0 ? Object.keys(data[0]) : [],
        示例数据: data.slice(0, 2)
      }
    });
  } catch (error) {
    console.error('=== Excel文件解析错误 ===');
    console.error('错误详情:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({ 
      error: '文件解析失败: ' + error.message,
      debugInfo: {
        errorType: error.name,
        errorMessage: error.message,
        errorStack: error.stack
      }
    });
  }
}

// 计算优化方案
app.post('/api/optimize', (req, res) => {
  try {
    const { designSteels, moduleSteels, wasteThreshold, expectedLossRate, timeLimit } = req.body;

    if (!designSteels || !moduleSteels || !designSteels.length || !moduleSteels.length) {
      return res.status(400).json({ error: '缺少必要的数据' });
    }

    const optimizer = new SteelOptimizer(
      designSteels,
      moduleSteels,
      wasteThreshold || 100,
      expectedLossRate || 5,
      (timeLimit || 30) * 1000 // 转换为毫秒
    );

    const results = optimizer.optimize();
    
    // 调试：检查最终结果中的details
    console.log('🎯 优化完成，检查最终结果:');
    Object.entries(results.solutions).forEach(([crossSection, solution]) => {
      console.log(`📊 截面面积 ${crossSection} 的详情数量:`, solution.details?.length || 0);
      if (solution.details && solution.details.length > 0) {
        console.log(`📝 前3个详情示例:`, solution.details.slice(0, 3));
      }
    });
    
    res.json(results);
  } catch (error) {
    console.error('优化计算错误:', error);
    res.status(500).json({ error: '优化计算失败: ' + error.message });
  }
});

// 智能优化预估
app.post('/api/smart-optimize/estimate', (req, res) => {
  try {
    const { designSteels, params } = req.body;

    if (!designSteels || !designSteels.length) {
      return res.status(400).json({ error: '缺少设计钢材数据' });
    }

    // 创建临时优化器进行预估
    const tempOptimizer = new SmartSteelOptimizer(designSteels, params);
    const candidateSpecs = tempOptimizer.selectCandidateSpecs();
    const estimatedTime = tempOptimizer.estimateCalculationTime(params.strategy);
    const testCombinations = tempOptimizer.generateTestCombinations(params.strategy);

    res.json({
      candidateSpecs,
      estimatedTime,
      totalCombinations: testCombinations.length,
      dataWarning: designSteels.length > 50 ? '数据量较大，建议设置较长的计算时间' : null
    });
  } catch (error) {
    console.error('智能优化预估错误:', error);
    res.status(500).json({ error: '预估计算失败: ' + error.message });
  }
});

// 开始智能优化
app.post('/api/smart-optimize/start', (req, res) => {
  try {
    const { designSteels, params } = req.body;

    if (!designSteels || !designSteels.length) {
      return res.status(400).json({ error: '缺少设计钢材数据' });
    }

    // 创建新的智能优化器
    globalSmartOptimizer = new SmartSteelOptimizer(designSteels, params);

    // 开始优化（异步）
    globalSmartOptimizer.optimize()
      .then(result => {
        // 优化完成，结果将通过进度接口获取
      })
      .catch(error => {
        console.error('智能优化执行错误:', error);
      });

    res.json({ success: true, message: '智能优化已启动' });
  } catch (error) {
    console.error('智能优化启动错误:', error);
    res.status(500).json({ error: '优化启动失败: ' + error.message });
  }
});

// 获取智能优化进度
app.get('/api/smart-optimize/progress', (req, res) => {
  try {
    if (!globalSmartOptimizer) {
      return res.json({ phase: 'not-started' });
    }

    // 创建进度快照
    const progress = {
      phase: globalSmartOptimizer.isCancelled ? 'cancelled' : 
             (globalSmartOptimizer.testedCombinations.length > 0 && 
              globalSmartOptimizer.bestCombination ? 'completed' : 'running'),
      currentCombination: globalSmartOptimizer.testedCombinations.length,
      totalCombinations: globalSmartOptimizer.candidateSpecs.length,
      bestLossRate: globalSmartOptimizer.bestCombination?.lossRate || 0,
      bestCombination: globalSmartOptimizer.bestCombination,
      candidateSpecs: globalSmartOptimizer.candidateSpecs,
      testedCombinations: globalSmartOptimizer.testedCombinations.slice(0, 5),
      estimatedTimeRemaining: 0
    };

    res.json(progress);
  } catch (error) {
    console.error('获取智能优化进度错误:', error);
    res.status(500).json({ error: '获取进度失败: ' + error.message });
  }
});

// 取消智能优化
app.post('/api/smart-optimize/cancel', (req, res) => {
  try {
    if (globalSmartOptimizer) {
      globalSmartOptimizer.cancel();
    }
    res.json({ success: true, message: '优化已取消' });
  } catch (error) {
    console.error('取消智能优化错误:', error);
    res.status(500).json({ error: '取消优化失败: ' + error.message });
  }
});

// 获取智能优化结果
app.get('/api/smart-optimize/result', (req, res) => {
  try {
    if (!globalSmartOptimizer) {
      return res.status(404).json({ error: '没有正在进行的优化' });
    }

    const result = {
      topCombinations: globalSmartOptimizer.testedCombinations.slice(0, 5),
      bestCombination: globalSmartOptimizer.bestCombination,
      totalTestedCombinations: globalSmartOptimizer.testedCombinations.length,
      totalExecutionTime: Date.now() - globalSmartOptimizer.startTime,
      isCancelled: globalSmartOptimizer.isCancelled,
      candidateSpecs: globalSmartOptimizer.candidateSpecs
    };

    res.json(result);
  } catch (error) {
    console.error('获取智能优化结果错误:', error);
    res.status(500).json({ error: '获取结果失败: ' + error.message });
  }
});

// 导出结果为Excel
app.post('/api/export/excel', (req, res) => {
  try {
    const { results, moduleSteels } = req.body;
    
    // 创建工作簿
    const wb = XLSX.utils.book_new();
    
    // 创建模数钢材采购清单工作表
    const moduleStats = {};
    Object.entries(results.solutions).forEach(([crossSection, solution]) => {
      solution.details.forEach(detail => {
        if (detail.sourceType === 'module' && detail.moduleType) {
          const key = `${detail.moduleType}_${crossSection}`;
          if (!moduleStats[key]) {
            moduleStats[key] = {
              moduleType: detail.moduleType,
              crossSection: parseInt(crossSection),
              length: detail.moduleLength || detail.sourceLength,
              count: 0,
              totalLength: 0
            };
          }
          moduleStats[key].count += 1;
          moduleStats[key].totalLength += detail.moduleLength || detail.sourceLength;
        }
      });
    });

    const purchaseData = [['钢材规格', '模数钢材长度 (mm)', '采购数量 (钢材条数)', '总长度 (mm)', '截面面积 (mm²)', '采购建议']];
    
    // 按截面面积和规格排序
    const sortedStats = Object.values(moduleStats).sort((a, b) => {
      if (a.crossSection !== b.crossSection) {
        return a.crossSection - b.crossSection;
      }
      return a.length - b.length;
    });
    
    sortedStats.forEach(stat => {
      purchaseData.push([
        stat.moduleType,
        stat.length,
        `${stat.count} 根`,
        stat.totalLength,
        stat.crossSection,
        `需采购 ${stat.count} 根钢材，每根长度 ${stat.length.toLocaleString()}mm`
      ]);
    });

    // 按规格分组添加小计
    const specGroups = {};
    sortedStats.forEach(stat => {
      const specKey = stat.moduleType.replace(/\d+$/, ''); // 去掉末尾数字得到规格组
      if (!specGroups[specKey]) {
        specGroups[specKey] = { count: 0, totalLength: 0, crossSection: stat.crossSection };
      }
      specGroups[specKey].count += stat.count;
      specGroups[specKey].totalLength += stat.totalLength;
    });

    // 添加规格小计
    Object.entries(specGroups).forEach(([spec, totals]) => {
      if (Object.keys(specGroups).length > 1) { // 只有多个规格时才显示小计
        purchaseData.push([
          `${spec} 小计`,
          '-',
          `${totals.count} 根`,
          totals.totalLength,
          totals.crossSection,
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

    const purchaseWS = XLSX.utils.aoa_to_sheet(purchaseData);
    XLSX.utils.book_append_sheet(wb, purchaseWS, '模数钢材采购清单');

    // 简化的汇总表
    const summaryData = [
      ['项目', '数值'],
      ['总损耗率(%)', results.totalLossRate.toFixed(2)],
      ['模数钢材使用量(根)', results.totalModuleUsed],
      ['总废料长度(mm)', results.totalWaste]
    ];
    const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWS, '汇总信息');

    // 生成文件
    const fileName = `module_steel_purchase_list_${Date.now()}.xlsx`;
    const filePath = path.join(uploadsDir, fileName);
    XLSX.writeFile(wb, filePath);

    res.json({ 
      success: true, 
      fileName,
      downloadUrl: `/api/download/${fileName}`
    });
  } catch (error) {
    console.error('Excel导出错误:', error);
    res.status(500).json({ error: 'Excel导出失败: ' + error.message });
  }
});

// 导出结果为PDF
app.post('/api/export/pdf', (req, res) => {
  try {
    const { results, designSteels } = req.body;
    
    if (!designSteels) {
      return res.status(400).json({ error: '缺少设计钢材数据' });
    }
    
    // 生成HTML内容
    const htmlContent = generatePDFHTML(results, designSteels);
    
    // 生成文件名
    const fileName = `design_steel_list_${Date.now()}.html`;
    const filePath = path.join(uploadsDir, fileName);
    
    // 写入HTML文件
    fs.writeFileSync(filePath, htmlContent, 'utf8');

    res.json({ 
      success: true, 
      fileName,
      downloadUrl: `/api/download/${fileName}`,
      message: '设计钢材清单已生成为HTML格式，可在浏览器中打开并打印为PDF'
    });
  } catch (error) {
    console.error('PDF导出错误:', error);
    res.status(500).json({ error: 'PDF导出失败: ' + error.message });
  }
});

// 生成PDF内容的HTML
function generatePDFHTML(results, designSteels) {
  const now = new Date();
  const reportTime = now.toLocaleString('zh-CN');
  
  // 按规格分组设计钢材
  const groupedBySpec = {};
  designSteels.forEach(steel => {
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

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>设计钢材清单</title>
  <style>
    body {
      font-family: 'Microsoft YaHei', '微软雅黑', sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
      padding: 20px;
    }
    
    .header {
      text-align: center;
      border-bottom: 3px solid #1890ff;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    
    .header h1 {
      font-size: 28px;
      color: #1890ff;
      margin-bottom: 10px;
    }
    
    .header .meta {
      color: #666;
      font-size: 14px;
    }
    
    .section {
      margin-bottom: 40px;
    }
    
    .section h2 {
      font-size: 20px;
      color: #1890ff;
      border-bottom: 2px solid #1890ff;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    
    th, td {
      border: 1px solid #d9d9d9;
      padding: 12px;
      text-align: left;
    }
    
    th {
      background: #fafafa;
      font-weight: bold;
      color: #333;
    }
    
    .summary {
      background-color: #f9f9f9;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    
    @media print {
      body {
        padding: 10px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>设计钢材清单</h1>
    <div class="meta">
      生成时间: ${reportTime}
    </div>
  </div>

  <div class="section">
    <h2>优化结果汇总</h2>
    <div class="summary">
      <table>
        <tr><td><strong>总损耗率</strong></td><td>${results.totalLossRate.toFixed(2)}%</td></tr>
        <tr><td><strong>模数钢材使用量</strong></td><td>${results.totalModuleUsed} 根</td></tr>
        <tr><td><strong>总废料长度</strong></td><td>${results.totalWaste.toLocaleString()} mm</td></tr>
      </table>
    </div>
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

</body>
</html>
  `;
}

// 文件下载
app.get('/api/download/:fileName', (req, res) => {
  const fileName = req.params.fileName;
  const filePath = path.join(uploadsDir, fileName);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath, (err) => {
      if (err) {
        console.error('下载错误:', err);
      }
      // 下载完成后删除文件
      setTimeout(() => {
        fs.removeSync(filePath);
      }, 60000); // 1分钟后删除
    });
  } else {
    res.status(404).json({ error: '文件不存在' });
  }
});

// 静态文件服务 (生产环境)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`钢材采购损耗率估算系统服务器运行在端口 ${PORT}`);
}); 