/**
 * 测试无限资源修复效果
 * 验证V3系统是否正确实现了"模数钢材资源无限"的设定
 */

const SteelOptimizerV3 = require('./core/optimizer/SteelOptimizerV3');
const { DesignSteel, ModuleSteel, OptimizationConstraints } = require('./api/types');

console.log('🧪 测试无限资源修复效果\n');

// 测试场景1：超长需求 + W=2（应该有解）
async function testScenario1() {
  console.log('📋 场景1：超长需求15000mm + W=2（应该有解）');
  
  const designSteels = [
    new DesignSteel({
      id: 'D1',
      name: '超长设计钢材',
      length: 15000,  // 超过最大可用长度12000mm
      quantity: 1,
      specification: 'H型钢',
      crossSection: 100
    })
  ];
  
  const moduleSteels = [
    new ModuleSteel({ id: 'M1', length: 6000, specification: 'H型钢', crossSection: 100 }),
    new ModuleSteel({ id: 'M2', length: 9000, specification: 'H型钢', crossSection: 100 }),
    new ModuleSteel({ id: 'M3', length: 12000, specification: 'H型钢', crossSection: 100 })
  ];
  
  const constraints = new OptimizationConstraints({
    maxWeldingSegments: 2,  // 允许2段焊接
    wasteThreshold: 500,
    timeLimit: 30000
  });
  
  const optimizer = new SteelOptimizerV3(designSteels, moduleSteels, constraints);
  const result = await optimizer.optimize();
  
  if (result.success) {
    console.log('✅ 场景1成功：找到解决方案');
    console.log(`   解决方案数量: ${Object.keys(result.result.solutions).length}`);
    
    // 检查是否使用了多段组合
    Object.entries(result.result.solutions).forEach(([groupKey, solution]) => {
      solution.cuttingPlans.forEach(plan => {
        if (plan.moduleType && plan.moduleType.includes('多段组合')) {
          console.log(`   ✅ 使用多段组合: ${plan.sourceDescription}`);
          console.log(`   📊 焊接次数: ${plan.weldingCount}`);
        }
      });
    });
  } else {
    console.log('❌ 场景1失败：', result.error);
  }
  
  console.log('');
}

// 测试场景2：超长需求 + W=1（应该报告约束冲突）
async function testScenario2() {
  console.log('📋 场景2：超长需求15000mm + W=1（应该报告约束冲突）');
  
  const designSteels = [
    new DesignSteel({
      id: 'D2',
      name: '超长设计钢材',
      length: 15000,
      quantity: 1,
      specification: 'H型钢',
      crossSection: 100
    })
  ];
  
  const moduleSteels = [
    new ModuleSteel({ id: 'M1', length: 6000, specification: 'H型钢', crossSection: 100 }),
    new ModuleSteel({ id: 'M2', length: 9000, specification: 'H型钢', crossSection: 100 }),
    new ModuleSteel({ id: 'M3', length: 12000, specification: 'H型钢', crossSection: 100 })
  ];
  
  const constraints = new OptimizationConstraints({
    maxWeldingSegments: 1,  // 不允许焊接
    wasteThreshold: 500,
    timeLimit: 30000
  });
  
  const optimizer = new SteelOptimizerV3(designSteels, moduleSteels, constraints);
  const result = await optimizer.optimize();
  
  if (!result.success) {
    console.log('✅ 场景2正确：识别约束冲突');
    console.log(`   错误信息: ${result.error}`);
  } else {
    console.log('❌ 场景2异常：应该报告约束冲突但却成功了');
  }
  
  console.log('');
}

// 测试场景3：正常需求（验证基本功能）
async function testScenario3() {
  console.log('📋 场景3：正常需求8000mm（验证基本功能）');
  
  const designSteels = [
    new DesignSteel({
      id: 'D3',
      name: '正常设计钢材',
      length: 8000,
      quantity: 2,
      specification: 'H型钢',
      crossSection: 100
    })
  ];
  
  const moduleSteels = [
    new ModuleSteel({ id: 'M1', length: 6000, specification: 'H型钢', crossSection: 100 }),
    new ModuleSteel({ id: 'M2', length: 9000, specification: 'H型钢', crossSection: 100 }),
    new ModuleSteel({ id: 'M3', length: 12000, specification: 'H型钢', crossSection: 100 })
  ];
  
  const constraints = new OptimizationConstraints({
    maxWeldingSegments: 2,
    wasteThreshold: 500,
    timeLimit: 30000
  });
  
  const optimizer = new SteelOptimizerV3(designSteels, moduleSteels, constraints);
  const result = await optimizer.optimize();
  
  if (result.success) {
    console.log('✅ 场景3成功：正常需求处理正常');
    console.log(`   解决方案数量: ${Object.keys(result.result.solutions).length}`);
  } else {
    console.log('❌ 场景3失败：', result.error);
  }
  
  console.log('');
}

// 测试场景4：极端超长需求（测试极限情况）
async function testScenario4() {
  console.log('📋 场景4：极端超长需求50000mm + W=3（测试极限）');
  
  const designSteels = [
    new DesignSteel({
      id: 'D4',
      name: '极端超长设计钢材',
      length: 50000,  // 极端超长
      quantity: 1,
      specification: 'H型钢',
      crossSection: 100
    })
  ];
  
  const moduleSteels = [
    new ModuleSteel({ id: 'M1', length: 12000, specification: 'H型钢', crossSection: 100 })
  ];
  
  const constraints = new OptimizationConstraints({
    maxWeldingSegments: 3,  // 最多3段
    wasteThreshold: 500,
    timeLimit: 30000
  });
  
  const optimizer = new SteelOptimizerV3(designSteels, moduleSteels, constraints);
  const result = await optimizer.optimize();
  
  // 需要5段（50000/12000 = 4.17，向上取整为5段），但约束只允许3段
  if (!result.success) {
    console.log('✅ 场景4正确：识别约束冲突（需要5段但只允许3段）');
  } else {
    console.log('❌ 场景4异常：应该报告约束冲突');
  }
  
  console.log('');
}

// 运行所有测试
async function runAllTests() {
  try {
    await testScenario1();
    await testScenario2();
    await testScenario3();
    await testScenario4();
    
    console.log('🎉 所有测试完成');
  } catch (error) {
    console.error('❌ 测试过程出错:', error);
  }
}

runAllTests();

module.exports = { runAllTests }; 