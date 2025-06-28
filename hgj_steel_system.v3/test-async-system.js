/**
 * 测试异步任务系统
 * 用于验证Netlify Functions的异步优化任务流程
 */

const TaskManager = require('./netlify/functions/utils/TaskManager');

async function testAsyncSystem() {
  console.log('🧪 开始测试异步任务系统...\n');

  const taskManager = new TaskManager();

  try {
    // 1. 创建测试任务
    console.log('1️⃣ 创建测试优化任务...');
    const testData = {
      designSteels: [
        { id: 'test1', length: 6000, quantity: 5, crossSection: 100, specification: 'HRB400' },
        { id: 'test2', length: 4000, quantity: 3, crossSection: 100, specification: 'HRB400' },
        { id: 'test3', length: 8000, quantity: 2, crossSection: 150, specification: 'HRB500' }
      ],
      moduleSteels: [
        { id: 'module1', name: 'HRB400-12000mm模数钢材', length: 12000, crossSection: 100, specification: 'HRB400' },
        { id: 'module2', name: 'HRB500-9000mm模数钢材', length: 9000, crossSection: 150, specification: 'HRB500' }
      ],
      constraints: {
        wasteThreshold: 500,
        maxWeldingSegments: 3,
        timeLimit: 30000
      }
    };

    const taskId = await taskManager.createOptimizationTask(testData);
    console.log(`✅ 任务创建成功: ${taskId}\n`);

    // 2. 轮询任务状态
    console.log('2️⃣ 开始轮询任务状态...');
    let attempts = 0;
    const maxAttempts = 20; // 最多轮询20次（40秒）

    while (attempts < maxAttempts) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒

      const task = await taskManager.getTask(taskId);
      
      if (!task) {
        console.error('❌ 任务不存在');
        break;
      }

      console.log(`📊 第${attempts}次查询 - 状态: ${task.status}, 进度: ${task.progress}%, 消息: ${task.message}`);

      if (task.status === 'completed') {
        console.log('\n✅ 任务完成！');
        console.log('📈 执行时间:', task.executionTime + 'ms');
        console.log('📋 结果摘要:', task.results?.summary || '无摘要');
        console.log('📊 损耗率:', task.results?.totalLossRate + '%');
        break;
      } else if (task.status === 'failed') {
        console.log('\n❌ 任务失败！');
        console.log('🔍 错误信息:', task.error);
        break;
      } else if (task.status === 'cancelled') {
        console.log('\n⏹️ 任务已取消');
        break;
      }
    }

    if (attempts >= maxAttempts) {
      console.log('\n⏰ 轮询超时，任务可能仍在运行');
    }

    // 3. 测试任务列表
    console.log('\n3️⃣ 获取任务列表...');
    const taskList = await taskManager.getTaskList({ limit: 5 });
    console.log(`📋 共有 ${taskList.length} 个任务:`);
    taskList.forEach(task => {
      console.log(`  - ${task.id}: ${task.status} (${task.message})`);
    });

    // 4. 清理测试
    console.log('\n4️⃣ 清理过期任务...');
    const cleanedCount = await taskManager.cleanupExpiredTasks();
    console.log(`🧹 清理了 ${cleanedCount} 个过期任务`);

    console.log('\n🎉 异步任务系统测试完成！');

  } catch (error) {
    console.error('\n💥 测试过程中出现错误:', error);
    console.error('📍 错误堆栈:', error.stack);
  }
}

// 执行测试
if (require.main === module) {
  testAsyncSystem().catch(console.error);
}

module.exports = { testAsyncSystem }; 