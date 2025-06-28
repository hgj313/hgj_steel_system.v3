/**
 * Netlify Function - 任务管理
 * 支持获取任务状态、任务列表等功能（使用真实的TaskManager）
 */

const TaskManager = require('./utils/TaskManager');

// 创建任务管理器实例
const taskManager = new TaskManager();

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

  const method = event.httpMethod;
  const path = event.path;

  try {
    // 获取单个任务状态 - GET /api/task/:taskId
    if (method === 'GET' && path.includes('/task/')) {
      const taskId = path.split('/').pop();
      
      // 自动清理过期任务
      await taskManager.cleanupExpiredTasks();
      
      const task = await taskManager.getTask(taskId);
      
      if (!task) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            error: '任务不存在'
          })
        };
      }
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          taskId: task.id,
          status: task.status,
          progress: task.progress,
          message: task.message,
          executionTime: task.executionTime,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          results: task.results,
          error: task.error
        })
      };
    }
    
    // 获取任务列表 - GET /api/tasks
    if (method === 'GET' && (path.endsWith('/tasks') || path.includes('/tasks?'))) {
      const queryParams = new URLSearchParams(event.queryStringParameters || '');
      const limit = parseInt(queryParams.get('limit')) || 20;
      const status = queryParams.get('status');
      
      // 自动清理过期任务
      await taskManager.cleanupExpiredTasks();
      
      const taskList = await taskManager.getTaskList({ limit, status });
      
      // 简化任务信息
      const simplifiedTasks = taskList.map(task => ({
        id: task.id,
        status: task.status,
        progress: task.progress,
        message: task.message,
        executionTime: task.executionTime,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        hasResults: task.status === 'completed' && !!task.results
      }));
      
      const allTasks = await taskManager.getAllTasks();
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          tasks: simplifiedTasks,
          total: Object.keys(allTasks).length
        })
      };
    }
    
    // 创建新任务 - POST /api/tasks
    if (method === 'POST') {
      const requestData = JSON.parse(event.body || '{}');
      const taskId = await taskManager.createOptimizationTask(requestData);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          taskId: taskId,
          message: '优化任务已创建',
          status: 'pending'
        })
      };
    }
    
    // 取消任务 - DELETE /api/task/:taskId
    if (method === 'DELETE' && path.includes('/task/')) {
      const taskId = path.split('/').pop();
      
      try {
        await taskManager.cancelTask(taskId);
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: true,
            message: '任务已取消'
          })
        };
      } catch (error) {
        const statusCode = error.message === '任务不存在' ? 404 : 400;
        
        return {
          statusCode: statusCode,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            error: error.message
          })
        };
      }
    }
    
    // 不支持的方法
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: '不支持的请求方法'
      })
    };
    
  } catch (error) {
    console.error('❌ 任务管理API错误:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: `任务管理失败: ${error.message}`
      })
    };
  }
}; 