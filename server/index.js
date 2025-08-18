/**
 * 钢材采购优化系统 V3.0 - Express服务器
 * 提供RESTful API接口，支持模块化架构
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

// 导入服务层
const OptimizationService = require('../api/services/OptimizationService');

const app = express();
const PORT = process.env.PORT || 5001;

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, `${timestamp}-${originalName}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件格式，请上传CSV或Excel文件'));
    }
  }
});

// 创建服务实例
const optimizationService = new OptimizationService();

// 定期清理过期的优化器
setInterval(() => {
  optimizationService.cleanupExpiredOptimizers();
}, 60000); // 每分钟清理一次

// ==================== API路由 ====================

/**
 * 系统健康检查
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '钢材采购优化系统 V3.0 运行正常 - 已整合V2所有上传优点',
    version: '3.0.0-enhanced',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    features: ['V2完整文件处理', 'V2数据统计分析', 'V2调试信息系统', 'V2显示ID生成', '8个核心字段支持', '智能列名映射']
  });
});

/**
 * 获取系统统计信息
 */
app.get('/api/stats', async (req, res) => {
  try {
    const stats = optimizationService.getSystemStats();
    res.json(stats);
  } catch (error) {
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
    const result = await optimizationService.validateWeldingConstraints(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `约束验证失败: ${error.message}`
    });
  }
});

/**
 * 执行钢材优化
 */
app.post('/api/optimize', async (req, res) => {
  try {
    console.log('🚀 收到优化请求');
    console.log('设计钢材数量:', req.body.designSteels?.length || 0);
    console.log('模数钢材数量:', req.body.moduleSteels?.length || 0);
    console.log('约束条件:', req.body.constraints);

    const result = await optimizationService.optimizeSteel(req.body);
    
    if (result.success) {
      console.log('✅ 优化完成');
      console.log('执行时间:', result.executionTime + 'ms');
      console.log('总损耗率:', result.result?.totalLossRate + '%');
    } else {
      console.log('❌ 优化失败:', result.error);
    }

    res.json(result);
  } catch (error) {
    console.error('❌ 优化API错误:', error);
    res.status(500).json({
      success: false,
      error: `优化请求处理失败: ${error.message}`
    });
  }
});

/**
 * 获取优化进度
 */
app.get('/api/optimize/:optimizationId/progress', (req, res) => {
  try {
    const { optimizationId } = req.params;
    const result = optimizationService.getOptimizationProgress(optimizationId);
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
    const result = optimizationService.cancelOptimization(optimizationId);
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
    const result = optimizationService.getActiveOptimizers();
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
    const result = optimizationService.getOptimizationHistory(limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `获取优化历史失败: ${error.message}`
    });
  }
});

/**
 * 上传设计钢材文件 - V2优点完全整合版本
 */
app.post('/api/upload-design-steels', async (req, res) => {
  try {
    console.log('📁 V3增强版文件上传请求开始');
    
    // 处理JSON格式的base64数据
    if (req.is('application/json') && req.body.data) {
      const { filename, data, type } = req.body;
      
      console.log('JSON格式上传:', { filename, type, size: data.length });
      
      // 解析base64数据
      const buffer = Buffer.from(data, 'base64');
      
      // 使用V2增强版处理函数
      processExcelFileV3Enhanced(buffer, filename, res);
      
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
      
      // 读取文件并使用V2增强版处理函数
      const buffer = fs.readFileSync(req.file.path);
      
      // 清理临时文件
      fs.removeSync(req.file.path);
      
      // 使用V2增强版处理函数
      processExcelFileV3Enhanced(buffer, req.file.originalname, res);
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
 * 解析文件缓冲区为设计钢材数据
 */
// ==================== V2优点完全整合：智能显示ID生成系统 ====================

/**
 * 生成显示ID - 完全整合自V2系统
 * 按截面面积分组，生成A1, A2, B1, B2等显示用的ID
 */
function generateDisplayIds(steels) {
  // 按截面面积分组
  const groups = {};
  steels.forEach(steel => {
    const crossSection = Math.round(steel.crossSection); // 四舍五入处理浮点数
    if (!groups[crossSection]) {
      groups[crossSection] = [];
    }
    groups[crossSection].push(steel);
  });

  // 按截面面积排序
  const sortedCrossSections = Object.keys(groups).map(Number).sort((a, b) => a - b);
  
  const result = [];
  sortedCrossSections.forEach((crossSection, groupIndex) => {
    const letter = String.fromCharCode(65 + groupIndex); // A, B, C...
    const groupSteels = groups[crossSection];
    
    // 按长度排序
    groupSteels.sort((a, b) => a.length - b.length);
    
    groupSteels.forEach((steel, itemIndex) => {
      result.push({
        ...steel,
        displayId: `${letter}${itemIndex + 1}` // A1, A2, B1, B2...
      });
    });
  });

  console.log('🎯 显示ID生成完成:', result.slice(0, 5).map(s => ({ id: s.id, displayId: s.displayId, crossSection: s.crossSection })));
  return result;
}

// ==================== V2优点完全整合：增强版Excel文件处理系统 ====================

/**
 * 处理Excel文件 - 完全整合自V2成熟系统
 * 支持完整的调试信息、数据统计、错误处理和8个核心字段
 */
function processExcelFileV3Enhanced(fileBuffer, filename, res) {
  try {
    const XLSX = require('xlsx');
    
    console.log('=== V3增强版Excel文件处理开始 ===');
    console.log('文件名:', filename);
    console.log('文件大小:', fileBuffer.length, '字节');

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    console.log('Excel工作簿信息:', {
      sheetNames: workbook.SheetNames,
      totalSheets: workbook.SheetNames.length
    });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    console.log('使用工作表:', sheetName);

    // 获取工作表的范围
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    console.log('工作表范围:', {
      start: `${XLSX.utils.encode_col(range.s.c)}${range.s.r + 1}`,
      end: `${XLSX.utils.encode_col(range.e.c)}${range.e.r + 1}`,
      rows: range.e.r - range.s.r + 1,
      cols: range.e.c - range.s.c + 1
    });

    // 读取原始数据
    const data = XLSX.utils.sheet_to_json(worksheet);
    console.log('原始数据行数:', data.length);
    
    if (data.length > 0) {
      console.log('第一行数据:', data[0]);
      console.log('数据列名:', Object.keys(data[0]));
    }

    // V2完整数据转换逻辑 - 支持8个核心字段
    const designSteels = data.map((row, index) => {
      const steel = {
        id: `design_${Date.now()}_${index}`,
        length: parseFloat(row['长度'] || row['长度(mm)'] || row['Length'] || row['length'] || 
                          row['长度 (mm)'] || row['长度（mm）'] || row['长度mm'] || 
                          row['西耳墙'] || row['xierqiang'] || row['Xierqiang'] || 0),
        quantity: parseInt(row['数量'] || row['数量(件)'] || row['Quantity'] || row['quantity'] || 
                          row['件数'] || row['数量（件）'] || 0),
        crossSection: parseFloat(row['截面面积'] || row['截面面积(mm²)'] || row['截面面积（mm²）'] || 
                                row['面积'] || row['CrossSection'] || row['crossSection'] || 100),
        componentNumber: row['构件编号'] || row['构件号'] || row['ComponentNumber'] || 
                        row['componentNumber'] || row['编号'] || `GJ${String(index + 1).padStart(3, '0')}`,
        specification: row['规格'] || row['Specification'] || row['specification'] || 
                      row['型号'] || row['钢材规格'] || '',
        partNumber: row['部件编号'] || row['部件号'] || row['PartNumber'] || 
                   row['partNumber'] || row['零件号'] || `BJ${String(index + 1).padStart(3, '0')}`,
        material: row['材质'] || row['Material'] || row['material'] || 
                 row['钢材材质'] || row['材料'] || '',
        note: row['备注'] || row['Note'] || row['note'] || 
             row['说明'] || row['备注说明'] || ''
      };

      // V2完整的调试逻辑 - 显示每行解析详情
      if (index < 3) { // 只显示前3行的详细信息
        console.log(`第${index + 1}行解析结果:`, {
          原始数据: row,
          解析结果: steel,
          长度来源: row['长度'] ? '长度' : (row['Length'] ? 'Length' : (row.length ? 'length' : '未找到')),
          数量来源: row['数量'] ? '数量' : (row['Quantity'] ? 'Quantity' : (row.quantity ? 'quantity' : '未找到')),
          截面面积来源: row['截面面积'] ? '截面面积' : (row['CrossSection'] ? 'CrossSection' : (row.crossSection ? 'crossSection' : '未找到')),
          规格来源: row['规格'] ? '规格' : (row['Specification'] ? 'Specification' : (row.specification ? 'specification' : '未找到')),
          规格内容: steel.specification,
          材质内容: steel.material,
          备注内容: steel.note
        });
      }

      // 增强的调试信息
      if (steel.length === 0 || steel.quantity === 0) {
          console.warn(`⚠️ 第${index + 1}行数据解析可能失败:`, {
              原始行: row,
              解析后: steel,
              找到的列名: Object.keys(row)
          });
      }

      return steel;
    }).filter(steel => {
      const isValid = steel.length > 0 && steel.quantity > 0;
      if (!isValid) {
        console.log('过滤掉无效数据:', steel);
      }
      return isValid;
    });

    console.log('最终有效数据:', {
      总行数: data.length,
      有效数据: designSteels.length,
      过滤掉: data.length - designSteels.length
    });

    // V2完整的统计分析系统
    const crossSectionStats = {
      有截面面积: designSteels.filter(s => s.crossSection > 0).length,
      无截面面积: designSteels.filter(s => s.crossSection === 0).length,
      最大截面面积: designSteels.length > 0 ? Math.max(...designSteels.map(s => s.crossSection)) : 0,
      最小截面面积: designSteels.filter(s => s.crossSection > 0).length > 0 ? 
        Math.min(...designSteels.filter(s => s.crossSection > 0).map(s => s.crossSection)) : 0
    };
    console.log('截面面积统计:', crossSectionStats);

    const specificationStats = {
      有规格: designSteels.filter(s => s.specification && s.specification.trim()).length,
      无规格: designSteels.filter(s => !s.specification || !s.specification.trim()).length,
      唯一规格数: [...new Set(designSteels.map(s => s.specification).filter(s => s && s.trim()))].length,
      规格列表: [...new Set(designSteels.map(s => s.specification).filter(s => s && s.trim()))].slice(0, 5)
    };
    console.log('规格统计:', specificationStats);

    const materialStats = {
      有材质: designSteels.filter(s => s.material && s.material.trim()).length,
      无材质: designSteels.filter(s => !s.material || !s.material.trim()).length,
      唯一材质数: [...new Set(designSteels.map(s => s.material).filter(s => s && s.trim()))].length,
      材质列表: [...new Set(designSteels.map(s => s.material).filter(s => s && s.trim()))].slice(0, 3)
    };
    console.log('材质统计:', materialStats);

    // V2智能显示ID生成
    const designSteelsWithDisplayIds = generateDisplayIds(designSteels);

    console.log('=== V3增强版Excel文件处理完成 ===');

    // V2完整的返回数据结构
    res.json({ 
      success: true,
      message: `文件解析成功，找到 ${designSteelsWithDisplayIds.length} 条设计钢材数据`,
      designSteels: designSteelsWithDisplayIds,
      debugInfo: {
        原始行数: data.length,
        有效数据: designSteelsWithDisplayIds.length,
        过滤掉: data.length - designSteelsWithDisplayIds.length,
        截面面积统计: crossSectionStats,
        规格统计: specificationStats,
        材质统计: materialStats,
        列名信息: data.length > 0 ? Object.keys(data[0]) : [],
        示例数据: data.slice(0, 2),
        字段支持: ['长度', '数量', '截面面积', '构件编号', '规格', '部件编号', '材质', '备注'],
        处理时间: new Date().toISOString(),
        版本信息: 'V3增强版 - 整合V2所有优点'
      }
    });
  } catch (error) {
    console.error('=== V3增强版Excel文件解析错误 ===');
    console.error('错误详情:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({ 
      success: false,
      error: '文件解析失败: ' + error.message,
      debugInfo: {
        errorType: error.name,
        errorMessage: error.message,
        errorStack: process.env.NODE_ENV === 'development' ? error.stack : '生产环境不显示详细堆栈',
        处理时间: new Date().toISOString(),
        版本信息: 'V3增强版 - 整合V2所有优点'
      }
    });
  }
}

// V3兼容的异步包装函数
async function parseFileBuffer(buffer, filename, mimetype) {
  console.log(`📊 V3增强版文件解析开始: ${filename}, 类型: ${mimetype}`);
  
  try {
    // 为了保持V3 API兼容性，创建一个Promise包装
    return new Promise((resolve, reject) => {
      const mockRes = {
        json: (result) => {
          if (result.success) {
            resolve(result.designSteels);
          } else {
            reject(new Error(result.error));
          }
        },
        status: () => ({
          json: (error) => reject(new Error(error.error))
        })
      };
      
      processExcelFileV3Enhanced(buffer, filename, mockRes);
    });
    
  } catch (error) {
    console.error('❌ V3增强版文件解析错误:', error);
    throw new Error(`文件解析失败: ${error.message}`);
  }
}

/**
 * 解析Excel缓冲区
 */
function parseExcelBuffer(buffer) {
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
    const results = [];
    const stream = Readable.from(buffer.toString('utf8'));
    
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

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

app.listen(PORT, () => {
  console.log('🚀 钢材采购优化系统 V3.0 服务器启动成功');
  console.log(`🌐 服务地址: http://localhost:${PORT}`);
  console.log(`📚 API文档: http://localhost:${PORT}/api/health`);
  console.log('🔧 模块化架构已启用');
  console.log('✨ 新功能: 余料系统V3.0、约束W、损耗率验证');
  
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
  console.log('');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 收到关闭信号，正在关闭服务器...');
  
  // 取消所有活跃的优化任务
  const activeOptimizers = optimizationService.getActiveOptimizers();
  if (activeOptimizers.success && activeOptimizers.activeOptimizers.length > 0) {
    console.log(`🔄 取消 ${activeOptimizers.activeOptimizers.length} 个活跃的优化任务...`);
    activeOptimizers.activeOptimizers.forEach(opt => {
      optimizationService.cancelOptimization(opt.id);
    });
  }
  
  console.log('✅ 服务器已关闭');
  process.exit(0);
});

module.exports = app; 