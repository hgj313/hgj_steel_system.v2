import React, { useState, useMemo } from 'react';
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
import { 
  formatNumber, 
  buildCrossSectionToSpecMapping, 
  regroupOptimizationResultsBySpecification 
} from '../utils/steelUtils';

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
  const [activeTab, setActiveTab] = useState<string>('summary');
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

  // 建立规格映射 - 确保每次都能获取最新映射
  const crossSectionToSpecMapping = useMemo(() => {
    return buildCrossSectionToSpecMapping(designSteels);
  }, [designSteels]);

  // 准备图表数据
  const prepareChartData = useMemo(() => {
    if (!currentResult || !currentResult.solutions) {
      return { lossRateData: [], pieData: [] };
    }
    
    // 调试信息
    console.log('🔍 调试规格映射:', {
      '设计钢材数量': designSteels.length,
      '前3个设计钢材': designSteels.slice(0, 3).map(s => ({
        id: s.id,
        specification: s.specification,
        crossSection: s.crossSection
      })),
      '规格映射': crossSectionToSpecMapping,
      '优化结果截面面积': Object.keys(currentResult.solutions)
    });
    
    const crossSections = Object.keys(currentResult.solutions);
    const lossRateData = crossSections.map(crossSection => {
      const solution = currentResult.solutions[crossSection];
      const crossSectionValue = Math.round(parseFloat(crossSection));
      const specification = crossSectionToSpecMapping[crossSectionValue] || `未知规格(${crossSectionValue}mm²)`;
      
      console.log(`截面面积 ${crossSection} → 四舍五入: ${crossSectionValue} → 映射到规格: ${specification}`);
      
      // 计算总材料使用量（只计算模数钢材）
      const totalMaterial = solution.cuttingPlans?.reduce((sum, plan) => {
        return sum + (plan.sourceType === 'module' ? plan.sourceLength : 0);
      }, 0) || 0;
      
      const lossRate = totalMaterial > 0 ? (solution.totalWaste / totalMaterial) * 100 : 0;
      
      return {
        specification: specification,
        lossRate: parseFloat(lossRate.toFixed(2)),
        moduleUsed: solution.totalModuleUsed,
        waste: solution.totalWaste
      };
    });

    const pieData = crossSections.map((crossSection, index) => {
      const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];
      const crossSectionValue = Math.round(parseFloat(crossSection));
      const specification = crossSectionToSpecMapping[crossSectionValue] || `未知规格(${crossSectionValue}mm²)`;
      
      return {
        name: specification,
        value: currentResult.solutions[crossSection].totalModuleUsed,
        fill: colors[index % colors.length]
      };
    });

    return { lossRateData, pieData };
  }, [currentResult, crossSectionToSpecMapping]);

  // 准备模数钢材使用统计数据
  const prepareModuleUsageStats = useMemo(() => {
    if (!currentResult || !currentResult.solutions) {
      return { 
        sortedStats: [], 
        specificationTotals: {}, 
        grandTotal: { count: 0, totalLength: 0 } 
      };
    }
    
    // Group by specification and length, not by moduleType to avoid double counting
    const moduleUsageStats: Record<string, {
      specification: string;
      crossSection: number;
      length: number;
      count: number;
      totalLength: number;
    }> = {};

    Object.entries(currentResult.solutions).forEach(([crossSection, solution]) => {
      const crossSectionValue = Math.round(parseFloat(crossSection));
      const specification = crossSectionToSpecMapping[crossSectionValue] || `未知规格(${crossSectionValue}mm²)`;
      
      // Count unique module steel bars by sourceId (not detail records)
      const uniqueModuleBars: Record<string, { length: number; sourceId: string }> = {};
      
      solution.details?.forEach(detail => {
        // Only count raw module steel bars, ignore remainders/remnants
        if (detail.sourceType === 'module' && detail.sourceId) {
          const length = detail.moduleLength || detail.sourceLength;
          const sourceId = detail.sourceId;
          
          // Each unique sourceId represents one physical steel bar
          if (!uniqueModuleBars[sourceId]) {
            uniqueModuleBars[sourceId] = {
              length: length,
              sourceId: sourceId
            };
          }
        }
      });
      
      // Group by length and count unique bars
      const moduleBarCounts: Record<number, number> = {};
      Object.values(uniqueModuleBars).forEach(bar => {
        if (!moduleBarCounts[bar.length]) {
          moduleBarCounts[bar.length] = 0;
        }
        moduleBarCounts[bar.length] += 1;
      });
      
      // Add to stats
      Object.entries(moduleBarCounts).forEach(([lengthStr, count]) => {
        const length = parseInt(lengthStr);
        const key = `${specification}_${length}`;
        if (!moduleUsageStats[key]) {
          moduleUsageStats[key] = {
            specification: specification,
            crossSection: crossSectionValue,
            length: length,
            count: 0,
            totalLength: 0
          };
        }
        moduleUsageStats[key].count += count;
        moduleUsageStats[key].totalLength += length * count;
      });
    });

    const sortedStats = Object.values(moduleUsageStats).sort((a, b) => {
      if (a.specification !== b.specification) {
        return a.specification.localeCompare(b.specification);
      }
      return a.length - b.length;
    });

    const specificationTotals: Record<string, { count: number; totalLength: number }> = {};
    sortedStats.forEach(stat => {
      if (!specificationTotals[stat.specification]) {
        specificationTotals[stat.specification] = { count: 0, totalLength: 0 };
      }
      specificationTotals[stat.specification].count += stat.count;
      specificationTotals[stat.specification].totalLength += stat.totalLength;
    });

    const grandTotal = sortedStats.reduce((acc, stat) => ({
      count: acc.count + stat.count,
      totalLength: acc.totalLength + stat.totalLength
    }), { count: 0, totalLength: 0 });

    return { sortedStats, specificationTotals, grandTotal };
  }, [currentResult, crossSectionToSpecMapping]);

  // 验证需求满足情况
  const validateRequirements = () => {
    if (!currentResult || !currentResult.solutions) {
      return [];
    }
    
    const produced: Record<string, number> = {};
    
    console.log('🔍 开始验证需求满足情况');
    console.log('📊 优化结果:', currentResult.solutions);
    console.log('📋 设计钢材列表:', designSteels);
    
    Object.values(currentResult.solutions).forEach(solution => {
      console.log('🔧 处理解决方案:', solution);
      if (solution.details && Array.isArray(solution.details)) {
        solution.details.forEach(detail => {
          console.log('📝 处理详情:', detail);
          console.log('🔑 详情中的designId:', detail.designId);
          console.log('📊 详情中的quantity:', detail.quantity);
          if (detail.designId && detail.quantity) {
            if (!produced[detail.designId]) {
              produced[detail.designId] = 0;
            }
            produced[detail.designId] += detail.quantity;
            console.log(`✅ 累计生产: ${detail.designId} → ${produced[detail.designId]} 件`);
          } else {
            console.log('❌ 跳过详情 - designId或quantity为空');
          }
        });
      }
    });

    console.log('📈 最终生产统计:', produced);

    const validation = designSteels.map(steel => {
      const producedQty = produced[steel.id] || 0;
      console.log(`🎯 验证钢材 ${steel.id}: 需求 ${steel.quantity}, 生产 ${producedQty}`);
      return {
        ...steel,
        specification: steel.specification,
        produced: producedQty,
        satisfied: producedQty === steel.quantity,
        difference: producedQty - steel.quantity
      };
    });

    console.log('✅ 验证结果:', validation);
    return validation;
  };

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

  const { lossRateData, pieData } = prepareChartData;
  const { sortedStats, specificationTotals, grandTotal } = prepareModuleUsageStats;
  const requirementValidation = validateRequirements();
  const allSatisfied = requirementValidation.every((v: any) => v.satisfied);

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
              rowKey={(record: any, index?: number) => index || 0}
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
          {record.newRemainders?.map((remainder, index) => {
            // 检查是否同时标记为余料和废料
            const isWasteMarked = remainder.isExcess && remainder.isWasteMarked;
            return (
              <Tag 
                key={index} 
                color={isWasteMarked ? "red" : "orange"}
                style={{
                  backgroundColor: isWasteMarked ? '#fff2f0' : undefined,
                  borderColor: isWasteMarked ? '#ffccc7' : undefined,
                  color: isWasteMarked ? '#cf1322' : undefined,
                  fontWeight: isWasteMarked ? 'bold' : 'normal'
                }}
                title={isWasteMarked ? '此余料已计入当前周期废料，但保留为余料供后续生产使用' : '可用余料'}
              >
                {remainder.id}: {remainder.length}mm
                {isWasteMarked && ' ⚠️'}
              </Tag>
            );
          })}
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
      title: '钢材规格',
      dataIndex: 'specification',
      key: 'specification',
      render: (value: string) => (
        <Tag color="blue" style={{ fontSize: '13px', padding: '4px 8px' }}>{value}</Tag>
      ),
    },
    {
      title: '模数钢材长度 (mm)',
      dataIndex: 'length',
      key: 'length',
      render: (value: number | string) => {
        if (value === '-') return value;
        return formatNumber(Number(value), 0);
      },
    },
    {
      title: '采购根数 (钢材条数)',
      dataIndex: 'count',
      key: 'count',
      render: (value: number) => (
        <Text strong style={{ color: '#1890ff' }}>{value} 根</Text>
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
      title: '截面面积 (mm²)',
      dataIndex: 'crossSection',
      key: 'crossSection',
      render: (value: number | string) => {
        if (value === '-') return value;
        return formatNumber(Number(value), 0);
      },
    },
    {
      title: '采购建议',
      key: 'remark',
      render: (_: any, record: any) => {
        if (record.isTotal || record.isSubtotal) {
          return '-';
        }
        return (
          <Text type="secondary">
            需采购 {record.count} 根钢材，每根长度 {formatNumber(record.length, 0)}mm
          </Text>
        );
      },
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
      title: '规格',
      dataIndex: 'specification',
      key: 'specification',
      render: (value: string) => (
        <Tag color="geekblue">{value}</Tag>
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
              <Card title="各规格损耗率对比" size="small">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={lossRateData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="specification" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="lossRate" stroke="#8884d8" name="损耗率 (%)" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="各规格钢材使用分布" size="small">
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
          <Alert
            type="info"
            message="余料标识说明"
            description={
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag color="orange">正常余料</Tag>
                  <Text type="secondary">可用于后续生产</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag 
                    color="red" 
                    style={{
                      backgroundColor: '#fff2f0',
                      borderColor: '#ffccc7',
                      color: '#cf1322',
                      fontWeight: 'bold'
                    }}
                  >
                    余料+废料 ⚠️
                  </Tag>
                  <Text type="secondary">已计入当前周期损耗率，但保留为余料供后续生产使用</Text>
                </div>
              </div>
            }
            style={{ marginBottom: 16 }}
            showIcon
          />
          {(() => {
            // 按规格重新组织优化结果
            const specificationResults = regroupOptimizationResultsBySpecification(
              currentResult.solutions, 
              crossSectionToSpecMapping
            );
            
            return Object.entries(specificationResults).map(([specification, solution]) => (
              <Collapse key={specification} style={{ marginBottom: 16 }}>
                <Panel
                  header={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <Tag color="blue" style={{ fontSize: '14px', padding: '4px 8px' }}>
                        {specification}
                      </Tag>
                      <Text>
                        截面面积: {solution.crossSection}mm²
                      </Text>
                      <Text>
                        损耗率: {((solution.totalWaste / solution.details.reduce((sum: number, d: any) => sum + (d.sourceType === 'module' ? d.sourceLength : 0), 0)) * 100).toFixed(2)}%
                      </Text>
                    </div>
                  }
                  key={specification}
                >
                  <div style={{ marginBottom: 8 }}>
                    <Alert
                      type="info"
                      message={`${specification} 规格钢材切割方案`}
                      description={`该规格对应截面面积 ${solution.crossSection}mm²，以下为详细的切割计划和余料利用情况。`}
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                  </div>
                  <Table
                    columns={cuttingColumns}
                    dataSource={solution.cuttingPlans}
                    rowKey={(record: any, index?: number) => `${specification}-${index}`}
                    pagination={false}
                    size="small"
                    title={() => (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text strong>切割计划明细</Text>
                        <Space>
                          <Text type="secondary">
                            总废料: {solution.totalWaste}mm
                          </Text>
                          <Text type="secondary">
                            总余料: {solution.totalRemainder || 0}mm
                          </Text>
                        </Space>
                      </div>
                    )}
                  />
                </Panel>
              </Collapse>
            ));
          })()}
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
          <Card title="模数钢材采购统计" size="small">
            <Alert
              type="info"
              message="采购指导"
              description="以下统计按钢材规格分组，显示需要采购的钢材条数（根数）。每根钢材可以切割出多个设计件，采购数量已考虑切割优化。"
              style={{ marginBottom: 16 }}
              showIcon
            />
            <Table
              columns={moduleStatsColumns}
              dataSource={[
                ...sortedStats.map((stat: any) => ({
                  key: `detail-${stat.specification}-${stat.length}`,
                  specification: stat.specification,
                  length: stat.length,
                  count: stat.count,
                  totalLength: stat.totalLength,
                  crossSection: stat.crossSection
                })),
                ...Object.entries(specificationTotals).map(([specification, totals]: [string, any]) => ({
                  key: `subtotal-${specification}`,
                  specification: `${specification} 小计`,
                  length: '-',
                  count: totals.count,
                  totalLength: totals.totalLength,
                  crossSection: '-',
                  isSubtotal: true
                })),
                {
                  key: 'total',
                  specification: '总计',
                  length: '-',
                  count: grandTotal.count,
                  totalLength: grandTotal.totalLength,
                  crossSection: '-',
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
              title={() => (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong>采购清单（按规格分组）</Text>
                  <Space>
                    <Text type="secondary">总计: {grandTotal.count}根</Text>
                    <Text type="secondary">总长: {formatNumber(grandTotal.totalLength, 0)}mm</Text>
                  </Space>
                </div>
              )}
            />
          </Card>
          
          <div style={{ marginTop: 16 }}>
            <Alert
              type="success"
              message="采购建议"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li><strong>按规格采购：</strong>严格按照表格中的规格名称采购，不可替换</li>
                  <li><strong>长度要求：</strong>每种规格需要的模数钢材长度和数量如表所示</li>
                  <li><strong>质量要求：</strong>确保采购的钢材截面面积符合设计要求</li>
                  <li><strong>库存管理：</strong>建议按规格分类存储，便于生产时快速取用</li>
                  <li><strong>成本控制：</strong>优先采购使用量大的规格，便于批量优惠</li>
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