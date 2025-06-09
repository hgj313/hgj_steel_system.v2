import React, { useState } from 'react';
import {
  Card,
  Button,
  Table,
  Form,
  InputNumber,
  Input,
  Modal,
  Space,
  message,
  Popconfirm,
  Typography,
  Divider,
  Tag,
  Alert
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { ModuleSteel, OptimizationMode, SmartOptimizationResult } from '../types';
import { generateId } from '../utils/steelUtils';

const { Title, Text } = Typography;

interface Props {
  moduleSteels: ModuleSteel[];
  onChange: (steels: ModuleSteel[]) => void;
  optimizationMode?: OptimizationMode;
  smartResult?: SmartOptimizationResult | null;
}

const ModuleSteelManager: React.FC<Props> = ({ moduleSteels, onChange, optimizationMode, smartResult }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingSteel, setEditingSteel] = useState<ModuleSteel | null>(null);
  const [form] = Form.useForm();

  // 添加/编辑模数钢材
  const handleSave = (values: any) => {
    if (!values.name || !values.length) {
      message.error('请填写完整信息');
      return;
    }

    if (values.length <= 0) {
      message.error('长度必须大于0');
      return;
    }

    // 检查名称是否重复
    const isDuplicate = moduleSteels.some(steel => 
      steel.name === values.name && steel.id !== editingSteel?.id
    );
    
    if (isDuplicate) {
      message.error('模数钢材名称已存在');
      return;
    }

    let newSteels: ModuleSteel[];
    if (editingSteel) {
      // 编辑模式
      newSteels = moduleSteels.map(steel =>
        steel.id === editingSteel.id ? { ...steel, ...values } : steel
      );
    } else {
      // 添加模式
      const newSteel: ModuleSteel = {
        id: generateId(),
        ...values
      };
      newSteels = [...moduleSteels, newSteel];
    }

    // 按长度排序
    newSteels.sort((a, b) => b.length - a.length);
    onChange(newSteels);
    
    setIsModalVisible(false);
    setEditingSteel(null);
    form.resetFields();
    message.success(editingSteel ? '模数钢材已更新' : '模数钢材已添加');
  };

  // 删除模数钢材
  const handleDelete = (steel: ModuleSteel) => {
    const newSteels = moduleSteels.filter(s => s.id !== steel.id);
    onChange(newSteels);
    message.success('模数钢材已删除');
  };

  // 编辑模数钢材
  const handleEdit = (steel: ModuleSteel) => {
    setEditingSteel(steel);
    form.setFieldsValue(steel);
    setIsModalVisible(true);
  };

  // 表格列定义
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: ModuleSteel, b: ModuleSteel) => a.name.localeCompare(b.name),
    },
    {
      title: '长度 (mm)',
      dataIndex: 'length',
      key: 'length',
      width: 150,
      sorter: (a: ModuleSteel, b: ModuleSteel) => a.length - b.length,
      render: (value: number) => value.toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: any, record: ModuleSteel) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个模数钢材吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 智能模式显示内容
  const renderSmartModeContent = () => {
    if (!smartResult) {
      return (
        <Alert
          message="智能模式已启用"
          description="在智能模式下，系统将自动计算最优的模数钢材规格组合。完成计算后，结果将显示在这里。"
          type="info"
          icon={<RobotOutlined />}
          showIcon
        />
      );
    }

    return (
      <div>
        <Alert
          message="智能优化结果"
          description={`已测试 ${smartResult.totalTestedCombinations} 种组合，找到最优方案。`}
          type="success"
          icon={<RobotOutlined />}
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Title level={4}>最优组合（前5名）</Title>
        <Table
          dataSource={smartResult.topCombinations}
          rowKey={(record, index) => index || 0}
          pagination={false}
          size="small"
          columns={[
            {
              title: '排名',
              key: 'rank',
              width: 60,
              render: (_, __, index) => (
                <Tag color={index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'orange' : 'default'}>
                  {index + 1}
                </Tag>
              )
            },
            {
              title: '模数规格',
              key: 'specs',
              render: (record) => (
                <Space>
                  {record.specs.map((spec: number) => (
                    <Tag key={spec} color="blue">{spec}mm</Tag>
                  ))}
                </Space>
              )
            },
            {
              title: '损耗率',
              dataIndex: 'lossRate',
              render: (value: number) => (
                <Text strong={true} style={{ color: value < 5 ? '#52c41a' : value < 10 ? '#faad14' : '#f5222d' }}>
                  {value.toFixed(2)}%
                </Text>
              )
            },
            {
              title: '使用量',
              dataIndex: 'totalModuleUsed',
              render: (value: number) => `${value} 根`
            },
            {
              title: '计算时间',
              dataIndex: 'executionTime',
              render: (value: number) => `${(value / 1000).toFixed(1)}s`
            }
          ]}
        />

        {smartResult.candidateSpecs.length > 0 && (
          <>
            <Divider />
            <Title level={4}>候选规格评分</Title>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">基于设计钢材长度分布智能预选的候选规格：</Text>
            </div>
            <Space wrap>
              {smartResult.candidateSpecs.map(spec => (
                <Tag key={spec.length} color="geekblue">
                  {spec.name} (评分: {spec.priority})
                </Tag>
              ))}
            </Space>
          </>
        )}
      </div>
    );
  };

  return (
    <Card className="section-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          {optimizationMode === 'smart' ? '智能优化结果' : '模数钢材管理'}
        </Title>
        {optimizationMode !== 'smart' && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsModalVisible(true)}
          >
            添加模数钢材
          </Button>
        )}
      </div>

      {optimizationMode === 'smart' ? (
        renderSmartModeContent()
      ) : (
        <Table
          columns={columns}
          dataSource={moduleSteels}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          size="small"
        />
      )}

      <Modal
        title={editingSteel ? '编辑模数钢材' : '添加模数钢材'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingSteel(null);
          form.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            label="名称"
            name="name"
            rules={[
              { required: true, message: '请输入模数钢材名称' },
              { max: 50, message: '名称长度不能超过50个字符' }
            ]}
          >
            <Input
              placeholder="请输入模数钢材名称，如：Q235-6000"
              maxLength={50}
            />
          </Form.Item>

          <Form.Item
            label="长度 (mm)"
            name="length"
            rules={[
              { required: true, message: '请输入长度' },
              { type: 'number', min: 1, message: '长度必须大于0' }
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入长度"
              min={1}
              precision={0}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setIsModalVisible(false);
                setEditingSteel(null);
                form.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingSteel ? '更新' : '添加'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default ModuleSteelManager; 