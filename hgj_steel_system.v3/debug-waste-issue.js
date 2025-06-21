/**
 * 调试废料问题 - 追踪数据流
 */

const SteelOptimizerV3 = require('./core/optimizer/SteelOptimizerV3');
const { DesignSteel, ModuleSteel, OptimizationConstraints } = require('./api/types');

console.log('🔍 调试废料问题 - 追踪数据流');

// 创建测试数据
const designSteels = [
  new DesignSteel({
    id: 'D1',
    name: '测试钢材1',
    length: 11000,
    quantity: 5,
    specification: 'custom',
    crossSection: 100
  }),
  new DesignSteel({
    id: 'D2', 
    name: '测试钢材2',
    length: 10000,
    quantity: 2,
    specification: 'custom',
    crossSection: 100
  })
];

const moduleSteels = Array.from({length: 10}, (_, i) => new ModuleSteel({
  id: `M${i+1}`,
  name: `模数钢材${i+1}`,
  length: 12000,
  specification: 'custom',
  crossSection: 100
}));

const constraints = new OptimizationConstraints({
  wasteThreshold: 500,  // 废料阈值500mm
  weldingSegments: 2,
  timeLimit: 30000
});

async function debugOptimization() {
  const optimizer = new SteelOptimizerV3(designSteels, moduleSteels, constraints);
  const result = await optimizer.optimize();
  
  if (!result.success) {
    console.error('❌ 优化失败:', result.error);
    return;
  }
  
  console.log('\n📊 分析切割计划数据...');
  
  for (const [groupKey, solution] of Object.entries(result.result.solutions)) {
    console.log(`\n🔍 规格组: ${groupKey}`);
    
    solution.cuttingPlans?.forEach((plan, index) => {
      console.log(`\n计划 #${index}:`);
      console.log(`  sourceType: ${plan.sourceType}`);
      console.log(`  sourceLength: ${plan.sourceLength}mm`);
      console.log(`  cuts: ${plan.cuts?.map(c => `${c.length}mm×${c.quantity}`).join(', ')}`);
      console.log(`  waste: ${plan.waste}mm`);
      console.log(`  newRemainders: ${plan.newRemainders?.length || 0}个`);
      
      // 详细分析余料
      if (plan.newRemainders && plan.newRemainders.length > 0) {
        plan.newRemainders.forEach(r => {
          console.log(`    - ${r.id}: ${r.length}mm (type: ${r.type})`);
        });
      }
      
      // 🔍 关键检查：废料值异常
      if (plan.waste > constraints.wasteThreshold) {
        console.log(`\n❌ 异常发现！waste(${plan.waste}mm) > 阈值(${constraints.wasteThreshold}mm)`);
        console.log(`    这违反了废料判断逻辑！`);
        
        // 计算预期waste值
        const totalCutLength = plan.cuts?.reduce((sum, cut) => sum + cut.length * cut.quantity, 0) || 0;
        const expectedRemainder = plan.sourceLength - totalCutLength;
        console.log(`    sourceLength: ${plan.sourceLength}mm`);
        console.log(`    totalCutLength: ${totalCutLength}mm`);
        console.log(`    expectedRemainder: ${expectedRemainder}mm`);
        console.log(`    实际waste: ${plan.waste}mm`);
      }
    });
  }
}

debugOptimization().catch(console.error); 