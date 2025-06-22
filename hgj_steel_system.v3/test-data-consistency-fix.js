/**
 * 数据一致性修复验证测试
 * 测试V3系统的统一数据源是否解决了"数据逻辑不自洽"问题
 */

const OptimizationService = require('./api/services/OptimizationService');

// 测试数据
const testData = {
  designSteels: [
    {
      id: "D001",
      length: 3000,
      quantity: 5,
      crossSection: 2000,
      specification: "HRB400",
      displayId: "D001"
    }
  ],
  moduleSteels: [
    {
      id: "M001",
      name: "12米标准钢材",
      length: 12000
    }
  ],
  constraints: {
    wasteThreshold: 100,
    targetLossRate: 5,
    timeLimit: 30000,
    maxWeldingSegments: 1
  }
};

async function testDataConsistency() {
  console.log('🧪 开始数据一致性修复验证测试...\n');
  
  try {
    const optimizationService = new OptimizationService();
    
    console.log('📋 测试数据概述:');
    console.log(`- 设计钢材: ${testData.designSteels.length}种`);
    console.log(`- 模数钢材: ${testData.moduleSteels.length}种`);
    console.log(`- 设计需求: 5根×3000mm = 15000mm`);
    console.log(`- 模数钢材: 12000mm/根`);
    console.log(`- 理论需要: 2根模数钢材 (24000mm)`);
    console.log(`- 理论损耗: 9000mm (37.5%)\n`);
    
    console.log('🚀 执行优化...');
    const result = await optimizationService.optimizeSteel(testData);
    
    if (!result.success) {
      console.error('❌ 优化失败:', result.error);
      if (result.suggestions) {
        console.log('💡 建议:', result.suggestions);
      }
      return;
    }
    
    console.log('✅ 优化成功!\n');
    
    // 验证数据一致性
    console.log('🔍 数据一致性验证:');
    const optimizationResult = result.result;
    
    // 检查是否包含新的completeStats
    if (optimizationResult.completeStats) {
      console.log('✅ 发现completeStats数据结构');
      
      const global = optimizationResult.completeStats.global;
      console.log('\n📊 统一数据源统计:');
      console.log(`- 模数钢材用量: ${global.totalModuleCount}根`);
      console.log(`- 模数钢材总长: ${global.totalModuleLength}mm`);
      console.log(`- 废料: ${global.totalWaste}mm`);
      console.log(`- 真余料: ${global.totalRealRemainder}mm`);
      console.log(`- 总损耗率: ${global.overallLossRate}%`);
      
      // 检查数据一致性
      const consistencyCheck = optimizationResult.completeStats.consistencyCheck;
      console.log('\n🔍 数据一致性检查结果:');
      console.log(`- 检查状态: ${consistencyCheck.isConsistent ? '✅ 通过' : '❌ 失败'}`);
      
      if (consistencyCheck.errors.length > 0) {
        console.log('- 发现错误:');
        consistencyCheck.errors.forEach(error => {
          console.log(`  • ${error}`);
        });
      }
      
      if (consistencyCheck.warnings.length > 0) {
        console.log('- 警告信息:');
        consistencyCheck.warnings.forEach(warning => {
          console.log(`  • ${warning}`);
        });
      }
      
      // 验证需求满足情况
      const requirementValidation = optimizationResult.completeStats.requirementValidation;
      console.log('\n✅ 需求验证结果:');
      console.log(`- 总需求: ${requirementValidation.summary.total}项`);
      console.log(`- 已满足: ${requirementValidation.summary.satisfied}项`);
      console.log(`- 未满足: ${requirementValidation.summary.unsatisfied}项`);
      console.log(`- 满足率: ${requirementValidation.summary.overallSatisfactionRate}%`);
      
      // 详细检查第一个设计钢材
      const firstRequirement = requirementValidation.items[0];
      if (firstRequirement) {
        console.log('\n📋 详细需求检查 (D001):');
        console.log(`- 需求数量: ${firstRequirement.quantity}根`);
        console.log(`- 生产数量: ${firstRequirement.produced}根`);
        console.log(`- 是否满足: ${firstRequirement.satisfied ? '✅ 是' : '❌ 否'}`);
        console.log(`- 差值: ${firstRequirement.difference}根`);
      }
      
    } else {
      console.log('⚠️ 未发现completeStats，使用兼容模式');
    }
    
    // 对比原有字段
    console.log('\n📊 原有字段对比:');
    console.log(`- totalModuleUsed: ${optimizationResult.totalModuleUsed}根`);
    console.log(`- totalMaterial: ${optimizationResult.totalMaterial}mm`);
    console.log(`- totalWaste: ${optimizationResult.totalWaste}mm`);
    console.log(`- totalRealRemainder: ${optimizationResult.totalRealRemainder}mm`);
    console.log(`- totalLossRate: ${optimizationResult.totalLossRate}%`);
    
    // 检查数据一致性
    if (optimizationResult.completeStats) {
      const global = optimizationResult.completeStats.global;
      console.log('\n🔍 新旧数据对比:');
      
      const moduleCountMatch = optimizationResult.totalModuleUsed === global.totalModuleCount;
      const materialMatch = Math.abs(optimizationResult.totalMaterial - global.totalModuleLength) < 0.01;
      const wasteMatch = Math.abs(optimizationResult.totalWaste - global.totalWaste) < 0.01;
      const lossRateMatch = Math.abs(optimizationResult.totalLossRate - global.overallLossRate) < 0.01;
      
      console.log(`- 模数钢材数量: ${moduleCountMatch ? '✅' : '❌'} 匹配`);
      console.log(`- 总材料长度: ${materialMatch ? '✅' : '❌'} 匹配`);
      console.log(`- 废料: ${wasteMatch ? '✅' : '❌'} 匹配`);
      console.log(`- 损耗率: ${lossRateMatch ? '✅' : '❌'} 匹配`);
      
      const allMatch = moduleCountMatch && materialMatch && wasteMatch && lossRateMatch;
      console.log(`\n🎯 总体数据一致性: ${allMatch ? '✅ 完全一致' : '⚠️ 存在差异'}`);
    }
    
    // 测试结果评估
    console.log('\n📈 测试结果评估:');
    
    // 检查理论计算
    const expectedModuleCount = Math.ceil(15000 / 12000); // 2根
    const actualModuleCount = optimizationResult.totalModuleUsed;
    
    console.log(`- 理论模数钢材需求: ${expectedModuleCount}根`);
    console.log(`- 实际模数钢材使用: ${actualModuleCount}根`);
    console.log(`- 计算是否合理: ${actualModuleCount === expectedModuleCount ? '✅ 合理' : '⚠️ 需检查'}`);
    
    if (optimizationResult.totalMaterial > 0) {
      const actualLossRate = ((optimizationResult.totalWaste + optimizationResult.totalRealRemainder) / optimizationResult.totalMaterial * 100);
      const theoreticalLossRate = (9000 / 24000 * 100); // 37.5%
      
      console.log(`- 理论损耗率: ${theoreticalLossRate.toFixed(2)}%`);
      console.log(`- 实际损耗率: ${actualLossRate.toFixed(2)}%`);
      console.log(`- 损耗率是否合理: ${Math.abs(actualLossRate - theoreticalLossRate) < 5 ? '✅ 合理' : '⚠️ 偏差较大'}`);
    }
    
    console.log('\n🎉 数据一致性修复验证测试完成!');
    
  } catch (error) {
    console.error('❌ 测试过程出错:', error.message);
    console.error('详细错误:', error);
  }
}

// 执行测试
if (require.main === module) {
  testDataConsistency().then(() => {
    console.log('\n✅ 测试脚本执行完成');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ 测试脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = { testDataConsistency }; 