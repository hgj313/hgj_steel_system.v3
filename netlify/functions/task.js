/**
 * Netlify Function - 获取单个任务状态
 */
const TaskManager = require('./utils/TaskManager');

exports.handler = async (event, context) => {
  // 预检请求处理
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET' },
      body: ''
    };
  }

  try {
    // 从URL路径中提取taskId - 支持多种来源
    let taskId;
    if (event.queryStringParameters && event.queryStringParameters.taskId) {
      taskId = event.queryStringParameters.taskId;
    } else if (event.pathParameters && event.pathParameters.taskId) {
      taskId = event.pathParameters.taskId;
    } else {
      // 从完整路径中提取任务ID
      const pathSegments = event.path.split('/');
      const potentialIdIndex = pathSegments.findIndex(segment => segment.startsWith('task_'));
      if (potentialIdIndex >= 0) {
        taskId = pathSegments[potentialIdIndex];
      } else {
        taskId = pathSegments.pop();
      }
    }
    
    console.log(`📥 收到任务查询请求: taskId=${taskId}`);
    
    if (!taskId) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: '缺少任务ID' }) };
    }
    
    const taskManager = new TaskManager();
    
    // 非阻塞地触发清理任务，不影响主流程
    taskManager.cleanupExpiredTasks().catch(err => {
      console.error('❌ 清理过期任务失败:', err);
    });
    
    // 获取当前任务状态
    let task;
    try {
      task = await taskManager.getTask(taskId);
      console.log(`🔍 查询结果: taskId=${taskId}, 找到=${!!task}`);
      if (task && (task.isTemporary || task.isRestoredFromBackup)) {
        console.log(`⚠️ 返回的任务是${task.isTemporary ? '临时' : '从备份恢复'}的任务`);
      }
    } catch (error) {
      console.error('❌ 获取任务信息失败:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: '获取任务信息失败' })
      };
    }
    
    if (!task) {
      console.log(`❌ 任务不存在: taskId=${taskId}`);
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: '任务不存在',
          taskId: taskId,
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // 关键修复：返回一个扁平化的对象，而不是嵌套的task对象，以匹配前端的期望
    const responseBody = {
      success: true,
      id: task.id,
      status: task.status,
      progress: task.progress,
      message: task.message,
      inputData: task.inputData || null,
      results: task.results || null,
      error: task.error || null,
      executionTime: task.executionTime || null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      isTemporary: task.isTemporary || false,
      isRestoredFromBackup: task.isRestoredFromBackup || false
    };
    
    // 对于临时任务，增加额外的提示信息
    if (task.isTemporary) {
      responseBody.message = responseBody.message || '任务可能正在处理中，数据库暂时不可用。请稍后再试。';
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(responseBody)
    };

  } catch (error) {
    console.error('❌ 获取任务状态失败:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: `服务器内部错误: ${error.message}` })
    };
  }
};