/**
 * Netlify Function - 系统统计信息
 * 提供系统运行状态、性能指标和使用统计
 */
const fs = require('fs');
const path = require('path');

// 初始化数据库连接 - 使用与系统核心一致的lowdb
const getDbInstance = () => {
  try {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'database', 'steel_system.json');
    
    let dbData = { optimizationTasks: [] };
    if (fs.existsSync(dbPath)) {
      const fileContent = fs.readFileSync(dbPath, 'utf8');
      dbData = JSON.parse(fileContent);
    }
    
    // 确保optimizationTasks数组存在
    if (!dbData.optimizationTasks) {
      dbData.optimizationTasks = [];
    }
    
    return dbData;
  } catch (error) {
    console.error('获取数据库实例失败:', error);
    // 返回默认空结构作为后备
    return { optimizationTasks: [] };
  }
};

// 获取系统统计信息
async function getSystemStats() {
  try {
    const db = getDbInstance();
    const tasks = db.optimizationTasks;
    
    return {
      totalOptimizations: tasks.length,
      activeTasks: tasks.filter(task => task.status === 'running').length,
      completedTasks: tasks.filter(task => task.status === 'completed').length,
      failedTasks: tasks.filter(task => task.status === 'failed').length,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('获取系统统计信息失败:', error);
    // 返回默认值作为后备
    return {
      totalOptimizations: 0,
      activeTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      timestamp: new Date().toISOString()
    };
  }
}

// 检查系统健康状态
async function getHealthStatus() {
  try {
    // 简单检查数据库文件是否可访问
    const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'database', 'steel_system.json');
    const dbAccessible = fs.existsSync(dbPath);
    
    const db = getDbInstance();
    const runningTasks = db.optimizationTasks.filter(task => task.status === 'running').length;
    
    return {
      status: 'healthy',
      database: dbAccessible ? 'connected' : 'file_not_found',
      runningTasks: runningTasks,
      timestamp: new Date().toISOString(),
      version: process.env.REACT_APP_VERSION || 'unknown'
    };
  } catch (error) {
    console.error('系统健康检查失败:', error);
    return {
      status: 'degraded',
      database: 'error',
      timestamp: new Date().toISOString(),
      version: process.env.REACT_APP_VERSION || 'unknown',
      error: error.message
    };
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
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: '仅支持GET请求'
        })
      };
    }

    const queryParams = event.queryStringParameters || {};
    const type = queryParams.type || 'full';

    let result;
    
    switch (type) {
      case 'health':
        result = await getHealthStatus();
        break;
      case 'full':
      default:
        result = await getSystemStats();
        break;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: JSON.stringify({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('❌ 系统统计API错误:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: `获取系统统计失败: ${error.message}`
      })
    };
  }
};