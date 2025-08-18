# 🚀 钢材采购优化系统 V3.0 - Netlify 一键部署

## 📋 快速开始

### 1. 部署检查
```bash
node deploy-netlify.js
```

### 2. Netlify部署 (推荐)

**方式一：网站部署**
1. 访问 [Netlify](https://www.netlify.com) 并登录
2. 点击 "New site from Git"
3. 选择此仓库
4. 配置构建设置：
   - Build command: `npm run build:netlify`
   - Publish directory: `client/build`
   - Functions directory: `netlify/functions`
5. 设置环境变量：
   - `NODE_ENV=production`
   - `REACT_APP_VERSION=3.0.0`
   - `REACT_APP_API_URL=/.netlify/functions`
6. 点击 "Deploy site"

**方式二：CLI部署**
```bash
npm install -g netlify-cli
netlify login
netlify init
npm run build:netlify
netlify deploy --prod
```

## 🔧 部署后测试

```bash
# 测试健康检查
curl https://your-site.netlify.app/.netlify/functions/health

# 测试系统统计
curl https://your-site.netlify.app/.netlify/functions/stats
```

## 📱 API端点映射

| 功能 | 原端点 | Netlify端点 |
|------|--------|-------------|
| 健康检查 | `/api/health` | `/.netlify/functions/health` |
| 优化算法 | `/api/optimize` | `/.netlify/functions/optimize` |
| 文件上传 | `/api/upload-design-steels` | `/.netlify/functions/upload-design-steels` |
| 约束验证 | `/api/validate-constraints` | `/.netlify/functions/validate-constraints` |
| 系统统计 | `/api/stats` | `/.netlify/functions/stats` |
| 任务管理 | `/api/task/*` | `/.netlify/functions/tasks` |

## 📚 详细文档

- 📖 **完整部署指南**: [NETLIFY_DEPLOYMENT_GUIDE.md](./NETLIFY_DEPLOYMENT_GUIDE.md)
- 📋 **部署检查清单**: [NETLIFY_CHECKLIST.md](./NETLIFY_CHECKLIST.md)
- 🔧 **环境变量参考**: [env.example.txt](./env.example.txt)

## ⚡ 特性

- ✅ 自动API路由重定向
- ✅ 完整的CORS支持
- ✅ 文件上传处理 (base64)
- ✅ 异步任务管理
- ✅ 优化算法集成
- ✅ 响应式部署配置

---

🎉 **一切就绪！你的V3系统已准备好部署到Netlify！** 