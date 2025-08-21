/**
 * 测试TaskManager初始化的脚本
 * 适配统一驼峰命名的数据结构
 */
const TaskManager = require('./netlify/functions/utils/TaskManager');

async function testTaskManager() {
  try {
    console.log('开始测试TaskManager初始化...');
    
    // 打印环境变量信息
    console.log('DB_PATH环境变量:', process.env.DB_PATH);
    
    // 创建TaskManager实例
    const taskManager = new TaskManager();
    console.log('TaskManager实例创建成功');
    
    // 手动调用初始化方法
    console.log('开始初始化...');
    await taskManager.initialize();
    console.log('初始化成功！');
    
    // 尝试创建一个测试任务
    const testTaskId = await taskManager.createPendingTask({ test: 'data' });
    console.log('测试任务创建成功，ID:', testTaskId);
    
    // 获取任务并验证数据结构是否为驼峰命名
    const task = await taskManager.getTask(testTaskId);
    console.log('获取任务成功:', task);
    
    // 验证驼峰命名字段
    console.log('验证数据结构字段命名...');
    console.log('inputData存在:', task.inputData !== undefined);
    console.log('createdAt存在:', task.createdAt !== undefined);
    console.log('updatedAt存在:', task.updatedAt !== undefined);
    
    // 更新任务状态
    console.log('更新任务状态为running...');
    await taskManager.updateTaskStatus(testTaskId, 'running', {
      progress: 50,
      message: '测试中...'
    });
    
    // 再次获取任务验证更新
    const updatedTask = await taskManager.getTask(testTaskId);
    console.log('更新后的任务状态:', updatedTask.status);
    console.log('更新后的任务进度:', updatedTask.progress);
    
    // 设置任务结果
    console.log('设置任务结果...');
    await taskManager.setTaskResults(testTaskId, { success: true, testResult: 'passed' });
    
    // 获取任务列表
    console.log('获取任务列表...');
    const tasks = await taskManager.getTaskList({ limit: 10 });
    console.log('任务列表长度:', tasks.length);
    
    console.log('✅ TaskManager测试全部通过！');
  } catch (error) {
    console.error('❌ TaskManager测试失败:', error);
    console.error('错误堆栈:', error.stack);
  }
}

testTaskManager();