# Git Bash 本地启动指南

## 系统概述

钢材采购损耗率估算系统是一个全栈应用，包含：
- **前端**：React + TypeScript + Ant Design (端口: 3000)
- **后端**：Node.js + Express (端口: 5000)  
- **部署**：支持 Netlify 云部署

## 前置要求

### 必需软件
1. **Node.js** (版本 ≥ 16.0.0)
   - 下载地址：https://nodejs.org/
   - 验证安装：`node --version`

2. **npm** (随 Node.js 自动安装)
   - 验证安装：`npm --version`

3. **Git** 
   - 下载地址：https://git-scm.com/
   - 验证安装：`git --version`

4. **Git Bash** (Windows 用户必需)
   - 随 Git 一起安装
   - 或使用 WSL/Linux 终端

## 项目结构

```
钢材系统/
├── client/                 # 前端 React 应用
│   ├── src/               # 源代码
│   ├── public/            # 静态资源
│   ├── build/             # 构建输出
│   └── package.json       # 前端依赖
├── server/                 # 后端 Node.js 应用
│   ├── index.js           # 服务器入口
│   └── uploads/           # 文件上传目录
├── netlify/               # Netlify 云函数
│   └── functions/         # 云函数代码
├── package.json           # 根目录依赖和脚本
└── netlify.toml           # Netlify 配置
```

## 启动方式

### 方式一：一键启动（推荐）

打开 Git Bash，导航到项目根目录：

```bash
# 1. 进入项目目录
cd /c/your-project-path/hgj313

# 2. 安装所有依赖（首次运行必需）
npm run install-all

# 3. 一键启动前端和后端
npm start
```

### 方式二：分别启动

#### 启动后端服务器
```bash
# 打开第一个 Git Bash 窗口
cd /c/your-project-path/hgj313

# 启动后端服务器（端口5000）
npm run server
```

#### 启动前端应用
```bash
# 打开第二个 Git Bash 窗口
cd /c/your-project-path/hgj313

# 启动前端应用（端口3000）
npm run client
```

### 方式三：使用 Netlify 开发环境

```bash
# 使用 Netlify 本地开发环境
npm run dev
```

## 详细启动步骤

### 1. 首次运行准备

```bash
# 克隆项目（如果还没有）
git clone <项目地址>
cd hgj313

# 安装所有依赖
npm run install-all

# 这个命令会依次执行：
# - npm install (根目录依赖)
# - cd client && npm install (前端依赖) 
# - cd netlify/functions && npm install (云函数依赖)
```

### 2. 启动系统

```bash
# 一键启动（推荐）
npm start

# 等待启动信息：
# [0] [nodemon] 3.0.1
# [0] [nodemon] to restart at any time, enter `rs`
# [0] [nodemon] watching path(s): *.*
# [0] [nodemon] starting `node server/index.js`
# [1] 
# [1] > steel-procurement-client@0.1.0 start
# [1] > react-scripts start
```

### 3. 验证启动成功

- **后端服务器**：打开 http://localhost:5000
  - 应该显示："钢材采购损耗率估算系统 API 服务运行中"
  
- **前端应用**：打开 http://localhost:3000
  - 应该显示系统主界面

## 常见启动错误和解决方案

### 错误1：`npm command not found`

**错误信息：**
```bash
bash: npm: command not found
```

**解决方案：**
```bash
# 检查 Node.js 是否正确安装
node --version

# 如果 Node.js 未安装，请到官网下载安装
# https://nodejs.org/

# 重新启动 Git Bash
```

### 错误2：端口被占用

**错误信息：**
```bash
Error: listen EADDRINUSE: address already in use :::3000
Error: listen EADDRINUSE: address already in use :::5000
```

**解决方案：**
```bash
# 查找占用端口的进程
netstat -ano | findstr :3000
netstat -ano | findstr :5000

# 方法1：杀死占用进程
taskkill /PID <进程ID> /F

# 方法2：更改端口
# 编辑 client/package.json，修改 start 脚本：
# "start": "set PORT=3001 && react-scripts start"

# 方法3：使用不同端口启动
PORT=3001 npm run client
```

### 错误3：依赖安装失败

**错误信息：**
```bash
npm ERR! peer dep missing
npm ERR! code ERESOLVE
```

**解决方案：**
```bash
# 清理缓存
npm cache clean --force

# 删除 node_modules 和 package-lock.json
rm -rf node_modules package-lock.json
rm -rf client/node_modules client/package-lock.json

# 重新安装
npm run install-all

# 如果还有问题，使用强制安装
npm install --force
cd client && npm install --force
```

### 错误4：权限问题（Windows）

**错误信息：**
```bash
Error: EPERM: operation not permitted
```

**解决方案：**
```bash
# 以管理员身份运行 Git Bash
# 或者修改文件夹权限

# 临时解决：使用 --unsafe-perm
npm install --unsafe-perm=true
```

### 错误5：路径问题

**错误信息：**
```bash
cd: /c/your-project-path/hgj313: No such file or directory
```

**解决方案：**
```bash
# 检查当前路径
pwd

# 列出文件
ls -la

# 使用正确的路径格式
# Windows: /c/Users/用户名/项目路径
# 或者使用相对路径
cd ./hgj313
```

### 错误6：React 启动失败

**错误信息：**
```bash
Module not found: Error: Can't resolve 'react-scripts'
```

**解决方案：**
```bash
# 进入客户端目录重新安装
cd client
npm install react-scripts --save

# 或者全局安装
npm install -g react-scripts
```

## 环境变量配置

创建 `.env` 文件（如需要）：

```bash
# 在项目根目录创建 .env
touch .env

# 添加环境变量
echo "PORT=5000" >> .env
echo "NODE_ENV=development" >> .env
```

## 开发调试

### 查看日志
```bash
# 后端日志会在终端显示
# 前端日志在浏览器开发者工具中查看
```

### 代码热重载
- **前端**：保存文件后自动刷新浏览器
- **后端**：使用 nodemon，保存文件后自动重启服务器

### 手动重启
```bash
# 重启后端（在后端终端按下）
rs + Enter

# 重启前端（停止并重新启动）
Ctrl + C
npm run client
```

## 性能优化建议

1. **关闭不必要的程序**：释放内存和CPU
2. **使用SSD**：提高文件读写速度
3. **增加内存**：建议8GB以上
4. **定期清理**：清理npm缓存和临时文件

```bash
# 清理命令
npm cache clean --force
rm -rf node_modules/package-lock.json
```

## 生产构建

```bash
# 构建前端用于生产部署
npm run build

# 构建文件位置：client/build/
```

## 常用命令速查

| 命令 | 功能 |
|------|------|
| `npm start` | 一键启动前后端 |
| `npm run server` | 仅启动后端 |
| `npm run client` | 仅启动前端 |
| `npm run build` | 构建生产版本 |
| `npm run install-all` | 安装所有依赖 |
| `npm run dev` | Netlify开发环境 |

## 故障排除流程

1. **检查Node.js版本**：`node --version`
2. **检查npm版本**：`npm --version`
3. **清理缓存**：`npm cache clean --force`
4. **重新安装依赖**：`npm run install-all`
5. **检查端口占用**：`netstat -ano | findstr :3000`
6. **查看详细错误**：使用 `npm start --verbose`

## 技术支持

如遇到其他问题：
1. 查看终端错误信息
2. 检查浏览器开发者工具控制台
3. 确认网络连接正常
4. 重启电脑后重试

---

**注意事项：**
- 首次运行务必执行 `npm run install-all`
- 确保网络连接正常（下载依赖需要）
- Windows用户推荐使用Git Bash而非命令提示符
- 如遇权限问题，尝试以管理员身份运行 