/**
 * V3并行计算框架测试脚本
 * 测试真正的并行优化性能
 */

console.log('🧪 ==================== V3并行计算框架测试 ====================');

const SteelOptimizerV3 = require('./core/optimizer/SteelOptimizerV3');
const { DesignSteel, ModuleSteel, OptimizationConstraints } = require('./api/types');

// 创建测试数据
function createTestData() {
  // 设计钢材数据（模拟12种不同规格）
  const designSteels = [
    // HRB400规格，截面面积201mm²
    new DesignSteel({ id: 'D1', length: 6000, quantity: 2, crossSection: 201, specification: 'HRB400' }),
    new DesignSteel({ id: 'D2', length: 4500, quantity: 2, crossSection: 201, specification: 'HRB400' }),
    new DesignSteel({ id: 'D3', length: 3200, quantity: 5, crossSection: 201, specification: 'HRB400' }),
    
    // HRB500规格，截面面积314mm²
    new DesignSteel({ id: 'D4', length: 5500, quantity: 3, crossSection: 314, specification: 'HRB500' }),
    new DesignSteel({ id: 'D5', length: 4200, quantity: 3, crossSection: 314, specification: 'HRB500' }),
    new DesignSteel({ id: 'D6', length: 3800, quantity: 4, crossSection: 314, specification: 'HRB500' }),
    
    // HRB400规格，截面面积452mm²
    new DesignSteel({ id: 'D7', length: 5200, quantity: 4, crossSection: 452, specification: 'HRB400' }),
    new DesignSteel({ id: 'D8', length: 3900, quantity: 5, crossSection: 452, specification: 'HRB400' }),
    
    // HRB500规格，截面面积615mm²
    new DesignSteel({ id: 'D9', length: 4800, quantity: 4, crossSection: 615, specification: 'HRB500' }),
    new DesignSteel({ id: 'D10', length: 3600, quantity: 6, crossSection: 615, specification: 'HRB500' }),
    
    // 未知规格（测试兼容性）
    new DesignSteel({ id: 'D11', length: 4000, quantity: 3, crossSection: 201 }),
    new DesignSteel({ id: 'D12', length: 3500, quantity: 5, crossSection: 314 })
  ];

  // 模数钢材数据（6种长度）
  const moduleSteels = [
    new ModuleSteel({ id: 'M1', name: '12m标准钢材', length: 12000 }),
    new ModuleSteel({ id: 'M2', name: '10m标准钢材', length: 10000 }),
    new ModuleSteel({ id: 'M3', name: '9m标准钢材', length: 9000 }),
    new ModuleSteel({ id: 'M4', name: '8m标准钢材', length: 8000 }),
    new ModuleSteel({ id: 'M5', name: '6m标准钢材', length: 6000 }),
    new ModuleSteel({ id: 'M6', name: '5m标准钢材', length: 5000 })
  ];

  return { designSteels, moduleSteels };
}

async function runParallelOptimizationTest() {
  try {
    const { designSteels, moduleSteels } = createTestData();
    
    // 测试约束配置
    const constraints = new OptimizationConstraints({
      wasteThreshold: 500,
      weldingSegments: 4,    // V3特性：允许4段焊接（比V2的2段更灵活）
      maxIterations: 1000,
      timeLimit: 30000
    });

    console.log(`📊 测试数据概况:`);
    console.log(`   设计钢材: ${designSteels.length}种`);
    console.log(`   模数钢材: ${moduleSteels.length}种`);
    
    // 计算预期并行组合数
    const specCombinations = new Set();
    designSteels.forEach(steel => {
      const key = `${steel.specification || '未知规格'}_${steel.crossSection}`;
      specCombinations.add(key);
    });
    console.log(`   预期并行组合数: ${specCombinations.size}`);

    // 创建优化器
    const optimizer = new SteelOptimizerV3(designSteels, moduleSteels, constraints);
    
    console.log('\n🚀 开始并行优化测试...');
    const startTime = Date.now();
    
    // 执行优化
    const result = await optimizer.optimize();
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    console.log('\n✅ 并行优化测试成功完成！');
    console.log(`⏱️  总执行时间: ${executionTime}ms`);
    
    // 分析结果
    console.log('\n📈 优化结果分析:');
    console.log(`   并行组合数: ${Object.keys(result.solutions || {}).length}`);
    
    Object.entries(result.solutions || {}).forEach(([groupKey, solution]) => {
      const [spec, crossSection] = groupKey.split('_');
      console.log(`   ${spec}(${crossSection}mm²): ${solution.totalModuleUsed || 0}根模数钢材, ${solution.cuttingPlans?.length || 0}个切割计划`);
    });
    
    console.log('\n🎯 总体统计:');
    console.log(`   总模数钢材使用: ${result.result.totalModuleUsed || 0}根`);
    console.log(`   总废料: ${(result.result.totalWaste || 0).toFixed(2)}mm`);
    console.log(`   总真余料: ${(result.result.totalRealRemainder || 0).toFixed(2)}mm`);
    console.log(`   总损耗率: ${(result.result.totalLossRate || 0).toFixed(4)}%`);
    
    // 🎯 V3新增：显示模数钢材使用统计
    if (result.result.moduleSteelUsageStats) {
      console.log('\n📊 V3模数钢材使用统计（按根数）:');
      Object.entries(result.result.moduleSteelUsageStats).forEach(([spec, stats]) => {
        console.log(`   ${spec}规格:`);
        Object.entries(stats).forEach(([length, count]) => {
          console.log(`     ${length}: ${count}根`);
        });
      });
    }
    
    // 🎯 V3新增：显示数据库记录信息
    if (result.result.databaseRecords && result.result.databaseRecords.length > 0) {
      console.log(`\n💾 V3数据库记录: 共${result.result.databaseRecords.length}条模数钢材使用记录待存储`);
    }
    
  } catch (error) {
    console.error('❌ 并行优化测试失败:', error);
    console.error('错误堆栈:', error.stack);
  }
}

// V3动态焊接约束演示
async function demonstrateDynamicWelding() {
  console.log('\n🔧 ==================== V3动态焊接约束演示 ====================');

  const dynamicConstraints = new OptimizationConstraints({
    wasteThreshold: 500,
    weldingSegments: 3,        // V3新特性：用户可动态设置
    allowDynamicWelding: true, // V3新特性：启用动态焊接
    maxWeldingSegments: 5,     // V3新特性：最大允许5段焊接
    minWeldingSegments: 1,     // V3新特性：最小1段（不焊接）
    timeLimit: 30000
  });

  console.log('🎯 V3动态焊接约束配置:');
  console.log('   当前焊接段数:', dynamicConstraints.weldingSegments);
  console.log('   允许范围:', `${dynamicConstraints.minWeldingSegments}-${dynamicConstraints.maxWeldingSegments}段`);
  console.log('   动态调整:', dynamicConstraints.allowDynamicWelding ? '启用' : '禁用');

  // V3新特性演示：动态调整焊接约束
  console.log('\n🔧 演示动态焊接约束调整:');
  try {
    dynamicConstraints.setWeldingSegments(4);
    console.log('✅ 成功调整到4段焊接');
    
    dynamicConstraints.setWeldingSegments(2);
    console.log('✅ 成功调整到2段焊接');
    
    // 测试边界条件
    dynamicConstraints.setWeldingSegments(1);
    console.log('✅ 成功调整到1段焊接（无焊接）');
    
    // 测试焊接成本计算
    console.log('\n💰 焊接成本计算演示:');
    for (let segments = 1; segments <= 5; segments++) {
      const cost = dynamicConstraints.calculateWeldingCost(segments);
      const time = dynamicConstraints.calculateWeldingTime(segments);
      console.log(`   ${segments}段焊接: 成本系数${cost.toFixed(2)}, 时间成本${time}秒`);
    }
    
  } catch (error) {
    console.error('❌ 焊接约束调整失败:', error.message);
  }

  console.log('============================================================');
}

// 执行测试
async function main() {
  await demonstrateDynamicWelding();
  await runParallelOptimizationTest();
  console.log('\n🏁 ==================== 测试完成 ====================');
}

main().catch(console.error); 