/**
 * 简化版钢材优化系统服务器
 * 专注于文件上传功能
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5001;

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// ==================== API路由 ====================

/**
 * 系统健康检查
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '钢材采购优化系统 V3.0 运行正常',
    version: '3.0.0',
    timestamp: new Date().toISOString()
  });
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

// 错误处理
app.use((error, req, res, next) => {
  console.error('🚨 服务器错误:', error);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `API端点不存在: ${req.method} ${req.originalUrl}`
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log('🚀 钢材采购优化系统 V3.0 服务器启动成功');
  console.log(`🌐 服务地址: http://localhost:${PORT}`);
  console.log(`📚 API文档: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('📋 可用的API端点:');
  console.log('  GET  /api/health                    - 系统健康检查');
  console.log('  POST /api/upload-design-steels      - 上传文件');
  console.log('');
});

module.exports = app; 