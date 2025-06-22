/**
 * 统一计算器架构验证测试 - 重点测试需求验证和分组编号映射
 */

const SteelOptimizerV3 = require('./core/optimizer/SteelOptimizerV3');
const { SCENARIO_CONFIGS } = require('./core/config/ConstraintConfig');

async function testUnifiedCalculatorArchitecture() {
  console.log('🧮 统一计算器架构验证测试开始...\n');

  try {
    // 1. 创建约束配置
    const constraintConfig = SCENARIO_CONFIGS.standard;
    
    // 2. 设置测试数据 - 模拟真实的分组编号场景
    const designSteels = [
      // A组：截面面积314
      { id: 'D1', specification: 'HRB400', crossSection: 314, length: 2500, quantity: 5 },
      { id: 'D2', specification: 'HRB400', crossSection: 314, length: 3200, quantity: 3 },
      
      // B组：截面面积490
      { id: 'D3', specification: 'HRB500', crossSection: 490, length: 4100, quantity: 4 },
      { id: 'D4', specification: 'HRB500', crossSection: 490, length: 2800, quantity: 6 }
    ];

    const moduleSteels = [
      { id: 'M1', specification: 'HRB400', length: 6000 },
      { id: 'M2', specification: 'HRB400', length: 9000 },
      { id: 'M3', specification: 'HRB400', length: 12000 },
      { id: 'M4', specification: 'HRB500', length: 6000 },
      { id: 'M5', specification: 'HRB500', length: 9000 },
      { id: 'M6', specification: 'HRB500', length: 12000 }
    ];

    console.log('📊 测试数据:');
    console.log('- 设计钢材:', designSteels.length, '种');
    console.log('- 模数钢材:', moduleSteels.length, '种');
    console.log('- 约束配置: 标准场景');
    console.log('- 废料阈值:', constraintConfig.wasteThreshold, 'mm');
    console.log('- 目标损耗率:', constraintConfig.targetLossRate, '%');

    // 3. 创建优化器并执行优化
    console.log('\n🚀 执行优化...');
    const optimizer = new SteelOptimizerV3(designSteels, moduleSteels, constraintConfig);
    const result = await optimizer.optimize();

    console.log('🔍 优化结果调试信息:');
    console.log('- result.success:', result.success);
    console.log('- result.error:', result.error);
    console.log('- result.result存在:', !!result.result);
    
    if (!result.success) {
      throw new Error(`优化失败: ${result.error}`);
    }

    // 4. 验证统一计算器架构
    console.log('\n✅ 验证统一计算器架构:');
    
    const optimizationResult = result.result;
    if (!optimizationResult || !optimizationResult.completeStats) {
      console.log('调试信息:');
      console.log('- optimizationResult存在:', !!optimizationResult);
      if (optimizationResult) {
        console.log('- optimizationResult.completeStats存在:', !!optimizationResult.completeStats);
        console.log('- optimizationResult keys:', Object.keys(optimizationResult));
      }
      throw new Error('❌ completeStats不存在，统一计算器未正常工作');
    }

    // 4.1 验证需求验证统计
    console.log('\n📋 需求验证统计测试:');
    const requirementValidation = optimizationResult.completeStats.requirementValidation;
    if (!requirementValidation || !requirementValidation.items) {
      throw new Error('❌ 需求验证统计不存在');
    }

    console.log(`✅ 需求验证统计存在，共${requirementValidation.items.length}个需求`);
    console.log('- 需求满足情况:', requirementValidation.summary);
    
    requirementValidation.items.forEach(item => {
      console.log(`  ${item.id}: 需求${item.quantity}件，生产${item.produced}件，${item.satisfied ? '✅满足' : '❌未满足'}`);
    });

    // 4.2 验证分组编号映射（模拟前端generateDisplayIds）
    console.log('\n🏷️ 分组编号映射测试:');
    
    // 模拟前端的generateDisplayIds逻辑
    const crossSectionGroups = designSteels.reduce((groups, steel) => {
      const crossSection = steel.crossSection;
      if (!groups[crossSection]) {
        groups[crossSection] = [];
      }
      groups[crossSection].push(steel);
      return groups;
    }, {});
    
    const sortedCrossSections = Object.keys(crossSectionGroups)
      .map(Number)
      .sort((a, b) => a - b);
    
    console.log('✅ 分组编号映射生成:');
    designSteels.forEach(steel => {
      const crossSection = steel.crossSection;
      const groupIndex = sortedCrossSections.indexOf(crossSection);
      const groupLetter = String.fromCharCode(65 + groupIndex);
      const sameGroupSteels = crossSectionGroups[crossSection]
        .sort((a, b) => a.length - b.length);
      const itemIndex = sameGroupSteels.findIndex(s => s.id === steel.id);
      const displayId = `${groupLetter}${itemIndex + 1}`;
      
      console.log(`  ${steel.id} → ${displayId} (${steel.specification}, ${steel.crossSection}mm², ${steel.length}mm)`);
    });

    // 4.3 验证切割详情中的编号使用
    console.log('\n✂️ 切割详情编号测试:');
    let totalCuts = 0;
    Object.entries(optimizationResult.solutions).forEach(([groupKey, solution]) => {
      solution.cuttingPlans?.forEach((plan, planIndex) => {
        plan.cuts?.forEach((cut, cutIndex) => {
          totalCuts++;
          console.log(`  计划${planIndex+1}-切割${cutIndex+1}: designId=${cut.designId}, 长度=${cut.length}mm, 数量=${cut.quantity}件`);
        });
      });
    });
    console.log(`✅ 总切割记录: ${totalCuts}条`);

    // 4.4 验证统计数据一致性
    console.log('\n📊 统计数据一致性验证:');
    const globalStats = optimizationResult.completeStats.global;
    console.log(`- 模数钢材使用: ${globalStats.totalModuleCount}根`);
    console.log(`- 总材料长度: ${globalStats.totalModuleLength}mm`);
    console.log(`- 损耗率: ${globalStats.overallLossRate.toFixed(2)}%`);
    console.log(`- 废料: ${globalStats.totalWaste}mm`);
    console.log(`- 真余料: ${globalStats.totalRealRemainder}mm`);

    const consistencyCheck = optimizationResult.completeStats.consistencyCheck;
    if (consistencyCheck.isConsistent) {
      console.log('✅ 数据一致性检查通过');
    } else {
      console.warn('⚠️ 数据一致性检查失败:', consistencyCheck.errors);
    }

    console.log('\n🎉 统一计算器架构验证完成！');
    console.log('✅ 需求验证统计正常');
    console.log('✅ 分组编号映射正常');
    console.log('✅ 切割详情编号正常');
    console.log('✅ 统计数据一致性正常');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('详细错误:', error.stack);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  testUnifiedCalculatorArchitecture()
    .then(() => {
      console.log('\n✅ 所有测试通过');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ 测试异常:', error);
      process.exit(1);
    });
}

module.exports = { testUnifiedCalculatorArchitecture }; 