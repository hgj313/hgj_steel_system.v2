import React, { useState } from 'react';
import {
  Card,
  Button,
  Upload,
  Table,
  Form,
  Input,
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
      console.log('=== 前端文件上传开始 ===');
      console.log('文件信息:', {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });
      
      // 读取文件内容
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64 = btoa(Array.from(uint8Array, byte => String.fromCharCode(byte)).join(''));
      
      console.log('文件转换完成:', {
        原始大小: file.size,
        Base64大小: base64.length,
        压缩比: (base64.length / file.size).toFixed(2)
      });
      
      // 发送文件数据
      const response = await uploadDesignSteels({
        filename: file.name,
        data: base64,
        type: file.type
      } as any);
      
      console.log('服务器响应:', response);
      
      // 显示调试信息
      if (response.debugInfo) {
        console.log('=== 调试信息 ===');
        console.log('原始行数:', response.debugInfo.原始行数);
        console.log('有效数据:', response.debugInfo.有效数据);
        console.log('列名信息:', response.debugInfo.列名信息);
        console.log('截面面积统计:', response.debugInfo.截面面积统计);
        console.log('示例数据:', response.debugInfo.示例数据);
        
        // 如果有截面面积问题，显示警告
        if (response.debugInfo.截面面积统计?.无截面面积 > 0) {
          message.warning(
            `注意：${response.debugInfo.截面面积统计.无截面面积} 条数据的截面面积为0，请检查Excel文件的列名是否正确！`,
            6
          );
          
          // 显示详细的调试信息
          Modal.info({
            title: '数据解析调试信息',
            width: 600,
            content: (
              <div>
                <h4>Excel文件解析结果：</h4>
                <p><strong>检测到的列名：</strong> {response.debugInfo.列名信息?.join(', ') || '无'}</p>
                <p><strong>原始数据行数：</strong> {response.debugInfo.原始行数}</p>
                <p><strong>有效数据行数：</strong> {response.debugInfo.有效数据}</p>
                <h4>截面面积统计：</h4>
                <p><strong>有截面面积：</strong> {response.debugInfo.截面面积统计?.有截面面积} 条</p>
                <p><strong>无截面面积：</strong> {response.debugInfo.截面面积统计?.无截面面积} 条</p>
                {response.debugInfo.示例数据?.length > 0 && (
                  <div>
                    <h4>示例数据：</h4>
                    <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                      {JSON.stringify(response.debugInfo.示例数据, null, 2)}
                    </pre>
                  </div>
                )}
                <div style={{ marginTop: 16, padding: 8, backgroundColor: '#f6ffed', border: '1px solid #b7eb8f' }}>
                  <strong>建议：</strong>
                  <br />1. 确保Excel文件包含"截面面积"、"CrossSection"或"crossSection"列
                  <br />2. 检查数据格式是否为数字
                  <br />3. 确认列名没有多余的空格
                </div>
              </div>
            )
          });
        }
      }
      
      // 使用服务器生成的显示ID，不再在客户端重新生成
      onChange(response.designSteels);
      message.success(`成功上传 ${response.designSteels.length} 条设计钢材数据`);
      console.log('📋 使用服务器生成的显示ID:', response.designSteels.slice(0, 5).map(s => ({ id: s.id, displayId: s.displayId })));
      console.log('=== 前端文件上传完成 ===');
    } catch (error: any) {
      console.error('=== 前端上传错误 ===');
      console.error('错误详情:', error);
      console.error('错误响应:', error.response?.data);
      
      const errorMsg = error.response?.data?.error || error.message;
      message.error(`上传失败: ${errorMsg}`);
      
      // 显示详细错误信息
      if (error.response?.data?.debugInfo) {
        Modal.error({
          title: '上传错误详情',
          width: 600,
          content: (
            <div>
              <p><strong>错误类型：</strong> {error.response.data.debugInfo.errorType}</p>
              <p><strong>错误信息：</strong> {error.response.data.debugInfo.errorMessage}</p>
              {error.response.data.debugInfo.errorStack && (
                <div>
                  <h4>错误堆栈：</h4>
                  <pre style={{ fontSize: '10px', overflow: 'auto', maxHeight: '200px' }}>
                    {error.response.data.debugInfo.errorStack}
                  </pre>
                </div>
              )}
            </div>
          )
        });
      }
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
      render: (value: string) => (
        <span style={{ 
          fontWeight: 'bold', 
          color: '#1890ff',
          backgroundColor: '#f0f8ff',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          {value || '-'}
        </span>
      ),
    },
    {
      title: '构件编号',
      dataIndex: 'componentNumber',
      key: 'componentNumber',
      width: 120,
      sorter: (a: DesignSteel, b: DesignSteel) => (a.componentNumber || '').localeCompare(b.componentNumber || ''),
      render: (value: string) => value || '-',
    },
    {
      title: '规格',
      dataIndex: 'specification',
      key: 'specification',
      width: 140,
      sorter: (a: DesignSteel, b: DesignSteel) => (a.specification || '').localeCompare(b.specification || ''),
      render: (value: string) => value || '-',
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
      title: '部件编号',
      dataIndex: 'partNumber',
      key: 'partNumber',
      width: 120,
      sorter: (a: DesignSteel, b: DesignSteel) => (a.partNumber || '').localeCompare(b.partNumber || ''),
      render: (value: string) => value || '-',
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
            scroll={{ x: 900 }}
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
            label="构件编号"
            name="componentNumber"
          >
            <Input
              placeholder="请输入构件编号（可选）"
            />
          </Form.Item>

          <Form.Item
            label="规格"
            name="specification"
          >
            <Input
              placeholder="请输入规格（可选）"
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

          <Form.Item
            label="部件编号"
            name="partNumber"
          >
            <Input
              placeholder="请输入部件编号（可选）"
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