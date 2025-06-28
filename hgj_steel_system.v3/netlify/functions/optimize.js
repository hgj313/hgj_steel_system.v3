/**
 * Netlify Function - 钢材优化算法 (异步模式)
 */
const path = require('path');
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

    const requestData = JSON.parse(event.body);
    console.log('🚀 收到优化请求 (Netlify异步模式)');
    console.log('设计钢材数量:', requestData.designSteels?.length || 0);
    console.log('模数钢材数量:', requestData.moduleSteels?.length || 0);

    // 创建异步任务
    const taskId = await taskManager.createOptimizationTask(requestData);
    
    // 立即返回taskId，不等待优化完成
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        taskId: taskId,
        message: '优化任务已创建，请通过taskId查询进度',
        status: 'pending'
      })
    };
  } catch (error) {
    console.error('❌ 优化API错误:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: `优化请求处理失败: ${error.message}`
      })
    };
  }
}; 