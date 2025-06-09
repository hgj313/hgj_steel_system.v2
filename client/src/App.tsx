import React, { useState } from 'react';
import { Layout, message } from 'antd';
import DesignSteelManager from './components/DesignSteelManager';
import ModuleSteelManager from './components/ModuleSteelManager';
import OptimizationPanel from './components/OptimizationPanel';
import ResultsViewer from './components/ResultsViewer';
import { 
  DesignSteel, 
  ModuleSteel, 
  OptimizationResult, 
  OptimizationMode,
  SmartOptimizationResult 
} from './types';
import './App.css';

const { Header, Content } = Layout;

const App: React.FC = () => {
  const [designSteels, setDesignSteels] = useState<DesignSteel[]>([]);
  const [moduleSteels, setModuleSteels] = useState<ModuleSteel[]>([]);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [smartOptimizationResult, setSmartOptimizationResult] = useState<SmartOptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationMode, setOptimizationMode] = useState<OptimizationMode>('manual');

  const handleOptimizationComplete = (result: OptimizationResult) => {
    setOptimizationResult(result);
    setSmartOptimizationResult(null); // 清除智能模式结果
    setIsOptimizing(false);
    message.success('优化计算完成！');
  };

  const handleSmartOptimizationComplete = (result: SmartOptimizationResult) => {
    setSmartOptimizationResult(result);
    setOptimizationResult(null); // 清除手动模式结果
    setIsOptimizing(false);
    if (result.isCancelled) {
      message.warning('智能优化已取消');
    } else {
      message.success('智能优化完成！');
    }
  };

  const handleOptimizationStart = () => {
    setIsOptimizing(true);
    // 根据模式清除对应的结果
    if (optimizationMode === 'manual') {
      setOptimizationResult(null);
    } else {
      setSmartOptimizationResult(null);
    }
  };

  const handleOptimizationError = (error: string) => {
    setIsOptimizing(false);
    message.error(`优化计算失败: ${error}`);
  };

  const handleModeChange = (mode: OptimizationMode) => {
    setOptimizationMode(mode);
    // 切换模式时不清除结果，允许对比
  };

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <h1>钢材采购损耗率估算系统</h1>
      </Header>
      <Content className="app-content">
        <div className="app-container">
          <DesignSteelManager
            designSteels={designSteels}
            onChange={setDesignSteels}
          />
          
          <ModuleSteelManager
            moduleSteels={moduleSteels}
            onChange={setModuleSteels}
            optimizationMode={optimizationMode}
            smartResult={smartOptimizationResult}
          />
          
          <OptimizationPanel
            designSteels={designSteels}
            moduleSteels={moduleSteels}
            onOptimizationStart={handleOptimizationStart}
            onOptimizationComplete={handleOptimizationComplete}
            onSmartOptimizationComplete={handleSmartOptimizationComplete}
            onOptimizationError={handleOptimizationError}
            isOptimizing={isOptimizing}
            optimizationMode={optimizationMode}
            onModeChange={handleModeChange}
          />
          
          {(optimizationResult || smartOptimizationResult) && (
            <ResultsViewer
              result={optimizationResult}
              smartResult={smartOptimizationResult}
              designSteels={designSteels}
              moduleSteels={moduleSteels}
              optimizationMode={optimizationMode}
            />
          )}
        </div>
      </Content>
    </Layout>
  );
};

export default App; 