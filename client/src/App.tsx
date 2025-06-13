import React, { useState } from 'react';
import { Layout, message, Button, Modal, Typography } from 'antd';
import { BugOutlined } from '@ant-design/icons';
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

const { Text, Title } = Typography;

const { Header, Content } = Layout;

const App: React.FC = () => {
  const [designSteels, setDesignSteels] = useState<DesignSteel[]>([]);
  const [moduleSteels, setModuleSteels] = useState<ModuleSteel[]>([]);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [smartOptimizationResult, setSmartOptimizationResult] = useState<SmartOptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationMode, setOptimizationMode] = useState<OptimizationMode>('manual');
  const [debugVisible, setDebugVisible] = useState(false);

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
        
        {/* 调试工具按钮 - 已隐藏 */}
        {false && (
          <Button
            type="primary"
            icon={<BugOutlined />}
            onClick={() => setDebugVisible(true)}
            style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 1000 }}
          >
            调试工具
          </Button>
        )}

        {/* 调试说明弹窗 */}
        <Modal
          title="系统调试说明"
          open={debugVisible}
          onCancel={() => setDebugVisible(false)}
          width={700}
          footer={
            <Button onClick={() => setDebugVisible(false)}>
              关闭
            </Button>
          }
        >
          <div>
            <Title level={4}>🔍 如何查看系统调试信息</Title>
            
            <div style={{ marginBottom: 20 }}>
              <Title level={5}>1. 打开浏览器开发者工具</Title>
              <Text>
                按 <Text code>F12</Text> 或右键页面选择 <Text code>检查</Text>，然后点击 <Text code>Console</Text> 标签
              </Text>
            </div>

            <div style={{ marginBottom: 20 }}>
              <Title level={5}>2. 查看系统日志</Title>
              <Text>
                系统会在控制台显示详细的运行信息，包括：
              </Text>
              <ul style={{ marginTop: 8 }}>
                <li>📁 Excel文件上传和解析过程</li>
                <li>📊 数据转换和验证结果</li>
                <li>⚠️ 截面面积读取问题诊断</li>
                <li>🚨 错误详情和堆栈追踪</li>
              </ul>
            </div>

            <div style={{ marginBottom: 20 }}>
              <Title level={5}>3. 上传文件时的自动提示</Title>
              <Text>
                如果截面面积读取失败，系统会：
              </Text>
              <ul style={{ marginTop: 8 }}>
                <li>🔔 自动弹出警告消息</li>
                <li>📋 显示详细的调试信息窗口</li>
                <li>💡 提供具体的修复建议</li>
              </ul>
            </div>

            <div style={{ padding: 12, backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
              <Title level={5} style={{ color: '#389e0d', marginBottom: 8 }}>💡 调试技巧</Title>
              <Text>
                • 上传Excel文件前先打开控制台<br/>
                • 注意查看以 <Text code>=== Excel文件上传开始 ===</Text> 开头的日志<br/>
                • 如果出现错误，重点关注红色的错误信息<br/>
                • 检查 <Text code>检测到的列名</Text> 是否包含截面面积相关字段
              </Text>
            </div>
          </div>
        </Modal>
      </Content>
    </Layout>
  );
};

export default App; 