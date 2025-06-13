import React, { useState, useEffect } from 'react';
import { Layout, message, Button, Modal, Typography, Alert, Space, Card, Row, Col } from 'antd';
import { 
  BugOutlined, 
  NotificationOutlined, 
  FileExcelOutlined, 
  BulbOutlined, 
  RobotOutlined,
  CloseOutlined,
  SettingOutlined
} from '@ant-design/icons';
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

// 系统公告 - 由管理员在代码中定义
const SYSTEM_ANNOUNCEMENTS = [
  {
    id: 'welcome-2025',
    title: '欢迎使用钢材采购损耗率估算系统',
    content: '开发部门：技术部\n参与人员：黄传凯、黄国俊、杨玉麟\n版本：v2.0.0',
    type: 'info' as const,
    createdAt: '2024-06-13',
    priority: 1
  },
  {
    id: 'update-notice',
    title: '系统功能更新通知',
    content: '✨ 新功能：Excel导出现在显示准确的钢材规格名称\n📊 优化：\n1、移除了导出文件中的小计行，使报告更简洁\n2、新增规格数据代替截面信息分组使结果更清晰\n3、算法优化进一步获取更接近全局最优解的优化结果\n4、📋 增强：PDF报告新增模数钢材统计详情\n温馨提示：在在使用时如果需求不匹配请多次尝试优化直达需求被完全满足\n\n如果你在使用过程中遇到问题请将问题发送至邮箱：2486575431@qq.com',
    type: 'success' as const,
    createdAt: '2024-06-13',
    priority: 2
  }
];

const App: React.FC = () => {
  const [designSteels, setDesignSteels] = useState<DesignSteel[]>([]);
  const [moduleSteels, setModuleSteels] = useState<ModuleSteel[]>([]);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [smartOptimizationResult, setSmartOptimizationResult] = useState<SmartOptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationMode, setOptimizationMode] = useState<OptimizationMode>('manual');
  const [debugVisible, setDebugVisible] = useState(false);

  // 公告系统状态
  const [announcementVisible, setAnnouncementVisible] = useState(false);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([]);
  const [autoOpenAttempted, setAutoOpenAttempted] = useState(false);

  // 检查是否有新公告需要显示
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem('dismissed-announcements');
      let dismissedIds: string[] = [];
      
      if (dismissed) {
        try {
          const parsed = JSON.parse(dismissed);
          // 确保 dismissedIds 是数组
          if (Array.isArray(parsed)) {
            dismissedIds = parsed;
          } else {
            dismissedIds = [];
          }
        } catch (parseError) {
          console.warn('Failed to parse dismissed announcements, resetting:', parseError);
          dismissedIds = [];
          localStorage.removeItem('dismissed-announcements');
        }
      }
      
      setDismissedAnnouncements(dismissedIds);
      
      // 检查是否有未查看的公告
      const hasNewAnnouncements = SYSTEM_ANNOUNCEMENTS.some(
        announcement => !dismissedIds.includes(announcement.id)
      );
      
      if (hasNewAnnouncements && !autoOpenAttempted) {
        setAutoOpenAttempted(true);
        // 延迟显示公告，让页面先加载完成
        const timer = setTimeout(() => {
          setAnnouncementVisible(true);
        }, 1500); // 增加延迟时间确保页面完全加载
        
        // 清理定时器
        return () => clearTimeout(timer);
      }
    } catch (error) {
      console.error('Error in announcement auto-open logic:', error);
      // 如果出错，直接显示公告
      setAutoOpenAttempted(true);
      setAnnouncementVisible(true);
    }
  }, []);

  // 备用自动打开机制 - 确保公告在页面加载后显示
  useEffect(() => {
    if (!autoOpenAttempted) {
      const fallbackTimer = setTimeout(() => {
        try {
          const dismissed = localStorage.getItem('dismissed-announcements');
          let dismissedIds: string[] = [];
          if (dismissed) {
            const parsed = JSON.parse(dismissed);
            if (Array.isArray(parsed)) {
              dismissedIds = parsed;
            } else {
              dismissedIds = [];
            }
          }
          
          const hasNewAnnouncements = SYSTEM_ANNOUNCEMENTS.some(
            announcement => !dismissedIds.includes(announcement.id)
          );
          
          if (hasNewAnnouncements) {
            setAutoOpenAttempted(true);
            setAnnouncementVisible(true);
          }
        } catch (error) {
          // 如果解析失败，直接显示公告
          setAutoOpenAttempted(true);
          setAnnouncementVisible(true);
        }
      }, 2000); // 2秒后的备用检查
      
      return () => clearTimeout(fallbackTimer);
    }
  }, [autoOpenAttempted]);

  // 关闭公告并记住用户选择
  const handleCloseAnnouncement = () => {
    setAnnouncementVisible(false);
    
    // 标记当前所有公告为已查看
    const allAnnouncementIds = SYSTEM_ANNOUNCEMENTS.map(a => a.id);
    setDismissedAnnouncements(allAnnouncementIds);
    localStorage.setItem('dismissed-announcements', JSON.stringify(allAnnouncementIds));
  };

  // 显示公告
  const handleShowAnnouncement = () => {
    setAnnouncementVisible(true);
  };



  const handleOptimizationComplete = (result: OptimizationResult) => {
    setOptimizationResult(result);
    setSmartOptimizationResult(null);
    setIsOptimizing(false);
    message.success('优化计算完成！');
  };

  const handleSmartOptimizationComplete = (result: SmartOptimizationResult) => {
    setSmartOptimizationResult(result);
    setOptimizationResult(null);
    setIsOptimizing(false);
    if (result.isCancelled) {
      message.warning('智能优化已取消');
    } else {
      message.success('智能优化完成！');
    }
  };

  const handleOptimizationStart = () => {
    setIsOptimizing(true);
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
  };

  // 获取未查看的公告
  const unviewedAnnouncements = SYSTEM_ANNOUNCEMENTS.filter(
    announcement => !dismissedAnnouncements.includes(announcement.id)
  ).sort((a, b) => a.priority - b.priority);

  return (
    <Layout style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      {/* Apple-style Header */}
      <Header style={{ 
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
        padding: '0 32px',
        height: '64px',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          height: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '16px'
            }}>
              <SettingOutlined style={{ fontSize: '18px', color: 'white' }} />
            </div>
            <Title level={3} style={{ 
              margin: 0, 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 600
            }}>
              钢材采购损耗率估算系统
            </Title>
          </div>
          <Space>
            <Button 
              type="text"
              icon={<NotificationOutlined />}
              onClick={handleShowAnnouncement}
              style={{
                borderRadius: '20px',
                height: '40px',
                padding: '0 16px',
                background: unviewedAnnouncements.length > 0 ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
                border: unviewedAnnouncements.length > 0 ? '1px solid rgba(24, 144, 255, 0.3)' : 'none',
                color: unviewedAnnouncements.length > 0 ? '#1890ff' : '#666'
              }}
            >
              系统公告
              {unviewedAnnouncements.length > 0 && (
                <span style={{
                  marginLeft: '8px',
                  background: '#ff4d4f',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '2px 6px',
                  fontSize: '12px',
                  minWidth: '18px',
                  height: '18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {unviewedAnnouncements.length}
                </span>
              )}
            </Button>

          </Space>
        </div>
      </Header>

      <Content style={{ padding: '32px' }}>
        {/* Apple-style Cards Layout */}
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={8}>
            <Card 
              title={
                <Space>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <FileExcelOutlined style={{ fontSize: '14px', color: 'white' }} />
                  </div>
                  <span style={{ fontWeight: 600 }}>设计钢材数据</span>
                </Space>
              }
              style={{ 
                height: '100%',
                borderRadius: '16px',
                border: '1px solid rgba(0, 0, 0, 0.06)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)'
              }}
              headStyle={{
                borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                borderRadius: '16px 16px 0 0'
              }}
              bodyStyle={{ padding: '24px' }}
            >
              <DesignSteelManager
                designSteels={designSteels}
                onChange={setDesignSteels}
              />
              {designSteels.length > 0 && (
                <div style={{ 
                  marginTop: 16,
                  padding: '12px',
                  background: 'rgba(82, 196, 26, 0.1)',
                  borderRadius: '8px',
                  border: '1px solid rgba(82, 196, 26, 0.2)'
                }}>
                  <Text style={{ color: '#52c41a', fontWeight: 500 }}>
                    ✓ 已加载 {designSteels.length} 条设计钢材数据
                  </Text>
                </div>
              )}
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card 
              title={
                <Space>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <BulbOutlined style={{ fontSize: '14px', color: 'white' }} />
                  </div>
                  <span style={{ fontWeight: 600 }}>模数钢材配置</span>
                </Space>
              }
              style={{ 
                height: '100%',
                borderRadius: '16px',
                border: '1px solid rgba(0, 0, 0, 0.06)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)'
              }}
              headStyle={{
                borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                borderRadius: '16px 16px 0 0'
              }}
              bodyStyle={{ padding: '24px' }}
            >
              <ModuleSteelManager 
                moduleSteels={moduleSteels}
                onChange={setModuleSteels}
                optimizationMode={optimizationMode}
                smartResult={smartOptimizationResult}
              />
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card 
              title={
                <Space>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <RobotOutlined style={{ fontSize: '14px', color: 'white' }} />
                  </div>
                  <span style={{ fontWeight: 600 }}>优化计算</span>
                </Space>
              }
              style={{ 
                height: '100%',
                borderRadius: '16px',
                border: '1px solid rgba(0, 0, 0, 0.06)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)'
              }}
              headStyle={{
                borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                borderRadius: '16px 16px 0 0'
              }}
              bodyStyle={{ padding: '24px' }}
            >
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
            </Card>
          </Col>
        </Row>
        
        {/* Results Section */}
        {(optimizationResult || smartOptimizationResult) && (
          <div style={{ marginTop: '24px' }}>
            <ResultsViewer
              result={optimizationResult}
              smartResult={smartOptimizationResult}
              designSteels={designSteels}
              moduleSteels={moduleSteels}
              optimizationMode={optimizationMode}
            />
          </div>
        )}

        {/* Debug Button - Hidden */}
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

        {/* Debug Modal */}
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

      {/* Apple-style Announcement Modal */}
      <Modal
        title={null}
        open={announcementVisible}
        onCancel={handleCloseAnnouncement}
        footer={null}
        width={600}
        centered
        closeIcon={null}
        style={{
          borderRadius: '16px',
          overflow: 'hidden'
        }}
        bodyStyle={{
          padding: 0,
          borderRadius: '16px'
        }}
      >
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '24px',
          color: 'white',
          position: 'relative'
        }}>
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={handleCloseAnnouncement}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              color: 'white',
              border: 'none',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <NotificationOutlined style={{ fontSize: '24px', marginRight: '12px' }} />
            <Title level={3} style={{ color: 'white', margin: 0 }}>
              系统公告
            </Title>
          </div>
          <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '16px' }}>
            欢迎使用钢材采购损耗率估算系统
          </Text>
        </div>
        
        <div style={{ padding: '24px', maxHeight: '400px', overflowY: 'auto' }}>
          {SYSTEM_ANNOUNCEMENTS.map((announcement, index) => (
            <Alert
              key={announcement.id}
              type={announcement.type}
              message={
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '8px' }}>
                    {announcement.title}
                  </div>
                  <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '8px' }}>
                    发布时间: {announcement.createdAt}
                  </div>
                </div>
              }
              description={
                <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}>
                  {announcement.content}
                </div>
              }
              style={{ 
                marginBottom: index < SYSTEM_ANNOUNCEMENTS.length - 1 ? '16px' : 0,
                borderRadius: '8px',
                border: '1px solid rgba(0, 0, 0, 0.06)'
              }}
              showIcon
            />
          ))}
        </div>
        
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(0, 0, 0, 0.06)',
          background: 'rgba(0, 0, 0, 0.02)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <Button
            type="primary"
            onClick={handleCloseAnnouncement}
            style={{
              borderRadius: '8px',
              height: '40px',
              padding: '0 24px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none'
            }}
          >
            我知道了
          </Button>
        </div>
      </Modal>
    </Layout>
  );
};

export default App; 