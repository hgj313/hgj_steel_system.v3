/**
 * Netlify Function - 钢材优化算法 (异步模式) - 最终稳健版
 */
const TaskManager = require('./utils/TaskManager');
const fetch = require('node-fetch');

// 初始化TaskManager并添加增强日志
console.log('🔧 Initializing TaskManager for optimize.js');
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

    // 确保TaskManager已初始化
    await taskManager.initialize();

    // 创建新任务并添加重试逻辑
    let taskId;
    let taskCreationAttempts = 3;
    while (taskCreationAttempts > 0) {
      try {
        console.log(`📝 Attempting to create task`);
        taskId = await taskManager.createPendingTask(requestData);
        console.log(`✅ Task created successfully: ${taskId}`);
        break;
      } catch (error) {
        taskCreationAttempts--;
        console.error(`❌ Task creation failed (attempts left: ${taskCreationAttempts}):`, error);
        if (taskCreationAttempts === 0) {
          throw new Error(`Failed to create task after multiple attempts: ${error.message}`);
        }
        // 短暂延迟后重试
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // 关键修复：不再依赖不稳定的event.headers.host，
    // 改用Netlify在构建和运行时提供的、更可靠的process.env.URL
    const siteUrl = process.env.URL || `https://${event.headers.host}`;
    if (!process.env.URL) {
      console.warn(`[${taskId}] 警告：环境变量 process.env.URL 未设置，降级使用 event.headers.host。这在本地开发时正常，但在生产环境可能导致调用失败。`);
    }
    
    const invokeUrl = `${siteUrl}/.netlify/functions/optimization-worker-background`;
    console.log(`[${taskId}] 准备调用后台工作者: ${invokeUrl}`);
    console.log(`[${taskId}] 请求头信息:`, JSON.stringify(event.headers, null, 2));
    
    // 使用Promise.allSettled确保不阻塞响应返回
    Promise.allSettled([
      (async () => {
        try {
          // 为fetch请求添加重试逻辑
          let fetchAttempts = 3;
          while (fetchAttempts > 0) {
            try {
              console.log(`[${taskId}] 📡 开始发送fetch请求... (attempt ${4 - fetchAttempts}/3)`);
              const fetchResponse = await fetch(invokeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId, optimizationData: requestData })
              });
              
              console.log(`[${taskId}] 📥 收到fetch响应，状态码: ${fetchResponse.status}`);
              
              if (!fetchResponse.ok) {
                fetchAttempts--;
                console.error(`[${taskId}] ❌ 调用后台工作者失败，状态码: ${fetchResponse.status}`);
                
                if (fetchAttempts === 0) {
                  const errorBody = await fetchResponse.text();
                  console.error(`[${taskId}] 错误详情: ${errorBody}`);
                  // 标记任务为失败
                  await taskManager.setTaskError(taskId, `后台工作者启动失败: ${fetchResponse.status} - ${errorBody}`);
                } else {
                  console.log(`[${taskId}] 🔄 准备重试，剩余尝试次数: ${fetchAttempts}`);
                  await new Promise(resolve => setTimeout(resolve, 200));
                  continue;
                }
              } else {
                const responseBody = await fetchResponse.text();
                console.log(`[${taskId}] ✅ 成功调用后台工作者，响应内容: ${responseBody}`);
                break;
              }
            } catch (err) {
              fetchAttempts--;
              console.error(`[${taskId}] ❌ 调用后台工作者时发生网络错误:`, err.message);
              if (fetchAttempts === 0) {
                // 标记任务为失败
                await taskManager.setTaskError(taskId, `后台工作者启动网络错误: ${err.message}`);
              } else {
                console.log(`[${taskId}] 🔄 准备重试网络请求，剩余尝试次数: ${fetchAttempts}`);
                await new Promise(resolve => setTimeout(resolve, 200));
              }
            }
          }
          console.log(`[${taskId}] 📤 fetch请求处理完成`);
        } catch (error) {
          console.error(`[${taskId}] ❌ 处理后台请求时发生严重错误:`, error);
          // 作为最后的后备，再次尝试更新任务状态
          try {
            await taskManager.setTaskError(taskId, `处理后台请求时发生严重错误: ${error.message}`);
          } catch (updateError) {
            console.error(`[${taskId}] ❌ 严重错误后更新任务状态失败:`, updateError);
          }
        }
      })()
    ]);

    // 返回202 Accepted，表示请求已接受
    return {
      statusCode: 202,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, taskId, message: '优化任务已创建' })
    };
  } catch (error) {
    console.error('❌ 优化API主流程错误:', error);
    console.error('❌ 错误详情:', error.stack);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: `服务器内部错误: ${error.message}` })
    };
  }
};