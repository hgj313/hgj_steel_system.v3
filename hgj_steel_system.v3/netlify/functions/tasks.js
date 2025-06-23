/**
 * Netlify Function - 任务管理
 * 支持获取任务状态、任务列表等功能
 */

// 模拟任务存储 (实际项目中应使用数据库)
let tasks = {};
let taskCounter = 0;

// 生成任务ID
function generateTaskId() {
  return `task_${Date.now()}_${++taskCounter}`;
}

// 创建模拟任务
function createMockTask(inputData = {}) {
  const taskId = generateTaskId();
  const task = {
    id: taskId,
    status: 'pending',
    progress: 0,
    message: '任务已创建，等待处理',
    inputData: inputData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    executionTime: null,
    results: null,
    error: null
  };
  
  tasks[taskId] = task;
  
  // 模拟异步处理
  setTimeout(() => processTask(taskId), 1000);
  
  return taskId;
}

// 模拟任务处理
async function processTask(taskId) {
  const task = tasks[taskId];
  if (!task) return;
  
  try {
    // 更新为运行中
    task.status = 'running';
    task.progress = 10;
    task.message = '正在处理...';
    task.updatedAt = new Date().toISOString();
    
    // 模拟处理时间
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 更新进度
    task.progress = 50;
    task.message = '正在计算优化方案...';
    task.updatedAt = new Date().toISOString();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 完成任务
    task.status = 'completed';
    task.progress = 100;
    task.message = '任务完成';
    task.executionTime = 4000;
    task.updatedAt = new Date().toISOString();
    task.results = {
      totalLossRate: 3.5,
      totalModuleUsed: 100,
      totalWaste: 50,
      solutions: {},
      summary: '优化完成，损耗率3.5%'
    };
    
  } catch (error) {
    task.status = 'failed';
    task.error = error.message;
    task.updatedAt = new Date().toISOString();
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

  const method = event.httpMethod;
  const path = event.path;

  try {
    // 获取单个任务状态 - GET /api/task/:taskId
    if (method === 'GET' && path.includes('/task/')) {
      const taskId = path.split('/').pop();
      const task = tasks[taskId];
      
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
          ...task
        })
      };
    }
    
    // 获取任务列表 - GET /api/tasks
    if (method === 'GET' && (path.endsWith('/tasks') || path.includes('/tasks?'))) {
      const queryParams = new URLSearchParams(event.queryStringParameters || '');
      const limit = parseInt(queryParams.get('limit')) || 20;
      const status = queryParams.get('status');
      
      let taskList = Object.values(tasks);
      
      // 状态过滤
      if (status) {
        taskList = taskList.filter(task => task.status === status);
      }
      
      // 按创建时间倒序
      taskList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // 限制数量
      taskList = taskList.slice(0, limit);
      
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
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          tasks: simplifiedTasks,
          total: Object.keys(tasks).length
        })
      };
    }
    
    // 创建新任务 - POST /api/tasks
    if (method === 'POST') {
      const requestData = JSON.parse(event.body || '{}');
      const taskId = createMockTask(requestData);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          taskId: taskId,
          message: '任务已创建',
          status: 'pending'
        })
      };
    }
    
    // 取消任务 - DELETE /api/task/:taskId
    if (method === 'DELETE' && path.includes('/task/')) {
      const taskId = path.split('/').pop();
      const task = tasks[taskId];
      
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
      
      if (task.status !== 'pending' && task.status !== 'running') {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            error: '只能取消待执行或正在执行的任务'
          })
        };
      }
      
      task.status = 'cancelled';
      task.message = '任务已被用户取消';
      task.updatedAt = new Date().toISOString();
      
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