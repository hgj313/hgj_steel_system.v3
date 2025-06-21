# 端口配置说明

## 🚀 服务端口配置

### 前端服务 (React)
- **端口**: 3001
- **访问地址**: http://localhost:3001
- **配置文件**: `client/package.json`

### 后端服务 (Express)
- **端口**: 5004  
- **访问地址**: http://localhost:5004
- **配置文件**: `server/stable.js`

## 📋 启动命令

### 1. 分别启动服务

```bash
# 启动后端服务 (端口 5004)
node server/stable.js

# 启动前端服务 (端口 3001) 
npm run start:client
```

### 2. 同时启动前后端服务

```bash
# 开发模式 - 同时启动前后端
npm run start:dev
```

### 3. 仅启动后端生产服务

```bash
# 生产模式 - 仅后端服务
npm start
```

## 🔧 端口配置详情

### 前端端口设置
- 方式1: 在 `client/package.json` 的 scripts 中设置
  ```json
  "start": "set PORT=3001 && react-scripts start"
  ```

### 后端端口设置
- 在 `server/stable.js` 中配置
  ```javascript
  const PORT = process.env.PORT || 5004;
  ```

### 代理配置
- 前端通过 `client/package.json` 中的 proxy 字段代理到后端
  ```json
  "proxy": "http://localhost:5004"
  ```

## 🌐 API 端点

所有API请求将通过前端代理转发到后端 5004 端口：

- `GET /api/health` - 系统健康检查
- `POST /api/optimize` - 执行优化
- `POST /api/upload-design-steels` - 上传文件
- 更多端点请查看后端控制台输出

## 🛠️ 故障排查

### 端口被占用
```bash
# Windows 查看端口占用
netstat -ano | findstr :3001
netstat -ano | findstr :5001

# 终止进程
taskkill /PID <进程ID> /F
```

### 代理问题
如果前端无法访问后端API，请检查：
1. 后端服务是否在 5004 端口运行
2. 代理配置是否正确
3. 防火墙设置 