/**
 * 测试余料状态修复
 * 验证真余料只能在生产结束后确定状态
 */

const SteelOptimizerV3 = require('./core/optimizer/SteelOptimizerV3');
const { DesignSteel, ModuleSteel, OptimizationConstraints } = require('./api/types');

async function testRemainderStatusFix() {
  console.log('🧪 开始测试余料状态修复...\n');

  // 创建测试数据
  const designSteels = [
    new DesignSteel({
      id: 'test_1',
      length: 5000,
      quantity: 2,
      crossSection: 100,
      specification: 'HRB400'
    }),
    new DesignSteel({
      id: 'test_2', 
      length: 3000,
      quantity: 1,
      crossSection: 100,
      specification: 'HRB400'
    })
  ];

  const moduleSteels = [
    new ModuleSteel({
      id: 'module_1',
      name: '12米标准钢材',
      length: 12000
    })
  ];

  const constraints = new OptimizationConstraints({
    wasteThreshold: 500,
    targetLossRate: 5,
    timeLimit: 5000, // 🔧 修复：减少时间限制，避免长时间等待
    maxWeldingSegments: 2
  });

  try {
    // 创建优化器
    const optimizer = new SteelOptimizerV3(designSteels, moduleSteels, constraints);
    
    console.log('📊 测试场景:');
    console.log(`  - 设计钢材: 5000mm×2, 3000mm×1`);
    console.log(`  - 模数钢材: 12000mm`);
    console.log(`  - 废料阈值: 500mm`);
    console.log(`  - 时间限制: 5秒`); // 🔧 修复：添加时间限制提示
    console.log(`  - 预期: 12000-5000-5000=2000mm余料(>500mm,应为pending状态)`);
    console.log(`  - 预期: 12000-3000=9000mm余料(>500mm,应为pending状态)`);
    console.log('');

    // 🔧 修复：添加超时保护
    const optimizationPromise = optimizer.optimize();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('优化超时')), 10000); // 10秒超时
    });

    console.log('⏰ 开始优化计算，10秒超时保护...');
    const result = await Promise.race([optimizationPromise, timeoutPromise]);
    
    if (!result.success) {
      console.error('❌ 优化失败:', result.error);
      return;
    }

    console.log('✅ 优化成功完成\n');

    // 检查处理状态
    if (result.result.processingStatus) {
      console.log('📋 处理状态检查:');
      console.log(`  - 优化完成: ${result.result.processingStatus.isCompleted}`);
      console.log(`  - 余料已最终处理: ${result.result.processingStatus.remaindersFinalized}`);
      console.log(`  - 准备渲染: ${result.result.processingStatus.readyForRendering}`);
      console.log(`  - 完成时间: ${result.result.processingStatus.completedAt}`);
      console.log('');
    }

    // 检查余料状态
    console.log('🔍 余料状态检查:');
    let totalPendingRemainders = 0;
    let totalRealRemainders = 0;
    let totalPseudoRemainders = 0;
    let totalWaste = 0;

    // 遍历所有解决方案
    Object.entries(result.result.solutions).forEach(([groupKey, solution]) => {
      console.log(`\n📋 ${groupKey} 组合:`);
      
      // 检查切割计划中的余料
      solution.cuttingPlans?.forEach((plan, index) => {
        console.log(`  切割计划 ${index + 1}:`);
        console.log(`    - 原料类型: ${plan.sourceType}`);
        console.log(`    - 原料长度: ${plan.sourceLength}mm`);
        
        if (plan.newRemainders && plan.newRemainders.length > 0) {
          plan.newRemainders.forEach(remainder => {
            console.log(`    - 新余料: ${remainder.id} (${remainder.length}mm, 类型: ${remainder.type})`);
            
            switch (remainder.type) {
              case 'pending':
                console.error('❌ 错误: 发现pending状态的余料，应该在finalizeRemainders后变为real');
                totalPendingRemainders++;
                break;
              case 'real':
                console.log('✅ 正确: 真余料状态');
                totalRealRemainders++;
                break;
              case 'pseudo':
                console.log('✅ 正确: 伪余料状态');
                totalPseudoRemainders++;
                break;
              case 'waste':
                console.log('✅ 正确: 废料状态');
                totalWaste++;
                break;
              default:
                console.warn(`⚠️ 未知余料类型: ${remainder.type}`);
            }
          });
        }
        
        if (plan.waste && plan.waste > 0) {
          console.log(`    - 废料: ${plan.waste}mm`);
        }
      });
    });

    // 汇总检查结果
    console.log('\n📊 余料状态汇总:');
    console.log(`  - 待定余料: ${totalPendingRemainders}个 ${totalPendingRemainders > 0 ? '❌' : '✅'}`);
    console.log(`  - 真余料: ${totalRealRemainders}个 ✅`);
    console.log(`  - 伪余料: ${totalPseudoRemainders}个 ✅`);
    console.log(`  - 废料: ${totalWaste}个 ✅`);

    // 检查全局统计
    if (result.result.globalStats) {
      console.log('\n📈 全局统计:');
      console.log(`  - 损耗率: ${result.result.globalStats.lossRate.toFixed(2)}%`);
      console.log(`  - 材料利用率: ${result.result.globalStats.efficiency.toFixed(2)}%`);
      console.log(`  - 总切割次数: ${result.result.globalStats.totalCuts}`);
      console.log(`  - 模数钢材使用: ${result.result.globalStats.totalModuleUsed}根`);
    }

    // 最终判定
    if (totalPendingRemainders === 0) {
      console.log('\n🎉 测试通过: 余料状态修复成功！');
      console.log('✅ 所有余料都已正确分类，没有pending状态的余料');
    } else {
      console.log('\n❌ 测试失败: 仍有pending状态的余料');
      console.log('需要进一步检查finalizeRemainders方法的实现');
    }

  } catch (error) {
    console.error('💥 测试过程出错:', error);
    console.error(error.stack);
  }
}

// 运行测试
if (require.main === module) {
  testRemainderStatusFix().catch(console.error);
}

module.exports = { testRemainderStatusFix }; 