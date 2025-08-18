# Algorithm_HGJ4.0

> 🚀 **全新模块化架构 · 智能余料系统 · 约束W优化**

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](https://github.com/hgj313/steel-optimization-v3)
[![Node.js](https://img.shields.io/badge/node.js-16%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-18%2B-61dafb.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-4.7%2B-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 🌟 系统亮点

### V3.0 核心创新

- **🧩 模块化架构**: 完全重构的微服务架构，便于集成和扩展
- **🔄 智能余料系统**: 伪余料/真余料动态识别，损耗率精确计算
- **⚡ 约束W优化**: 新增焊接段数约束，智能冲突检测和解决方案
- **📊 损耗率验证**: 双重验证机制，确保计算准确性
- **🎨 现代化UI**: 苹果风格设计，深色模式，响应式布局
- **🚀 性能优化**: 算法鲁棒性增强，支持多种模数钢材优雅处理

## 📋 功能特性

### 🔧 核心功能
- [x] 设计钢材管理（手动输入 + Excel导入）
- [x] 模数钢材配置（多规格支持）
- [x] 智能优化算法（手动模式）
- [x] MW-CD交换优化（辅助优化器）
- [x] 约束W验证与冲突处理
- [x] 余料系统V3.0（伪余料/真余料分类）
- [x] 损耗率计算与验证
- [x] Excel/PDF报告导出
- [ ] 智能模式（待集成）

### 📈 数据分析
- [x] 实时损耗率分解
- [x] 加权平均验证
- [x] 规格级别统计
- [x] 余料使用追踪
- [x] 优化历史记录
- [x] 性能监控仪表板

### 🎨 用户体验
- [x] 苹果风格设计语言
- [x] 深色/浅色主题切换
- [x] 响应式布局适配
- [x] 毛玻璃效果界面
- [x] 流畅动画交互
- [x] 直观的数据可视化

## 🏗️ 技术架构

### 后端技术栈
```
Node.js + Express.js
├── 核心优化引擎
│   ├── SteelOptimizerV3 (主优化器)
│   ├── RemainderManager (余料管理)
│   ├── ConstraintValidator (约束验证)
│   └── LossRateCalculator (损耗率计算)
├── API服务层
│   ├── OptimizationService (优化服务)
│   └── RESTful API接口
└── 工具模块
    ├── 文件解析器
    ├── 导出生成器
    └── 数据验证器
```

### 前端技术栈
```
React 18 + TypeScript
├── UI组件库
│   ├── Ant Design 5.0
│   ├── Styled Components
│   └── Framer Motion
├── 状态管理
│   ├── React Context
│   └── Custom Hooks
├── 数据可视化
│   ├── Recharts
│   └── 自定义图表组件
└── 路由导航
    └── React Router DOM
```

## 🚀 快速开始

### 环境要求

- **Node.js**: 16.0+ 
- **npm**: 8.0+
- **浏览器**: Chrome 88+, Firefox 78+, Safari 14+
- **内存**: 建议 4GB+
- **存储**: 建议 2GB+ 可用空间

### 安装部署

#### 1. 克隆项目
```bash
git clone https://github.com/hgj313/steel-optimization-v3.git
cd hgj_steel_system.v3
```

#### 2. 安装依赖
```bash
# 安装根目录依赖
npm install

# 安装完整依赖（包含前端和函数）
npm run install-all
```

#### 3. 启动开发环境
```bash
# 同时启动前后端
npm start

# 或分别启动
npm run server  # 后端服务 (http://localhost:3001)
npm run client  # 前端应用 (http://localhost:3000)
```

#### 4. 生产部署
```bash
# 构建生产版本
npm run build

# Netlify部署
npm run dev
```

### 🖥️ 访问地址

- **前端应用**: http://localhost:3000
- **API服务**: http://localhost:3001
- **API文档**: http://localhost:3001/api/health
- **系统状态**: http://localhost:3001/api/stats

## 📖 使用指南

### 基本操作流程

1. **设计钢材输入**
   - 手动添加：长度、数量、截面面积等
   - Excel导入：支持CSV/XLSX格式
   - 数据验证：自动检查数据完整性

2. **模数钢材配置**
   - 添加可用规格：名称、长度
   - 多规格管理：支持不同长度模数钢材
   - 规格排序：按长度自动排列

3. **约束条件设置**
   - **废料阈值S**: 小于此值的余料视为废料
   - **期望损耗率**: 目标损耗率参考
   - **时间限制**: 算法执行超时设置
   - **焊接段数W**: 关键新约束，控制焊接复杂度
   - **余料重用**: 最大重用次数限制

4. **约束验证**
   - 预检查W约束冲突
   - 智能解决方案推荐
   - 数据完整性验证

5. **执行优化**
   - 一键启动优化算法
   - 实时进度监控
   - 结果自动验证

6. **结果分析**
   - 详细切割计划
   - 损耗率分解分析
   - 余料使用统计
   - 导出Excel/PDF报告

### 🔧 约束W使用说明

#### 什么是约束W？
约束W表示允许的最大焊接段数，控制每根设计钢材可以由多少段模数钢材焊接而成。

#### 使用场景
- **W=1**: 不允许焊接，每根设计钢材必须从单段模数钢材切割
- **W=2**: 允许一次焊接，可由2段模数钢材组成
- **W≥3**: 允许多次焊接，适用于复杂结构

#### 冲突处理
当W=1且设计钢材长度超过最大模数钢材长度时，系统会：
1. 检测冲突并给出警告
2. 提供两种解决方案：
   - 方案A：添加更长的模数钢材
   - 方案B：增加允许焊接段数W
3. 用户选择处理方式

### 📊 余料系统V3.0

#### 余料分类
- **伪余料**: 在后续生产中被使用消耗的余料
- **真余料**: 本次生产周期结束后未使用的余料，存入仓库
- **废料**: 长度小于阈值的无法使用的余料

#### 动态判断机制
```
余料产生 → 添加到余料池 → 标记为"待定"
    ↓
后续使用？ → 是：标记为"伪余料" → 继续处理新余料
    ↓
生产结束 → 否：标记为"真余料" → 计入损耗
```

#### 损耗率计算
- **单规格损耗率** = (真余料+废料) / 该规格模数钢材总长度 × 100%
- **总损耗率** = 各规格真余料废料总和 / 各规格模数钢材总长度总和 × 100%
- **验证机制**: 加权平均检查，确保计算正确性

## 🛠️ 开发指南

### 项目结构
```
hgj_steel_system.v3/
├── 📁 core/                    # 核心算法模块
│   ├── optimizer/              # 优化算法
│   ├── constraints/            # 约束处理
│   ├── remainder/              # 余料管理
│   └── calculator/             # 计算模块
├── 📁 api/                     # API服务层
│   ├── services/               # 业务服务
│   ├── controllers/            # 控制器
│   └── types/                  # 类型定义
├── 📁 server/                  # 服务器配置
├── 📁 client/                  # React前端应用
│   ├── src/
│   │   ├── components/         # UI组件
│   │   ├── pages/              # 页面组件
│   │   ├── hooks/              # 自定义Hooks
│   │   ├── contexts/           # React Context
│   │   ├── styles/             # 样式主题
│   │   └── types/              # TypeScript类型
│   └── public/                 # 静态资源
├── 📁 utils/                   # 工具函数
├── 📁 config/                  # 配置文件
├── 📁 netlify/                 # Netlify部署
└── 📄 README.md               # 文档说明
```

### API接口文档

#### 优化接口
```typescript
POST /api/optimize
{
  designSteels: DesignSteel[],      // 设计钢材
  moduleSteels: ModuleSteel[],      // 模数钢材
  constraints: OptimizationConstraints  // 约束条件
}
```

#### 约束验证
```typescript
POST /api/validate-constraints
{
  designSteels: DesignSteel[],
  moduleSteels: ModuleSteel[],
  constraints: OptimizationConstraints
}
```

#### 系统状态
```typescript
GET /api/health                   // 健康检查
GET /api/stats                    // 系统统计
GET /api/optimize/history         // 优化历史
GET /api/optimize/active          // 活跃任务
```

### 自定义开发

#### 添加新的优化算法
```javascript
// 1. 继承基础优化器
class CustomOptimizer extends SteelOptimizerV3 {
  async optimize() {
    // 实现自定义优化逻辑
  }
}

// 2. 注册到服务中
const optimizationService = new OptimizationService();
optimizationService.registerOptimizer('custom', CustomOptimizer);
```

#### 扩展余料处理
```javascript
// 自定义余料管理策略
class CustomRemainderManager extends RemainderManager {
  findBestRemainderCombination(targetLength, crossSection) {
    // 实现自定义余料选择策略
  }
}
```

#### 添加新约束
```javascript
// 扩展约束验证器
class CustomConstraintValidator extends ConstraintValidator {
  validateCustomConstraint(designSteels, moduleSteels, constraints) {
    // 实现自定义约束验证
  }
}
```

## 🔍 故障排除

### 常见问题

#### 1. 启动失败
```bash
# 检查Node.js版本
node --version  # 需要 16.0+

# 清理依赖重新安装
rm -rf node_modules package-lock.json
npm install
```

#### 2. 端口占用
```bash
# 检查端口占用
netstat -ano | findstr :3001

# 使用不同端口
PORT=3002 npm start
```

#### 3. 内存不足
```bash
# 增加Node.js内存限制
export NODE_OPTIONS="--max-old-space-size=4096"
npm start
```

#### 4. 优化算法报错
- 检查约束W设置是否合理
- 验证设计钢材数据完整性
- 确认模数钢材配置正确
- 查看控制台错误日志

#### 5. 前端显示异常
- 清除浏览器缓存
- 检查浏览器兼容性
- 验证API服务连接
- 重新构建前端应用

### 性能优化建议

#### 算法性能
- 合理设置时间限制
- 避免过多的设计钢材数量
- 优化模数钢材规格配置
- 使用适当的约束条件

#### 系统性能
- 定期清理优化历史
- 监控内存使用情况
- 优化数据库查询（如适用）
- 使用CDN加速静态资源

## 📞 技术支持

### 联系方式
- **开发团队**: HGJ技术团队
- **邮箱**: support@hgj.tech
- **GitHub**: https://github.com/hgj313/steel-optimization-v3
- **文档**: https://docs.hgj.tech/steel-v3

### 报告问题
在GitHub上提交Issue时，请包含：
1. 系统环境信息（OS、Node.js版本等）
2. 错误重现步骤
3. 错误日志和截图
4. 期望的行为描述

### 贡献代码
1. Fork项目仓库
2. 创建特性分支
3. 提交代码变更
4. 发起Pull Request

## 📄 许可证

本项目采用 [MIT许可证](LICENSE)。

---

## 📋 更新日志

### V3.0.1 (2025-06-23) - PDF功能重构
- 🚀 **重大重构**: 将PDF导出功能从复杂的 `jsPDF` 库迁移到简单、可靠的 **HTML文件生成方案**。
- ✅ **解决中文乱码**: 新方案通过生成HTML，从根本上解决了PDF导出时的中文乱码问题。
- ✨ **简化流程**: 用户现在下载的是一个HTML文件，可以在浏览器中完美渲染，并使用打印功能（Ctrl+P）轻松保存为PDF。
- 🗑️ **精简依赖**: 移除了 `jsPDF` 和 `jsPDF-AutoTable` 库，使后端服务更轻量。

### V3.0.0 (2024-06-19)
🎉 **重大版本更新 - 模块化重构**

#### 🚀 新功能
- ✨ 全新模块化架构，支持插件化扩展
- 🔄 智能余料系统V3.0（伪余料/真余料动态识别）
- ⚡ 约束W支持（焊接段数控制）
- 📊 双重损耗率验证机制
- 🎨 苹果风格现代化UI设计
- 🌙 深色模式支持
- 📱 完全响应式布局

#### 🔧 优化改进
- 🚀 算法鲁棒性大幅提升
- 📈 支持多种长度模数钢材优雅处理
- 💾 优化内存使用和性能
- 🔒 增强数据验证和错误处理
- 📝 完善API文档和类型定义

#### 🗑️ 移除功能
- ❌ 移除智能模式算法（待后续集成）
- 🔄 重构原有余料标记规则

#### 🐛 问题修复
- 修复多规格钢材处理错误
- 解决内存泄漏问题
- 修正损耗率计算精度问题
- 优化文件上传处理逻辑

---

**🎯 下一步计划 (V3.1.0)**
- 🤖 智能优化算法集成
- 🔧 高级约束条件支持
- 📊 增强数据分析功能
- 🌐 多语言国际化支持
- 📦 npm包发布支持

---

*Built with ❤️ by HGJ技术团队* 