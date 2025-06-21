/**
 * 测试新的余料组合优化算法
 */

const RemainderManager = require('./core/remainder/RemainderManager');
const { RemainderV3, REMAINDER_TYPES } = require('./api/types');

async function testRemainderOptimization() {
  console.log('🧪 开始测试余料组合优化算法');
  
  // 创建余料管理器
  const remainderManager = new RemainderManager(100);
  const groupKey = 'HPB300_2000';
  
  // 创建测试余料
  const testRemainders = [
    new RemainderV3({ id: 'R1', length: 1500, type: REMAINDER_TYPES.REAL, groupKey }),
    new RemainderV3({ id: 'R2', length: 2200, type: REMAINDER_TYPES.REAL, groupKey }),
    new RemainderV3({ id: 'R3', length: 800, type: REMAINDER_TYPES.REAL, groupKey }),
    new RemainderV3({ id: 'R4', length: 3000, type: REMAINDER_TYPES.REAL, groupKey }),
    new RemainderV3({ id: 'R5', length: 1200, type: REMAINDER_TYPES.REAL, groupKey }),
    new RemainderV3({ id: 'R6', length: 900, type: REMAINDER_TYPES.REAL, groupKey }),
    new RemainderV3({ id: 'R7', length: 1800, type: REMAINDER_TYPES.REAL, groupKey }),
    new RemainderV3({ id: 'R8', length: 2500, type: REMAINDER_TYPES.REAL, groupKey }),
  ];
  
  // 添加余料到池中
  testRemainders.forEach(remainder => {
    remainderManager.addRemainder(remainder, groupKey);
  });
  
  console.log(`📦 已添加 ${testRemainders.length} 个测试余料到池中`);
  
  // 测试不同的目标长度和焊接段数
  const testCases = [
    { target: 2000, segments: 1, description: '单段匹配' },
    { target: 2000, segments: 2, description: '双段组合' },
    { target: 3500, segments: 2, description: '双段组合（需要大余料）' },
    { target: 4000, segments: 3, description: '三段组合' },
    { target: 5000, segments: 4, description: '四段组合' },
    { target: 1000, segments: 1, description: '小长度单段' },
  ];
  
  console.log('\n🔍 开始测试不同场景：');
  
  for (const testCase of testCases) {
    console.log(`\n--- 测试：${testCase.description} (目标: ${testCase.target}mm, 最大段数: ${testCase.segments}) ---`);
    
    const startTime = Date.now();
    const result = remainderManager.findBestRemainderCombination(
      testCase.target, 
      groupKey, 
      testCase.segments
    );
    const endTime = Date.now();
    
    if (result) {
      console.log(`✅ 找到解决方案:`);
      console.log(`   - 类型: ${result.type}`);
      console.log(`   - 余料: ${result.remainders.map(r => `${r.id}(${r.length}mm)`).join(' + ')}`);
      console.log(`   - 总长度: ${result.totalLength}mm`);
      console.log(`   - 效率: ${(result.efficiency * 100).toFixed(1)}%`);
      console.log(`   - 浪费: ${result.totalLength - testCase.target}mm`);
      console.log(`   - 耗时: ${endTime - startTime}ms`);
    } else {
      console.log(`❌ 未找到合适的组合`);
      console.log(`   - 耗时: ${endTime - startTime}ms`);
    }
  }
  
  // 测试大规模性能
  console.log('\n🚀 测试大规模性能：');
  
  // 创建大量余料
  const largeRemainders = [];
  for (let i = 0; i < 50; i++) {
    const length = 500 + Math.floor(Math.random() * 3000);
    largeRemainders.push(new RemainderV3({ 
      id: `LR${i}`, 
      length, 
      type: REMAINDER_TYPES.REAL, 
      groupKey: 'LARGE_TEST' 
    }));
  }
  
  largeRemainders.forEach(remainder => {
    remainderManager.addRemainder(remainder, 'LARGE_TEST');
  });
  
  console.log(`📦 已添加 ${largeRemainders.length} 个大规模测试余料`);
  
  const largeTestStartTime = Date.now();
  const largeResult = remainderManager.findBestRemainderCombination(
    3000, 
    'LARGE_TEST', 
    5
  );
  const largeTestEndTime = Date.now();
  
  if (largeResult) {
    console.log(`✅ 大规模测试成功:`);
    console.log(`   - 余料数量: ${largeResult.remainders.length}`);
    console.log(`   - 总长度: ${largeResult.totalLength}mm`);
    console.log(`   - 效率: ${(largeResult.efficiency * 100).toFixed(1)}%`);
    console.log(`   - 耗时: ${largeTestEndTime - largeTestStartTime}ms`);
  } else {
    console.log(`❌ 大规模测试未找到合适组合`);
  }
  
  console.log('\n🎯 测试完成！');
}

// 运行测试
if (require.main === module) {
  testRemainderOptimization().catch(console.error);
}

module.exports = { testRemainderOptimization }; 