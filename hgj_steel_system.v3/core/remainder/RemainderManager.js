/**
 * 余料管理器 - V3.0核心模块
 * 按规格+截面面积组合键分组管理余料（真正的规格化设计）
 */

const { RemainderV3, REMAINDER_TYPES } = require('../../api/types');
const { v4: uuidv4 } = require('uuid');

class RemainderManager {
  constructor(wasteThreshold = 100) {
    this.wasteThreshold = wasteThreshold;
    this.remainderPools = {}; // 按规格+截面面积组合键分组的余料池
    this.remainderCounters = {}; // 余料计数器
    this.usageHistory = {}; // 余料使用历史
  }

  /**
   * 初始化组合键余料池
   */
  initializePool(groupKey) {
    if (!this.remainderPools[groupKey]) {
      this.remainderPools[groupKey] = [];
      this.remainderCounters[groupKey] = { letterIndex: 0, numbers: {} };
      this.usageHistory[groupKey] = [];
    }
  }

  /**
   * 生成余料ID（按组合键）
   */
  generateRemainderID(groupKey, sourceId = null) {
    this.initializePool(groupKey);
    
    const counter = this.remainderCounters[groupKey];
    const letter = String.fromCharCode(97 + counter.letterIndex); // a, b, c...
    
    if (!counter.numbers[letter]) {
      counter.numbers[letter] = 0;
    }
    counter.numbers[letter]++;
    
    // 如果单个字母的数量超过50，切换到下一个字母
    if (counter.numbers[letter] > 50) {
      counter.letterIndex++;
      const newLetter = String.fromCharCode(97 + counter.letterIndex);
      counter.numbers[newLetter] = 1;
      return `${groupKey}_${newLetter}1`; // 包含组合键信息
    }
    
    return `${groupKey}_${letter}${counter.numbers[letter]}`;
  }

  /**
   * 🔧 修复：余料评估和处理方法
   * 关键修复：真余料只能在生产结束后确定，不能在切割过程中提前标记
   */
  evaluateAndProcessRemainder(remainder, groupKey, context = {}) {
    this.initializePool(groupKey);
    
    // 确保余料有正确的ID和组合键信息
    if (!remainder.id) {
      remainder.id = this.generateRemainderID(groupKey);
    }
    if (!remainder.groupKey) {
      remainder.groupKey = groupKey;
    }
    
    const result = {
      remainder: remainder,
      isWaste: false,
      isPendingRemainder: false, // 🔧 修复：改为isPendingRemainder
      wasteLength: 0,
      action: '', // 'addToPool', 'markAsWaste', 'ignore'
      statistics: {
        wasteGenerated: 0,
        pendingRemainderGenerated: 0 // 🔧 修复：改为pendingRemainderGenerated
      }
    };
    
    // 🎯 修复：正确的动态判断逻辑
    if (remainder.length < this.wasteThreshold) {
      // 情况1：长度小于阈值，立即标记为废料
      remainder.markAsWaste();
      result.isWaste = true;
      result.wasteLength = remainder.length;
      result.action = 'markAsWaste';
      result.statistics.wasteGenerated = remainder.length;
      
      console.log(`🗑️ ${groupKey}余料 ${remainder.id} (${remainder.length}mm) 立即判断为废料 [${context.source || '未知来源'}]`);
    } else {
      // 🔧 关键修复：长度大于阈值，保持pending状态，加入池中待后续使用
      // 注意：不能在这里markAsReal()，因为真余料只能在生产结束后确定
      remainder.type = REMAINDER_TYPES.PENDING; // 保持pending状态
      this.remainderPools[groupKey].push(remainder);
      
      // 🔧 优化：按长度升序排列，配合二分查找策略
      this.remainderPools[groupKey].sort((a, b) => a.length - b.length);
      
      result.isPendingRemainder = true;
      result.action = 'addToPool';
      result.statistics.pendingRemainderGenerated = remainder.length;
      
      console.log(`⏳ ${groupKey}余料 ${remainder.id} (${remainder.length}mm) 标记为待定状态并加入池中 [${context.source || '未知来源'}] - 真余料状态将在生产结束后确定`);
    }
    
    return result;
  }

  /**
   * 添加余料到组合键池中（修改为使用统一动态判断）
   */
  addRemainder(remainder, groupKey) {
    // 🔧 修复：使用统一的动态判断，移除重复的废料判断逻辑
    const evaluationResult = this.evaluateAndProcessRemainder(remainder, groupKey, {
      source: '外部添加'
    });
    
    return evaluationResult.remainder;
  }

  /**
   * 寻找最佳余料组合（按组合键匹配）
   * 🔧 重构：支持动态多余料组合，根据焊接段数限制
   */
  findBestRemainderCombination(targetLength, groupKey, maxWeldingSegments = 2) {
    this.initializePool(groupKey);
    const pool = this.remainderPools[groupKey].filter(r => r.type !== REMAINDER_TYPES.WASTE);
    
    console.log(`🔍 在${groupKey}组合余料池中寻找 ${targetLength}mm 的最佳组合（最大焊接段数：${maxWeldingSegments}）`);
    
    if (pool.length === 0) {
      console.log(`❌ ${groupKey}组合余料池为空`);
      return null;
    }
    
    // 🔧 优化：按长度升序排序，便于算法优化
    const sortedPool = [...pool].sort((a, b) => a.length - b.length);
    
    const startTime = Date.now();
    let bestCombination = null;
    let bestEfficiency = Infinity;
    
    // 🔧 动态组合：从1段到maxWeldingSegments段
    for (let segmentCount = 1; segmentCount <= maxWeldingSegments; segmentCount++) {
      const combination = this.findBestCombinationWithSegments(sortedPool, targetLength, segmentCount);
      
      if (combination && combination.efficiency < bestEfficiency) {
        bestEfficiency = combination.efficiency;
        bestCombination = combination;
        
        // 🔧 优化：如果找到完美匹配（效率≈1），立即返回
        if (combination.efficiency <= 1.01) {
          console.log(`✨ 找到完美匹配，提前结束搜索`);
          break;
        }
      }
    }
    
    const endTime = Date.now();
    
    if (bestCombination) {
      // 转换为原池中的索引
      bestCombination.indices = bestCombination.remainders.map(remainder => 
        pool.findIndex(r => r.id === remainder.id)
      );
      
      console.log(`✅ 找到最优${bestCombination.remainders.length}段组合: ${bestCombination.remainders.map(r => `${r.id}(${r.length}mm)`).join(' + ')} = ${bestCombination.totalLength}mm，效率：${bestCombination.efficiency.toFixed(3)}，耗时：${endTime - startTime}ms`);
      return bestCombination;
    }
    
    console.log(`❌ 在${groupKey}组合余料池中未找到合适组合，耗时：${endTime - startTime}ms`);
    return null;
  }

  /**
   * 🧠 智能算法选择器：根据问题规模选择最优算法
   */
  findBestCombinationWithSegments(sortedPool, targetLength, segmentCount) {
    const poolSize = sortedPool.length;
    
    if (poolSize <= 20 || segmentCount <= 2) {
      // 小规模问题：使用动态规划（精确解）
      console.log(`🧮 选择动态规划算法（池大小：${poolSize}，段数：${segmentCount}）- 精确解`);
      return this.findBestCombinationDP(sortedPool, targetLength, segmentCount);
    } else {
      // 大规模问题：使用分层贪心（近似解，但很快）
      console.log(`🚀 选择分层贪心算法（池大小：${poolSize}，段数：${segmentCount}）- 快速近似解`);
      return this.findBestCombinationGreedy(sortedPool, targetLength, segmentCount);
    }
  }

  /**
   * 🎯 动态规划算法：找到精确最优解
   * 时间复杂度：O(k × n × L)，其中L是可能长度的数量
   * 适用于：小规模问题，保证全局最优
   */
  findBestCombinationDP(sortedPool, targetLength, maxSegments) {
    if (maxSegments === 1) {
      // 单段：直接二分查找
      const index = this.binarySearchClosest(sortedPool, targetLength);
      if (index !== -1) {
        const remainder = sortedPool[index];
        return {
          type: 'single',
          remainders: [remainder],
          totalLength: remainder.length,
          efficiency: remainder.length / targetLength
        };
      }
      return null;
    }

    // 动态规划状态：Map<length, {remainders, efficiency}>
    let currentStates = new Map();
    currentStates.set(0, { remainders: [], efficiency: Infinity });

    // 逐段构建解
    for (let segment = 1; segment <= maxSegments; segment++) {
      const nextStates = new Map();
      
      // 对于每个当前状态
      for (const [currentLength, currentState] of currentStates) {
        // 尝试添加每个余料
        for (const remainder of sortedPool) {
          // 避免重复使用同一个余料
          if (currentState.remainders.some(r => r.id === remainder.id)) {
            continue;
          }
          
          const newLength = currentLength + remainder.length;
          const newRemainders = [...currentState.remainders, remainder];
          const newEfficiency = newLength >= targetLength ? newLength / targetLength : Infinity;
          
          // 更新状态（保留更优的组合）
          if (!nextStates.has(newLength) || nextStates.get(newLength).efficiency > newEfficiency) {
            nextStates.set(newLength, {
              remainders: newRemainders,
              efficiency: newEfficiency
            });
      }
    }
      }
      
      currentStates = nextStates;
    
      // 剪枝：保留效率合理的解，避免状态爆炸
      if (currentStates.size > 1000) {
        const validStates = new Map();
        const sortedStates = Array.from(currentStates.entries())
          .filter(([length, state]) => length >= targetLength && state.efficiency <= 2.0)
          .sort(([, a], [, b]) => a.efficiency - b.efficiency)
          .slice(0, 100); // 只保留前100个最优解
        
        for (const [length, state] of sortedStates) {
          validStates.set(length, state);
        }
        
        if (validStates.size > 0) {
          currentStates = validStates;
        }
      }
    }

    // 找到最优解
    let bestSolution = null;
    let bestEfficiency = Infinity;
    
    for (const [length, state] of currentStates) {
      if (length >= targetLength && state.efficiency < bestEfficiency) {
        bestEfficiency = state.efficiency;
        bestSolution = {
          type: 'combination',
          remainders: state.remainders,
          totalLength: length,
          efficiency: state.efficiency
        };
      }
    }
    
    return bestSolution;
  }

  /**
   * ⚡ 分层贪心算法：快速找到近似最优解
   * 时间复杂度：O(k × n × log n)
   * 适用于：大规模问题，速度优先
   */
  findBestCombinationGreedy(sortedPool, targetLength, maxSegments) {
    // 按长度降序排序，贪心选择
    const descendingPool = [...sortedPool].sort((a, b) => b.length - a.length);
    
    let bestSolution = null;
      let bestEfficiency = Infinity;
      
    // 尝试每个可能的段数
    for (let segments = 1; segments <= maxSegments; segments++) {
      const solution = this.greedySearchForSegments(descendingPool, targetLength, segments);
      
      if (solution && solution.efficiency < bestEfficiency) {
        bestEfficiency = solution.efficiency;
        bestSolution = solution;
        
        // 如果找到完美匹配，立即返回
        if (solution.efficiency <= 1.01) {
          break;
        }
      }
    }
    
    return bestSolution;
  }

  /**
   * 🎲 贪心搜索指定段数的组合
   */
  greedySearchForSegments(descendingPool, targetLength, targetSegments) {
    const used = new Set();
    const combination = [];
    let totalLength = 0;
    let remaining = targetLength;
    
    for (let segment = 0; segment < targetSegments && remaining > 0; segment++) {
      let bestChoice = null;
      let bestWaste = Infinity;
      
      // 在剩余余料中找最合适的
      for (let i = 0; i < descendingPool.length; i++) {
        const remainder = descendingPool[i];
        
        if (used.has(remainder.id)) continue;
        
        // 如果是最后一段，必须满足剩余需求
        if (segment === targetSegments - 1) {
          if (remainder.length >= remaining) {
            const waste = remainder.length - remaining;
            if (waste < bestWaste) {
              bestWaste = waste;
              bestChoice = { remainder, index: i };
            }
          }
        } else {
          // 不是最后一段，选择最大的（贪心策略）
          if (remainder.length <= remaining * 1.5) { // 避免选择过大的余料
            bestChoice = { remainder, index: i };
            break;
          }
        }
      }
      
      if (!bestChoice) break;
      
      used.add(bestChoice.remainder.id);
      combination.push(bestChoice.remainder);
      totalLength += bestChoice.remainder.length;
      remaining -= bestChoice.remainder.length;
    }
    
    if (totalLength >= targetLength) {
      return {
        type: combination.length === 1 ? 'single' : 'combination',
        remainders: combination,
                totalLength: totalLength,
        efficiency: totalLength / targetLength
              };
            }
    
    return null;
  }

  /**
   * 🔍 二分查找最接近且大于目标长度的余料
   * 时间复杂度：O(log n)
   */
  binarySearchClosest(sortedPool, targetLength) {
    let left = 0;
    let right = sortedPool.length - 1;
    let result = -1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midLength = sortedPool[mid].length;
      
      if (midLength >= targetLength) {
        result = mid; // 记录当前找到的合适余料
        right = mid - 1; // 继续在左半部分寻找更小的合适余料
      } else {
        left = mid + 1; // 在右半部分寻找
      }
    }
    
    return result;
  }

  /**
   * 使用余料进行切割
   * 关键：动态判断余料类型，并确保统计正确
   */
  useRemainder(combination, targetLength, designId, groupKey) {
    const { remainders, indices } = combination;
    const totalLength = combination.totalLength;
    const newRemainderLength = totalLength - targetLength;
    
    // 记录使用历史
    const usage = {
      timestamp: new Date().toISOString(),
      remainderIds: remainders.map(r => r.id),
      targetLength,
      designId,
      groupKey,
      resultLength: newRemainderLength
    };
    this.usageHistory[groupKey].push(usage);
    
    // ❗ 关键修复：从池中移除已使用的余料
    this.removeRemaindersFromPool(indices, groupKey);
    
    // 🔧 关键修复：标记原余料为伪余料（已被使用），这仅用于追溯，不参与主统计
    const pseudoRemainders = [];
    remainders.forEach(remainder => {
      // 🔧 关键修复：创建伪余料副本，并确保方法被正确复制
      const pseudoRemainder = Object.assign(new RemainderV3({}), remainder);
      pseudoRemainder.markAsPseudo();
      pseudoRemainders.push(pseudoRemainder);
      console.log(`🔄 ${groupKey}组合余料 ${remainder.id} 标记为伪余料（已使用）`);
    });
    
    const newRemainders = [];
    const realRemainders = [];
    let waste = 0;
    
    if (newRemainderLength > 0) {
      const sourceChain = remainders.reduce((chain, r) => chain.concat(r.sourceChain || [r.id]), []);
      
      const newRemainder = new RemainderV3({
        id: this.generateRemainderID(groupKey),
        length: newRemainderLength,
        type: REMAINDER_TYPES.PENDING, // 初始为待定状态
        sourceChain,
        groupKey,
        originalLength: totalLength,
        parentId: remainders.map(r => r.id).join('+'),
        createdAt: new Date().toISOString()
      });
      
      // 🔧 修复：使用统一的动态判断替代重复逻辑
      const evaluationResult = this.evaluateAndProcessRemainder(newRemainder, groupKey, {
        source: '余料组合切割后'
      });
      
      if (evaluationResult.isWaste) {
        waste = evaluationResult.wasteLength;
      } else if (evaluationResult.isRealRemainder) {
        realRemainders.push(newRemainder);
      }
      
      newRemainders.push(newRemainder);
    }
    
    // 创建切割详情
    const details = [{
      sourceType: 'remainder',
      sourceId: remainders.map(r => r.id).join('+'),
      sourceLength: totalLength,
      designId,
      length: targetLength,
      quantity: 1,
      groupKey,
      remainderInfo: {
        usedRemainders: remainders,
        newRemainder: newRemainders[0] || null,
        waste
      },
      weldingCount: remainders.length
    }];
    
    return {
      usedRemainders: remainders,
      newRemainders: newRemainders,
      pseudoRemainders,
      realRemainders,
      cuttingLength: targetLength,
      waste,
      details: details
    };
  }

  /**
   * 从组合键余料池中移除指定余料
   */
  removeRemaindersFromPool(indices, groupKey) {
    this.initializePool(groupKey);
    
    // 按索引降序排列，避免删除时索引错乱
    indices.sort((a, b) => b - a);
    
    indices.forEach(index => {
      if (index >= 0 && index < this.remainderPools[groupKey].length) {
        const removed = this.remainderPools[groupKey].splice(index, 1)[0];
        console.log(`➖ 从${groupKey}组合余料池中移除: ${removed.id}`);
      }
    });
  }

  /**
   * 获取所有余料（跨所有组合）
   */
  getAllRemainders() {
    const allRemainders = [];
    
    // 遍历所有余料池
    for (const [groupKey, remainders] of Object.entries(this.remainderPools)) {
      allRemainders.push(...remainders);
    }
    
    return allRemainders;
  }

  /**
   * 🔧 修复：生产结束后的余料最终处理
   * 关键修复：只有在此阶段才能确定真余料状态
   */
  finalizeRemainders() {
    const finalStats = {
      totalWaste: 0,
      totalRealRemainders: 0,
      totalPseudoRemainders: 0,
      remaindersByGroup: {}
    };

    console.log('\n🏁 开始生产结束后的余料最终处理...');
    
    // 🔧 关键修复：遍历所有余料池，将剩余的pending余料标记为真余料
    for (const [groupKey, remainders] of Object.entries(this.remainderPools)) {
      const groupStats = {
        pendingToReal: 0,
        realCount: 0,
        realLength: 0
      };
      
      console.log(`\n📋 处理 ${groupKey} 组余料池...`);
    
      // 🔧 修复：只处理pending状态的余料
      const pendingRemainders = remainders.filter(r => r.type === REMAINDER_TYPES.PENDING);
    
      console.log(`  - 池中待定余料数量: ${pendingRemainders.length}`);
      
      // 🔧 关键修复：将pending余料标记为真余料
    pendingRemainders.forEach(remainder => {
        remainder.markAsReal();
        groupStats.pendingToReal++;
        groupStats.realCount++;
        groupStats.realLength += remainder.length;
        
        console.log(`  ✅ 余料 ${remainder.id} (${remainder.length}mm) 确定为真余料`);
      });
      
      finalStats.totalRealRemainders += groupStats.realCount;
      finalStats.remaindersByGroup[groupKey] = groupStats;
    
      console.log(`  📊 ${groupKey} 组统计: ${groupStats.pendingToReal}个待定余料 → ${groupStats.realCount}个真余料 (总长度: ${groupStats.realLength}mm)`);
    }

    // 统计所有类型的余料
    this.getAllRemainders().forEach(remainder => {
      if (remainder.type === REMAINDER_TYPES.WASTE) {
        finalStats.totalWaste += remainder.length;
      } else if (remainder.type === REMAINDER_TYPES.PSEUDO) {
        finalStats.totalPseudoRemainders++;
      }
    });

    console.log('\n🎯 余料最终处理完成统计:');
    console.log(`  - 真余料: ${finalStats.totalRealRemainders}个`);
    console.log(`  - 伪余料: ${finalStats.totalPseudoRemainders}个`);
    console.log(`  - 废料总长度: ${finalStats.totalWaste}mm`);
    
    return finalStats;
  }

  /**
   * 获取规格统计信息
   */
  getStatistics(groupKey = null) {
    if (groupKey) {
      return this.getSpecificationStatistics(groupKey);
    }
    
    // 获取所有规格的统计
    const allStats = {};
    Object.keys(this.remainderPools).forEach(spec => {
      allStats[spec] = this.getSpecificationStatistics(spec);
    });
    
    return allStats;
  }

  /**
   * 获取单个规格的统计信息
   */
  getSpecificationStatistics(groupKey) {
    this.initializePool(groupKey);
    
    const pool = this.remainderPools[groupKey];
    const usage = this.usageHistory[groupKey];
    
    const stats = {
      groupKey: groupKey,
      totalRemainders: pool.length,
      realRemainders: pool.filter(r => r.type === REMAINDER_TYPES.REAL).length,
      pseudoRemainders: pool.filter(r => r.type === REMAINDER_TYPES.PSEUDO).length,
      wasteRemainders: pool.filter(r => r.type === REMAINDER_TYPES.WASTE).length,
      pendingRemainders: pool.filter(r => r.type === REMAINDER_TYPES.PENDING).length,
      totalLength: pool.reduce((sum, r) => sum + r.length, 0),
      realLength: pool.filter(r => r.type === REMAINDER_TYPES.REAL).reduce((sum, r) => sum + r.length, 0),
      wasteLength: pool.filter(r => r.type === REMAINDER_TYPES.WASTE).reduce((sum, r) => sum + r.length, 0),
      usageCount: usage.length,
      averageLength: pool.length > 0 ? pool.reduce((sum, r) => sum + r.length, 0) / pool.length : 0
    };
    
    return stats;
  }

  /**
   * 清空组合键余料池
   */
  clearPool(groupKey = null) {
    if (groupKey) {
      this.remainderPools[groupKey] = [];
      this.remainderCounters[groupKey] = { letterIndex: 0, numbers: {} };
      this.usageHistory[groupKey] = [];
      console.log(`🧹 清空${groupKey}组合余料池`);
    } else {
      this.remainderPools = {};
      this.remainderCounters = {};
      this.usageHistory = {};
      console.log('🧹 清空所有组合键余料池');
    }
  }

  /**
   * 导出池状态
   */
  exportPoolState() {
    const state = {
      timestamp: new Date().toISOString(),
      groupKeys: Object.keys(this.remainderPools),
      pools: {},
      statistics: {}
    };
    
    Object.keys(this.remainderPools).forEach(groupKey => {
      state.pools[groupKey] = this.remainderPools[groupKey].map(r => ({
        id: r.id,
        length: r.length,
        type: r.type,
        groupKey: r.groupKey,
        sourceChain: r.sourceChain,
        createdAt: r.createdAt
      }));
      
      state.statistics[groupKey] = this.getSpecificationStatistics(groupKey);
    });
    
    return state;
  }
}

module.exports = RemainderManager; 