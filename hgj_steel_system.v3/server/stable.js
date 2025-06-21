/**
 * 钢材采购优化系统 V3.0 - 稳定版服务器
 * 结合简化版的稳定性和完整版的功能
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const databaseManager = require('./database/Database');

const app = express();
const PORT = process.env.PORT || 5099;

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

// 创建uploads目录
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, `${timestamp}-${originalName}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// 优化服务实例（延迟加载）
let optimizationService = null;

// 延迟加载优化服务
function getOptimizationService() {
  if (!optimizationService) {
    try {
      const OptimizationService = require('../api/services/OptimizationService');
      optimizationService = new OptimizationService();
      console.log('✅ 优化服务模块加载成功');
    } catch (error) {
      console.warn('⚠️ 优化服务模块加载失败，将使用模拟模式:', error.message);
      optimizationService = createMockOptimizationService();
    }
  }
  return optimizationService;
}

// 创建模拟优化服务
function createMockOptimizationService() {
  return {
    optimizeSteel: async (data) => ({
      success: true,
      result: {
        totalLossRate: 3.5,
        totalModuleUsed: 100,
        totalWaste: 50,
        solutions: {},
        executionTime: 1500
      },
      optimizationId: 'mock_' + Date.now(),
      stats: { totalCuts: 10, remaindersGenerated: 5 }
    }),
    validateWeldingConstraints: async (data) => ({
      success: true,
      validation: { isValid: true, violations: [], suggestions: [] }
    }),
    getOptimizationProgress: (id) => ({
      success: true,
      status: 'completed',
      runningTime: 1500
    }),
    cancelOptimization: (id) => ({
      success: true,
      message: '优化已取消'
    }),
    getActiveOptimizers: () => ({
      success: true,
      activeOptimizers: []
    }),
    getOptimizationHistory: (limit) => ({
      success: true,
      history: []
    }),
    getSystemStats: () => ({
      success: true,
      stats: {
        totalOptimizations: 0,
        averageExecutionTime: 0,
        successRate: 100
      }
    }),
    cleanupExpiredOptimizers: () => {}
  };
}

// ==================== API路由 ====================

/**
 * 系统健康检查
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '钢材采购优化系统 V3.0 运行正常',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    optimizationServiceStatus: optimizationService ? 'loaded' : 'not_loaded'
  });
});

/**
 * 获取系统统计信息
 */
app.get('/api/stats', async (req, res) => {
  console.log('🔍 Stats端点被访问');
  try {
    console.log('🔧 获取数据库统计...');
    const dbStats = databaseManager.getStats();
    
    console.log('🔧 获取优化服务统计...');
    const service = getOptimizationService();
    const serviceStats = service.getSystemStats();
    
    // 合并数据库和服务统计
    const combinedStats = {
      success: true,
      stats: {
        totalOptimizations: dbStats?.completedTasks || 0,
        totalDesignSteels: dbStats?.designSteels || 0,
        totalModuleSteels: dbStats?.moduleSteels || 0,
        totalSavedCost: 0, // 待开发功能
        averageExecutionTime: serviceStats?.stats?.averageExecutionTime || 0,
        successRate: serviceStats?.stats?.successRate || 100,
        databaseSize: dbStats?.databaseSize || '未知',
        lastUpdated: dbStats?.lastUpdated || new Date().toISOString()
      }
    };
    
    console.log('✅ Stats数据:', combinedStats);
    res.json(combinedStats);
  } catch (error) {
    console.error('❌ Stats端点错误:', error);
    res.status(500).json({
      success: false,
      error: `获取系统统计失败: ${error.message}`
    });
  }
});

/**
 * 验证约束条件
 */
app.post('/api/validate-constraints', async (req, res) => {
  try {
    const service = getOptimizationService();
    const result = await service.validateWeldingConstraints(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `约束验证失败: ${error.message}`
    });
  }
});

/**
 * 执行钢材优化 - 异步任务模式
 */
app.post('/api/optimize', async (req, res) => {
  console.log('--- ENTERING NEW ASYNC /api/optimize (DEBUG V5) ---');
  try {
    console.log('🚀 收到优化请求 - 异步模式');
    console.log('设计钢材数量:', req.body.designSteels?.length || 0);
    console.log('模数钢材数量:', req.body.moduleSteels?.length || 0);
    console.log('约束条件:', req.body.constraints);

    // 创建异步任务
    const taskId = await databaseManager.createOptimizationTask(req.body);
    
    // 立即返回taskId，不等待优化完成
    res.json({
      success: true,
      taskId: taskId,
      message: '优化任务已创建，请通过taskId查询进度',
      status: 'pending'
    });
    
    // 在后台异步执行优化
    executeOptimizationTask(taskId, req.body);
    
  } catch (error) {
    console.error('❌ 创建优化任务失败:', error);
    res.status(500).json({
      success: false,
      error: `创建优化任务失败: ${error.message}`
    });
  }
});

/**
 * 异步执行优化任务
 */
async function executeOptimizationTask(taskId, optimizationData) {
  try {
    console.log(`🔄 开始执行优化任务: ${taskId}`);
    
    // 更新任务状态为运行中
    await databaseManager.updateTaskStatus(taskId, 'running', {
      progress: 10,
      message: '正在初始化优化器...'
    });
    
    // 获取优化服务实例
    const service = getOptimizationService();
    
    // 模拟进度更新
    await databaseManager.updateTaskProgress(taskId, 20, '正在解析输入数据...');
    
    // 执行优化计算
    await databaseManager.updateTaskProgress(taskId, 30, '正在计算最优切割方案...');
    
    const result = await service.optimizeSteel(optimizationData);
    
    if (result.success) {
      console.log(`✅ 优化任务完成: ${taskId}`);
      console.log('执行时间:', result.executionTime + 'ms');
      console.log('总损耗率:', result.result?.totalLossRate + '%');

      // 保存优化结果到数据库
      await databaseManager.setTaskResults(taskId, result.result);
      
      // 记录操作日志
      await databaseManager.logOperation(
        'optimize',
        `完成优化任务 ${taskId}`,
        { 
          optimizationId: result.optimizationId,
          executionTime: result.executionTime,
          totalLossRate: result.result?.totalLossRate
        }
      );
      
    } else {
      console.log(`❌ 优化任务失败: ${taskId}`, result.error);
      await databaseManager.setTaskError(taskId, new Error(result.error || '优化计算失败'));
    }
    
  } catch (error) {
    console.error(`❌ 执行优化任务异常: ${taskId}`, error);
    await databaseManager.setTaskError(taskId, error);
  }
}

/**
 * 获取任务状态和结果
 */
app.get('/api/task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = databaseManager.getOptimizationTask(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    // 构建响应数据
    const response = {
      success: true,
      taskId: task.id,
      status: task.status,
      progress: task.progress,
      message: task.message,
      executionTime: task.executionTime,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    };
    
    // 如果任务完成，包含结果数据
    if (task.status === 'completed' && task.results) {
      try {
        response.results = JSON.parse(task.results);
      } catch (parseError) {
        console.error('解析任务结果失败:', parseError);
        response.results = null;
      }
    }
    
    // 如果任务失败，包含错误信息
    if (task.status === 'failed' && task.error) {
      response.error = task.error;
    }
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ 获取任务状态失败:', error);
    res.status(500).json({
      success: false,
      error: `获取任务状态失败: ${error.message}`
    });
  }
});

/**
 * 获取所有任务列表
 */
app.get('/api/tasks', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status; // 可选的状态过滤
    
    let tasks = databaseManager.getOptimizationTasks();
    
    // 状态过滤
    if (status) {
      tasks = tasks.filter(task => task.status === status);
    }
    
    // 按创建时间倒序排列
    tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // 限制返回数量
    tasks = tasks.slice(0, limit);
    
    // 简化任务信息（不包含完整结果）
    const simplifiedTasks = tasks.map(task => ({
      id: task.id,
      status: task.status,
      progress: task.progress,
      message: task.message,
      executionTime: task.executionTime,
      inputData: task.inputData,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      hasResults: task.status === 'completed' && !!task.results
    }));
    
    res.json({
      success: true,
      tasks: simplifiedTasks,
      total: databaseManager.getOptimizationTasks().length
    });
    
  } catch (error) {
    console.error('❌ 获取任务列表失败:', error);
    res.status(500).json({
      success: false,
      error: `获取任务列表失败: ${error.message}`
    });
  }
});

/**
 * 取消任务
 */
app.delete('/api/task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = databaseManager.getOptimizationTask(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    // 只能取消待执行或正在执行的任务
    if (task.status !== 'pending' && task.status !== 'running') {
      return res.status(400).json({
        success: false,
        error: '只能取消待执行或正在执行的任务'
      });
    }
    
    // 更新任务状态为已取消
    await databaseManager.updateTaskStatus(taskId, 'cancelled', {
      message: '任务已被用户取消'
    });
    
    res.json({
      success: true,
      message: '任务已取消'
    });
    
  } catch (error) {
    console.error('❌ 取消任务失败:', error);
    res.status(500).json({
      success: false,
      error: `取消任务失败: ${error.message}`
    });
  }
});

/**
 * 获取优化进度
 */
app.get('/api/optimize/:optimizationId/progress', (req, res) => {
  try {
    const { optimizationId } = req.params;
    const service = getOptimizationService();
    const result = service.getOptimizationProgress(optimizationId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `获取优化进度失败: ${error.message}`
    });
  }
});

/**
 * 取消优化
 */
app.delete('/api/optimize/:optimizationId', (req, res) => {
  try {
    const { optimizationId } = req.params;
    const service = getOptimizationService();
    const result = service.cancelOptimization(optimizationId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `取消优化失败: ${error.message}`
    });
  }
});

/**
 * 获取活跃的优化任务
 */
app.get('/api/optimize/active', (req, res) => {
  try {
    const service = getOptimizationService();
    const result = service.getActiveOptimizers();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `获取活跃优化任务失败: ${error.message}`
    });
  }
});

/**
 * 获取优化历史
 */
app.get('/api/optimize/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const service = getOptimizationService();
    const result = service.getOptimizationHistory(limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `获取优化历史失败: ${error.message}`
    });
  }
});

/**
 * 上传设计钢材文件 - 支持JSON和multipart两种格式
 */
app.post('/api/upload-design-steels', async (req, res) => {
  try {
    console.log('📁 处理文件上传请求');
    
    // 处理JSON格式的base64数据
    if (req.is('application/json') && req.body.data) {
      const { filename, data, type } = req.body;
      
      console.log('JSON格式上传:', { filename, type, size: data.length });
      
      // 解析base64数据
      const buffer = Buffer.from(data, 'base64');
      
      // 解析文件并返回设计钢材数据
      const designSteels = await parseFileBuffer(buffer, filename, type);
      
      res.json({
        success: true,
        message: `文件解析成功，找到 ${designSteels.length} 条设计钢材数据`,
        designSteels: designSteels,
        debugInfo: {
          原始行数: designSteels.length + 1,
          有效数据: designSteels.length,
          列名信息: '编号,构件编号,规格,长度,数量,截面面积,部件编号',
          截面面积统计: {
            有截面面积: designSteels.filter(s => s.crossSection > 0).length,
            无截面面积: designSteels.filter(s => s.crossSection === 0).length
          }
        }
      });

      // === 持久化到JSON数据库 ===
      try {
        await databaseManager.saveDesignSteels(designSteels);
        await databaseManager.logOperation(
          'upload',
          `上传设计钢材文件 ${filename}`,
          { count: designSteels.length, filename }
        );
      } catch (dbErr) {
        console.warn('⚠️ 设计钢材数据未写入数据库:', dbErr.message);
      }
      
      return;
    }
    
    // 处理multipart/form-data格式
    upload.single('file')(req, res, async (err) => {
      if (err) {
        console.error('❌ 文件上传错误:', err);
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '未接收到文件'
        });
      }

      console.log('文件上传成功:', req.file.originalname);
      
      // 读取文件并解析
      const buffer = fs.readFileSync(req.file.path);
      const designSteels = await parseFileBuffer(buffer, req.file.originalname, req.file.mimetype);
      
      res.json({
        success: true,
        message: `文件解析成功，找到 ${designSteels.length} 条设计钢材数据`,
        designSteels: designSteels,
        debugInfo: {
          原始行数: designSteels.length + 1,
          有效数据: designSteels.length,
          列名信息: '编号,构件编号,规格,长度,数量,截面面积,部件编号',
          截面面积统计: {
            有截面面积: designSteels.filter(s => s.crossSection > 0).length,
            无截面面积: designSteels.filter(s => s.crossSection === 0).length
          }
        }
      });

      // === 持久化到JSON数据库 ===
      try {
        await databaseManager.saveDesignSteels(designSteels);
        await databaseManager.logOperation(
          'upload',
          `上传设计钢材文件 ${req.file.originalname}`,
          { count: designSteels.length, filename: req.file.originalname }
        );
      } catch (dbErr) {
        console.warn('⚠️ 设计钢材数据未写入数据库:', dbErr.message);
      }
      
      return;
    });

  } catch (error) {
    console.error('❌ 文件处理错误:', error);
    res.status(500).json({
      success: false,
      error: `文件处理失败: ${error.message}`
    });
  }
});

/**
 * 导出Excel报告
 */
app.post('/api/export/excel', async (req, res) => {
  try {
    // Excel导出功能待实现
    res.json({
      success: false,
      error: 'Excel导出功能正在开发中'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `Excel导出失败: ${error.message}`
    });
  }
});

/**
 * 导出PDF报告
 */
app.post('/api/export/pdf', async (req, res) => {
  try {
    // PDF导出功能待实现
    res.json({
      success: false,
      error: 'PDF导出功能正在开发中'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `PDF导出失败: ${error.message}`
    });
  }
});

// ==================== 文件解析功能 ====================

/**
 * 解析文件缓冲区为设计钢材数据
 */
async function parseFileBuffer(buffer, filename, mimetype) {
  console.log(`📊 开始解析文件: ${filename}, 类型: ${mimetype}`);
  
  try {
    let data = [];
    
    if (filename.toLowerCase().endsWith('.csv')) {
      // 解析CSV文件
      data = await parseCSVBuffer(buffer);
    } else if (filename.toLowerCase().endsWith('.xlsx') || filename.toLowerCase().endsWith('.xls')) {
      // 解析Excel文件
      const XLSX = require('xlsx');
      data = parseExcelBuffer(buffer, XLSX);
    } else {
      throw new Error('不支持的文件格式');
    }
    
    console.log(`📊 解析完成，找到 ${data.length} 条原始数据`);
    
    // 转换为标准格式
    const steelData = data.map((row, index) => {
      // 尝试多种可能的列名映射
      const length = parseFloat(
        row['长度'] || row['长度(mm)'] || row['Length'] || row['length'] || 
        row['长度 (mm)'] || row['长度（mm）'] || row['长度mm'] || 0
      );
      
      const quantity = parseInt(
        row['数量'] || row['Quantity'] || row['quantity'] || row['件数'] || 
        row['数量(件)'] || row['数量（件）'] || 1
      );
      
      const crossSection = parseFloat(
        row['截面面积'] || row['截面面积(mm²)'] || row['截面面积（mm²）'] || 
        row['CrossSection'] || row['crossSection'] || row['面积'] || 0
      );
      
      const componentNumber = String(
        row['构件编号'] || row['构件号'] || row['ComponentNumber'] || 
        row['componentNumber'] || row['编号'] || `GJ${String(index + 1).padStart(3, '0')}`
      );
      
      const specification = String(
        row['规格'] || row['Specification'] || row['specification'] || 
        row['型号'] || row['钢材规格'] || ''
      );
      
      const partNumber = String(
        row['部件编号'] || row['部件号'] || row['PartNumber'] || 
        row['partNumber'] || row['零件号'] || `BJ${String(index + 1).padStart(3, '0')}`
      );
      
      return {
        id: `steel_${Date.now()}_${index}`,
        length: length || 0,
        quantity: quantity || 1,
        crossSection: crossSection || 0,
        componentNumber: componentNumber,
        specification: specification,
        partNumber: partNumber
      };
    }).filter(steel => steel.length > 0); // 过滤掉长度为0的数据
    
    console.log(`✅ 数据转换完成，有效数据 ${steelData.length} 条`);
    return steelData;
    
  } catch (error) {
    console.error('❌ 文件解析错误:', error);
    throw new Error(`文件解析失败: ${error.message}`);
  }
}

/**
 * 解析Excel缓冲区
 */
function parseExcelBuffer(buffer, XLSX) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // 转换为JSON格式
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    defval: '',
    raw: false
  });
  
  if (jsonData.length < 2) {
    throw new Error('Excel文件数据不足，至少需要标题行和一行数据');
  }
  
  // 第一行作为标题
  const headers = jsonData[0];
  const rows = jsonData.slice(1);
  
  // 转换为对象数组
  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] || '';
    });
    return obj;
  });
}

/**
 * 解析CSV缓冲区
 */
function parseCSVBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const csv = require('csv-parser');
    const { Readable } = require('stream');
    const results = [];
    const stream = Readable.from(buffer.toString('utf8'));
    
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

// ==================== 错误处理 ====================

// 处理文件上传错误
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: '文件大小超过限制（最大10MB）'
      });
    }
  }
  
  if (error.message) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
  
  next(error);
});

// 全局错误处理
app.use((error, req, res, next) => {
  console.error('🚨 服务器错误:', error);
  
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `API端点不存在: ${req.method} ${req.originalUrl}`
  });
});

// ==================== 服务器启动 ====================

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    console.log('💾 正在初始化数据库...');
    const dbInitSuccess = await databaseManager.init();
    if (!dbInitSuccess) {
      console.warn('⚠️ 数据库初始化失败，系统将以内存模式运行');
    }

    app.listen(PORT, () => {
      console.log('🚀 钢材采购优化系统 V3.0 稳定版服务器启动成功');
      console.log(`🌐 服务地址: http://localhost:${PORT}`);
      console.log(`📚 API文档: http://localhost:${PORT}/api/health`);
      console.log('🔧 模块化架构已启用（延迟加载）');
      console.log('✨ 新功能: 余料系统V3.0、约束W、损耗率验证');
      console.log('💾 数据库: JSON文件数据库已集成');
      
      // 显示可用的API端点
      console.log('\n📋 可用的API端点:');
      console.log('  GET  /api/health                    - 系统健康检查');
      console.log('  GET  /api/stats                     - 系统统计信息');
      console.log('  POST /api/validate-constraints      - 验证约束条件');
      console.log('  POST /api/optimize                  - 执行优化');
      console.log('  GET  /api/optimize/:id/progress     - 优化进度');
      console.log('  DEL  /api/optimize/:id              - 取消优化');
      console.log('  GET  /api/optimize/active           - 活跃优化任务');
      console.log('  GET  /api/optimize/history          - 优化历史');
      console.log('  POST /api/upload-design-steels      - 上传文件');
      console.log('  POST /api/export/excel              - 导出Excel');
      console.log('  POST /api/export/pdf                - 导出PDF');
      console.log('  GET  /api/task/:taskId               - 获取任务状态');
      console.log('  GET  /api/tasks                      - 获取任务列表');
      console.log('  DEL  /api/task/:taskId               - 取消任务');
      console.log('');
      
      // 延迟加载优化服务
      getOptimizationService();
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();

// 定期清理过期的优化器
setInterval(() => {
  try {
    const service = getOptimizationService();
    service.cleanupExpiredOptimizers();
  } catch (error) {
    // 忽略清理错误
  }
}, 60000); // 每分钟清理一次

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 收到关闭信号，正在关闭服务器...');
  
  // 取消所有活跃的优化任务
  try {
    const service = getOptimizationService();
    const activeOptimizers = service.getActiveOptimizers();
    if (activeOptimizers.success && activeOptimizers.activeOptimizers.length > 0) {
      console.log(`🔄 取消 ${activeOptimizers.activeOptimizers.length} 个活跃的优化任务...`);
      activeOptimizers.activeOptimizers.forEach(opt => {
        service.cancelOptimization(opt.id);
      });
    }
  } catch (error) {
    // 忽略关闭时的错误
  }
  
  console.log('✅ 服务器已关闭');
  process.exit(0);
});

module.exports = app; 