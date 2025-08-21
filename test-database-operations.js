/**
 * 数据库操作测试脚本 - 验证TaskManager的任务创建和查询功能
 */
const TaskManager = require('./netlify/functions/utils/TaskManager');
const fs = require('fs').promises;
const path = require('path');

// 模拟Netlify环境
process.env.NETLIFY = 'true';
process.env.URL = 'https://test.netlify.app';

// 测试数据
const testOptimizationData = {
  materials: [{ id: 'test-material', length: 1000 }],
  parts: [{ id: 'test-part', length: 100, quantity: 5 }],
  constraints: { maxWaste: 10 }
};

async function runTests() {
  console.log('\n==========================');
  console.log('开始数据库操作测试');
  console.log('==========================');
  
  try {
    // 1. 创建新的TaskManager实例
    const taskManager1 = new TaskManager();
    console.log(`初始化TaskManager, 数据库路径: ${taskManager1.dbPath}`);
    
    // 2. 创建任务
    console.log('\n测试1: 创建新任务');
    const taskId = await taskManager1.createPendingTask(testOptimizationData);
    console.log(`✅ 成功创建任务: ${taskId}`);
    
    // 3. 使用不同的TaskManager实例查询任务
    console.log('\n测试2: 使用不同实例查询任务');
    const taskManager2 = new TaskManager();
    const task = await taskManager2.getTask(taskId);
    
    if (task) {
      console.log(`✅ 成功查询到任务: ${task.id}`);
      console.log(`   任务状态: ${task.status}`);
      console.log(`   任务进度: ${task.progress}%`);
      console.log(`   任务消息: ${task.message}`);
    } else {
      console.error('❌ 查询任务失败，任务不存在');
    }
    
    // 4. 更新任务状态
    console.log('\n测试3: 更新任务状态');
    await taskManager2.updateTaskProgress(taskId, 50, '正在优化中...');
    console.log('✅ 成功更新任务进度');
    
    // 5. 再次使用不同实例查询更新后的任务
    console.log('\n测试4: 查询更新后的任务');
    const taskManager3 = new TaskManager();
    const updatedTask = await taskManager3.getTask(taskId);
    
    if (updatedTask) {
      console.log(`✅ 成功查询到更新后的任务: ${updatedTask.id}`);
      console.log(`   更新后的状态: ${updatedTask.status}`);
      console.log(`   更新后的进度: ${updatedTask.progress}%`);
      console.log(`   更新后的消息: ${updatedTask.message}`);
    } else {
      console.error('❌ 查询更新后的任务失败');
    }
    
    // 6. 设置任务结果
    console.log('\n测试5: 设置任务结果');
    const testResults = { 
      optimalSolution: { totalWaste: 5, utilization: 95 },
      generatedParts: [{ materialId: 'test-material', partId: 'test-part', position: 0 }]
    };
    await taskManager3.setTaskResults(taskId, testResults);
    console.log('✅ 成功设置任务结果');
    
    // 7. 查询最终任务状态
    console.log('\n测试6: 查询最终任务状态');
    const finalTask = await new TaskManager().getTask(taskId);
    
    if (finalTask) {
      console.log(`✅ 成功查询到最终任务状态: ${finalTask.id}`);
      console.log(`   最终状态: ${finalTask.status}`);
      console.log(`   执行时间: ${finalTask.executionTime}`);
      console.log(`   是否有结果: ${!!finalTask.results}`);
    } else {
      console.error('❌ 查询最终任务状态失败');
    }
    
    // 8. 检查数据库文件内容
    console.log('\n测试7: 检查数据库文件内容');
    try {
      const fileContent = await fs.readFile(taskManager1.dbPath, 'utf8');
      const dbData = JSON.parse(fileContent);
      console.log(`✅ 数据库文件内容有效，任务总数: ${dbData.optimizationTasks?.length || 0}`);
      
      // 查找创建的任务
      const dbTask = dbData.optimizationTasks?.find(t => t.id === taskId);
      if (dbTask) {
        console.log(`✅ 任务在数据库文件中存在，状态: ${dbTask.status}`);
      } else {
        console.error('❌ 任务在数据库文件中不存在');
      }
    } catch (error) {
      console.error('❌ 读取数据库文件失败:', error.message);
    }
    
    console.log('\n==========================');
    console.log('测试完成');
    console.log('==========================');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('错误详情:', error.stack);
  }
}

// 运行测试
runTests();