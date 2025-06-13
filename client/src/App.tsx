import React, { useState, useEffect } from 'react';
import { Layout, Typography, Card, Row, Col, Divider, Button, Space, Alert, Modal, Input, message, Tag } from 'antd';
import { FileExcelOutlined, RobotOutlined, SettingOutlined, BulbOutlined, NotificationOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import DesignSteelUploader from './components/DesignSteelUploader';
import ModuleSteelManager from './components/ModuleSteelManager';
import OptimizationPanel from './components/OptimizationPanel';
import ResultsViewer from './components/ResultsViewer';
import SmartOptimizationPanel from './components/SmartOptimizationPanel';
import { DesignSteel, ModuleSteel, OptimizationResult, OptimizationMode, SmartOptimizationResult } from './types';
import './App.css';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

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
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [smartResult, setSmartResult] = useState<SmartOptimizationResult | null>(null);
  const [optimizationMode, setOptimizationMode] = useState<OptimizationMode>('normal');
  
  // 公告相关状态
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementModalVisible, setAnnouncementModalVisible] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error'
  });

  // 从localStorage加载公告
  useEffect(() => {
    const savedAnnouncements = localStorage.getItem('steel-optimization-announcements');
    if (savedAnnouncements) {
      try {
        setAnnouncements(JSON.parse(savedAnnouncements));
      } catch (error) {
        console.error('加载公告失败:', error);
      }
    }
  }, []);

  // 保存公告到localStorage
  const saveAnnouncements = (newAnnouncements: Announcement[]) => {
    setAnnouncements(newAnnouncements);
    localStorage.setItem('steel-optimization-announcements', JSON.stringify(newAnnouncements));
  };

  // 添加或编辑公告
  const handleSaveAnnouncement = () => {
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      message.error('请填写公告标题和内容');
      return;
    }

    if (editingAnnouncement) {
      // 编辑现有公告
      const updatedAnnouncements = announcements.map(ann => 
        ann.id === editingAnnouncement.id 
          ? { ...ann, ...announcementForm }
          : ann
      );
      saveAnnouncements(updatedAnnouncements);
      message.success('公告更新成功');
    } else {
      // 添加新公告
      const newAnnouncement: Announcement = {
        id: Date.now().toString(),
        ...announcementForm,
        createdAt: new Date().toLocaleString('zh-CN')
      };
      saveAnnouncements([newAnnouncement, ...announcements]);
      message.success('公告添加成功');
    }

    setAnnouncementModalVisible(false);
    setEditingAnnouncement(null);
    setAnnouncementForm({ title: '', content: '', type: 'info' });
  };

  // 删除公告
  const handleDeleteAnnouncement = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条公告吗？',
      onOk: () => {
        const updatedAnnouncements = announcements.filter(ann => ann.id !== id);
        saveAnnouncements(updatedAnnouncements);
        message.success('公告删除成功');
      }
    });
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

  // 添加新公告
  const handleAddAnnouncement = () => {
    setEditingAnnouncement(null);
    setAnnouncementForm({ title: '', content: '', type: 'info' });
    setAnnouncementModalVisible(true);
  };

  const handleDesignSteelsUploaded = (steels: DesignSteel[]) => {
    setDesignSteels(steels);
    setResult(null);
    setSmartResult(null);
  };

  const handleModuleSteelsChange = (steels: ModuleSteel[]) => {
    setModuleSteels(steels);
    setResult(null);
    setSmartResult(null);
  };

  const handleOptimizationComplete = (optimizationResult: OptimizationResult) => {
    setResult(optimizationResult);
    setSmartResult(null);
  };

  const handleSmartOptimizationComplete = (smartOptimizationResult: SmartOptimizationResult) => {
    setSmartResult(smartOptimizationResult);
    setResult(smartOptimizationResult.bestCombination?.result || null);
  };

  const handleModeChange = (mode: OptimizationMode) => {
    setOptimizationMode(mode);
    setResult(null);
    setSmartResult(null);
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
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={8}>
            <Card 
              title={
                <Space>
                  <FileExcelOutlined style={{ color: '#52c41a' }} />
                  <span>设计钢材数据</span>
                </Space>
              }
              style={{ height: '100%' }}
            >
              <DesignSteelUploader onSteelsUploaded={handleDesignSteelsUploaded} />
              {designSteels.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Text type="success">
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
                  <BulbOutlined style={{ color: '#1890ff' }} />
                  <span>模数钢材配置</span>
                </Space>
              }
              style={{ height: '100%' }}
            >
              <ModuleSteelManager 
                moduleSteels={moduleSteels}
                onModuleSteelsChange={handleModuleSteelsChange}
              />
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card 
              title={
                <Space>
                  <RobotOutlined style={{ color: '#722ed1' }} />
                  <span>优化计算</span>
                </Space>
              }
              style={{ height: '100%' }}
            >
              {optimizationMode === 'normal' ? (
                <OptimizationPanel
                  designSteels={designSteels}
                  moduleSteels={moduleSteels}
                  onOptimizationComplete={handleOptimizationComplete}
                  onModeChange={handleModeChange}
                />
              ) : (
                <SmartOptimizationPanel
                  designSteels={designSteels}
                  onOptimizationComplete={handleSmartOptimizationComplete}
                  onModeChange={handleModeChange}
                />
              )}
            </Card>
          </Col>
        </Row>

        {(result || smartResult) && (
          <>
            <Divider style={{ margin: '32px 0' }} />
            <ResultsViewer 
              result={result}
              smartResult={smartResult}
              designSteels={designSteels}
              moduleSteels={moduleSteels}
              optimizationMode={optimizationMode}
            />
          </>
        )}
      </Content>
    </Layout>
  );
};

export default App; 