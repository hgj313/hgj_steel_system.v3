/**
 * Netlify环境模拟测试脚本
 * 模拟Netlify无状态环境中的任务处理流程
 */
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const fs = require('fs').promises;
const path = require('path');

// 模拟Netlify环境变量
process.env.NETLIFY = 'true';
process.env.URL = 'https://test.netlify.app';

// 导入TaskManager
const TaskManager = require('./netlify/functions/utils/TaskManager');

// 模拟测试数据
const testOptimizationData = {
  steels: [
    { length: 12000, width: 2000, thickness: 10, count: 10 },
    { length: 6000, width: 1500, thickness: 8, count: 5 }
  ],
  orders: [
    { length: 3000, width: 1000, thickness: 10, count: 3 },
    { length: 2000, width: 800, thickness: 8, count: 4 }
  ],
  constraints: {
    cuttingLoss: 5,
    minRemainderSize: 1000
  }
};

// 模拟不同Lambda函数实例的函数
async function simulateFunction1() {
  console.log('\n🚀 模拟函数1 (创建任务)...');
  const taskManager = new TaskManager();
  console.log(`   - 数据库路径: ${taskManager.dbPath}`);
  
  try {
    // 初始化并创建任务
    await taskManager.initialize();
    const taskId = await taskManager.createPendingTask(testOptimizationData);
    console.log(`✅ 函数1: 任务创建成功，ID: ${taskId}`);
    
    // 立即验证创建
    const task = await taskManager.getTask(taskId);
    console.log(`✅ 函数1: 立即查询任务结果: ${task ? `找到任务，状态: ${task.status}` : '任务未找到'}`);
    
    return taskId;
  } catch (error) {
    console.error('❌ 函数1: 执行失败:', error.message);
    throw error;
  }
}

async function simulateFunction2(taskId) {
  console.log('\n🚀 模拟函数2 (查询任务)...');
  const taskManager = new TaskManager();
  console.log(`   - 数据库路径: ${taskManager.dbPath}`);
  
  try {
    // 模拟不同函数实例查询同一任务
    await taskManager.initialize();
    
    // 打印文件状态
    try {
      const stats = await fs.stat(taskManager.dbPath);
      console.log(`   - 数据库文件状态: 大小=${stats.size}字节, 修改时间=${stats.mtime}`);
    } catch (fileError) {
      console.error(`   - 无法访问数据库文件: ${fileError.message}`);
    }
    
    // 查询任务
    const task = await taskManager.getTask(taskId);
    console.log(`✅ 函数2: 查询任务结果: ${task ? `找到任务，状态: ${task.status}` : '任务未找到'}`);
    
    // 如果找到任务，尝试更新状态
    if (task) {
      await taskManager.updateTaskStatus(taskId, 'running', { 
        progress: 30, 
        message: '模拟优化中...' 
      });
      console.log(`✅ 函数2: 任务状态已更新为running`);
    }
    
    return task ? true : false;
  } catch (error) {
    console.error('❌ 函数2: 执行失败:', error.message);
    throw error;
  }
}

async function simulateFunction3(taskId) {
  console.log('\n🚀 模拟函数3 (完成任务)...');
  const taskManager = new TaskManager();
  console.log(`   - 数据库路径: ${taskManager.dbPath}`);
  
  try {
    // 模拟第三个函数实例更新任务结果
    await taskManager.initialize();
    
    // 设置任务结果
    const testResults = { optimalSolutions: [{利用率: 95.2}], totalWaste: 1200 };
    await taskManager.setTaskResults(taskId, testResults);
    console.log(`✅ 函数3: 任务结果设置成功`);
    
    return true;
  } catch (error) {
    console.error('❌ 函数3: 执行失败:', error.message);
    throw error;
  }
}

async function simulateFunction4(taskId) {
  console.log('\n🚀 模拟函数4 (最终查询)...');
  const taskManager = new TaskManager();
  console.log(`   - 数据库路径: ${taskManager.dbPath}`);
  
  try {
    // 模拟第四个函数实例最终查询任务
    await taskManager.initialize();
    
    // 直接读取数据库文件验证
    try {
      const fileContent = await fs.readFile(taskManager.dbPath, 'utf8');
      const dbData = JSON.parse(fileContent);
      console.log(`   - 数据库直接读取: 任务总数=${dbData.optimizationTasks?.length || 0}`);
      const found = dbData.optimizationTasks?.find(t => t.id === taskId);
      console.log(`   - 任务在数据库中: ${found ? '存在' : '不存在'}`);
    } catch (fileError) {
      console.error(`   - 直接读取数据库文件失败: ${fileError.message}`);
    }
    
    // 查询任务
    const task = await taskManager.getTask(taskId);
    console.log(`✅ 函数4: 最终查询结果: ${task ? `找到任务，状态: ${task.status}` : '任务未找到'}`);
    
    return task ? true : false;
  } catch (error) {
    console.error('❌ 函数4: 执行失败:', error.message);
    throw error;
  }
}

async function runNetlifySimulation() {
  console.log('====================================');
  console.log('开始Netlify环境模拟测试');
  console.log('====================================');

  // 环境信息
  console.log('🌐 模拟环境信息:');
  console.log('   - NETLIFY:', process.env.NETLIFY);
  console.log('   - URL:', process.env.URL);

  let taskId = null;
  let success = false;
  
  try {
    // 步骤1: 模拟第一个函数创建任务
    taskId = await simulateFunction1();
    
    // 步骤2: 模拟第二个函数查询任务
    const foundInFunction2 = await simulateFunction2(taskId);
    
    // 步骤3: 模拟第三个函数更新任务结果
    if (foundInFunction2) {
      await simulateFunction3(taskId);
    }
    
    // 步骤4: 模拟第四个函数最终查询任务
    success = await simulateFunction4(taskId);
    
    console.log('\n====================================');
    console.log(success ? '✅ Netlify环境模拟测试成功' : '❌ Netlify环境模拟测试失败');
    console.log('====================================');
    
    return { success, taskId };
  } catch (error) {
    console.error('\n❌ 模拟测试失败:', error);
    console.error('❌ 错误详情:', error.stack);
    console.log('\n====================================');
    console.log('❌ Netlify环境模拟测试失败');
    console.log('====================================');
    
    return { success: false, taskId, error: error.message };
  }
}

// 运行模拟测试
runNetlifySimulation().then(result => {
  process.exit(result.success ? 0 : 1);
});