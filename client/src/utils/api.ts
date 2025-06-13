import axios from 'axios';
import {
  DesignSteel,
  ModuleSteel,
  OptimizationResult,
  OptimizationParams,
  UploadResponse,
  ExportResponse,
  SmartOptimizationParams,
  SmartOptimizationResult,
  SmartOptimizationProgress
} from '../types';

// 创建axios实例
const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5000/api',
  timeout: 300000, // 5分钟超时
});

// 上传设计钢材Excel文件
export const uploadDesignSteels = async (fileData: { filename: string; data: string; type: string } | File): Promise<UploadResponse> => {
  if (fileData instanceof File) {
    // 兼容原来的File对象（本地开发）
    const formData = new FormData();
    formData.append('file', fileData);
    
    const response = await api.post('/upload-design-steels', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  } else {
    // 新的JSON格式（Netlify部署）
    const response = await api.post('/upload-design-steels', fileData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return response.data;
  }
};

// 执行优化计算
export const optimizeSteel = async (
  designSteels: DesignSteel[],
  moduleSteels: ModuleSteel[],
  params: OptimizationParams
): Promise<OptimizationResult> => {
  const response = await api.post('/optimize', {
    designSteels,
    moduleSteels,
    wasteThreshold: params.wasteThreshold,
    expectedLossRate: params.expectedLossRate,
    timeLimit: params.timeLimit,
  });
  
  return response.data;
};

// 智能优化预估
export const smartOptimizeEstimate = async (
  designSteels: DesignSteel[],
  params: SmartOptimizationParams
): Promise<{
  candidateSpecs: any[];
  estimatedTime: number;
  totalCombinations: number;
  dataWarning?: string;
}> => {
  const response = await api.post('/smart-optimize-estimate', {
    designSteels,
    params
  });
  return response.data;
};

// 开始智能优化
export const smartOptimizeStart = async (
  designSteels: DesignSteel[],
  params: SmartOptimizationParams
): Promise<{ success: boolean; message: string }> => {
  const response = await api.post('/smart-optimize-start', {
    designSteels,
    params
  });
  return response.data;
};

// 获取智能优化进度
export const smartOptimizeProgress = async (): Promise<SmartOptimizationProgress> => {
  const response = await api.get('/smart-optimize-progress');
  return response.data;
};

// 取消智能优化
export const smartOptimizeCancel = async (): Promise<{ success: boolean; message: string }> => {
  const response = await api.post('/smart-optimize-cancel');
  return response.data;
};

// 获取智能优化结果
export const smartOptimizeResult = async (): Promise<SmartOptimizationResult> => {
  const response = await api.get('/smart-optimize-result');
  return response.data;
};

// 导出结果为Excel
export const exportToExcel = async (results: OptimizationResult, moduleSteels?: ModuleSteel[]): Promise<ExportResponse> => {
  const response = await api.post('/export-excel', { results, moduleSteels });
  return response.data;
};

// 导出结果为PDF
export const exportToPDF = async (results: OptimizationResult, designSteels: DesignSteel[], moduleSteels?: ModuleSteel[]): Promise<ExportResponse> => {
  const response = await api.post('/export-pdf', { results, designSteels, moduleSteels });
  return response.data;
};

// 下载文件 - 支持Netlify部署
export const downloadFile = (response: any) => {
  if (response.htmlContent && response.filename) {
    // PDF HTML内容，在新窗口中打开并触发打印
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(response.htmlContent);
      printWindow.document.close();
      
      // 等待内容加载完成后触发打印
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    }
  } else if (response.data && response.filename) {
    // Netlify Functions返回base64数据（Excel文件）
    const byteCharacters = atob(response.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = response.filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 100);
  } else if (response.downloadUrl || response.fileName) {
    // 传统下载URL方式（本地开发）
    const baseURL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';
    const fullUrl = response.downloadUrl?.startsWith('/') ? `${baseURL}${response.downloadUrl}` : response.downloadUrl;
    
    const link = document.createElement('a');
    link.href = fullUrl;
    link.download = response.fileName || '';
    link.target = '_blank';
    link.style.display = 'none';
    
    document.body.appendChild(link);
    setTimeout(() => {
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
    }, 10);
  }
}; 