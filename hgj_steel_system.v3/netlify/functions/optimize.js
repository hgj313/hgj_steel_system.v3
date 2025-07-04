/**
 * Netlify Function - 钢材优化算法 (异步模式) - 最终稳健版
 */
const TaskManager = require('./utils/TaskManager');
const fetch = require('node-fetch');

const taskManager = new TaskManager();

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' },
      body: ''
    };
  }

  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ success: false, error: '仅支持POST请求' }) };
    }

    const requestData = JSON.parse(event.body);
    console.log('🚀 收到优化请求');

    const taskId = await taskManager.createPendingTask(requestData);
    
    // 从请求头中动态、可靠地构建URL
    const siteUrl = `https://${event.headers.host}`;
    const invokeUrl = `${siteUrl}/.netlify/functions/optimization-worker-background`;
    console.log(`[${taskId}] 准备调用后台工作者: ${invokeUrl}`);
    
    // 异步调用后台函数，并添加完整的响应验证和日志记录
    fetch(invokeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, optimizationData: requestData })
    })
    .then(async res => {
      if (res.ok) {
        console.log(`[${taskId}] ✅ 成功调用后台工作者，状态码: ${res.status}`);
      } else {
        const errorBody = await res.text();
        console.error(`[${taskId}] ❌ 调用后台工作者失败，状态码: ${res.status}`);
        console.error(`[${taskId}] 错误详情: ${errorBody}`);
        // 标记任务为失败
        await taskManager.setTaskError(taskId, `后台工作者启动失败: ${res.status} - ${errorBody}`);
      }
    })
    .catch(async err => {
      console.error(`[${taskId}] ❌ 调用后台工作者时发生网络错误:`, err);
      // 标记任务为失败
      await taskManager.setTaskError(taskId, `后台工作者启动网络错误: ${err.message}`);
    });

    // 立即返回202 Accepted，表示请求已接受
    return {
      statusCode: 202,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, taskId, message: '优化任务已创建' })
    };
  } catch (error) {
    console.error('❌ 优化API主流程错误:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: `服务器内部错误: ${error.message}` })
    };
  }
}; 