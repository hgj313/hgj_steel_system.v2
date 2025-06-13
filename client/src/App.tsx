import React, { useState, useEffect } from 'react';
import { Layout, message, Button, Modal, Typography, Alert, Space, Input, Tag } from 'antd';
import { BugOutlined, NotificationOutlined, EditOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
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
const { TextArea } = Input;
const { Header, Content } = Layout;

// 公告接口
interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'success' | 'warning' | 'error';
  createdAt: string;
}

const App: React.FC = () => {
  const [designSteels, setDesignSteels] = useState<DesignSteel[]>([]);
  const [moduleSteels, setModuleSteels] = useState<ModuleSteel[]>([]);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [smartOptimizationResult, setSmartOptimizationResult] = useState<SmartOptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationMode, setOptimizationMode] = useState<OptimizationMode>('manual');
  const [debugVisible, setDebugVisible] = useState(false);

  // 公告系统状态
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementModalVisible, setAnnouncementModalVisible] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [announcementForm, setAnnouncementForm] = useState<{
    title: string;
    content: string;
    type: 'info' | 'success' | 'warning' | 'error';
  }>({
    title: '',
    content: '',
    type: 'info'
  });

  // 加载公告
  useEffect(() => {
    const savedAnnouncements = localStorage.getItem('steel-system-announcements');
    if (savedAnnouncements) {
      try {
        setAnnouncements(JSON.parse(savedAnnouncements));
      } catch (error) {
        console.error('Failed to load announcements:', error);
      }
    }
  }, []);

  // 保存公告
  const saveAnnouncements = (newAnnouncements: Announcement[]) => {
    setAnnouncements(newAnnouncements);
    localStorage.setItem('steel-system-announcements', JSON.stringify(newAnnouncements));
  };

  // 保存公告
  const handleSaveAnnouncement = () => {
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      message.error('请填写完整的公告信息');
      return;
    }

    const now = new Date().toLocaleString('zh-CN');
    
    if (editingAnnouncement) {
      // 编辑现有公告
      const updatedAnnouncements = announcements.map(ann => 
        ann.id === editingAnnouncement.id 
          ? { ...ann, ...announcementForm, createdAt: `${now} (已编辑)` }
          : ann
      );
      saveAnnouncements(updatedAnnouncements);
      message.success('公告已更新');
    } else {
      // 添加新公告
      const newAnnouncement: Announcement = {
        id: Date.now().toString(),
        ...announcementForm,
        createdAt: now
      };
      saveAnnouncements([newAnnouncement, ...announcements]);
      message.success('公告已添加');
    }

    // 重置表单
    setAnnouncementModalVisible(false);
    setEditingAnnouncement(null);
    setAnnouncementForm({ title: '', content: '', type: 'info' });
  };

  // 删除公告
  const handleDeleteAnnouncement = (id: string) => {
    const updatedAnnouncements = announcements.filter(ann => ann.id !== id);
    saveAnnouncements(updatedAnnouncements);
    message.success('公告已删除');
  };

  // 编辑公告
  const handleEditAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setAnnouncementForm({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type
    });
    setAnnouncementModalVisible(true);
  };

  // 添加公告
  const handleAddAnnouncement = () => {
    setEditingAnnouncement(null);
    setAnnouncementForm({ title: '', content: '', type: 'info' });
    setAnnouncementModalVisible(true);
  };

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
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Header style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
        padding: '0 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <SettingOutlined style={{ fontSize: '24px', color: 'white', marginRight: '12px' }} />
            <Title level={3} style={{ color: 'white', margin: 0 }}>
              钢材采购损耗率估算系统
            </Title>
          </div>
          <Space>
            <Button 
              type="primary" 
              ghost 
              icon={<NotificationOutlined />}
              onClick={handleAddAnnouncement}
            >
              管理公告
            </Button>
          </Space>
        </div>
      </Header>

      <Content style={{ padding: '24px' }}>
        {/* 公告区域 */}
        {announcements.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            {announcements.map(announcement => (
              <Alert
                key={announcement.id}
                type={announcement.type}
                message={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{announcement.title}</strong>
                      <div style={{ marginTop: '4px', fontSize: '12px', opacity: 0.8 }}>
                        {announcement.createdAt}
                      </div>
                    </div>
                    <Space>
                      <Button 
                        type="text" 
                        size="small" 
                        icon={<EditOutlined />}
                        onClick={() => handleEditAnnouncement(announcement)}
                      />
                      <Button 
                        type="text" 
                        size="small" 
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteAnnouncement(announcement.id)}
                      />
                    </Space>
                  </div>
                }
                description={announcement.content}
                style={{ marginBottom: '8px' }}
                showIcon
                closable
                onClose={() => handleDeleteAnnouncement(announcement.id)}
              />
            ))}
          </div>
        )}

        {/* 公告管理模态框 */}
        <Modal
          title={editingAnnouncement ? '编辑公告' : '添加公告'}
          open={announcementModalVisible}
          onOk={handleSaveAnnouncement}
          onCancel={() => {
            setAnnouncementModalVisible(false);
            setEditingAnnouncement(null);
            setAnnouncementForm({ title: '', content: '', type: 'info' });
          }}
          okText="保存"
          cancelText="取消"
        >
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>公告标题</label>
            <Input
              placeholder="请输入公告标题"
              value={announcementForm.title}
              onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>公告类型</label>
            <Space>
              {(['info', 'success', 'warning', 'error'] as const).map(type => (
                <Tag
                  key={type}
                  color={type === 'info' ? 'blue' : type === 'success' ? 'green' : type === 'warning' ? 'orange' : 'red'}
                  style={{ 
                    cursor: 'pointer',
                    border: announcementForm.type === type ? '2px solid #1890ff' : '1px solid #d9d9d9'
                  }}
                  onClick={() => setAnnouncementForm({ ...announcementForm, type })}
                >
                  {type === 'info' ? '信息' : type === 'success' ? '成功' : type === 'warning' ? '警告' : '错误'}
                </Tag>
              ))}
            </Space>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>公告内容</label>
            <TextArea
              placeholder="请输入公告内容"
              rows={4}
              value={announcementForm.content}
              onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
            />
          </div>
        </Modal>

        {/* 原有内容 */}
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