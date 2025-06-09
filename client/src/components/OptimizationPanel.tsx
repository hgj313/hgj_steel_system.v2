import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Form,
  InputNumber,
  Row,
  Col,
  message,
  Typography,
  Progress,
  Space,
  Alert,
  Switch,
  Modal,
  Radio,
  Divider,
  Tag
} from 'antd';
import { 
  PlayCircleOutlined, 
  StopOutlined, 
  RobotOutlined
} from '@ant-design/icons';
import { 
  DesignSteel, 
  ModuleSteel, 
  OptimizationResult, 
  OptimizationParams,
  OptimizationMode,
  SmartOptimizationResult,
  SmartOptimizationParams,
  SmartOptimizationProgress
} from '../types';
import { optimizeSteel, smartOptimizeEstimate, smartOptimizeStart, smartOptimizeProgress, smartOptimizeCancel, smartOptimizeResult } from '../utils/api';

const { Title, Text } = Typography;

interface Props {
  designSteels: DesignSteel[];
  moduleSteels: ModuleSteel[];
  onOptimizationStart: () => void;
  onOptimizationComplete: (result: OptimizationResult) => void;
  onSmartOptimizationComplete: (result: SmartOptimizationResult) => void;
  onOptimizationError: (error: string) => void;
  isOptimizing: boolean;
  optimizationMode: OptimizationMode;
  onModeChange: (mode: OptimizationMode) => void;
}

const OptimizationPanel: React.FC<Props> = ({
  designSteels,
  moduleSteels,
  onOptimizationStart,
  onOptimizationComplete,
  onSmartOptimizationComplete,
  onOptimizationError,
  isOptimizing,
  optimizationMode,
  onModeChange
}) => {
  const [form] = Form.useForm();
  const [progress, setProgress] = useState(0);
  const [smartProgress, setSmartProgress] = useState<SmartOptimizationProgress | null>(null);
  const [isStrategyModalVisible, setIsStrategyModalVisible] = useState(false);
  const [estimationData, setEstimationData] = useState<any>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<'single-first' | 'dual-only'>('single-first');
  const [customTimeLimit, setCustomTimeLimit] = useState<number>(600); // 默认10分钟

  // 智能优化进度轮询
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isOptimizing && optimizationMode === 'smart') {
      interval = setInterval(async () => {
        try {
          const progressData = await smartOptimizeProgress();
          setSmartProgress(progressData);
          
          if (progressData.phase === 'completed' || progressData.phase === 'cancelled') {
            clearInterval(interval);
            const result = await smartOptimizeResult();
            onSmartOptimizationComplete(result);
          }
        } catch (error) {
          console.error('获取智能优化进度失败:', error);
        }
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOptimizing, optimizationMode, onSmartOptimizationComplete]);

  // 开始手动优化
  const handleOptimize = async (values: OptimizationParams) => {
    if (designSteels.length === 0) {
      message.error('请先添加设计钢材数据');
      return;
    }

    if (moduleSteels.length === 0) {
      message.error('请先添加模数钢材数据');
      return;
    }

    onOptimizationStart();
    setProgress(0);

    try {
      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.random() * 10;
        });
      }, 500);

      const result = await optimizeSteel(designSteels, moduleSteels, values);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      setTimeout(() => {
        onOptimizationComplete(result);
        setProgress(0);
      }, 500);

    } catch (error: any) {
      setProgress(0);
      const errorMessage = error.response?.data?.error || error.message || '优化计算失败';
      onOptimizationError(errorMessage);
    }
  };

  // 开始智能优化
  const handleSmartOptimize = async () => {
    if (designSteels.length === 0) {
      message.error('请先添加设计钢材数据');
      return;
    }

    // 先进行预估
    try {
      const formValues = form.getFieldsValue();
      const params: SmartOptimizationParams = {
        ...formValues,
        strategy: selectedStrategy,
        customTimeLimit: customTimeLimit
      };

      const estimation = await smartOptimizeEstimate(designSteels, params);
      setEstimationData(estimation);

      if (estimation.dataWarning) {
        message.warning(estimation.dataWarning);
      }

      // 显示策略选择对话框
      setIsStrategyModalVisible(true);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || '预估失败';
      onOptimizationError(errorMessage);
    }
  };

  // 确认开始智能优化
  const confirmSmartOptimize = async () => {
    setIsStrategyModalVisible(false);
    onOptimizationStart();
    setSmartProgress(null);

    try {
      const formValues = form.getFieldsValue();
      const params: SmartOptimizationParams = {
        ...formValues,
        strategy: selectedStrategy,
        customTimeLimit: customTimeLimit
      };

      await smartOptimizeStart(designSteels, params);
      message.info('智能优化已启动，正在计算中...');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || '启动失败';
      onOptimizationError(errorMessage);
    }
  };

  // 取消智能优化
  const handleCancelSmartOptimize = async () => {
    try {
      await smartOptimizeCancel();
      message.info('智能优化已取消');
    } catch (error: any) {
      console.error('取消智能优化失败:', error);
    }
  };

  // 验证设计钢材数量
  const validateRequirements = () => {
    const totalQuantity = designSteels.reduce((sum, steel) => sum + steel.quantity, 0);
    const uniqueCrossSections = new Set(designSteels.map(steel => steel.crossSection)).size;
    const avgLength = designSteels.reduce((sum, steel) => sum + steel.length, 0) / designSteels.length;

    return {
      totalQuantity,
      uniqueCrossSections,
      avgLength: Math.round(avgLength),
      totalDesignTypes: designSteels.length
    };
  };

  const stats = designSteels.length > 0 ? validateRequirements() : null;

  return (
    <Card className="section-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>优化参数设置</Title>
        <Space>
          <Text>模式:</Text>
          <Switch
            checked={optimizationMode === 'smart'}
            onChange={(checked) => onModeChange(checked ? 'smart' : 'manual')}
            checkedChildren={<><RobotOutlined /> 智能</>}
            unCheckedChildren="手动"
            disabled={isOptimizing}
          />
        </Space>
      </div>

      {optimizationMode === 'smart' && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="智能优化模式"
          description="系统将自动计算最优的1-2种模数钢材规格组合，无需手动指定模数钢材。"
          icon={<RobotOutlined />}
        />
      )}
      
      {stats && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="当前数据概览"
          description={
            <div>
              <Text>设计钢材类型: {stats.totalDesignTypes} 种</Text><br />
              <Text>总需求数量: {stats.totalQuantity.toLocaleString()} 件</Text><br />
              <Text>截面类型: {stats.uniqueCrossSections} 种</Text><br />
              <Text>平均长度: {stats.avgLength.toLocaleString()} mm</Text><br />
              {optimizationMode === 'manual' && (
                <Text>模数钢材类型: {moduleSteels.length} 种</Text>
              )}
            </div>
          }
        />
      )}

      {optimizationMode === 'smart' && (
        <Row gutter={24} style={{ marginBottom: 16 }}>
          <Col xs={24} md={12}>
            <Card size="small" title="时间限制设置">
              <Space>
                <Text>自定义时间限制:</Text>
                <InputNumber
                  value={customTimeLimit}
                  onChange={(value) => setCustomTimeLimit(value || 600)}
                  min={60}
                  max={3600}
                  step={60}
                  addonAfter="秒"
                  style={{ width: 120 }}
                />
              </Space>
            </Card>
          </Col>
        </Row>
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={optimizationMode === 'smart' ? handleSmartOptimize : handleOptimize}
        initialValues={{
          wasteThreshold: 100,
          expectedLossRate: 5,
          timeLimit: 30
        }}
      >
        <Row gutter={24}>
          <Col xs={24} md={8}>
            <Form.Item
              label="废料阈值 S (mm)"
              name="wasteThreshold"
              tooltip="余料长度小于此值时视为废料"
              rules={[
                { required: true, message: '请输入废料阈值' },
                { type: 'number', min: 1, message: '废料阈值必须大于0' }
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="100"
                min={1}
                precision={0}
                addonAfter="mm"
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item
              label="期望损耗率 (%)"
              name="expectedLossRate"
              tooltip="作为算法优化目标的参考值"
              rules={[
                { required: true, message: '请输入期望损耗率' },
                { type: 'number', min: 0, max: 50, message: '期望损耗率应在0-50%之间' }
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="5"
                min={0}
                max={50}
                precision={2}
                addonAfter="%"
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item
              label="计算时间限制 (秒)"
              name="timeLimit"
              tooltip="算法最大运行时间"
              rules={[
                { required: true, message: '请输入时间限制' },
                { type: 'number', min: 5, max: 300, message: '时间限制应在5-300秒之间' }
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="30"
                min={5}
                max={300}
                precision={0}
                addonAfter="秒"
              />
            </Form.Item>
          </Col>
        </Row>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          {isOptimizing ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              {optimizationMode === 'smart' && smartProgress ? (
                <>
                  <Progress
                    percent={smartProgress.totalCombinations > 0 
                      ? Math.round((smartProgress.currentCombination / smartProgress.totalCombinations) * 100)
                      : 0}
                    status="active"
                    strokeColor={{
                      '0%': '#108ee9',
                      '100%': '#87d068',
                    }}
                  />
                  <Space direction="vertical" align="center">
                    <Text strong>
                      {smartProgress.phase === 'selecting' && '正在选择候选规格...'}
                      {smartProgress.phase === 'single' && '正在测试单规格方案...'}
                      {smartProgress.phase === 'dual' && '正在测试双规格组合...'}
                    </Text>
                    <Text type="secondary">
                      进度: {smartProgress.currentCombination}/{smartProgress.totalCombinations}
                    </Text>
                    {smartProgress.bestLossRate > 0 && (
                      <Text type="success">
                        当前最佳损耗率: {smartProgress.bestLossRate.toFixed(2)}%
                      </Text>
                    )}
                    {smartProgress.estimatedTimeRemaining > 0 && (
                      <Text type="secondary">
                        预计剩余时间: {Math.round(smartProgress.estimatedTimeRemaining / 60)}分钟
                      </Text>
                    )}
                  </Space>
                  <Button 
                    type="default" 
                    icon={<StopOutlined />}
                    onClick={handleCancelSmartOptimize}
                  >
                    停止智能优化
                  </Button>
                </>
              ) : (
                <>
                  <Progress
                    percent={Math.round(progress)}
                    status="active"
                    strokeColor={{
                      '0%': '#108ee9',
                      '100%': '#87d068',
                    }}
                  />
                  <Text type="secondary">正在计算最优切割方案...</Text>
                  <Button 
                    type="default" 
                    icon={<StopOutlined />}
                    onClick={() => window.location.reload()}
                  >
                    停止计算
                  </Button>
                </>
              )}
            </Space>
          ) : (
            <Button
              type="primary"
              size="large"
              icon={optimizationMode === 'smart' ? <RobotOutlined /> : <PlayCircleOutlined />}
              htmlType="submit"
              disabled={designSteels.length === 0 || (optimizationMode === 'manual' && moduleSteels.length === 0)}
            >
              {optimizationMode === 'smart' ? '开始智能优化' : '开始优化计算'}
            </Button>
          )}
        </div>
      </Form>

      {/* 智能优化策略选择对话框 */}
      <Modal
        title="智能优化策略选择"
        open={isStrategyModalVisible}
        onCancel={() => setIsStrategyModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsStrategyModalVisible(false)}>
            取消
          </Button>,
          <Button key="ok" type="primary" onClick={confirmSmartOptimize}>
            开始优化
          </Button>
        ]}
        width={600}
      >
        {estimationData && (
          <div>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="预估结果"
              description={
                <div>
                  <Text>候选规格数量: {estimationData.candidateSpecs.length} 种</Text><br />
                  <Text>预计测试组合: {estimationData.totalCombinations} 个</Text><br />
                  <Text>预计计算时间: {Math.round(estimationData.estimatedTime / 60)} 分钟</Text>
                  {estimationData.dataWarning && (
                    <>
                      <br />
                      <Text type="warning">{estimationData.dataWarning}</Text>
                    </>
                  )}
                </div>
              }
            />

            <Divider>候选规格</Divider>
            <Space wrap style={{ marginBottom: 16 }}>
              {estimationData.candidateSpecs.map((spec: any) => (
                <Tag key={spec.length} color="blue">
                  {spec.name} (评分: {spec.priority})
                </Tag>
              ))}
            </Space>

            <Divider>优化策略</Divider>
            <Radio.Group
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
            >
              <Space direction="vertical">
                <Radio value="single-first">
                  <strong>先单规格后双规格</strong>
                  <br />
                  <Text type="secondary">先测试单规格方案，如果损耗率不理想再测试双规格组合（推荐）</Text>
                </Radio>
                <Radio value="dual-only">
                  <strong>直接双规格</strong>
                  <br />
                  <Text type="secondary">直接测试双规格组合，通常能获得更低的损耗率</Text>
                </Radio>
              </Space>
            </Radio.Group>

            <Divider>时间设置</Divider>
            <Space>
              <Text>计算时间限制:</Text>
              <InputNumber
                value={customTimeLimit}
                onChange={(value) => setCustomTimeLimit(value || 600)}
                min={60}
                max={3600}
                step={60}
                addonAfter="秒"
                style={{ width: 120 }}
              />
              <Text type="secondary">({Math.round(customTimeLimit / 60)}分钟)</Text>
            </Space>
                     </div>
         )}
       </Modal>
      </Card>
    );
  };
  
  export default OptimizationPanel; 