/**
 * 测试异步优化任务API
 */

const fetch = require('node-fetch');

// 测试数据
const testData = {
  designSteels: [
    {
      id: 'test1',
      length: 3000,
      quantity: 1,
      crossSection: 100,
      specification: 'H100x100',
      componentNumber: 'GJ001',
      partNumber: 'BJ001'
    }
  ],
  moduleSteels: [
    {
      id: 'mod1',
      name: '12米钢材',
      length: 12000
    }
  ],
  constraints: {
    wasteThreshold: 100,
    targetLossRate: 5,
    timeLimit: 30,
    maxWeldingSegments: 5  // 增加允许的焊接段数
  }
};

async function testAsyncOptimization() {
  try {
    console.log('🚀 测试异步优化任务API...');
    
    // 1. 提交优化任务
    console.log('\n1. 提交优化任务...');
    const submitResponse = await fetch('http://localhost:5004/api/optimize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    const submitResult = await submitResponse.json();
    console.log('提交结果完整响应:', JSON.stringify(submitResult, null, 2));
    
    if (!submitResult.success) {
      throw new Error('提交任务失败: ' + submitResult.error);
    }
    
    const taskId = submitResult.taskId;
    console.log('✅ 任务已提交，TaskID:', taskId);
    
    if (!taskId) {
      throw new Error('TaskID为空，无法继续测试');
    }
    
    // 2. 轮询任务状态
    console.log('\n2. 开始轮询任务状态...');
    let isCompleted = false;
    let attempts = 0;
    const maxAttempts = 30; // 最多轮询30次（60秒）
    
    while (!isCompleted && attempts < maxAttempts) {
      attempts++;
      
      const statusResponse = await fetch(`http://localhost:5004/api/task/${taskId}`);
      const statusResult = await statusResponse.json();
      
      if (statusResult.success) {
        console.log(`[${attempts}] 状态: ${statusResult.status}, 进度: ${statusResult.progress}%, 消息: ${statusResult.message}`);
        
        if (statusResult.status === 'completed') {
          console.log('✅ 任务完成！');
          console.log('执行时间:', statusResult.executionTime, 'ms');
          console.log('结果概要:', {
            totalLossRate: statusResult.results?.totalLossRate,
            totalModuleUsed: statusResult.results?.totalModuleUsed,
            totalWaste: statusResult.results?.totalWaste
          });
          isCompleted = true;
        } else if (statusResult.status === 'failed') {
          console.log('❌ 任务失败:', statusResult.error);
          isCompleted = true;
        } else if (statusResult.status === 'cancelled') {
          console.log('🛑 任务已取消');
          isCompleted = true;
        }
      } else {
        console.log('❌ 获取状态失败:', statusResult.error);
      }
      
      if (!isCompleted) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
      }
    }
    
    if (!isCompleted) {
      console.log('⏰ 轮询超时，任务可能仍在执行中');
    }
    
    // 3. 获取任务列表
    console.log('\n3. 获取任务列表...');
    const tasksResponse = await fetch('http://localhost:5004/api/tasks?limit=5');
    const tasksResult = await tasksResponse.json();
    
    if (tasksResult.success) {
      console.log('任务历史:');
      tasksResult.tasks.forEach((task, index) => {
        console.log(`  ${index + 1}. ${task.id} - ${task.status} (${task.progress}%) - ${task.message}`);
      });
    }
    
    console.log('\n✅ 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
testAsyncOptimization(); 