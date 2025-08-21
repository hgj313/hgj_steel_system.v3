/**
 * Netlify Function - 系统统计信息
 * 提供系统运行状态、性能指标和使用统计
 */
const fs = require('fs');
const path = require('path');

// lowdb数据库连接
let db = null;

async function initDatabase() {
  if (!db) {
    // 从环境变量获取数据库路径，默认为项目根目录下的db.json
    const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'db.json');
    
    try {
      // 检查文件是否存在，如果不存在则创建
      if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({ optimizationTasks: [] }, null, 2));
      }
      
      // 读取数据库文件
      const data = fs.readFileSync(dbPath, 'utf8');
      db = JSON.parse(data);
      
      // 确保optimizationTasks数组存在
      if (!db.optimizationTasks) {
        db.optimizationTasks = [];
      }
    } catch (error) {
      console.error('初始化lowdb数据库失败:', error);
      // 如果读取失败，创建一个空的数据库结构
      db = { optimizationTasks: [] };
    }
  }
}

// 辅助函数：格式化日期（仅包含年月日）
function formatDate(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// 获取系统统计信息
async function getSystemStats() {
  try {
    await initDatabase();
    
    const tasks = db.optimizationTasks;
    const now = new Date();
    
    // 计算时间边界
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    
    // 计算任务统计
    const totalTasks = tasks.length;
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const runningTasks = tasks.filter(t => t.status === 'running').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const failedTasks = tasks.filter(t => t.status === 'failed').length;
    const cancelledTasks = tasks.filter(t => t.status === 'cancelled').length;
    
    // 计算成功率
    const successRate = totalTasks > 0 ? 
      Math.round((completedTasks / totalTasks * 100) * 100) / 100 : 0;
    
    // 计算平均执行时间
    const completedWithTime = tasks.filter(t => t.status === 'completed' && t.executionTime);
    const avgExecutionTime = completedWithTime.length > 0 ? 
      Math.round(completedWithTime.reduce((sum, t) => sum + t.executionTime, 0) / completedWithTime.length * 100) / 100 : 0;
    
    // 计算时间段内的任务数
    const last24hTasks = tasks.filter(t => new Date(t.createdAt) > oneDayAgo).length;
    const last7dTasks = tasks.filter(t => new Date(t.createdAt) > sevenDaysAgo).length;
    const last30dTasks = tasks.filter(t => new Date(t.createdAt) > thirtyDaysAgo).length;
    
    // 获取最近任务
    const recentTasks = [...tasks]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .map(task => ({
        id: task.id,
        status: task.status,
        progress: task.progress,
        message: task.message,
        execution_time: task.executionTime,
        created_at: task.createdAt
      }));
    
    // 获取性能统计（按天分组）
    const performanceStatsMap = new Map();
    tasks
      .filter(t => new Date(t.createdAt) > sevenDaysAgo)
      .forEach(task => {
        const dateKey = formatDate(task.createdAt).toISOString().split('T')[0];
        
        if (!performanceStatsMap.has(dateKey)) {
          performanceStatsMap.set(dateKey, {
            date: dateKey,
            total_tasks: 0,
            completed_tasks: 0,
            failed_tasks: 0,
            execution_times: []
          });
        }
        
        const stats = performanceStatsMap.get(dateKey);
        stats.total_tasks++;
        
        if (task.status === 'completed') stats.completed_tasks++;
        if (task.status === 'failed') stats.failed_tasks++;
        if (task.executionTime) stats.execution_times.push(task.executionTime);
      });
    
    // 转换为数组并计算平均执行时间
    const performanceStats = Array.from(performanceStatsMap.values())
      .map(stats => ({
        ...stats,
        avg_execution_time: stats.execution_times.length > 0 ? 
          Math.round(stats.execution_times.reduce((sum, time) => sum + time, 0) / stats.execution_times.length * 100) / 100 : 0
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // 系统日志统计（lowdb版本暂不实现system_logs表）
    const logStats = [];
    
    return {
      summary: {
        total_tasks: totalTasks,
        pending_tasks: pendingTasks,
        running_tasks: runningTasks,
        completed_tasks: completedTasks,
        failed_tasks: failedTasks,
        cancelled_tasks: cancelledTasks,
        success_rate: successRate,
        avg_execution_time: avgExecutionTime,
        last_24h_tasks: last24hTasks,
        last_7d_tasks: last7dTasks,
        last_30d_tasks: last30dTasks
      },
      recentTasks: recentTasks,
      performanceStats: performanceStats,
      logStats: logStats,
      systemInfo: {
        version: process.env.REACT_APP_VERSION || '3.0.0',
        platform: 'Netlify Functions',
        nodeVersion: process.version,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('获取系统统计失败:', error);
    throw error;
  }
}

// 获取健康状态
async function getHealthStatus() {
  try {
    await initDatabase();
    
    // 检查数据库连接状态（对于lowdb，只要能读取到db对象就视为连接成功）
    const dbHealthy = !!db;
    
    // 检查运行中的任务
    const runningCount = db?.optimizationTasks?.filter(t => t.status === 'running').length || 0;
    
    return {
      status: 'healthy',
      database: dbHealthy ? 'connected' : 'disconnected',
      runningTasks: runningCount,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
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