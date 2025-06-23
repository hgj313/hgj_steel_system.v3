/**
 * Netlify Function - 设计钢材文件上传
 */
const multiparty = require('multiparty');

// 生成显示ID - 完全整合自V2系统
function generateDisplayIds(steels) {
  // 按截面面积分组
  const groups = {};
  steels.forEach(steel => {
    const crossSection = Math.round(steel.crossSection);
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

  return result;
}

// 处理Excel文件
function processExcelFile(fileBuffer, filename) {
  try {
    const XLSX = require('xlsx');
    
    console.log('=== Netlify Excel文件处理开始 ===');
    console.log('文件名:', filename);
    console.log('文件大小:', fileBuffer.length, '字节');

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // 读取原始数据
    const data = XLSX.utils.sheet_to_json(worksheet);
    console.log('原始数据行数:', data.length);

    // 数据转换逻辑 - 支持8个核心字段
    const designSteels = data.map((row, index) => {
      const steel = {
        id: `design_${Date.now()}_${index}`,
        length: parseFloat(row['长度'] || row['长度(mm)'] || row['Length'] || row['length'] || 
                          row['长度 (mm)'] || row['长度（mm）'] || row['长度mm'] || 0),
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

      return steel;
    }).filter(steel => steel.length > 0 && steel.quantity > 0);

    // 生成显示ID
    const designSteelsWithDisplayIds = generateDisplayIds(designSteels);

    console.log('=== Netlify Excel文件处理完成 ===');

    return {
      success: true,
      message: `文件解析成功，找到 ${designSteelsWithDisplayIds.length} 条设计钢材数据`,
      designSteels: designSteelsWithDisplayIds,
      debugInfo: {
        原始行数: data.length,
        有效数据: designSteelsWithDisplayIds.length,
        过滤掉: data.length - designSteelsWithDisplayIds.length,
        处理时间: new Date().toISOString(),
        版本信息: 'Netlify V3增强版'
      }
    };
  } catch (error) {
    console.error('=== Netlify Excel文件解析错误 ===', error);
    throw error;
  }
}

exports.handler = async (event, context) => {
  // 处理CORS预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: ''
    };
  }

  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: '仅支持POST请求'
        })
      };
    }

    // 处理JSON格式的base64数据
    if (event.headers['content-type']?.includes('application/json')) {
      const requestData = JSON.parse(event.body);
      const { filename, data, type } = requestData;
      
      console.log('JSON格式上传:', { filename, type, size: data.length });
      
      // 解析base64数据
      const buffer = Buffer.from(data, 'base64');
      
      // 处理文件
      const result = processExcelFile(buffer, filename);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result)
      };
    }

    // 处理multipart/form-data格式 (暂时简化处理)
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Netlify Functions目前仅支持JSON格式的base64文件上传'
      })
    };

  } catch (error) {
    console.error('❌ 文件处理错误:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: `文件处理失败: ${error.message}`
      })
    };
  }
}; 