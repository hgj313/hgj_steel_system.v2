# 钢材采购损耗率估算系统

一个基于Web的钢材采购优化系统，通过智能算法计算最优切割方案，最小化材料损耗率。

## 功能特性

### 核心功能
- **设计钢材管理**：支持Excel .xls文件上传和手动添加
- **模数钢材管理**：添加和管理可用的原材料规格
- **智能优化算法**：基于First Fit Decreasing算法的损耗率优化
- **实时计算**：可设置计算时间限制，支持中途停止
- **结果可视化**：损耗率趋势图表和数据分析
- **多格式导出**：支持Excel和PDF格式导出结果

### 约束条件
- 生产数量必须严格等于需求数量
- 余料只能用于相同截面面积的设计钢材
- 余料小于阈值S时视为废料
- 模数钢材数量视为无限

## 技术栈

### 后端
- Node.js + Express
- XLSX文件处理
- 钢材切割优化算法

### 前端
- React 18 + TypeScript
- Ant Design UI组件库
- Recharts图表库
- Axios HTTP客户端

## 安装和运行

### 1. 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装前端依赖
cd client
npm install
cd ..
```
## 算法说明

### 优化策略
1. **分组处理**：按截面面积将设计钢材分组
2. **贪心选择**：优先选择最适合的模数钢材
3. **First Fit Decreasing**：按长度降序排列，依次切割
4. **余料管理**：余料可继续用于相同截面的切割

### 性能特点
- 时间复杂度：O(n²m)，n为设计钢材数量，m为模数钢材数量
- 空间复杂度：O(n)
- 近似比：通常能达到理论最优解的90%以上

## 项目结构

```
steel-procurement-system/
├── server/                 # 后端代码
│   ├── index.js           # 服务器主文件
│   └── uploads/           # 文件上传目录
├── client/                # 前端代码
│   ├── src/
│   │   ├── components/    # React组件
│   │   ├── utils/         # 工具函数
│   │   ├── types.ts       # TypeScript类型定义
│   │   └── App.tsx        # 主应用组件
│   └── public/
├── package.json           # 项目配置
└── README.md             # 项目文档
```

## 开发指南

### 添加新功能
1. 后端API：在`server/index.js`中添加新的路由
2. 前端组件：在`client/src/components/`中创建新组件
3. 类型定义：在`client/src/types.ts`中添加TypeScript类型

### 算法优化
核心算法在`server/index.js`的`SteelOptimizer`类中：
- `optimizeGroup()`: 单个截面组的优化
- `selectBestModule()`: 模数钢材选择策略
- `cutModule()`: 单根钢材切割方案

## 许可证

MIT License

## 联系方式

email:2486575431@qq.com 
