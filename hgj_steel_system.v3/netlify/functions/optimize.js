/**
 * Netlify Function - 钢材优化算法 (异步模式)
 */
const TaskManager = require('./utils/TaskManager');
const fetch = require('node-fetch'); // 引入node-fetch

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
        body: JSON.stringify({ success: false, error: '仅支持POST请求' })
      };
    }

    const requestData = JSON.parse(event.body);
    console.log('🚀 收到优化请求 (Netlify异步模式)');
    console.log('设计钢材数量:', requestData.designSteels?.length || 0);
    console.log('模数钢材数量:', requestData.moduleSteels?.length || 0);

    // 步骤1：在数据库中创建异步任务，状态为'pending'
    const taskId = await taskManager.createPendingTask(requestData);
    
    // 步骤2：通过标准HTTP请求异步调用后台工作函数
    // 从请求头中动态、可靠地构建URL，不再依赖特殊context
    const siteUrl = `https://${event.headers.host}`;
    const invokeUrl = `${siteUrl}/.netlify/functions/optimization-worker-background`;
    console.log(`[${taskId}] 正在调用后台工作者: ${invokeUrl}`);
    
    // 使用fetch异步调用，不等待结果 (fire and forget)
    fetch(invokeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, optimizationData: requestData })
    }).catch(err => {
      // 这个错误只在日志中记录，不会影响主函数的返回
      console.error(`[${taskId}] 调用后台工作者失败:`, err);
    });

    // 步骤3：立即返回taskId，让前端可以开始轮询
    return {
      statusCode: 202, // 202 Accepted 表示请求已接受，正在处理
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