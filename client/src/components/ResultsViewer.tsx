import React, { useState } from 'react';
import {
  Card,
  Button,
  Table,
  Tabs,
  Row,
  Col,
  Statistic,
  Space,
  Typography,
  Tag,
  message,
  Divider,
  Alert,
  Collapse
} from 'antd';
import {
  FileExcelOutlined,
  FilePdfOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { OptimizationResult, DesignSteel, ModuleSteel, CuttingPlan, SmartOptimizationResult, OptimizationMode } from '../types';
import { exportToExcel, exportToPDF, downloadFile } from '../utils/api';
import { formatNumber } from '../utils/steelUtils';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Panel } = Collapse;

interface Props {
  result?: OptimizationResult | null;
  smartResult?: SmartOptimizationResult | null;
  designSteels: DesignSteel[];
  moduleSteels: ModuleSteel[];
  optimizationMode: OptimizationMode;
}

const ResultsViewer: React.FC<Props> = ({ result, smartResult, designSteels, moduleSteels, optimizationMode }) => {
  const [exporting, setExporting] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  // 获取当前显示的结果
  const getCurrentResult = (): OptimizationResult | null => {
    if (optimizationMode === 'smart' && smartResult?.bestCombination?.result) {
      return smartResult.bestCombination.result;
    }
    return result || null;
  };

  const currentResult = getCurrentResult();

  // 如果没有结果，显示空状态
  if (!currentResult) {
    return (
      <Card className="section-card">
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Text type="secondary">暂无优化结果</Text>
        </div>
      </Card>
    );
  }

  // 导出Excel
  const handleExportExcel = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExporting(true);
    try {
      const response = await exportToExcel(currentResult, moduleSteels);
      downloadFile(response);
      message.success('Excel文件导出成功');
    } catch (error: any) {
      console.error('Excel导出错误:', error);
      message.error(`导出失败: ${error.response?.data?.error || error.message}`);
    } finally {
      setExporting(false);
    }
  };

  // 导出PDF
  const handleExportPDF = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExportingPDF(true);
    try {
      const response = await exportToPDF(currentResult, designSteels, moduleSteels);
      downloadFile(response);
      message.success('PDF文件导出成功');
    } catch (error: any) {
      console.error('PDF导出错误详情:', error);
      
      let errorMessage = 'PDF导出失败';
      if (error.response) {
        errorMessage = `PDF导出失败(${error.response.status}): ${error.response.data?.error || error.response.statusText}`;
        console.error('PDF导出服务器响应:', error.response.data);
      } else if (error.request) {
        errorMessage = 'PDF导出网络连接失败，请检查网络或稍后重试';
        console.error('PDF导出网络请求失败:', error.request);
      } else {
        errorMessage = `PDF导出失败: ${error.message}`;
      }
      
      message.error(errorMessage);
    } finally {
      setExportingPDF(false);
    }
  };

  // 验证需求满足情况
  const validateRequirements = () => {
    if (!currentResult || !currentResult.solutions) {
      return [];
    }
    
    const produced: Record<string, number> = {};
    
    Object.values(currentResult.solutions).forEach(solution => {
      // 确保 details 数组存在
      if (solution.details && Array.isArray(solution.details)) {
        solution.details.forEach(detail => {
          // details 数组中的每个元素是 CuttingDetail 类型，直接包含 designId, length, quantity
          if (detail.designId && detail.quantity) {
            if (!produced[detail.designId]) {
              produced[detail.designId] = 0;
            }
            produced[detail.designId] += detail.quantity;
          }
        });
      }
    });

    const validation = designSteels.map(steel => {
      const producedQty = produced[steel.id] || 0;
      return {
        ...steel,
        produced: producedQty,
        satisfied: producedQty === steel.quantity,
        difference: producedQty - steel.quantity
      };
    });

    return validation;
  };

  // 准备图表数据
  const prepareChartData = () => {
    if (!currentResult || !currentResult.solutions) {
      return { lossRateData: [], pieData: [] };
    }
    
    const crossSections = Object.keys(currentResult.solutions);
    const lossRateData = crossSections.map(crossSection => {
      const solution = currentResult.solutions[crossSection];
      
      // 计算总材料使用量（只计算模数钢材）
      const totalMaterial = solution.cuttingPlans?.reduce((sum, plan) => {
        return sum + (plan.sourceType === 'module' ? plan.sourceLength : 0);
      }, 0) || 0;
      
      const lossRate = totalMaterial > 0 ? (solution.totalWaste / totalMaterial) * 100 : 0;
      
      return {
        crossSection: `截面${crossSection}`,
        lossRate: parseFloat(lossRate.toFixed(2)),
        moduleUsed: solution.totalModuleUsed,
        waste: solution.totalWaste
      };
    });

    const pieData = crossSections.map((crossSection, index) => {
      const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];
      return {
        name: `截面${crossSection}`,
        value: currentResult.solutions[crossSection].totalModuleUsed,
        fill: colors[index % colors.length]
      };
    });

    return { lossRateData, pieData };
  };

  // 准备模数钢材使用统计数据
  const prepareModuleUsageStats = () => {
    if (!currentResult || !currentResult.solutions) {
      return { 
        sortedStats: [], 
        crossSectionTotals: {}, 
        grandTotal: { count: 0, totalLength: 0 } 
      };
    }
    
    const moduleUsageStats: Record<string, {
      moduleType: string;
      crossSection: number;
      length: number;
      count: number;
      totalLength: number;
    }> = {};

    Object.entries(currentResult.solutions).forEach(([crossSection, solution]) => {
      // 从设计钢材中获取截面面积
      const crossSectionValue = parseInt(crossSection);
      
      solution.details?.forEach(detail => {
        if (detail.sourceType === 'module' && detail.moduleType) {
          const key = `${detail.moduleType}_${crossSection}`;
          if (!moduleUsageStats[key]) {
            moduleUsageStats[key] = {
              moduleType: detail.moduleType,
              crossSection: crossSectionValue,
              length: detail.moduleLength || detail.sourceLength,
              count: 0,
              totalLength: 0
            };
          }
          moduleUsageStats[key].count += detail.quantity;
          moduleUsageStats[key].totalLength += (detail.moduleLength || detail.sourceLength) * detail.quantity;
        }
      });
    });

    // 按截面面积和规格排序
    const sortedStats = Object.values(moduleUsageStats).sort((a, b) => {
      if (a.crossSection !== b.crossSection) {
        return a.crossSection - b.crossSection;
      }
      return a.length - b.length;
    });

    // 计算各截面合计
    const crossSectionTotals: Record<number, { count: number; totalLength: number }> = {};
    sortedStats.forEach(stat => {
      if (!crossSectionTotals[stat.crossSection]) {
        crossSectionTotals[stat.crossSection] = { count: 0, totalLength: 0 };
      }
      crossSectionTotals[stat.crossSection].count += stat.count;
      crossSectionTotals[stat.crossSection].totalLength += stat.totalLength;
    });

    // 计算总计
    const grandTotal = sortedStats.reduce((acc, stat) => ({
      count: acc.count + stat.count,
      totalLength: acc.totalLength + stat.totalLength
    }), { count: 0, totalLength: 0 });

    return { sortedStats, crossSectionTotals, grandTotal };
  };

  // 安全地调用数据准备函数
  const chartData = currentResult ? prepareChartData() : { lossRateData: [], pieData: [] };
  const moduleUsageData = currentResult ? prepareModuleUsageStats() : { 
    sortedStats: [], 
    crossSectionTotals: {}, 
    grandTotal: { count: 0, totalLength: 0 } 
  };
  
  const { lossRateData, pieData } = chartData;
  const { sortedStats, crossSectionTotals, grandTotal } = moduleUsageData;
  const requirementValidation = currentResult ? validateRequirements() : [];
  const allSatisfied = requirementValidation.every(v => v.satisfied);

  // 渲染智能优化结果概览
  const renderSmartResultOverview = () => {
    if (optimizationMode !== 'smart' || !smartResult) return null;

    return (
      <Card style={{ marginBottom: 16 }}>
        <Title level={4}>
          <RobotOutlined /> 智能优化概览
        </Title>
        <Row gutter={24}>
          <Col xs={24} md={6}>
            <Statistic
              title="测试组合数"
              value={smartResult.totalTestedCombinations}
              suffix="个"
            />
          </Col>
          <Col xs={24} md={6}>
            <Statistic
              title="最佳损耗率"
              value={smartResult.bestCombination?.lossRate || 0}
              precision={2}
              suffix="%"
              valueStyle={{ color: smartResult.bestCombination?.lossRate && smartResult.bestCombination.lossRate < 5 ? '#3f8600' : '#cf1322' }}
            />
          </Col>
          <Col xs={24} md={6}>
            <Statistic
              title="最佳规格组合"
              value={smartResult.bestCombination?.specs.join(' + ') || ''}
              suffix="mm"
            />
          </Col>
          <Col xs={24} md={6}>
            <Statistic
              title="计算时间"
              value={Math.round(smartResult.totalExecutionTime / 1000)}
              suffix="秒"
            />
          </Col>
        </Row>

        {smartResult.topCombinations.length > 1 && (
          <>
            <Divider />
            <Title level={5}>前5名组合对比</Title>
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
                    <Text strong style={{ color: value < 5 ? '#52c41a' : value < 10 ? '#faad14' : '#f5222d' }}>
                      {value.toFixed(2)}%
                    </Text>
                  )
                },
                {
                  title: '使用量',
                  dataIndex: 'totalModuleUsed',
                  render: (value: number) => `${value} 根`
                }
              ]}
            />
          </>
        )}
      </Card>
    );
  };

  // 切割详情表格列
  const cuttingColumns = [
    {
      title: '原料',
      key: 'source',
      render: (_: any, record: CuttingPlan) => (
        <div>
          <Tag color={record.sourceType === 'module' ? 'blue' : 'green'}>
            {record.sourceDescription}
          </Tag>
        </div>
      ),
    },
    {
      title: '原料长度 (mm)',
      dataIndex: 'sourceLength',
      key: 'sourceLength',
      render: (value: number) => formatNumber(value, 0),
    },
    {
      title: '切割详情',
      key: 'cuts',
      render: (_: any, record: CuttingPlan) => (
        <div>
          {record.cuts.map((cut, index) => {
            const steel = designSteels.find(s => s.id === cut.designId);
            return (
              <Tag key={index} color="blue">
                {steel?.displayId || cut.designId}: {cut.length}mm × {cut.quantity}件
              </Tag>
            );
          })}
        </div>
      ),
    },
    {
      title: '新余料',
      key: 'newRemainders',
      render: (_: any, record: CuttingPlan) => (
        <div>
          {record.newRemainders?.map((remainder, index) => (
            <Tag key={index} color="orange">
              {remainder.id}: {remainder.length}mm
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: '废料 (mm)',
      dataIndex: 'waste',
      key: 'waste',
      render: (value: number) => (
        <Text type={value > 0 ? 'warning' : 'secondary'}>
          {formatNumber(value, 0)}
        </Text>
      ),
    }
  ];

  // 模数钢材统计表格列
  const moduleStatsColumns = [
    {
      title: '模数钢材规格',
      dataIndex: 'moduleType',
      key: 'moduleType',
      render: (value: string) => (
        <Tag color="blue">{value}</Tag>
      ),
    },
    {
      title: '截面面积 (mm²)',
      dataIndex: 'crossSection',
      key: 'crossSection',
      render: (value: number) => formatNumber(value, 0),
    },
    {
      title: '长度 (mm)',
      dataIndex: 'length',
      key: 'length',
      render: (value: number) => formatNumber(value, 0),
    },
    {
      title: '使用数量 (根)',
      dataIndex: 'count',
      key: 'count',
      render: (value: number) => (
        <Text strong style={{ color: '#1890ff' }}>{value}</Text>
      ),
    },
    {
      title: '总长度 (mm)',
      dataIndex: 'totalLength',
      key: 'totalLength',
      render: (value: number) => (
        <Text strong style={{ color: '#1890ff' }}>{formatNumber(value, 0)}</Text>
      ),
    },
    {
      title: '备注',
      key: 'remark',
      render: (_: any, record: any) => (
        <Text type="secondary">单根长度{formatNumber(record.length, 0)}mm</Text>
      ),
    }
  ];

  // 需求验证表格列
  const requirementColumns = [
    {
      title: '设计钢材ID',
      dataIndex: 'displayId',
      key: 'displayId',
      render: (value: string, record: any) => (
        <Tag color="blue">{value || record.id}</Tag>
      ),
    },
    {
      title: '长度 (mm)',
      dataIndex: 'length',
      key: 'length',
      render: (value: number) => formatNumber(value, 0),
    },
    {
      title: '需求数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (value: number) => (
        <Text strong>{value}</Text>
      ),
    },
    {
      title: '生产数量',
      dataIndex: 'produced',
      key: 'produced',
      render: (value: number) => (
        <Text strong style={{ color: value > 0 ? '#1890ff' : '#ff4d4f' }}>
          {value}
        </Text>
      ),
    },
    {
      title: '满足状态',
      dataIndex: 'satisfied',
      key: 'satisfied',
      render: (satisfied: boolean, record: any) => (
        <Tag color={satisfied ? 'green' : 'red'}>
          {satisfied ? '已满足' : '未满足'}
        </Tag>
      ),
    },
    {
      title: '差异',
      dataIndex: 'difference',
      key: 'difference',
      render: (value: number) => (
        <Text style={{ 
          color: value === 0 ? '#52c41a' : value > 0 ? '#1890ff' : '#ff4d4f',
          fontWeight: 'bold'
        }}>
          {value > 0 ? `+${value}` : value}
        </Text>
      ),
    }
  ];

  return (
    <Card className="section-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          {optimizationMode === 'smart' ? '智能优化结果' : '优化结果'}
        </Title>
        <Space>
          <Button
            type="primary"
            icon={<FileExcelOutlined />}
            onClick={handleExportExcel}
            loading={exporting}
          >
            导出Excel
          </Button>
          <Button
            icon={<FilePdfOutlined />}
            onClick={handleExportPDF}
            loading={exportingPDF}
          >
            导出PDF
          </Button>
        </Space>
      </div>

      {renderSmartResultOverview()}

      <Alert
        type={allSatisfied ? 'success' : 'warning'}
        showIcon
        icon={allSatisfied ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
        message={allSatisfied ? '所有需求已满足' : '部分需求未满足'}
        style={{ marginBottom: 16 }}
      />

      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col xs={24} md={6}>
          <Statistic
            title="总损耗率"
            value={currentResult.totalLossRate}
            precision={2}
            suffix="%"
            valueStyle={{ color: currentResult.totalLossRate < 5 ? '#3f8600' : '#cf1322' }}
          />
        </Col>
        <Col xs={24} md={6}>
          <Statistic
            title="模数钢材使用量"
            value={currentResult.totalModuleUsed}
            suffix="根"
          />
        </Col>
        <Col xs={24} md={6}>
          <Statistic
            title="总废料长度"
            value={currentResult.totalWaste}
            suffix="mm"
          />
        </Col>
        <Col xs={24} md={6}>
          <Statistic
            title="计算时间"
            value={currentResult.executionTime}
            suffix="ms"
          />
        </Col>
      </Row>

      <Tabs defaultActiveKey="summary">
        <TabPane tab="汇总统计" key="summary">
          <Row gutter={24}>
            <Col xs={24} lg={12}>
              <Card title="各截面损耗率对比" size="small">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={lossRateData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="crossSection" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="lossRate" stroke="#8884d8" name="损耗率 (%)" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="模数钢材使用分布" size="small">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="切割详情" key="details">
          {Object.entries(currentResult.solutions).map(([crossSection, solution]) => (
            <Collapse key={crossSection} style={{ marginBottom: 16 }}>
              <Panel
                header={
                  <div>
                    <Tag color="blue">截面 {crossSection}</Tag>
                    <Text>损耗率: {((solution.totalWaste / solution.details.reduce((sum, d) => sum + (d.sourceType === 'module' ? d.sourceLength : 0), 0)) * 100).toFixed(2)}%</Text>
                  </div>
                }
                key={crossSection}
              >
                <Table
                  columns={cuttingColumns}
                  dataSource={solution.cuttingPlans}
                  rowKey={(record, index) => `${crossSection}-${index}`}
                  pagination={false}
                  size="small"
                />
              </Panel>
            </Collapse>
          ))}
        </TabPane>

        <TabPane tab="需求验证" key="requirements">
          <Card title="生产需求匹配验证表" size="small">
            <Table
              columns={requirementColumns}
              dataSource={requirementValidation}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              size="small"
              summary={(pageData) => {
                const totalRequired = pageData.reduce((sum, record) => sum + record.quantity, 0);
                const totalProduced = pageData.reduce((sum, record) => sum + record.produced, 0);
                const unsatisfiedCount = pageData.filter(record => !record.satisfied).length;
                
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0}>
                        <Text strong>统计</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1}>-</Table.Summary.Cell>
                      <Table.Summary.Cell index={2}>
                        <Text strong>{totalRequired}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3}>
                        <Text strong style={{ color: '#1890ff' }}>{totalProduced}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={4}>
                        <Tag color={unsatisfiedCount === 0 ? 'green' : 'red'}>
                          {unsatisfiedCount === 0 ? '全部满足' : `${unsatisfiedCount}项未满足`}
                        </Tag>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={5}>
                        <Text strong style={{ 
                          color: (totalProduced - totalRequired) === 0 ? '#52c41a' : 
                                (totalProduced - totalRequired) > 0 ? '#1890ff' : '#ff4d4f'
                        }}>
                          {totalProduced - totalRequired > 0 ? 
                            `+${totalProduced - totalRequired}` : 
                            totalProduced - totalRequired}
                        </Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                );
              }}
            />
          </Card>
          
          <div style={{ marginTop: 16 }}>
            <Alert
              type={allSatisfied ? 'success' : 'warning'}
              message={allSatisfied ? '需求验证通过' : '需求验证异常'}
              description={
                allSatisfied ? (
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li>所有设计钢材需求已完全满足</li>
                    <li>生产计划可直接执行</li>
                    <li>无需调整优化参数</li>
                  </ul>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li style={{ color: '#ff4d4f' }}>部分设计钢材需求未满足</li>
                    <li>建议调整优化参数重新计算</li>
                    <li>或检查模数钢材规格是否合适</li>
                    <li>红色标记的项目需要特别关注</li>
                  </ul>
                )
              }
            />
          </div>
        </TabPane>

        <TabPane tab="模数钢材统计" key="moduleStats">
          <Card title="模数钢材使用统计" size="small">
            <Table
              columns={moduleStatsColumns}
              dataSource={[
                ...sortedStats,
                ...Object.entries(crossSectionTotals).map(([crossSection, totals]) => ({
                  key: `subtotal-${crossSection}`,
                  moduleType: `截面${crossSection}小计`,
                  crossSection: parseInt(crossSection),
                  length: '-',
                  count: totals.count,
                  totalLength: totals.totalLength,
                  isSubtotal: true
                })),
                {
                  key: 'total',
                  moduleType: '总计',
                  crossSection: '-',
                  length: '-',
                  count: grandTotal.count,
                  totalLength: grandTotal.totalLength,
                  isTotal: true
                }
              ]}
              rowKey="key"
              pagination={false}
              size="small"
              rowClassName={(record: any) => {
                if (record.isTotal) return 'module-stats-total-row';
                if (record.isSubtotal) return 'module-stats-subtotal-row';
                return '';
              }}
            />
          </Card>
          
          <div style={{ marginTop: 16 }}>
            <Alert
              type="info"
              message="统计说明"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>按截面面积和模数钢材规格分类统计使用量</li>
                  <li>显示每种规格的使用数量和总长度</li>
                  <li>提供各截面小计和总计数据</li>
                  <li>便于采购计划制定和成本核算</li>
                </ul>
              }
            />
          </div>
        </TabPane>
      </Tabs>
    </Card>
  );
};

export default ResultsViewer; 