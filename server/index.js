const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs-extra');

const app = express();
const PORT = process.env.PORT || 5001;

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
      }

      solution.cuttingPlans.push(cuttingPlan);
      solution.totalWaste += cuttingPlan.waste;
      solution.details.push(cuttingPlan);

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
    const allDemandsSatisfied = demands.every(d => d.remaining === 0);
    
    if (allDemandsSatisfied && pool.length > 0) {
      // 所有需求已满足，余料标记为过剩并计入废料
      pool.forEach(remainder => {
        remainder.isExcess = true;
        solution.totalWaste += remainder.length;
      });
      
      // 添加过剩余料信息到最后一个切割计划
      if (solution.details.length > 0) {
        const lastDetail = solution.details[solution.details.length - 1];
        if (!lastDetail.excessRemainders) {
          lastDetail.excessRemainders = [];
        }
        lastDetail.excessRemainders.push(...pool);
      }
      
      // 清空余料池
      this.remainderPools[crossSection] = [];
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

    // 计算损耗率
    if (results.totalMaterial > 0) {
      results.totalLossRate = (results.totalWaste / results.totalMaterial) * 100;
    }

    results.executionTime = Date.now() - this.startTime;
    return results;
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
app.post('/api/upload-design-steels', upload.single('file'), (req, res) => {
  try {
    console.log('=== Excel文件上传开始 ===');
    
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

    const filePath = req.file.path;
    console.log('文件路径:', filePath);

    const workbook = XLSX.readFile(filePath);
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
        crossSection: parseFloat(row['截面面积'] || row['CrossSection'] || row.crossSection || 0),
        specification: row['规格'] || row['Specification'] || row.specification || '',
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
          截面面积来源: row['截面面积'] ? '截面面积' : (row['CrossSection'] ? 'CrossSection' : (row.crossSection ? 'crossSection' : '未找到'))
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

    // 清理临时文件
    fs.removeSync(filePath);
    console.log('临时文件已清理');

    console.log('=== Excel文件上传完成 ===');

    res.json({ 
      designSteels,
      debugInfo: {
        原始行数: data.length,
        有效数据: designSteels.length,
        截面面积统计: crossSectionStats,
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
});

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
    
    // 统计模数钢材使用量
    const moduleUsageStats = {};
    Object.entries(results.solutions).forEach(([crossSection, solution]) => {
      solution.details.forEach(detail => {
        if (detail.sourceType === 'module' && detail.moduleType) {
          const key = `${detail.moduleType}_${crossSection}`;
          if (!moduleUsageStats[key]) {
            moduleUsageStats[key] = {
              moduleType: detail.moduleType,
              crossSection: parseInt(crossSection),
              length: detail.moduleLength || detail.sourceLength,
              count: 0,
              totalLength: 0
            };
          }
          moduleUsageStats[key].count += 1;
          moduleUsageStats[key].totalLength += detail.moduleLength || detail.sourceLength;
        }
      });
    });

    // 汇总表
    const summaryData = [
      ['项目', '数值'],
      ['总损耗率 (%)', results.totalLossRate.toFixed(2)],
      ['总模数钢材使用量', results.totalModuleUsed],
      ['总废料长度 (mm)', results.totalWaste],
      ['总材料长度 (mm)', results.totalMaterial],
      ['计算时间 (ms)', results.executionTime]
    ];
    const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWS, '汇总');

    // 模数钢材使用统计表
    const moduleStatsData = [
      ['模数钢材规格', '截面面积(mm²)', '长度(mm)', '使用数量(根)', '总长度(mm)', '备注']
    ];
    
    // 按截面面积和规格排序
    const sortedStats = Object.values(moduleUsageStats).sort((a, b) => {
      if (a.crossSection !== b.crossSection) {
        return a.crossSection - b.crossSection;
      }
      return a.length - b.length;
    });
    
    sortedStats.forEach(stat => {
      moduleStatsData.push([
        stat.moduleType,
        stat.crossSection,
        stat.length.toLocaleString(),
        stat.count,
        stat.totalLength.toLocaleString(),
        `单根长度${stat.length}mm`
      ]);
    });

    // 添加各截面合计行
    const crossSectionTotals = {};
    sortedStats.forEach(stat => {
      if (!crossSectionTotals[stat.crossSection]) {
        crossSectionTotals[stat.crossSection] = { count: 0, totalLength: 0 };
      }
      crossSectionTotals[stat.crossSection].count += stat.count;
      crossSectionTotals[stat.crossSection].totalLength += stat.totalLength;
    });

    Object.entries(crossSectionTotals).forEach(([crossSection, totals]) => {
      moduleStatsData.push([
        `截面${crossSection}小计`,
        crossSection,
        '-',
        totals.count,
        totals.totalLength.toLocaleString(),
        `截面${crossSection}mm²合计`
      ]);
    });

    // 添加总计行
    const grandTotal = sortedStats.reduce((acc, stat) => ({
      count: acc.count + stat.count,
      totalLength: acc.totalLength + stat.totalLength
    }), { count: 0, totalLength: 0 });

    moduleStatsData.push([
      '总计',
      '-',
      '-',
      grandTotal.count,
      grandTotal.totalLength.toLocaleString(),
      '所有模数钢材总计'
    ]);

    const moduleStatsWS = XLSX.utils.aoa_to_sheet(moduleStatsData);
    XLSX.utils.book_append_sheet(wb, moduleStatsWS, '模数钢材统计');

    // 为每个截面面积创建详细表
    Object.entries(results.solutions).forEach(([crossSection, solution]) => {
      const detailData = [['原料', '原料长度', '切割详情', '新余料', '废料', '过剩余料']];
      
      solution.details.forEach(detail => {
        const cuts = detail.cuts.map(c => `${c.length}mm×${c.quantity}件`).join(', ');
        const newRemainders = detail.newRemainders ? 
          detail.newRemainders.map(r => `${r.id}:${r.length}mm`).join(', ') : '';
        const excessRemainders = detail.excessRemainders ? 
          detail.excessRemainders.map(r => `${r.id}:${r.length}mm(过剩)`).join(', ') : '';
        
        detailData.push([
          detail.sourceDescription || detail.moduleType,
          detail.sourceLength || detail.moduleLength,
          cuts,
          newRemainders,
          detail.waste,
          excessRemainders
        ]);
      });

      const detailWS = XLSX.utils.aoa_to_sheet(detailData);
      XLSX.utils.book_append_sheet(wb, detailWS, `截面${crossSection}`);
    });

    // 生成文件
    const fileName = `steel_optimization_${Date.now()}.xlsx`;
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
    const { results, designSteels, moduleSteels } = req.body;
    
    // 生成HTML内容
    const htmlContent = generatePDFHTML(results, designSteels, moduleSteels);
    
    // 生成文件名
    const fileName = `steel_optimization_${Date.now()}.html`;
    const filePath = path.join(uploadsDir, fileName);
    
    // 写入HTML文件
    fs.writeFileSync(filePath, htmlContent, 'utf8');

    res.json({ 
      success: true, 
      fileName,
      downloadUrl: `/api/download/${fileName}`,
      message: 'PDF报告已生成为HTML格式，可在浏览器中打开并打印为PDF'
    });
  } catch (error) {
    console.error('PDF导出错误:', error);
    res.status(500).json({ error: 'PDF导出失败: ' + error.message });
  }
});

// 生成PDF内容的HTML
function generatePDFHTML(results, designSteels, moduleSteels) {
  const now = new Date();
  const reportTime = now.toLocaleString('zh-CN');
  
  // 计算需求满足情况
  const produced = {};
  Object.values(results.solutions).forEach(solution => {
    solution.details.forEach(detail => {
      detail.cuts.forEach(cut => {
        if (!produced[cut.designId]) {
          produced[cut.designId] = 0;
        }
        produced[cut.designId] += cut.quantity;
      });
    });
  });

  const validation = designSteels.map(steel => {
    const producedQty = produced[steel.id] || 0;
    return {
      ...steel,
      produced: producedQty,
      satisfied: producedQty === steel.quantity,
      difference: producedQty - steel.quantity
    };
  });

  const allSatisfied = validation.every(v => v.satisfied);

  // 统计模数钢材使用量
  const moduleUsageStats = {};
  Object.entries(results.solutions).forEach(([crossSection, solution]) => {
    solution.details.forEach(detail => {
      if (detail.sourceType === 'module' && detail.moduleType) {
        const key = `${detail.moduleType}_${crossSection}`;
        if (!moduleUsageStats[key]) {
          moduleUsageStats[key] = {
            moduleType: detail.moduleType,
            crossSection: parseInt(crossSection),
            length: detail.moduleLength || detail.sourceLength,
            count: 0,
            totalLength: 0
          };
        }
        moduleUsageStats[key].count += 1;
        moduleUsageStats[key].totalLength += detail.moduleLength || detail.sourceLength;
      }
    });
  });

  // 按截面面积和规格排序
  const sortedStats = Object.values(moduleUsageStats).sort((a, b) => {
    if (a.crossSection !== b.crossSection) {
      return a.crossSection - b.crossSection;
    }
    return a.length - b.length;
  });

  // 计算各截面合计
  const crossSectionTotals = {};
  sortedStats.forEach(stat => {
    if (!crossSectionTotals[stat.crossSection]) {
      crossSectionTotals[stat.crossSection] = { count: 0, totalLength: 0 };
    }
    crossSectionTotals[stat.crossSection].count += stat.count;
    crossSectionTotals[stat.crossSection].totalLength += stat.totalLength;
  });

  // 计算总计
  const grandTotal = sortedStats.reduce((acc, stat) => ({
    count: acc.count + stat.count,
    totalLength: acc.totalLength + stat.totalLength
  }), { count: 0, totalLength: 0 });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>钢材采购切割优化报告</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
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
    
    .summary-section {
      margin-bottom: 30px;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .summary-card {
      border: 1px solid #d9d9d9;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      background: #fafafa;
    }
    
    .summary-card h3 {
      font-size: 14px;
      color: #666;
      margin-bottom: 10px;
    }
    
    .summary-card .value {
      font-size: 24px;
      font-weight: bold;
      color: #1890ff;
    }
    
    .summary-card.success .value {
      color: #52c41a;
    }
    
    .summary-card.warning .value {
      color: #faad14;
    }
    
    .summary-card.error .value {
      color: #ff4d4f;
    }
    
    .status-alert {
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-weight: bold;
    }
    
    .status-alert.success {
      background: #f6ffed;
      border: 1px solid #b7eb8f;
      color: #389e0d;
    }
    
    .status-alert.warning {
      background: #fffbe6;
      border: 1px solid #ffe58f;
      color: #d48806;
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
    
    .cross-section {
      margin-bottom: 30px;
      border: 1px solid #d9d9d9;
      border-radius: 8px;
      padding: 20px;
    }
    
    .cross-section h3 {
      font-size: 18px;
      color: #333;
      margin-bottom: 15px;
      padding: 10px;
      background: #f0f0f0;
      border-radius: 4px;
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
    
    .tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      margin: 2px;
    }
    
    .tag.module {
      background: #e6f7ff;
      color: #1890ff;
      border: 1px solid #91d5ff;
    }
    
    .tag.remainder {
      background: #f6ffed;
      color: #52c41a;
      border: 1px solid #b7eb8f;
    }
    
    .tag.cut {
      background: #fff2e8;
      color: #fa8c16;
      border: 1px solid #ffd591;
    }
    
    .tag.waste {
      background: #fff1f0;
      color: #ff4d4f;
      border: 1px solid #ffccc7;
    }
    
    .requirements-table {
      margin-bottom: 20px;
    }
    
    @media print {
      body {
        padding: 10px;
      }
      
      .header {
        break-after: page;
      }
      
      .cross-section {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>钢材采购切割优化报告</h1>
    <div class="meta">
      生成时间: ${reportTime} | 系统版本: v2.0
    </div>
  </div>

  <div class="summary-section">
    <div class="status-alert ${allSatisfied ? 'success' : 'warning'}">
      ${allSatisfied ? '✓ 所有设计需求已完全满足' : '⚠ 部分设计需求未满足，请检查切割方案'}
    </div>
    
    <div class="summary-grid">
      <div class="summary-card ${results.totalLossRate < 3 ? 'success' : results.totalLossRate < 8 ? 'warning' : 'error'}">
        <h3>总损耗率</h3>
        <div class="value">${results.totalLossRate.toFixed(2)}%</div>
      </div>
      
      <div class="summary-card">
        <h3>模数钢材使用量</h3>
        <div class="value">${results.totalModuleUsed}</div>
      </div>
      
      <div class="summary-card warning">
        <h3>总废料长度</h3>
        <div class="value">${results.totalWaste.toLocaleString()}mm</div>
      </div>
      
      <div class="summary-card">
        <h3>计算时间</h3>
        <div class="value">${results.executionTime}ms</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>需求满足情况</h2>
    <table class="requirements-table">
      <thead>
        <tr>
          <th>设计钢材ID</th>
          <th>长度 (mm)</th>
          <th>需求数量</th>
          <th>生产数量</th>
          <th>满足状态</th>
          <th>差异</th>
        </tr>
      </thead>
      <tbody>
        ${validation.map(steel => `
          <tr>
            <td>${steel.displayId || steel.id}</td>
            <td>${steel.length.toLocaleString()}</td>
            <td>${steel.quantity}</td>
            <td>${steel.produced}</td>
            <td>
              <span class="tag ${steel.satisfied ? 'remainder' : 'waste'}">
                ${steel.satisfied ? '已满足' : '未满足'}
              </span>
            </td>
            <td>${steel.difference >= 0 ? '+' : ''}${steel.difference}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>模数钢材使用统计</h2>
    <table class="requirements-table">
      <thead>
        <tr>
          <th>模数钢材规格</th>
          <th>截面面积 (mm²)</th>
          <th>长度 (mm)</th>
          <th>使用数量 (根)</th>
          <th>总长度 (mm)</th>
          <th>备注</th>
        </tr>
      </thead>
      <tbody>
        ${sortedStats.map(stat => `
          <tr>
            <td>
              <span class="tag module">${stat.moduleType}</span>
            </td>
            <td>${stat.crossSection.toLocaleString()}</td>
            <td>${stat.length.toLocaleString()}</td>
            <td><strong>${stat.count}</strong></td>
            <td><strong>${stat.totalLength.toLocaleString()}</strong></td>
            <td>单根长度${stat.length.toLocaleString()}mm</td>
          </tr>
        `).join('')}
        ${Object.entries(crossSectionTotals).map(([crossSection, totals]) => `
          <tr style="background-color: #f5f5f5; font-weight: bold;">
            <td>截面${crossSection}小计</td>
            <td>${crossSection}</td>
            <td>-</td>
            <td style="color: #1890ff;">${totals.count}</td>
            <td style="color: #1890ff;">${totals.totalLength.toLocaleString()}</td>
            <td>截面${crossSection}mm²合计</td>
          </tr>
        `).join('')}
        <tr style="background-color: #e6f7ff; font-weight: bold; font-size: 16px;">
          <td><strong>总计</strong></td>
          <td>-</td>
          <td>-</td>
          <td style="color: #1890ff;"><strong>${grandTotal.count}</strong></td>
          <td style="color: #1890ff;"><strong>${grandTotal.totalLength.toLocaleString()}</strong></td>
          <td><strong>所有模数钢材总计</strong></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>各截面详细切割方案</h2>
    
    ${Object.entries(results.solutions).map(([crossSection, solution]) => {
      const totalMaterial = solution.details.reduce((sum, detail) => {
        return sum + (detail.sourceType === 'module' ? detail.sourceLength : 0);
      }, 0);
      const lossRate = totalMaterial > 0 ? (solution.totalWaste / totalMaterial) * 100 : 0;
      
      return `
        <div class="cross-section">
          <h3>截面 ${crossSection} (损耗率: ${lossRate.toFixed(2)}%)</h3>
          
          <table>
            <thead>
              <tr>
                <th>原料信息</th>
                <th>原料长度 (mm)</th>
                <th>切割详情</th>
                <th>新余料</th>
                <th>废料 (mm)</th>
              </tr>
            </thead>
            <tbody>
              ${solution.details.map(detail => `
                <tr>
                  <td>
                    <span class="tag ${detail.sourceType === 'module' ? 'module' : 'remainder'}">
                      ${detail.sourceDescription}
                    </span>
                  </td>
                  <td>${detail.sourceLength.toLocaleString()}</td>
                  <td>
                    ${detail.cuts.map(cut => {
                      const steel = designSteels.find(s => s.id === cut.designId);
                      return `<span class="tag cut">${steel?.displayId || cut.designId}: ${cut.length.toLocaleString()}mm × ${cut.quantity}件</span>`;
                    }).join(' ')}
                  </td>
                  <td>
                    ${(detail.newRemainders || []).map(remainder => 
                      `<span class="tag remainder">${remainder.id}: ${remainder.length.toLocaleString()}mm</span>`
                    ).join(' ')}
                  </td>
                  <td>
                    <span class="tag waste">${detail.waste.toLocaleString()}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('')}
  </div>

  <div class="section">
    <h2>报告说明</h2>
    <ul>
      <li><strong>损耗率计算</strong>: 废料长度 ÷ 总材料长度 × 100%</li>
      <li><strong>优化目标</strong>: 在满足所有设计需求的前提下，最小化材料损耗</li>
      <li><strong>余料管理</strong>: 系统自动管理余料库存，优先使用长余料</li>
      <li><strong>材料规格</strong>: 基于设定的模数钢材规格进行优化</li>
      <li><strong>建议</strong>: 损耗率低于3%为优秀，3-8%为良好，超过8%建议重新优化</li>
    </ul>
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