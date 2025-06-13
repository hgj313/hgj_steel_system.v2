import { DesignSteel } from '../types';

// 生成设计钢材显示编号
export const generateDisplayIds = (steels: DesignSteel[]): DesignSteel[] => {
  // 按截面面积和长度排序
  const sorted = [...steels].sort((a, b) => {
    if (a.crossSection !== b.crossSection) {
      return a.crossSection - b.crossSection;
    }
    return a.length - b.length;
  });

  // 按截面面积分组
  const groups: Record<number, DesignSteel[]> = {};
  sorted.forEach(steel => {
    if (!groups[steel.crossSection]) {
      groups[steel.crossSection] = [];
    }
    groups[steel.crossSection].push(steel);
  });

  // 生成编号
  const result: DesignSteel[] = [];
  const crossSections = Object.keys(groups).map(Number).sort((a, b) => a - b);
  
  crossSections.forEach((crossSection, groupIndex) => {
    const letter = String.fromCharCode(65 + groupIndex); // A, B, C...
    const groupSteels = groups[crossSection];
    
    groupSteels.forEach((steel, itemIndex) => {
      result.push({
        ...steel,
        displayId: `${letter}${itemIndex + 1}`
      });
    });
  });

  return result;
};

// 验证设计钢材数据
export const validateDesignSteel = (steel: Partial<DesignSteel>): string | null => {
  if (!steel.length || steel.length <= 0) {
    return '长度必须大于0';
  }
  if (!steel.quantity || steel.quantity <= 0) {
    return '数量必须大于0';
  }
  if (!steel.crossSection || steel.crossSection <= 0) {
    return '截面面积必须大于0';
  }
  return null;
};

// 计算设计钢材总体积
export const calculateTotalVolume = (steels: DesignSteel[]): number => {
  return steels.reduce((total, steel) => {
    return total + steel.length * steel.quantity * steel.crossSection;
  }, 0);
};

// 按截面面积分组
export const groupByCrossSection = (steels: DesignSteel[]): Record<number, DesignSteel[]> => {
  const groups: Record<number, DesignSteel[]> = {};
  steels.forEach(steel => {
    if (!groups[steel.crossSection]) {
      groups[steel.crossSection] = [];
    }
    groups[steel.crossSection].push(steel);
  });
  return groups;
};

// 格式化数字显示
export const formatNumber = (num: number, decimals: number = 2): string => {
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

// 生成唯一ID
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// 建立规格到截面面积的映射
export const buildSpecificationMapping = (steels: DesignSteel[]): Record<string, number> => {
  const mapping: Record<string, number> = {};
  steels.forEach(steel => {
    if (steel.specification && steel.crossSection) {
      // 如果同一规格对应多个截面面积，取第一个（理论上应该一致）
      if (!mapping[steel.specification]) {
        mapping[steel.specification] = steel.crossSection;
      }
    }
  });
  return mapping;
};

// 建立截面面积到规格的反向映射
export const buildCrossSectionToSpecMapping = (steels: DesignSteel[]): Record<number, string> => {
  const mapping: Record<number, string> = {};
  
  steels.forEach(steel => {
    if (steel.specification && steel.specification.trim() && steel.crossSection) {
      // 关键修复：使用四舍五入处理浮点数精度问题
      const roundedCrossSection = Math.round(steel.crossSection);
      
      // 如果同一截面面积对应多个规格，取第一个遇到的
      if (!mapping[roundedCrossSection]) {
        mapping[roundedCrossSection] = steel.specification.trim();
        console.log(`✅ 映射建立: ${steel.crossSection}mm² (rounded to ${roundedCrossSection}) → ${steel.specification.trim()}`);
      }
    }
  });
  
  console.log('🎯 最终映射结果:', mapping);
  return mapping;
};

// 按规格分组（显示用）
export const groupBySpecification = (steels: DesignSteel[]): Record<string, DesignSteel[]> => {
  const groups: Record<string, DesignSteel[]> = {};
  steels.forEach(steel => {
    const spec = steel.specification || '未知规格';
    if (!groups[spec]) {
      groups[spec] = [];
    }
    groups[spec].push(steel);
  });
  return groups;
};

// 从优化结果中按规格重新组织数据（用于显示）
export const regroupOptimizationResultsBySpecification = (
  solutions: Record<string, any>, 
  crossSectionToSpecMapping: Record<number, string>
): Record<string, any> => {
  const specificationResults: Record<string, any> = {};
  
  Object.entries(solutions).forEach(([crossSection, solution]) => {
    // 关键修复：使用Math.round()与映射建立时保持一致
    const crossSectionValue = Math.round(parseFloat(crossSection));
    const spec = crossSectionToSpecMapping[crossSectionValue] || `未知规格(${crossSectionValue}mm²)`;
    
    console.log(`🔍 截面面积: ${crossSection} → 四舍五入: ${crossSectionValue} → 映射到规格: ${spec}`);
    
    if (!specificationResults[spec]) {
      specificationResults[spec] = {
        ...solution,
        crossSection: crossSectionValue,
        specification: spec
      };
    } else {
      // 如果同一规格有多个截面面积（理论上不应该发生），合并数据
      specificationResults[spec].cuttingPlans = [
        ...(specificationResults[spec].cuttingPlans || []),
        ...(solution.cuttingPlans || [])
      ];
      specificationResults[spec].details = [
        ...(specificationResults[spec].details || []),
        ...(solution.details || [])
      ];
      specificationResults[spec].totalWaste += solution.totalWaste || 0;
      specificationResults[spec].totalRemainder += solution.totalRemainder || 0;
    }
  });
  
  return specificationResults;
}; 