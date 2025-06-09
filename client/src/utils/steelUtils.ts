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