// 设计钢材类型
export interface DesignSteel {
  id: string;
  length: number;
  quantity: number;
  crossSection: number;
  displayId?: string;
}

// 模数钢材类型
export interface ModuleSteel {
  id: string;
  name: string;
  length: number;
}

// 余料类型
export interface Remainder {
  id: string;
  length: number;
  sourceId: string;
  sourceChain: string[];
  crossSection: number;
  isExcess?: boolean;
}

// 切割详情类型
export interface CuttingDetail {
  sourceType: 'module' | 'remainder';
  sourceId: string;
  sourceLength: number;
  moduleType?: string;
  moduleLength?: number;
  designId: string;
  length: number;
  quantity: number;
}

// 切割计划类型
export interface CuttingPlan {
  sourceType: 'module' | 'remainder';
  sourceDescription: string;
  sourceLength: number;
  moduleType?: string;
  moduleLength?: number;
  cuts: {
    designId: string;
    length: number;
    quantity: number;
  }[];
  newRemainders?: Remainder[];
  excessRemainders?: Remainder[];
  waste: number;
  usedRemainders?: Remainder[];
}

// 解决方案类型
export interface Solution {
  cuttingPlans: CuttingPlan[];
  totalModuleUsed: number;
  totalWaste: number;
  details: CuttingDetail[];
}

// 优化结果类型
export interface OptimizationResult {
  solutions: Record<string, Solution>;
  totalLossRate: number;
  totalModuleUsed: number;
  totalWaste: number;
  totalMaterial: number;
  executionTime: number;
}

// 参数设置类型
export interface OptimizationParams {
  wasteThreshold: number;
  expectedLossRate: number;
  timeLimit: number;
}

// 智能优化候选规格类型
export interface CandidateSpec {
  length: number;
  name: string;
  priority: number; // 优先级分数
}

// 智能优化组合类型
export interface SpecCombination {
  specs: number[]; // 模数钢材长度数组 [6000] 或 [6000, 9000]
  lossRate: number;
  totalModuleUsed: number;
  totalWaste: number;
  executionTime: number;
  result?: OptimizationResult;
}

// 智能优化进度类型
export interface SmartOptimizationProgress {
  phase: 'selecting' | 'single' | 'dual' | 'completed' | 'cancelled';
  currentCombination: number;
  totalCombinations: number;
  bestLossRate: number;
  bestCombination?: SpecCombination;
  candidateSpecs: CandidateSpec[];
  testedCombinations: SpecCombination[];
  estimatedTimeRemaining: number; // 秒
}

// 智能优化参数类型
export interface SmartOptimizationParams extends OptimizationParams {
  strategy: 'single-first' | 'dual-only'; // 优化策略
  maxSpecs: 1 | 2; // 最大规格数量
  customTimeLimit?: number; // 用户自定义时间限制
}

// 智能优化结果类型
export interface SmartOptimizationResult {
  topCombinations: SpecCombination[]; // 前5名组合
  bestCombination: SpecCombination;
  totalTestedCombinations: number;
  totalExecutionTime: number;
  isCancelled: boolean;
  candidateSpecs: CandidateSpec[];
}

// 优化模式类型
export type OptimizationMode = 'manual' | 'smart';

// API响应类型
export interface ApiResponse<T> {
  success?: boolean;
  error?: string;
  data?: T;
}

// 文件上传响应类型
export interface UploadResponse {
  designSteels: DesignSteel[];
}

// 导出响应类型
export interface ExportResponse {
  success: boolean;
  fileName: string;
  downloadUrl: string;
} 