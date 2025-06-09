# 🚀 钢材采购损耗率估算系统 - Netlify部署指南

## 📋 概述

本指南将帮助您将钢材采购损耗率估算系统部署到Netlify。系统包含React前端和Node.js后端，通过Netlify Functions实现全栈部署。

## 🛠️ 前置要求

- ✅ Node.js 18+ 和 npm
- ✅ Git 版本控制
- ✅ Netlify 账户 (https://netlify.com)
- ✅ GitHub/GitLab 账户

## 🔧 第一步：准备项目

### 1. 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装客户端依赖  
cd client && npm install && cd ..

# 安装Netlify Functions依赖
cd netlify/functions && npm install && cd ../..
```

### 2. 验证配置

确保以下文件已正确配置：

- ✅ `netlify.toml` - Netlify配置文件
- ✅ `netlify/functions/` - 后端函数目录
- ✅ 更新了API调用路径

## 🌐 第二步：部署到Netlify

### 方法1：通过Git自动部署（推荐）

#### 1. 推送到Git仓库

##### 方法A: 使用SSH推送（推荐）

```bash
# 初始化Git仓库（如果还没有）
git init

# 添加所有文件
git add .

# 提交更改
git commit -m "Prepare for Netlify deployment"

# 添加SSH远程仓库
git remote add origin git@github.com:username/repository.git

# SSH推送
git push -u origin master
```

**SSH推送问题解决**:

1. **使用专用脚本**（最简单）:
```powershell
# 运行SSH推送脚本
.\ssh_push.ps1
```

2. **手动SSH推送**:
```bash
# 确保SSH密钥已添加到GitHub
ssh -T git@github.com

# 推送代码（需要输入SSH密钥密码）
git push origin master
```

3. **使用SSH Agent缓存密钥**:
```bash
# Windows (Git Bash)
eval $(ssh-agent -s)
ssh-add ~/.ssh/id_ed25519

# 推送（不需要再输入密码）
git push origin master
```

##### 方法B: 使用HTTPS推送

```bash
# 添加HTTPS远程仓库
git remote add origin https://github.com/username/repository.git

# HTTPS推送（需要GitHub Token）
git push -u origin master
```

**获取GitHub Personal Access Token**:
1. 访问: https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 选择权限: `repo`, `workflow`
4. 复制生成的token
5. 推送时使用token作为密码

#### 2. 连接Netlify

1. 登录 [Netlify](https://netlify.com)
2. 点击 "New site from Git"
3. 选择Git提供商（GitHub/GitLab）
4. 选择您的仓库
5. 配置构建设置：
   - **Build command**: `npm run build:netlify`
   - **Publish directory**: `client/build`
   - **Functions directory**: `netlify/functions`

#### 3. 环境变量设置

在Netlify站点设置中添加环境变量：

- `NODE_VERSION`: `18`

### 方法2：手动部署

#### 1. 构建项目

```bash
npm run build:netlify
```

#### 2. 手动上传

1. 登录Netlify控制台
2. 选择 "Deploy manually"
3. 将 `client/build` 文件夹拖拽到部署区域
4. 上传 `netlify/functions` 到Functions

## 🔍 第三步：验证部署

### 1. 功能测试

访问您的Netlify站点，测试以下功能：

- ✅ 页面加载正常
- ✅ 文件上传功能
- ✅ 优化计算功能  
- ✅ Excel导出功能
- ✅ 模数钢材统计

### 2. 查看日志

在Netlify控制台中检查：

- **Site logs** - 构建日志
- **Functions logs** - 函数执行日志
- **Real-time logs** - 实时请求日志

## 🛠️ 常见问题排查

### 1. 构建失败

**问题**: 构建过程中出现错误

**解决方案**:
```bash
# 检查Node版本
node --version  # 应该是18+

# 清理并重新安装依赖
rm -rf node_modules client/node_modules netlify/functions/node_modules
npm run install-all
```

### 2. Functions执行失败

**问题**: API调用返回错误

**解决方案**:
- 检查Netlify Functions日志
- 确认 `netlify/functions/package.json` 中的依赖
- 验证API路径映射 (`/api/*` → `/.netlify/functions/`)

### 3. 文件上传问题

**问题**: Excel文件上传失败

**解决方案**:
- 检查文件大小限制（Netlify Functions 50MB限制）
- 确认 `multiparty` 依赖已安装
- 查看函数日志中的具体错误

### 4. CORS错误

**问题**: 跨域请求被阻止

**解决方案**:
- 确认前端API base URL配置正确
- 检查 `netlify.toml` 中的重定向规则

## 📚 配置说明

### netlify.toml 配置详解

```toml
[build]
  publish = "client/build"          # 前端构建目录
  command = "npm run build:netlify" # 构建命令
  functions = "netlify/functions"   # Functions目录

[build.environment]
  NODE_VERSION = "18"               # Node.js版本

[[redirects]]
  from = "/api/*"                   # API请求路径
  to = "/.netlify/functions/:splat" # 重定向到Functions
  status = 200

[[redirects]]
  from = "/*"                       # SPA路由
  to = "/index.html"                # 重定向到index.html
  status = 200
```

### API路径映射

| 原始路径 | Netlify路径 | Function文件 |
|---------|------------|-------------|
| `/api/upload-design-steels` | `/.netlify/functions/upload-design-steels` | `upload-design-steels.js` |
| `/api/optimize` | `/.netlify/functions/optimize` | `optimize.js` |
| `/api/export-excel` | `/.netlify/functions/export-excel` | `export-excel.js` |

## 🚀 性能优化建议

### 1. 构建优化

```bash
# 生产环境构建优化
export NODE_ENV=production
npm run build:netlify
```

### 2. 函数优化

- 减少函数冷启动时间
- 使用适当的内存限制
- 启用函数缓存（如适用）

### 3. 静态资源优化

- 启用Gzip压缩
- 配置CDN缓存策略
- 优化图片和字体资源

## 📞 支持与帮助

### 1. Netlify官方文档

- [Functions文档](https://docs.netlify.com/functions/overview/)
- [部署配置](https://docs.netlify.com/configure-builds/file-based-configuration/)
- [环境变量](https://docs.netlify.com/environment-variables/overview/)

### 2. 调试工具

```bash
# 本地测试Netlify环境
npx netlify dev

# 部署预览
npx netlify deploy --prod
```

### 3. 监控和分析

- Netlify Analytics - 站点访问统计
- Functions监控 - 函数执行统计
- Real-time logs - 实时日志监控

## ✅ 部署检查清单

在部署前，请确认以下项目：

- [ ] 所有依赖已正确安装
- [ ] API路径已更新
- [ ] 环境变量已配置
- [ ] 构建命令能正常执行
- [ ] Functions目录结构正确
- [ ] Git仓库已推送最新代码
- [ ] Netlify站点配置正确
- [ ] 域名配置（如需要）

## 🎉 部署完成

恭喜！您的钢材采购损耗率估算系统现已成功部署到Netlify。

**下一步**：
- 配置自定义域名
- 设置SSL证书
- 配置备份策略
- 监控系统性能

---

**需要帮助？** 
- 查看Netlify控制台日志
- 检查实时函数执行情况
- 联系技术支持 