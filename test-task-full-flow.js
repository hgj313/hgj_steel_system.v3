/**
 * 任务全流程测试脚本
 * 测试任务创建、查询、处理和结果获取的完整流程
 */
const TaskManager = require('./netlify/functions/utils/TaskManager');
const fs = require('fs').promises;
const path = require('path');

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

async function runFullTest() {
  console.log('====================================');
  console.log('开始任务全流程测试');
  console.log('====================================');

  try {
    // 环境信息
    console.log('🌐 测试环境信息:');
    console.log('   - NODE_ENV:', process.env.NODE_ENV);
    console.log('   - NETLIFY:', process.env.NETLIFY);
    console.log('   - URL:', process.env.URL);

    // 创建TaskManager实例
    console.log('\n🚀 创建TaskManager实例...');
    const taskManager = new TaskManager();
    console.log('   - 数据库路径:', taskManager.dbPath);

    // 1. 初始化TaskManager
    console.log('\n🔧 初始化TaskManager...');
    await taskManager.initialize();
    console.log('✅ TaskManager初始化成功');

    // 2. 创建任务
    console.log('\n📝 创建新任务...');
    const taskId = await taskManager.createPendingTask(testOptimizationData);
    console.log(`✅ 任务创建成功，ID: ${taskId}`);

    // 3. 立即查询刚创建的任务（模拟optimize.js和task.js之间的交互）
    console.log('\n🔍 立即查询刚创建的任务...');
    const task1 = await taskManager.getTask(taskId);
    console.log('✅ 任务查询结果:', task1 ? `找到任务，状态: ${task1.status}` : '任务未找到');

    // 4. 创建新的TaskManager实例并查询同一任务（模拟不同Lambda函数间的交互）
    console.log('\n🔄 创建新的TaskManager实例并查询同一任务...');
    const anotherTaskManager = new TaskManager();
    console.log('   - 新实例数据库路径:', anotherTaskManager.dbPath);
    const task2 = await anotherTaskManager.getTask(taskId);
    console.log('✅ 新实例任务查询结果:', task2 ? `找到任务，状态: ${task2.status}` : '任务未找到');

    // 5. 更新任务状态
    console.log('\n🔄 更新任务状态...');
    await taskManager.updateTaskStatus(taskId, 'running', { progress: 50, message: '测试进度更新' });
    console.log('✅ 任务状态更新成功');

    // 6. 再次查询更新后的任务
    console.log('\n🔍 查询更新后的任务状态...');
    const task3 = await taskManager.getTask(taskId);
    console.log('✅ 更新后任务状态:', task3 ? `状态: ${task3.status}, 进度: ${task3.progress}%` : '任务未找到');

    // 7. 设置任务结果
    console.log('\n🏁 设置任务结果...');
    const testResults = { optimalSolutions: [{利用率: 95.2}], totalWaste: 1200 };
    await taskManager.setTaskResults(taskId, testResults);
    console.log('✅ 任务结果设置成功');

    // 8. 最后查询完成的任务
    console.log('\n🔍 查询完成的任务...');
    const task4 = await taskManager.getTask(taskId);
    console.log('✅ 完成任务查询结果:', task4 ? `状态: ${task4.status}, 结果: ${task4.results ? '有结果' : '无结果'}` : '任务未找到');

    // 9. 检查数据库文件内容
    try {
      console.log('\n📋 检查数据库文件内容...');
      const fileContent = await fs.readFile(taskManager.dbPath, 'utf8');
      const dbData = JSON.parse(fileContent);
      console.log(`   - 数据库中任务总数: ${dbData.optimizationTasks?.length || 0}`);
      const foundInDb = dbData.optimizationTasks?.find(t => t.id === taskId);
      console.log(`   - 测试任务在数据库中: ${foundInDb ? '存在' : '不存在'}`);
      
      // 显示最近的几个任务，用于调试
      if (dbData.optimizationTasks && dbData.optimizationTasks.length > 0) {
        const recentTasks = dbData.optimizationTasks
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 3)
          .map(t => `${t.id} (${t.status})`);
        console.log(`   - 最近的任务: ${recentTasks.join(', ')}`);
      }
    } catch (error) {
      console.error('❌ 读取数据库文件失败:', error.message);
    }

    console.log('\n====================================');
    console.log('✅ 任务全流程测试完成');
    console.log('====================================');
    return { success: true, taskId };
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    console.error('❌ 错误详情:', error.stack);
    console.log('\n====================================');
    console.log('❌ 任务全流程测试失败');
    console.log('====================================');
    return { success: false, error: error.message };
  }
}

// 运行测试
runFullTest().then(result => {
  process.exit(result.success ? 0 : 1);
});