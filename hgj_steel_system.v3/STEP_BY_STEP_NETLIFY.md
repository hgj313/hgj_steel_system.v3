# 🚀 Netlify 详细操作步骤（图文并茂）

## 📋 准备工作

确保你的代码已经推送到GitHub/GitLab/Bitbucket仓库。

## 🎯 步骤一：配置构建设置

### 1️⃣ 登录并创建站点

1. **打开浏览器，访问：**
   ```
   https://www.netlify.com
   ```

2. **登录账户**
   - 点击右上角 "Log in" 按钮
   - 选择你的Git提供商（建议用GitHub）
   - 完成授权登录

3. **创建新站点**
   - 登录后，在Dashboard页面点击绿色的 **"New site from Git"** 按钮

### 2️⃣ 连接仓库

1. **选择Git提供商**
   - 点击 **"GitHub"**（或你使用的其他提供商）

2. **授权Netlify**
   - 如果是首次使用，会弹出授权页面
   - 点击 **"Authorize netlify"** 完成授权

3. **选择仓库**
   - 在仓库列表中找到你的项目
   - 点击项目名称（应该是 `hgj_steel_system.v3` 或类似名称）

### 3️⃣ 配置部署设置 ⭐⭐⭐ 重点！

现在会出现 **"Deploy settings"** 页面，这里需要填写以下信息：

```
┌─────────────────────────────────────────────────────────┐
│ Deploy settings                                         │
├─────────────────────────────────────────────────────────┤
│ Owner: [你的账户名] ✓ 自动选择                          │
│                                                         │
│ Branch to deploy: main ✓ 或 master                     │
│                                                         │
│ Basic build settings                                    │
│                                                         │
│ Build command: [     npm run build:netlify        ] ⭐ │
│                                                         │
│ Publish directory: [     client/build             ] ⭐ │
│                                                         │
│ ▼ Show advanced                                         │
│                                                         │
│ Functions directory: [  netlify/functions         ] ⭐ │
│                                                         │
│ [    Cancel    ] [      Deploy site      ]             │
└─────────────────────────────────────────────────────────┘
```

**具体填写：**

1. **Build command** 输入框里填写：
   ```
   npm run build:netlify
   ```

2. **Publish directory** 输入框里填写：
   ```
   client/build
   ```

3. **点击 "Show advanced"** 展开高级设置

4. **Functions directory** 输入框里填写：
   ```
   netlify/functions
   ```

5. **点击绿色的 "Deploy site" 按钮**

### 4️⃣ 等待首次部署

- 会跳转到部署页面，显示构建进度
- 首次部署可能需要5-10分钟
- 如果构建失败，查看日志找出问题

## 🎯 步骤二：配置环境变量

### 1️⃣ 进入站点设置

1. **在部署完成后（或部署过程中）**
   - 点击站点名称回到Dashboard
   - 点击 **"Site settings"** 标签

2. **找到环境变量设置**
   - 在左侧菜单中点击 **"Environment variables"**

### 2️⃣ 添加环境变量 ⭐⭐⭐ 重点！

```
┌─────────────────────────────────────────────────────────┐
│ Environment variables                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ [     + Add variable     ]                              │
│                                                         │
│ Key              Value                                  │
│ ─────────────────────────────────────────────────────── │
│ (这里会显示你添加的环境变量)                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**点击 "Add variable" 按钮，然后逐个添加：**

**第1个变量：**
```
Key:   NODE_ENV
Value: production
```
点击 **"Create variable"**

**第2个变量：**
```
Key:   REACT_APP_VERSION
Value: 3.0.0
```
点击 **"Create variable"**

**第3个变量：**
```
Key:   REACT_APP_API_URL
Value: /.netlify/functions
```
点击 **"Create variable"**

### 3️⃣ 触发重新部署

环境变量设置完成后，需要重新部署：

1. **点击 "Deploys" 标签**
2. **点击 "Trigger deploy" 按钮**
3. **选择 "Deploy site"**

## 🎯 验证部署结果

### 1️⃣ 检查站点访问

部署完成后，你会得到一个类似这样的URL：
```
https://amazing-cupcake-123456.netlify.app
```

**点击这个URL，确认：**
- ✅ 网站能正常访问
- ✅ 页面加载正常
- ✅ 没有明显错误

### 2️⃣ 测试API端点

在浏览器地址栏测试：
```
https://你的站点名.netlify.app/.netlify/functions/health
```

应该返回类似：
```json
{
  "success": true,
  "message": "钢材采购优化系统 V3.0 运行正常 (Netlify)",
  "version": "3.0.0",
  "timestamp": "2024-12-19T...",
  "platform": "Netlify Functions"
}
```

### 3️⃣ 检查Functions部署

1. **在站点Dashboard中点击 "Functions" 标签**
2. **确认能看到以下Functions：**
   - ✅ health
   - ✅ optimize  
   - ✅ stats
   - ✅ tasks
   - ✅ upload-design-steels
   - ✅ validate-constraints

## 🚨 常见错误及解决

### ❌ 构建失败：Command failed with exit code 1

**解决方法：**
1. 检查 Build command 是否正确：`npm run build:netlify`
2. 确认你的 package.json 中有这个脚本
3. 查看构建日志的详细错误信息

### ❌ 404 错误页面

**解决方法：**
1. 检查 Publish directory 是否正确：`client/build`
2. 确认构建成功生成了 client/build 目录

### ❌ API不工作

**解决方法：**
1. 检查 Functions directory 是否正确：`netlify/functions`
2. 确认环境变量设置正确
3. 查看Function日志

## 🎉 完成！

如果所有步骤都正确完成，你的钢材采购优化系统V3.0就成功部署到Netlify了！

**最终检查清单：**
- ✅ 网站可以正常访问
- ✅ API健康检查正常
- ✅ Functions都正确部署
- ✅ 环境变量设置正确

---

**🔗 快速访问链接：**
- 🌐 你的网站：`https://你的站点名.netlify.app`
- 🔧 API健康检查：`https://你的站点名.netlify.app/.netlify/functions/health`
- 📊 系统统计：`https://你的站点名.netlify.app/.netlify/functions/stats` 