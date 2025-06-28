/**
 * Netlify Function - 单个任务查询接口
 * 对应路由: GET /api/task/:taskId
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
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
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

    // 从路径中提取taskId
    const pathSegments = event.path.split('/');
    const taskId = pathSegments[pathSegments.length - 1];

    if (!taskId || taskId === 'task') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: '缺少任务ID'
        })
      };
    }

    console.log(`🔍 查询任务状态: ${taskId}`);

    // 自动清理过期任务
    await taskManager.cleanupExpiredTasks();

    // 获取任务信息
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
      response.results = task.results;
    }

    // 如果任务失败，包含错误信息
    if (task.status === 'failed' && task.error) {
      response.error = task.error;
    }

    console.log(`📊 任务状态: ${task.status}, 进度: ${task.progress}%`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('❌ 任务查询API错误:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: `任务查询失败: ${error.message}`
      })
    };
  }
}; 