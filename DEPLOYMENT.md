# 部署指南 - Vercel 全栈部署

本指南将帮助您将整个化妆品安全检测应用（前端 + 后端）部署到 Vercel。

## 📋 部署前准备

### 1. 确保项目结构正确
```
mycosmetic2/
├── backend/          # 后端 API
│   ├── server.js     # 主服务器文件
│   └── package.json  # 后端依赖
├── src/              # 前端源码
├── package.json      # 前端依赖
├── vercel.json       # Vercel 配置
└── .env.production   # 生产环境变量
```

### 2. 数据库准备
确保您的 PostgreSQL 数据库（如 Neon）已经设置好，并且有正确的连接字符串。

## 🚀 部署步骤

### 步骤 1: 推送代码到 GitHub

```bash
# 如果还没有 git 仓库
git init
git add .
git commit -m "Ready for Vercel deployment"

# 推送到 GitHub
git remote add origin https://github.com/你的用户名/mycosmetic2.git
git push -u origin main
```

### 步骤 2: 在 Vercel 中导入项目

1. 访问 [vercel.com](https://vercel.com)
2. 点击 "New Project"
3. 从 GitHub 导入您的 `mycosmetic2` 仓库
4. Vercel 会自动检测到这是一个全栈项目

### 步骤 3: 配置环境变量

在 Vercel 项目设置中添加以下环境变量：

```
DATABASE_URL=你的数据库连接字符串
NODE_ENV=production
```

**重要**: `DATABASE_URL` 应该是您的 PostgreSQL 数据库完整连接字符串，例如：
```
postgresql://username:password@host:port/database?sslmode=require
```

### 步骤 4: 部署

1. 点击 "Deploy" 按钮
2. Vercel 会自动：
   - 构建前端（使用 `npm run vercel-build`）
   - 部署后端 API 为 serverless 函数
   - 配置路由规则

## 📁 关键配置文件说明

### `vercel.json`
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "dist" }
    },
    {
      "src": "backend/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/backend/server.js"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### `.env.production`
```
VITE_API_BASE_URL=/api
```

### 后端修改
- 添加了 Vercel 域名的 CORS 支持
- 条件性服务器启动（仅在开发环境）
- 默认导出 Express 应用

## 🔧 本地测试生产构建

部署前，您可以本地测试生产构建：

```bash
# 构建前端
npm run build

# 预览构建结果
npm run preview

# 测试后端（生产模式）
cd backend
NODE_ENV=production npm start
```

## 🌐 部署后验证

部署完成后，验证以下功能：

1. **前端访问**: `https://你的项目名.vercel.app`
2. **API 健康检查**: `https://你的项目名.vercel.app/api/health`
3. **搜索功能**: 测试产品搜索是否正常工作
4. **数据库连接**: 确保能正常获取产品数据

## 🐛 常见问题排查

### 1. API 调用失败
- 检查环境变量 `DATABASE_URL` 是否正确设置
- 查看 Vercel 函数日志
- 确认数据库允许来自 Vercel 的连接

### 2. CORS 错误
- 确认后端已添加 Vercel 域名支持
- 检查 `server.js` 中的 CORS 配置

### 3. 构建失败
- 检查 `package.json` 中的 `vercel-build` 脚本
- 确认所有依赖都已正确安装

### 4. 数据库连接超时
- Vercel 函数有 10 秒执行限制
- 优化数据库查询性能
- 考虑使用连接池

## 📈 性能优化建议

1. **数据库优化**:
   - 为常用查询添加索引
   - 使用连接池
   - 实现查询缓存

2. **前端优化**:
   - 启用代码分割
   - 压缩图片资源
   - 使用 CDN

3. **API 优化**:
   - 实现响应缓存
   - 分页大数据集
   - 使用 gzip 压缩

## 🔄 更新部署

每次推送到 GitHub 主分支时，Vercel 会自动重新部署：

```bash
git add .
git commit -m "Update application"
git push origin main
```

## 📞 支持

如果遇到部署问题：
1. 查看 Vercel 部署日志
2. 检查函数执行日志
3. 验证环境变量配置
4. 测试数据库连接

---

**注意**: 这个配置支持全栈部署，前端和后端都会部署到同一个 Vercel 项目中，后端作为 serverless 函数运行。