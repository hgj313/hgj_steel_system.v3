/**
 * TaskManager在Netlify环境下的兼容性测试脚本
 * 用于验证修改后的TaskManager能否在模拟Netlify环境下正常工作
 */
const TaskManager = require('./netlify/functions/utils/TaskManager');

// 模拟Netlify环境变量
process.env.NETLIFY = 'true';
process.env.URL = 'https://example.netlify.app';

async function runTest() {
  console.log('🚀 开始TaskManager Netlify环境兼容性测试');
  console.log('=========================================');
  
  try {
    // 1. 初始化TaskManager
    console.log('\n1. 初始化TaskManager...');
    const taskManager = new TaskManager();
    console.log(`📁 数据库路径: ${taskManager.dbPath}`);
    
    // 2. 测试初始化
    const initResult = await taskManager.initialize();
    console.log('✅ TaskManager初始化成功:', initResult);
    
    // 3. 测试创建任务
    console.log('\n2. 创建测试任务...');
    const testData = {
      designSteels: [{ id: 'test1', length: 6000, quantity: 5 }],
      moduleSteels: [{ id: 'mod1', name: 'Test Module', length: 12000 }],
      constraints: { maxWeldingSegments: 1, timeLimit: 30000 }
    };
    
    const taskId = await taskManager.createPendingTask(testData);
    console.log(`✅ 测试任务创建成功，TaskID: ${taskId}`);
    
    // 4. 测试获取任务
    console.log('\n3. 获取创建的任务...');
    const task = await taskManager.getTask(taskId);
    console.log('✅ 任务详情:', {
      id: task.id,
      status: task.status,
      progress: task.progress,
      message: task.message
    });
    
    // 5. 测试更新任务状态
    console.log('\n4. 更新任务状态...');
    await taskManager.updateTaskProgress(taskId, 50, '测试进度更新');
    const updatedTask = await taskManager.getTask(taskId);
    console.log('✅ 更新后的任务进度:', updatedTask.progress, '消息:', updatedTask.message);
    
    // 6. 测试设置任务结果
    console.log('\n5. 设置任务结果...');
    const testResults = { optimized: true, wasteRate: 5.2, totalLength: 60000 };
    await taskManager.setTaskResults(taskId, testResults);
    const completedTask = await taskManager.getTask(taskId);
    console.log('✅ 任务完成状态:', completedTask.status);
    console.log('✅ 任务结果:', completedTask.results);
    
    // 7. 测试获取任务列表
    console.log('\n6. 获取任务列表...');
    const tasks = await taskManager.getTaskList({ limit: 5 });
    console.log(`✅ 任务列表获取成功，共 ${tasks.length} 个任务`);
    
    console.log('\n✅ 所有测试通过！TaskManager在Netlify环境下兼容性良好。');
    console.log('=========================================');
    return true;
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    console.error('❌ 错误堆栈:', error.stack);
    console.log('=========================================');
    return false;
  }
}

// 执行测试
runTest();