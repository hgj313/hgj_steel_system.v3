/**
 * 简单验证测试 - 专门测试分组编号映射和需求验证
 */

const SteelOptimizerV3 = require('./core/optimizer/SteelOptimizerV3');
const { SCENARIO_CONFIGS } = require('./core/config/ConstraintConfig');

async function testSimpleValidation() {
  console.log('🧮 简单验证测试开始...\n');

  try {
    // 设置简单的测试数据
    const designSteels = [
      { id: 'D1', specification: 'HRB400', crossSection: 314, length: 2500, quantity: 2 },
      { id: 'D2', specification: 'HRB400', crossSection: 314, length: 3200, quantity: 1 },
      { id: 'D3', specification: 'HRB500', crossSection: 490, length: 4100, quantity: 1 }
    ];

    const moduleSteels = [
      { id: 'M1', specification: 'HRB400', length: 6000 },
      { id: 'M2', specification: 'HRB500', length: 6000 }
    ];

    const constraintConfig = SCENARIO_CONFIGS.standard;

    console.log('📊 测试数据:');
    console.log('- 设计钢材:', designSteels.length, '种');
    console.log('- 模数钢材:', moduleSteels.length, '种');

    // 执行优化
    console.log('\n🚀 执行优化...');
    const optimizer = new SteelOptimizerV3(designSteels, moduleSteels, constraintConfig);
    const result = await optimizer.optimize();

    console.log('\n🔍 优化结果:');
    console.log('- success:', result.success);
    console.log('- error:', result.error);

    if (!result.success) {
      throw new Error(`优化失败: ${result.error}`);
    }

    const optimizationResult = result.result;
    console.log('- optimizationResult存在:', !!optimizationResult);
    
    if (optimizationResult) {
      console.log('- completeStats存在:', !!optimizationResult.completeStats);
      
      if (optimizationResult.completeStats) {
        console.log('- global存在:', !!optimizationResult.completeStats.global);
        console.log('- requirementValidation存在:', !!optimizationResult.completeStats.requirementValidation);
        
        if (optimizationResult.completeStats.global) {
          const global = optimizationResult.completeStats.global;
          console.log(`✅ 全局统计: 模数${global.totalModuleCount}根, 损耗率${global.overallLossRate}%`);
        }
        
        if (optimizationResult.completeStats.requirementValidation) {
          const validation = optimizationResult.completeStats.requirementValidation;
          console.log(`✅ 需求验证: ${validation.items?.length || 0}个需求, 全部满足: ${validation.summary?.allSatisfied || false}`);
        }
      }
    }

    // 测试分组编号映射
    console.log('\n🏷️ 测试分组编号映射:');
    
    // 按截面面积分组
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

    console.log('\n✅ 验证完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('详细错误:', error.stack);
  }
}

// 运行测试
testSimpleValidation(); 