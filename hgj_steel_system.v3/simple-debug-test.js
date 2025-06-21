/**
 * 简单调试测试 - 验证V3修复效果
 */

const SteelOptimizerV3 = require('./core/optimizer/SteelOptimizerV3');
const { DesignSteel, ModuleSteel, OptimizationConstraints } = require('./api/types');

async function simpleTest() {
  console.log('🧪 ==================== 简单调试测试 ====================');
  
  // 创建简单测试数据
  const designSteels = [
    new DesignSteel({ id: 'D1', length: 6000, quantity: 2, crossSection: 201, specification: 'HRB400' }),
    new DesignSteel({ id: 'D2', length: 4500, quantity: 1, crossSection: 201, specification: 'HRB400' })
  ];

  const moduleSteels = [
    new ModuleSteel({ id: 'M1', name: '12m标准钢材', length: 12000 })
  ];

  const constraints = new OptimizationConstraints({
    wasteThreshold: 500,
    weldingSegments: 2,
    maxIterations: 100,
    timeLimit: 10000
  });

  console.log('📊 测试数据:');
  console.log(`   设计钢材: ${designSteels.length}种`);
  console.log(`   模数钢材: ${moduleSteels.length}种`);

  try {
    const optimizer = new SteelOptimizerV3(designSteels, moduleSteels, constraints);
    
    console.log('\n🚀 开始优化...');
    const result = await optimizer.optimize();
    
    console.log('\n📈 优化结果:');
    console.log(`   成功: ${result.success}`);
    console.log(`   总模数钢材: ${result.totalModuleUsed}根`);
    console.log(`   总长度: ${result.totalMaterial}mm`);
    console.log(`   总废料: ${result.totalWaste}mm`);
    console.log(`   总真余料: ${result.totalRealRemainder}mm`);
    console.log(`   损耗率: ${result.totalLossRate}%`);
    
    // 检查solutions对象
    console.log('\n🔍 解决方案详情:');
    if (result.solutions) {
      Object.entries(result.solutions).forEach(([groupKey, solution]) => {
        console.log(`   ${groupKey}:`);
        console.log(`     模数钢材: ${solution.totalModuleUsed}根`);
        console.log(`     废料: ${solution.totalWaste}mm`);
        console.log(`     真余料: ${solution.totalRealRemainder}mm`);
        console.log(`     切割计划: ${solution.cuttingPlans?.length || 0}个`);
        
        if (solution.taskStats) {
          console.log(`     taskStats模数钢材: ${solution.taskStats.totalModuleSteelsUsed}根`);
          console.log(`     taskStats总长度: ${solution.taskStats.totalModuleLength}mm`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('错误堆栈:', error.stack);
  }
}

simpleTest().catch(console.error); 