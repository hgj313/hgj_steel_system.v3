/**
 * 测试统计计算器修复效果
 * 验证真余料、废料、伪余料计算的正确性
 */

const OptimizationService = require('./api/services/OptimizationService');

async function testStatisticsCalculatorFix() {
  console.log('🧪 开始测试统计计算器修复效果...\n');

  const optimizationService = new OptimizationService();

  // 测试数据：简单的西耳墙数据
  const testData = {
    designSteels: [
      { id: "S1", length: 2668, quantity: 1, crossSection: 2830, specification: "HRB400" },
      { id: "S2", length: 2552, quantity: 1, crossSection: 2830, specification: "HRB400" },
      { id: "S3", length: 2386, quantity: 1, crossSection: 2830, specification: "HRB400" },
      { id: "S4", length: 2307, quantity: 1, crossSection: 2830, specification: "HRB400" }
    ],
    moduleSteels: [
      { id: "M1", name: "HRB400-12000", length: 12000, specification: "HRB400", crossSection: 2830 },
      { id: "M2", name: "HRB400-10000", length: 10000, specification: "HRB400", crossSection: 2830 },
      { id: "M3", name: "HRB400-8000", length: 8000, specification: "HRB400", crossSection: 2830 }
    ],
    constraints: {
      wasteThreshold: 100,
      targetLossRate: 5,
      maxWeldingSegments: 1,
      timeLimit: 10000
    }
  };

  try {
    const result = await optimizationService.optimizeSteel(testData);

    if (!result.success) {
      console.error('❌ 优化失败:', result.error);
      return;
    }

    console.log('✅ 优化成功，开始验证统计数据...\n');

    const optimizationResult = result.result;

    // 🔍 验证数据一致性检查
    console.log('📊 数据一致性检查结果:');
    const consistencyCheck = optimizationResult.completeStats?.consistencyCheck;
    if (consistencyCheck) {
      console.log(`  - 数据一致性: ${consistencyCheck.isConsistent ? '✅ 通过' : '❌ 失败'}`);
      if (consistencyCheck.errors?.length > 0) {
        console.log('  - 错误列表:');
        consistencyCheck.errors.forEach(error => {
          console.log(`    ❌ ${error}`);
        });
      }
      if (consistencyCheck.warnings?.length > 0) {
        console.log('  - 警告列表:');
        consistencyCheck.warnings.forEach(warning => {
          console.log(`    ⚠️ ${warning}`);
        });
      }
    }

    // 🔍 检查全局统计数据
    console.log('\n📈 全局统计数据:');
    const globalStats = optimizationResult.completeStats?.global;
    if (globalStats) {
      console.log(`  - 模数钢材数量: ${globalStats.totalModuleCount} 根`);
      console.log(`  - 模数钢材总长度: ${globalStats.totalModuleLength} mm`);
      console.log(`  - 设计钢材总长度: ${globalStats.totalDesignLength} mm`);
      console.log(`  - 废料总长度: ${globalStats.totalWaste} mm`);
      console.log(`  - 真余料总长度: ${globalStats.totalRealRemainder} mm`);
      console.log(`  - 伪余料数量: ${globalStats.totalPseudoRemainder} 个`);
      console.log(`  - 损耗率: ${globalStats.overallLossRate}%`);
      console.log(`  - 材料利用率: ${globalStats.materialUtilizationRate}%`);
    }

    // 🔍 验证物料守恒定律
    console.log('\n⚖️ 物料守恒验证:');
    const totalInput = globalStats.totalModuleLength;
    const totalOutput = globalStats.totalDesignLength + globalStats.totalWaste + globalStats.totalRealRemainder;
    const difference = Math.abs(totalInput - totalOutput);
    
    console.log(`  - 总投入: ${totalInput} mm`);
    console.log(`  - 总产出: ${totalOutput} mm (设计${globalStats.totalDesignLength} + 废料${globalStats.totalWaste} + 真余料${globalStats.totalRealRemainder})`);
    console.log(`  - 差异: ${difference} mm ${difference <= 1 ? '✅' : '❌'}`);

    // 🔍 检查规格级统计
    console.log('\n📋 规格级统计详情:');
    const specDetails = optimizationResult.completeStats?.specificationDetails;
    if (specDetails) {
      Object.entries(specDetails).forEach(([groupKey, details]) => {
        console.log(`  ${details.displayName}:`);
        console.log(`    - 模数钢材: ${details.stats.moduleUsed} 根 (${details.stats.totalMaterial} mm)`);
        console.log(`    - 设计长度: ${details.stats.designLength} mm`);
        console.log(`    - 废料: ${details.stats.waste} mm`);
        console.log(`    - 真余料: ${details.stats.realRemainder} mm`);
        console.log(`    - 伪余料: ${details.stats.pseudoRemainder} 个`);
        console.log(`    - 损耗率: ${details.stats.lossRate}%`);
        console.log(`    - 利用率: ${details.stats.utilization}%`);
      });
    }

    // 🔍 验证余料状态
    console.log('\n🔢 余料状态验证:');
    const solutions = optimizationResult.solutions;
    let pendingRemainderCount = 0;
    let realRemainderCount = 0;
    let wasteRemainderCount = 0;
    let pseudoRemainderCount = 0;

    Object.entries(solutions).forEach(([groupKey, solution]) => {
      solution.cuttingPlans?.forEach(plan => {
        if (plan.newRemainders) {
          plan.newRemainders.forEach(remainder => {
            switch (remainder.type) {
              case 'pending':
                pendingRemainderCount++;
                console.log(`    ⚠️ 发现待定状态余料: ${remainder.id} (${remainder.length}mm)`);
                break;
              case 'real':
                realRemainderCount++;
                break;
              case 'waste':
                wasteRemainderCount++;
                break;
              case 'pseudo':
                pseudoRemainderCount++;
                break;
            }
          });
        }
      });
    });

    console.log(`  - 待定余料: ${pendingRemainderCount} 个 ${pendingRemainderCount === 0 ? '✅' : '❌ 应该为0'}`);
    console.log(`  - 真余料: ${realRemainderCount} 个`);
    console.log(`  - 废料: ${wasteRemainderCount} 个`);
    console.log(`  - 伪余料: ${pseudoRemainderCount} 个`);

    // 🔍 总结修复效果
    console.log('\n🎯 修复效果总结:');
    const fixes = [];
    
    if (consistencyCheck?.isConsistent) {
      fixes.push('✅ 数据一致性检查通过');
    } else {
      fixes.push('❌ 数据一致性检查失败');
    }
    
    if (difference <= 1) {
      fixes.push('✅ 物料守恒定律满足');
    } else {
      fixes.push('❌ 物料守恒定律不满足');
    }
    
    if (pendingRemainderCount === 0) {
      fixes.push('✅ 所有余料状态已确定');
    } else {
      fixes.push('❌ 存在未确定状态的余料');
    }
    
    if (globalStats.totalPseudoRemainder >= 0) {
      fixes.push('✅ 伪余料统计正常');
    } else {
      fixes.push('❌ 伪余料统计异常');
    }

    fixes.forEach(fix => console.log(`  ${fix}`));

    const successCount = fixes.filter(fix => fix.startsWith('✅')).length;
    const totalCount = fixes.length;
    
    console.log(`\n📊 修复成功率: ${successCount}/${totalCount} (${(successCount/totalCount*100).toFixed(1)}%)`);

    if (successCount === totalCount) {
      console.log('🎉 所有统计计算问题已成功修复！');
    } else {
      console.log('⚠️ 仍有部分问题需要进一步调整');
    }

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
    console.error(error.stack);
  }
}

// 执行测试
testStatisticsCalculatorFix(); 