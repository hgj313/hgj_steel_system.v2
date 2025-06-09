import React, { useState } from 'react';
import {
  Card,
  Button,
  Upload,
  Table,
  Form,
  InputNumber,
  Modal,
  Space,
  message,
  Popconfirm,
  Typography,
  Collapse
} from 'antd';
import {
  UploadOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  DownOutlined,
  RightOutlined
} from '@ant-design/icons';
import { DesignSteel } from '../types';
import { uploadDesignSteels } from '../utils/api';
import { generateDisplayIds, validateDesignSteel, generateId } from '../utils/steelUtils';

const { Title } = Typography;
const { Panel } = Collapse;

interface Props {
  designSteels: DesignSteel[];
  onChange: (steels: DesignSteel[]) => void;
}

const DesignSteelManager: React.FC<Props> = ({ designSteels, onChange }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingSteel, setEditingSteel] = useState<DesignSteel | null>(null);
  const [uploading, setUploading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [form] = Form.useForm();

  // 处理文件上传
  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      // 读取文件内容
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64 = btoa(Array.from(uint8Array, byte => String.fromCharCode(byte)).join(''));
      
      // 发送文件数据
      const response = await uploadDesignSteels({
        filename: file.name,
        data: base64,
        type: file.type
      } as any);
      
      const steelsWithIds = generateDisplayIds(response.designSteels);
      onChange(steelsWithIds);
      message.success(`成功上传 ${steelsWithIds.length} 条设计钢材数据`);
    } catch (error: any) {
      message.error(`上传失败: ${error.response?.data?.error || error.message}`);
    } finally {
      setUploading(false);
    }
    return false; // 阻止默认上传行为
  };

  // 添加/编辑钢材
  const handleSave = (values: any) => {
    const validation = validateDesignSteel(values);
    if (validation) {
      message.error(validation);
      return;
    }

    let newSteels: DesignSteel[];
    if (editingSteel) {
      // 编辑模式
      newSteels = designSteels.map(steel =>
        steel.id === editingSteel.id ? { ...steel, ...values } : steel
      );
    } else {
      // 添加模式
      const newSteel: DesignSteel = {
        id: generateId(),
        ...values
      };
      newSteels = [...designSteels, newSteel];
    }

    // 重新生成显示编号
    const steelsWithIds = generateDisplayIds(newSteels);
    onChange(steelsWithIds);
    
    setIsModalVisible(false);
    setEditingSteel(null);
    form.resetFields();
    message.success(editingSteel ? '钢材信息已更新' : '钢材已添加');
  };

  // 删除钢材
  const handleDelete = (steel: DesignSteel) => {
    const newSteels = designSteels.filter(s => s.id !== steel.id);
    const steelsWithIds = generateDisplayIds(newSteels);
    onChange(steelsWithIds);
    message.success('钢材已删除');
  };

  // 编辑钢材
  const handleEdit = (steel: DesignSteel) => {
    setEditingSteel(steel);
    form.setFieldsValue(steel);
    setIsModalVisible(true);
  };

  // 表格列定义
  const columns = [
    {
      title: '编号',
      dataIndex: 'displayId',
      key: 'displayId',
      width: 80,
      sorter: (a: DesignSteel, b: DesignSteel) => (a.displayId || '').localeCompare(b.displayId || ''),
    },
    {
      title: '长度 (mm)',
      dataIndex: 'length',
      key: 'length',
      width: 120,
      sorter: (a: DesignSteel, b: DesignSteel) => a.length - b.length,
      render: (value: number) => value.toLocaleString(),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      sorter: (a: DesignSteel, b: DesignSteel) => a.quantity - b.quantity,
      render: (value: number) => value.toLocaleString(),
    },
    {
      title: '截面面积 (mm²)',
      dataIndex: 'crossSection',
      key: 'crossSection',
      width: 140,
      sorter: (a: DesignSteel, b: DesignSteel) => a.crossSection - b.crossSection,
      render: (value: number) => value.toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: any, record: DesignSteel) => (
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
            title="确定要删除这条数据吗？"
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

  return (
    <Card className="section-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          设计钢材管理
          <Button
            type="text"
            icon={collapsed ? <RightOutlined /> : <DownOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            size="small"
            className="collapse-toggle"
          >
            {collapsed ? '展开' : '折叠'}
          </Button>
        </Title>
        <Space>
          <Upload
            beforeUpload={handleUpload}
            accept=".xlsx,.xls,.csv"
            showUploadList={false}
          >
            <Button icon={<UploadOutlined />} loading={uploading}>
              上传Excel文件
            </Button>
          </Upload>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsModalVisible(true)}
          >
            手动添加
          </Button>
        </Space>
      </div>

      <Collapse activeKey={collapsed ? [] : ['1']} ghost>
        <Panel header="" key="1" showArrow={false}>
          <Table
            columns={columns}
            dataSource={designSteels}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
            size="small"
            scroll={{ x: 600 }}
          />
        </Panel>
      </Collapse>

      <Modal
        title={editingSteel ? '编辑设计钢材' : '添加设计钢材'}
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

          <Form.Item
            label="数量"
            name="quantity"
            rules={[
              { required: true, message: '请输入数量' },
              { type: 'number', min: 1, message: '数量必须大于0' }
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入数量"
              min={1}
              precision={0}
            />
          </Form.Item>

          <Form.Item
            label="截面面积 (mm²)"
            name="crossSection"
            rules={[
              { required: true, message: '请输入截面面积' },
              { type: 'number', min: 0.01, message: '截面面积必须大于0' }
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入截面面积"
              min={0.01}
              precision={2}
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

export default DesignSteelManager; 