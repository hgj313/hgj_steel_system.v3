/**
 * 钢材优化器 V3.0 - 核心算法引擎
 * 集成新的余料系统、约束W和模块化架构
 */

const { 
  DesignSteel, 
  ModuleSteel, 
  RemainderV3, 
  OptimizationSolution,
  OptimizationResult,
  CuttingPlan,
  CuttingDetail,
  LossRateCalculator,
  REMAINDER_TYPES,
  SOURCE_TYPES,
  OptimizationConstraints
} = require('../../api/types');

const RemainderManager = require('../remainder/RemainderManager');
const ConstraintValidator = require('../constraints/ConstraintValidator');
const ParallelOptimizationMonitor = require('./ParallelOptimizationMonitor');
const { v4: uuidv4 } = require('uuid');

class SteelOptimizerV3 {
  constructor(designSteels, moduleSteels, constraints) {
    this.designSteels = designSteels;
    this.moduleSteels = moduleSteels; // 保留原始模数钢材作为模板
    this.constraints = constraints;
    this.startTime = Date.now();
    this.lossRateCalculator = new LossRateCalculator();
    this.moduleCounters = {}; // 模数钢材计数器
    
    // V3新增：规格化模数钢材池管理
    this.moduleSteelPools = new Map(); // 按规格+截面面积组合管理的池
    this.availableLengths = this.extractAvailableLengths(moduleSteels);
    
    console.log('🎯 V3规格化优化器初始化完成');
    console.log(`📊 可用模数钢材长度: ${this.availableLengths.join(', ')}mm`);
    
    // 核心组件
    this.remainderManager = new RemainderManager(constraints.wasteThreshold);
    this.constraintValidator = new ConstraintValidator();
    this.parallelMonitor = new ParallelOptimizationMonitor();
    
    // 计数器
    this.executionStats = {
      totalCuts: 0,
      remaindersGenerated: 0,
      remaindersReused: 0,
      weldingOperations: 0
    };
  }

  /**
   * 从原始模数钢材中提取可用长度
   */
  extractAvailableLengths(moduleSteels) {
    const lengths = moduleSteels.map(m => m.length);
    // 🔧 关键修复：必须按升序排列，这样 find() 才能正确选择最短的合格模数钢材
    return [...new Set(lengths)].sort((a, b) => a - b);
  }

  /**
   * 获取或创建规格化模数钢材池
   */
  getOrCreateModuleSteelPool(groupKey) {
    if (!this.moduleSteelPools.has(groupKey)) {
      const [specification, crossSection] = this.parseGroupKey(groupKey);
      const pool = new SpecificationModuleSteelPool(
        specification,
        parseFloat(crossSection),
        this.availableLengths
      );
      this.moduleSteelPools.set(groupKey, pool);
      console.log(`🔧 创建规格化模数钢材池: ${groupKey}`);
    }
    return this.moduleSteelPools.get(groupKey);
  }

  /**
   * 解析组合键
   */
  parseGroupKey(groupKey) {
    const parts = groupKey.split('_');
    return [parts[0], parts[1]]; // [specification, crossSection]
  }

  /**
   * 主优化入口
   */
  async optimize() {
    console.log('🚀 启动钢材优化算法 V3.0');
    
    try {
      // 1. 预验证约束条件
      const validation = this.constraintValidator.validateAllConstraints(
        this.designSteels, 
        this.moduleSteels, 
        this.constraints
      );
      
      if (!validation.isValid) {
        console.error('❌ 约束条件验证失败');
        return {
          success: false,
          error: '约束条件验证失败',
          validation: validation // 确保返回完整的验证对象
        };
      }

      // 2. 按规格分组优化
      const solutions = await this.optimizeByGroups();
      
      // 🔧 关键修复：在所有组合优化完成后，统一进行余料最终处理
      console.log('\n🏁 所有组合优化完成，开始余料最终处理...');
      const finalRemainderStats = this.remainderManager.finalizeRemainders();
      
      // 🔧 关键修复：更新所有切割计划中的余料状态
      this.updateCuttingPlansRemainderStatus(solutions);
      
      // 3. MW-CD交换已在各并行任务内部完成，无需全局处理
      console.log('\n✅ MW-CD交换优化已在各组合内部完成');
      
      // 4. 计算损耗率和验证
      const result = this.buildOptimizationResult(solutions, validation);
      
      // 5. 验证损耗率计算
      const lossRateValidation = this.lossRateCalculator.validateLossRateCalculation(solutions);
      if (!lossRateValidation.isValid) {
        console.warn('⚠️ 损耗率计算验证失败:', lossRateValidation.errorMessage);
      }
      
      result.lossRateValidation = lossRateValidation;
      result.constraintValidation = validation;
      
      console.log('🎉 优化完成');
      return {
        success: true,
        result: result,
        stats: this.executionStats
      };
      
    } catch (error) {
      console.error('❌ 优化过程出错:', error);
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * V3并行计算框架：按规格+截面面积组合并行优化
   */
  async optimizeByGroups() {
    const groups = this.groupBySpecificationAndCrossSection();
    const groupKeys = Object.keys(groups);
    
    // 启动性能监控
    this.parallelMonitor.startMonitoring(groupKeys.length);
    
    console.log(`🚀 启动V3并行计算框架，共${groupKeys.length}个规格组合将并行优化`);
    
    // 创建并行优化任务（带监控）
    const parallelTasks = groupKeys.map((groupKey, index) => 
      this.createMonitoredParallelTask(groupKey, groups[groupKey], index)
    );
    
    // 并行执行所有优化任务
    const parallelResults = await Promise.allSettled(parallelTasks);
    
    // 合并并行结果
    const solutions = {};
    const parallelStats = {
      successful: 0,
      failed: 0,
      totalGroups: groupKeys.length,
      errors: []
    };
    
    parallelResults.forEach((result, index) => {
      const groupKey = groupKeys[index];
      
      if (result.status === 'fulfilled') {
        solutions[groupKey] = result.value.solution;
        parallelStats.successful++;
        this.parallelMonitor.recordTaskCompletion(index, result.value.stats);
        
        // 🔧 关键修复：合并独立余料管理器的数据到主余料管理器
        if (result.value.remainderManager) {
          this.mergeRemainderManager(result.value.remainderManager, groupKey);
        }
      } else {
        parallelStats.failed++;
        parallelStats.errors.push({
          groupKey: groupKey,
          error: result.reason.message || result.reason
        });
        this.parallelMonitor.recordTaskFailure(index, result.reason.message || result.reason);
        
        // 为失败的任务创建空解决方案
        solutions[groupKey] = new OptimizationSolution({});
      }
    });
    
    // 完成监控并生成报告
    const performanceReport = this.parallelMonitor.finishMonitoring();
    this.parallelMonitor.printPerformanceReport();
    
    console.log(`🏁 V3并行计算完成: ${parallelStats.successful}成功/${parallelStats.failed}失败，共${parallelStats.totalGroups}个组合`);
    
    // 如果有失败的任务，记录详细信息
    if (parallelStats.failed > 0) {
      console.warn('⚠️ 并行计算中的失败任务:', parallelStats.errors);
    }
    
    return solutions;
  }

  /**
   * 创建带监控的并行任务
   */
  async createMonitoredParallelTask(groupKey, steels, taskIndex) {
    // 记录任务开始
    this.parallelMonitor.recordTaskStart(taskIndex, groupKey, steels.length);
    
    try {
      return await this.createParallelOptimizationTask(groupKey, steels);
    } catch (error) {
      // 监控器会在上层记录失败
      throw error;
    }
  }

  /**
   * 创建独立的并行优化任务
   */
  async createParallelOptimizationTask(groupKey, steels) {
    const taskStartTime = Date.now();
    
    try {
      // 为每个并行任务创建独立的余料管理器
      const independentRemainderManager = this.createIndependentRemainderManager(groupKey);
      
      // 创建任务专用的统计信息
      const taskStats = {
        groupKey: groupKey,
        steelsCount: steels.length,
        cuts: 0,
        remaindersGenerated: 0,
        remaindersReused: 0,
        weldingOperations: 0
      };
      
      console.log(`🔧 并行任务启动: ${groupKey} (${steels.length}种设计钢材)`);
      
      // 执行独立优化
      const solution = await this.optimizeGroupIndependently(
        steels, 
        groupKey, 
        independentRemainderManager,
        taskStats
      );
      
      // 🔧 修复：此处不再调用finalizeRemainders，因为要在所有组合完成后统一处理
      // independentRemainderManager.finalizeRemainders();
      
      const executionTime = Date.now() - taskStartTime;
      taskStats.executionTime = executionTime;
      
      return {
        solution: solution,
        stats: taskStats,
        remainderManager: independentRemainderManager
      };
      
    } catch (error) {
      console.error(`💥 并行任务异常: ${groupKey} - ${error.message}`);
      throw new Error(`并行优化失败[${groupKey}]: ${error.message}`);
    }
  }

  /**
   * 创建独立的余料管理器实例
   */
  createIndependentRemainderManager(groupKey) {
    const RemainderManager = require('../remainder/RemainderManager');
    const independentManager = new RemainderManager(this.constraints.wasteThreshold);
    
    // 预初始化该组合的余料池
    independentManager.initializePool(groupKey);
    
    console.log(`🔧 为${groupKey}创建独立余料管理器`);
    return independentManager;
  }

  /**
   * 🔧 关键修复：合并独立余料管理器的数据到主余料管理器
   */
  mergeRemainderManager(independentManager, groupKey) {
    console.log(`🔄 合并独立余料管理器数据: ${groupKey}`);
    
    // 获取独立管理器中的余料池
    const independentPool = independentManager.remainderPools[groupKey] || [];
    
    if (independentPool.length > 0) {
      // 确保主余料管理器有对应的池
      this.remainderManager.initializePool(groupKey);
      
      // 合并余料到主管理器
      independentPool.forEach(remainder => {
        this.remainderManager.remainderPools[groupKey].push(remainder);
        console.log(`  ➕ 合并余料: ${remainder.id} (${remainder.length}mm, 类型: ${remainder.type})`);
      });
      
      console.log(`✅ 已合并 ${independentPool.length} 个余料到主管理器`);
    } else {
      console.log(`  - ${groupKey} 组合没有余料需要合并`);
    }
  }

  /**
   * 🔧 关键修复：更新所有切割计划中的余料状态
   * 在finalizeRemainders之后，将切割计划中pending状态的余料更新为real状态
   */
  updateCuttingPlansRemainderStatus(solutions) {
    console.log('\n🔄 更新切割计划中的余料状态...');
    
    let updatedCount = 0;
    
    // 获取所有已最终化的余料
    const allFinalizedRemainders = this.remainderManager.getAllRemainders();
    const remainderMap = new Map();
    
    allFinalizedRemainders.forEach(remainder => {
      remainderMap.set(remainder.id, remainder);
    });
    
    // 遍历所有解决方案和切割计划
    Object.entries(solutions).forEach(([groupKey, solution]) => {
      solution.cuttingPlans?.forEach(plan => {
        // 更新newRemainders中的状态
        if (plan.newRemainders && plan.newRemainders.length > 0) {
          plan.newRemainders.forEach(remainder => {
            const finalizedRemainder = remainderMap.get(remainder.id);
            if (finalizedRemainder && remainder.type !== finalizedRemainder.type) {
              console.log(`  🔄 更新余料状态: ${remainder.id} (${remainder.type} → ${finalizedRemainder.type})`);
              remainder.type = finalizedRemainder.type;
              updatedCount++;
            }
          });
        }
        
        // 更新realRemainders中的状态
        if (plan.realRemainders && plan.realRemainders.length > 0) {
          plan.realRemainders.forEach(remainder => {
            const finalizedRemainder = remainderMap.get(remainder.id);
            if (finalizedRemainder && remainder.type !== finalizedRemainder.type) {
              console.log(`  🔄 更新真余料状态: ${remainder.id} (${remainder.type} → ${finalizedRemainder.type})`);
              remainder.type = finalizedRemainder.type;
              updatedCount++;
            }
          });
        }
      });
    });
    
    console.log(`✅ 切割计划余料状态更新完成，共更新 ${updatedCount} 个余料`);
  }

  /**
   * 独立优化单个规格+截面面积组合（并行安全）
   */
  async optimizeGroupIndependently(steels, groupKey, remainderManager, taskStats) {
    const solution = new OptimizationSolution({});
    const demands = this.createDemandList(steels);
    
    // 按长度降序排列，优先处理长钢材，确保优化效率
    demands.sort((a, b) => b.length - a.length);
    
    let iterationCount = 0;
    const maxIterations = demands.length * 100; // 设置更合理的迭代上限

    // 🔧 结构性修复：改为"逐个需求满足"模式
    for (const demand of demands) {
      console.log(`🚀 处理新需求: ${demand.id}, 长度: ${demand.length}, 数量: ${demand.quantity}`);
      
      while (demand.remaining > 0 && !this.isTimeExceeded() && iterationCount < maxIterations) {
        iterationCount++;
        let progress = false;

        // 1. 优先尝试使用余料
        const remainderResult = await this.tryUseRemainderIndependently(
          demand, groupKey, solution, remainderManager, taskStats
        );
        if (remainderResult) {
          progress = true;
          console.log(`  ✅ 成功使用余料满足需求: ${demand.id}`);
          continue; // 继续满足当前需求的剩余数量
        }

        // 2. 尝试使用模数钢材
        const moduleResult = await this.useModuleSteelIndependently(
          demand, groupKey, solution, remainderManager, taskStats
        );
        if (moduleResult) {
          progress = true;
          console.log(`  ✅ 成功使用模数钢材满足需求: ${demand.id}`);
        }

        // 3. 如果都没有进展，说明余料和现有模数钢材都无法满足，必须强制使用新模数钢材
        if (!progress) {
          console.warn(`  ⚠️ 余料和模数钢材均无进展，强制使用新模数钢材满足: ${demand.id}`);
          const forceModuleResult = await this.useModuleSteelIndependently(
            demand, groupKey, solution, remainderManager, taskStats, true // 强制执行
          );
          if (!forceModuleResult) {
            console.error(`  ❌ 严重错误: 强制使用模数钢材失败，需求 ${demand.id} 可能无法满足`);
            break; // 强制失败，跳出内循环
          }
        }
      }
      if (demand.remaining > 0) {
        console.error(`  ❌ 需求未完全满足: ${demand.id}, 剩余数量: ${demand.remaining}`);
      }
    }
    
    if (iterationCount >= maxIterations) {
      console.warn(`⚠️ 并行任务${groupKey}: 达到最大迭代次数${maxIterations}，强制结束`);
    }
    
    // 🔧 关键修复：在并行任务内部执行MW-CD交换优化
    console.log(`\n🔄 ${groupKey}组合内部MW-CD交换优化...`);
    const mwcdStats = await this.performInternalMWCDOptimization(solution, groupKey, remainderManager);
    
    if (mwcdStats.exchangesPerformed > 0) {
      console.log(`✅ ${groupKey}组合完成${mwcdStats.exchangesPerformed}次内部交换，效益提升${mwcdStats.totalBenefitGained.toFixed(2)}mm`);
    }
    
    // 🔧 修复：将taskStats数据汇总到solution对象，解决"数据孤岛"问题
    this.mergeTaskStatsToSolution(solution, taskStats);
    
    // 🔧 修复：删除手动统计逻辑，避免"幽灵统计"，完全信任calculateSolutionStats
    // 计算解决方案统计（这是唯一的统计来源）
    this.calculateSolutionStats(solution);
    
    console.log(`✅ 并行任务${groupKey}优化完成: ${taskStats.cuts}次切割，${iterationCount}轮迭代，${mwcdStats.exchangesPerformed}次内部交换`);
    
    return solution;
  }

  /**
   * 将taskStats数据汇总到solution对象，解决"数据孤岛"问题
   */
  mergeTaskStatsToSolution(solution, taskStats) {
    console.log(`🔄 合并taskStats数据到solution对象:`);
    console.log(`  - taskStats.cuts: ${taskStats.cuts}`);
    console.log(`  - taskStats.moduleSteelsUsed: ${taskStats.moduleSteelsUsed}`);
    console.log(`  - taskStats.totalModuleLength: ${taskStats.totalModuleLength}`);
    console.log(`  - taskStats.wasteGenerated: ${taskStats.wasteGenerated}`);
    console.log(`  - taskStats.remaindersReused: ${taskStats.remaindersReused}`);
    console.log(`  - taskStats.weldingOperations: ${taskStats.weldingOperations}`);
    
    // 初始化solution的统计字段（如果不存在）
    solution.taskStats = solution.taskStats || {
      totalCuts: 0,
      totalModuleSteelsUsed: 0,
      totalModuleLength: 0,
      totalWasteGenerated: 0,
      totalRemaindersReused: 0,
      totalWeldingOperations: 0
    };
    
    // 累加taskStats数据到solution
    solution.taskStats.totalCuts += taskStats.cuts || 0;
    solution.taskStats.totalModuleSteelsUsed += taskStats.moduleSteelsUsed || 0;
    solution.taskStats.totalModuleLength += taskStats.totalModuleLength || 0;
    solution.taskStats.totalWasteGenerated += taskStats.wasteGenerated || 0;
    solution.taskStats.totalRemaindersReused += taskStats.remaindersReused || 0;
    solution.taskStats.totalWeldingOperations += taskStats.weldingOperations || 0;
    
    console.log(`✅ taskStats数据已合并到solution.taskStats`);
  }

  /**
   * 并行安全的余料使用方法
   */
  async tryUseRemainderIndependently(demand, groupKey, solution, remainderManager, taskStats) {
    const combination = remainderManager.findBestRemainderCombination(
      demand.length, 
      groupKey,
      this.constraints.weldingSegments
    );
    
    if (!combination) return null;
    
    // 检查焊接约束
    const weldingCount = combination.type === 'single' ? 1 : combination.remainders.length;
    if (weldingCount > this.constraints.weldingSegments) {
      return null;
    }
    
    // 使用余料
    const usageResult = remainderManager.useRemainder(
      combination, 
      demand.length, 
      demand.id, 
      groupKey
    );
    
    // 🔧 修复关键问题：确保sourceType使用正确的常量值
    const cuttingPlan = new CuttingPlan({
      sourceType: 'remainder', // 🎯 直接使用字符串，确保与损耗率计算器匹配
      sourceId: combination.remainders.map(r => r.id).join('+'), // 🔧 修复：添加sourceId字段
      sourceDescription: `${groupKey}组合余料 ${combination.remainders.map(r => r.id).join('+')}`,
      sourceLength: combination.totalLength,
      cuts: [{
        designId: demand.id,
        length: demand.length,
        quantity: 1
      }],
      usedRemainders: combination.remainders,
      newRemainders: usageResult.newRemainders,
      pseudoRemainders: usageResult.pseudoRemainders,
      realRemainders: usageResult.realRemainders,
      waste: usageResult.waste
    });
    
    solution.cuttingPlans.push(cuttingPlan);
    solution.details.push(...usageResult.details);
    
    // 更新需求和统计
    demand.remaining -= 1;
    taskStats.cuts += 1;
    taskStats.remaindersReused += combination.remainders.length;
    if (weldingCount > 1) {
      taskStats.weldingOperations += 1;
    }
    
    // --- 强制互斥校验与修正 ---
    if (cuttingPlan) {
      const newRemainderTotal = Array.isArray(cuttingPlan.newRemainders) ? cuttingPlan.newRemainders.reduce((sum, r) => sum + (r && r.length ? r.length : 0), 0) : 0;
      const wasteVal = cuttingPlan.waste || 0;
      if (newRemainderTotal > 0 && wasteVal > 0) {
        // 互斥冲突，保留较大者
        if (newRemainderTotal >= wasteVal) {
          cuttingPlan.waste = 0;
          console.warn(`[互斥修正] cuttingPlan(${cuttingPlan.sourceId || ''}): newRemainders(${newRemainderTotal})与waste(${wasteVal})同时为正，已将waste清零`);
        } else {
          cuttingPlan.newRemainders = [];
          cuttingPlan.realRemainders = [];
          console.warn(`[互斥修正] cuttingPlan(${cuttingPlan.sourceId || ''}): newRemainders(${newRemainderTotal})与waste(${wasteVal})同时为正，已将newRemainders清空`);
        }
      }
    }
    
    return true;
  }

  /**
   * 并行安全的模数钢材使用方法
   */
  async useModuleSteelIndependently(demand, groupKey, solution, remainderManager, taskStats, force = false) {
    const bestModule = this.selectBestModule(demand, groupKey, force);
    if (!bestModule) {
      // 在非强制模式下，找不到合适的模数钢材是正常情况
      if (!force) {
        console.log(`  - 找不到合适的模数钢材来满足 ${demand.id} (非强制模式)`);
        return false;
      }
      // 在强制模式下，如果仍然找不到，这是个问题，但我们应记录并尝试恢复
      console.error(`  ❌ 严重错误: 强制模式下也无法选择模数钢材来满足 ${demand.id}`);
      return false;
    }
    
    const moduleId = this.generateModuleId(groupKey);
    const cuts = [];
    const newRemainders = [];
    let remainingLength = bestModule.length;
    let currentQuantity = demand.remaining;
    
    // 计算最大可切割数量
    const maxCuts = Math.floor(remainingLength / demand.length);
    const actualCuts = Math.min(maxCuts, currentQuantity);
    
    if (actualCuts > 0) {
      cuts.push({
        designId: demand.id,
        length: demand.length,
        quantity: actualCuts
      });
      
      // ❗ 最终修复：创建并记录切割明细，这是前端统计的关键数据源
      const cuttingDetail = new CuttingDetail({
        sourceType: 'module',
        sourceId: moduleId,
        sourceLength: bestModule.length,
        designId: demand.id,
        length: demand.length,
        quantity: actualCuts,
        weldingCount: 1
      });
      solution.details.push(cuttingDetail);

      remainingLength -= demand.length * actualCuts;
      demand.remaining -= actualCuts;
      
      // 🔧 修复：使用统一的余料处理逻辑
      if (remainingLength > 0) {
        const remainder = new RemainderV3({
          id: `${moduleId}_remainder`,
          length: remainingLength,
          type: REMAINDER_TYPES.PENDING, // 初始为待定状态，由统一方法判断
          isConsumed: false,
          sourceChain: [moduleId],
          crossSection: bestModule.crossSection || 0,
          specification: groupKey,
          createdAt: new Date().toISOString(),
          originalLength: bestModule.length,
          parentId: moduleId
        });
        
        // 🔧 修复：使用统一的动态判断方法
        const evaluationResult = remainderManager.evaluateAndProcessRemainder(remainder, groupKey, {
          source: '模数钢材切割后'
        });
        
        if (evaluationResult.isWaste) {
          // 废料直接计入统计
          taskStats.wasteGenerated = (taskStats.wasteGenerated || 0) + evaluationResult.wasteLength;
        } else if (evaluationResult.isPendingRemainder) {
          // 待定余料已经被统一方法加入池中
          newRemainders.push(remainder);
        }
      }
      
      // 🔧 修复关键问题：确保sourceType使用正确的常量值
      const cuttingPlan = new CuttingPlan({
        sourceType: 'module', // 🎯 直接使用字符串，确保与损耗率计算器匹配
        sourceId: moduleId,   // 🔧 修复：添加sourceId字段，用于统计模数钢材根数
        sourceDescription: `${groupKey}组合模数钢材 ${moduleId}`,
        sourceLength: bestModule.length,
        moduleType: bestModule.name || `${bestModule.length}mm标准钢材`,
        moduleLength: bestModule.length,
        cuts: cuts,
        newRemainders: newRemainders,
        pseudoRemainders: [], // 模数钢材切割不产生伪余料
        realRemainders: newRemainders, // 新产生的余料都是真余料
        waste: remainingLength < this.constraints.wasteThreshold ? remainingLength : 0,
        usedRemainders: [] // 模数钢材切割不使用已有余料
      });
      
      solution.cuttingPlans.push(cuttingPlan);
      
      // 更新统计信息
      taskStats.cuts += 1;
      taskStats.moduleSteelsUsed = (taskStats.moduleSteelsUsed || 0) + 1;
      taskStats.totalModuleLength = (taskStats.totalModuleLength || 0) + bestModule.length;
      
      console.log(`✅ ${groupKey}组合使用模数钢材: ${moduleId} (${bestModule.length}mm) → 切割${actualCuts}根${demand.length}mm，余料${remainingLength}mm`);
      
      // --- 强制互斥校验与修正 ---
      if (cuttingPlan) {
        const newRemainderTotal = Array.isArray(cuttingPlan.newRemainders) ? cuttingPlan.newRemainders.reduce((sum, r) => sum + (r && r.length ? r.length : 0), 0) : 0;
        const wasteVal = cuttingPlan.waste || 0;
        if (newRemainderTotal > 0 && wasteVal > 0) {
          // 互斥冲突，保留较大者
          if (newRemainderTotal >= wasteVal) {
            cuttingPlan.waste = 0;
            console.warn(`[互斥修正] cuttingPlan(${cuttingPlan.sourceId || ''}): newRemainders(${newRemainderTotal})与waste(${wasteVal})同时为正，已将waste清零`);
          } else {
            cuttingPlan.newRemainders = [];
            cuttingPlan.realRemainders = [];
            console.warn(`[互斥修正] cuttingPlan(${cuttingPlan.sourceId || ''}): newRemainders(${newRemainderTotal})与waste(${wasteVal})同时为正，已将newRemainders清空`);
          }
        }
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * V3规格化改进：选择最佳模数钢材（使用规格化池）
   */
  selectBestModule(demand, groupKey, force = false) {
    const pool = this.getOrCreateModuleSteelPool(groupKey);
    
    // 使用池中的动态生成逻辑
    let steel = pool.getSteel(demand.length);
    
    // 强制模式下的备用逻辑
    if (!steel && force) {
      console.warn(`  ⚠️ (强制模式) 无法为 ${groupKey} 生成标准模数钢材，将使用默认最长规格`);
      steel = pool.createSteel(Math.max(...pool.availableLengths));
    }
    
    if (!steel) {
      console.warn(`⚠️ (非强制模式) 无法为${groupKey}组合生成合适的模数钢材，需求长度: ${demand.length}mm`);
      return null;
    }
    
    console.log(`🎯 ${groupKey}组合选择模数钢材: ${steel.id} (${steel.length}mm)`);
    return steel;
  }

  /**
   * 按规格+截面面积组合分组（真正的规格化设计）
   */
  groupBySpecificationAndCrossSection() {
    const groups = {};
    
    this.designSteels.forEach(steel => {
      const specification = steel.specification || '未知规格';
      const crossSection = Math.round(steel.crossSection);
      const groupKey = `${specification}_${crossSection}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(steel);
    });
    
    console.log('🎯 按规格+截面面积组合分组结果:', Object.keys(groups));
    return groups;
  }

  /**
   * 废弃方法：按截面面积分组（V2妥协方案，V3不再使用）
   */
  groupByCrossSection() {
    console.warn('⚠️ groupByCrossSection 是V2妥协方案，V3已改为按规格分组');
    const groups = {};
    
    this.designSteels.forEach(steel => {
      const key = Math.round(steel.crossSection);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(steel);
    });
    
    return groups;
  }

  /**
   * V3规格化改进：生成模数钢材ID
   */
  generateModuleId(groupKey) {
    if (!this.moduleCounters[groupKey]) {
      this.moduleCounters[groupKey] = 0;
    }
    this.moduleCounters[groupKey]++;
    return `${groupKey}_M${this.moduleCounters[groupKey]}`;
  }

  /**
   * 🔧 修复版：MW-CD交换优化算法
   * 基于规格匹配和效益分析的智能交换
   */
  async performMWCDOptimization(solutions) {
    console.log('🔄 执行改进版MW-CD交换优化算法');
    
    const stats = {
      totalMWFound: 0,
      totalCDFound: 0,
      validExchanges: 0,
      exchangesPerformed: 0,
      totalBenefitGained: 0
    };
    
    for (const [groupKey, solution] of Object.entries(solutions)) {
      if (this.isTimeExceeded()) break;
      
      console.log(`\n📋 分析 ${groupKey} 组合的MW-CD交换机会...`);
      
      const mwRemainders = this.findMWRemainders(solution);
      const cdPlans = this.findCDPlans(solution);
      
      stats.totalMWFound += mwRemainders.length;
      stats.totalCDFound += cdPlans.length;
      
      console.log(`  - 发现MW余料: ${mwRemainders.length}个`);
      console.log(`  - 发现CD计划: ${cdPlans.length}个`);
      
      if (mwRemainders.length === 0 || cdPlans.length === 0) {
        console.log(`  - 跳过${groupKey}组合（缺少交换对象）`);
        continue;
      }
      
      // 🔧 改进：按效益排序，优先执行最有价值的交换
      const exchangeOpportunities = this.analyzeExchangeOpportunities(mwRemainders, cdPlans, groupKey);
      
      for (const opportunity of exchangeOpportunities) {
        if (this.isTimeExceeded()) break;
        
        stats.validExchanges++;
        
        // 🔧 改进：执行完整的交换操作
        const exchangeResult = this.executeImprovedInterchange(solution, opportunity, groupKey);
        
        if (exchangeResult.success) {
          stats.exchangesPerformed++;
          stats.totalBenefitGained += exchangeResult.benefit;
          console.log(`  ✅ 交换成功: 效益提升 ${exchangeResult.benefit.toFixed(2)}mm`);
        } else {
          console.log(`  ❌ 交换失败: ${exchangeResult.reason}`);
        }
      }
    }
    
    console.log('\n📊 MW-CD交换优化统计:');
    console.log(`  - MW余料总数: ${stats.totalMWFound}`);
    console.log(`  - CD计划总数: ${stats.totalCDFound}`);
    console.log(`  - 有效交换机会: ${stats.validExchanges}`);
    console.log(`  - 实际执行交换: ${stats.exchangesPerformed}`);
    console.log(`  - 总效益提升: ${stats.totalBenefitGained.toFixed(2)}mm`);
    
    return stats;
  }

  /**
   * 🔧 改进：分析交换机会并按效益排序
   */
  analyzeExchangeOpportunities(mwRemainders, cdPlans, groupKey) {
    const opportunities = [];
      
      for (const mw of mwRemainders) {
        for (const cd of cdPlans) {
        // 🔧 改进：全面的交换可行性检查
        const feasibility = this.checkExchangeFeasibility(mw, cd, groupKey);
        
        if (feasibility.isFeasible) {
          opportunities.push({
            mw: mw,
            cd: cd,
            benefit: feasibility.benefit,
            totalBenefit: feasibility.benefit, // 🔧 修复：添加totalBenefit字段
            confidence: feasibility.confidence,
            reason: feasibility.reason
          });
        }
      }
    }
    
    // 按效益降序排列，优先执行最有价值的交换
    opportunities.sort((a, b) => b.benefit - a.benefit);
    
    console.log(`  - 分析出 ${opportunities.length} 个可行的交换机会`);
    
    return opportunities.slice(0, 5); // 限制最多5个交换，避免过度优化
  }

  /**
   * 🔧 改进：全面的交换可行性检查
   */
  checkExchangeFeasibility(mw, cd, groupKey) {
    const mwLength = mw.remainder.length;
    const cdTotalLength = cd.usedRemainders.reduce((sum, r) => sum + r.length, 0);
    const cdSegments = cd.usedRemainders.length;
    
    // 检查1：规格匹配（同一组合内才能交换）
    const mwGroupKey = mw.remainder.groupKey || groupKey;
    const cdGroupKey = cd.usedRemainders[0]?.groupKey || groupKey;
    
    if (mwGroupKey !== cdGroupKey) {
      return {
        isFeasible: false,
        reason: '规格不匹配'
      };
    }
    
    // 检查2：长度合理性（MW余料必须能满足CD的切割需求）
    const targetLength = cd.cuts[0]?.length || 0;
    if (mwLength < targetLength) {
      return {
        isFeasible: false,
        reason: 'MW余料长度不足'
      };
    }
    
    // 检查3：焊接约束（用MW替代CD可以减少焊接段数）
    if (cdSegments <= 1) {
      return {
        isFeasible: false,
        reason: 'CD计划已是单段，无需交换'
      };
    }
    
    // 检查4：效益计算（交换必须有正效益）
    const weldingCostSaved = (cdSegments - 1) * 50; // 假设每个焊接点成本50mm等效
    const materialWasteDiff = mwLength - cdTotalLength;
    const totalBenefit = weldingCostSaved - Math.abs(materialWasteDiff);
    
    if (totalBenefit <= 0) {
      return {
        isFeasible: false,
        reason: '交换效益为负',
        benefit: totalBenefit
      };
    }
    
    // 检查5：废料阈值约束
    const newWaste = mwLength - targetLength;
    if (newWaste >= this.constraints.wasteThreshold) {
      return {
        isFeasible: false,
        reason: '交换后废料过多'
      };
    }
    
    return {
      isFeasible: true,
      benefit: totalBenefit,
      confidence: Math.min(1.0, totalBenefit / 100), // 信心度基于效益大小
      reason: `可节省${cdSegments-1}个焊接点，效益${totalBenefit.toFixed(2)}mm`
    };
  }

  /**
   * 🔧 改进：执行完整的交换操作
   */
  executeImprovedInterchange(solution, opportunity, groupKey) {
    const { mw, cd, benefit } = opportunity;
    
    try {
      console.log(`    🔄 执行交换: MW(${mw.remainder.id}, ${mw.remainder.length}mm) ↔ CD(${cd.usedRemainders.map(r => r.id).join('+')}, ${cd.usedRemainders.reduce((sum, r) => sum + r.length, 0)}mm)`);
      
      // 1. 创建新的切割计划（用MW替代CD）
      const targetLength = cd.cuts[0]?.length || 0;
      const newWaste = mw.remainder.length - targetLength;
      
      const newCuttingPlan = new CuttingPlan({
        sourceType: 'remainder',
        sourceId: mw.remainder.id,
        sourceDescription: `${groupKey}组合MW余料 ${mw.remainder.id} (交换优化)`,
        sourceLength: mw.remainder.length,
        cuts: cd.cuts, // 复用原CD的切割需求
        usedRemainders: [mw.remainder],
        newRemainders: [],
        pseudoRemainders: [mw.remainder], // MW余料变为伪余料
        realRemainders: [],
        waste: newWaste
      });
      
      // 2. 移除原CD计划
      const cdIndex = solution.cuttingPlans.findIndex(plan => plan === cd);
      if (cdIndex !== -1) {
        solution.cuttingPlans.splice(cdIndex, 1);
      }
      
      // 3. 添加新计划
      solution.cuttingPlans.push(newCuttingPlan);
      
      // 4. 更新统计数据
      solution.totalWaste += newWaste;
      solution.totalRealRemainder -= mw.remainder.length;
      solution.totalPseudoRemainder += mw.remainder.length;
      
      // 5. 标记MW余料状态
      mw.remainder.markAsPseudo();
      
      // 6. 恢复CD使用的余料到池中（它们现在可以重新使用）
      cd.usedRemainders.forEach(remainder => {
        if (remainder.type === REMAINDER_TYPES.PSEUDO) {
          remainder.type = REMAINDER_TYPES.REAL; // 恢复为真余料
          this.remainderManager.remainderPools[groupKey].push(remainder);
        }
      });
      
      return {
        success: true,
        benefit: benefit,
        newPlan: newCuttingPlan
      };
      
    } catch (error) {
      console.error(`    ❌ 交换执行失败: ${error.message}`);
      return {
        success: false,
        reason: error.message
      };
    }
  }

  /**
   * 🔧 关键修复：在并行任务内部执行MW-CD交换优化
   * 这是正确的架构设计 - MW-CD应该在每个规格组合内部进行
   */
  async performInternalMWCDOptimization(solution, groupKey, remainderManager) {
    const stats = {
      totalMWFound: 0,
      totalCDFound: 0,
      validExchanges: 0,
      exchangesPerformed: 0,
      totalBenefitGained: 0,
      iterations: 0
    };
    
    console.log(`\n🔄 开始${groupKey}组合内部MW-CD交换优化...`);
    
    // 🔧 基于效益的收敛条件设置
    const minBenefitThreshold = 50; // 最小效益阈值(mm)
    const maxIterations = 10; // 最大迭代次数，防止无限循环
    let iteration = 0;
    
    while (iteration < maxIterations && !this.isTimeExceeded()) {
      iteration++;
      stats.iterations = iteration;
      
      console.log(`  📊 第${iteration}轮MW-CD分析...`);
      
      // 在该组合内查找MW余料和CD计划
      const mwRemainders = this.findMWRemainders(solution);
      const cdPlans = this.findCDPlans(solution);
      
      stats.totalMWFound = mwRemainders.length;
      stats.totalCDFound = cdPlans.length;
      
      console.log(`    - 发现MW余料: ${mwRemainders.length}个`);
      console.log(`    - 发现CD计划: ${cdPlans.length}个`);
      
      if (mwRemainders.length === 0 || cdPlans.length === 0) {
        console.log(`    - 第${iteration}轮无交换对象，收敛退出`);
            break;
          }
      
      // 分析交换机会并按效益排序
      const exchangeOpportunities = this.analyzeExchangeOpportunities(mwRemainders, cdPlans, groupKey);
      
      // 🔧 关键改进：基于效益的收敛条件
      let hasPositiveBenefitExchange = false;
      const validOpportunities = exchangeOpportunities.filter(opportunity => {
        if (opportunity.totalBenefit > minBenefitThreshold) {
          hasPositiveBenefitExchange = true;
          return true;
        }
        return false;
      });
      
      if (!hasPositiveBenefitExchange) {
        console.log(`    - 第${iteration}轮无正效益交换(阈值${minBenefitThreshold}mm)，收敛退出`);
        break;
      }
      
      console.log(`    - 发现${validOpportunities.length}个有效交换机会`);
      
      // 执行本轮最优交换
      let roundExchangeCount = 0;
      for (const opportunity of validOpportunities) {
        if (this.isTimeExceeded()) break;
        
        stats.validExchanges++;
        
        // 执行内部交换
        const exchangeResult = this.executeInternalInterchange(solution, opportunity, groupKey, remainderManager);
        
        if (exchangeResult.success) {
          stats.exchangesPerformed++;
          stats.totalBenefitGained += exchangeResult.benefit;
          roundExchangeCount++;
          console.log(`      ✅ 第${iteration}轮交换${roundExchangeCount}: 效益提升 ${exchangeResult.benefit.toFixed(2)}mm`);
          
          // 🔧 重要：每次交换后重新分析，因为状态已改变
          break;
        } else {
          console.log(`      ❌ 交换失败: ${exchangeResult.reason}`);
        }
      }
      
      if (roundExchangeCount === 0) {
        console.log(`    - 第${iteration}轮无成功交换，收敛退出`);
        break;
      }
    }
    
    if (iteration >= maxIterations) {
      console.log(`  ⚠️ 达到最大迭代次数${maxIterations}，强制收敛`);
    }
    
    console.log(`✅ ${groupKey}组合MW-CD优化完成: ${stats.iterations}轮迭代，${stats.exchangesPerformed}次交换，总效益${stats.totalBenefitGained.toFixed(2)}mm`);
    
    return stats;
  }

  /**
   * 🔧 内部交换执行方法（针对并行任务优化）
   */
  executeInternalInterchange(solution, opportunity, groupKey, remainderManager) {
    const { mw, cd, benefit } = opportunity;
    
    try {
      console.log(`      🔄 执行内部交换: MW(${mw.remainder.id}, ${mw.remainder.length}mm) ↔ CD(${cd.usedRemainders.map(r => r.id).join('+')}, ${cd.usedRemainders.reduce((sum, r) => sum + r.length, 0)}mm)`);
      
      // 1. 创建新的切割计划（用MW替代CD）
      const targetLength = cd.cuts[0]?.length || 0;
      const newWaste = mw.remainder.length - targetLength;
      
      const newCuttingPlan = new CuttingPlan({
        sourceType: 'remainder',
        sourceId: mw.remainder.id,
        sourceDescription: `${groupKey}组合MW余料 ${mw.remainder.id} (内部交换优化)`,
        sourceLength: mw.remainder.length,
        cuts: cd.cuts, // 复用原CD的切割需求
        usedRemainders: [mw.remainder],
        newRemainders: [],
        pseudoRemainders: [mw.remainder], // MW余料变为伪余料
        realRemainders: [],
        waste: newWaste
      });
      
      // 2. 移除原CD计划
      const cdIndex = solution.cuttingPlans.findIndex(plan => plan === cd);
      if (cdIndex !== -1) {
        solution.cuttingPlans.splice(cdIndex, 1);
      }
      
      // 3. 添加新计划
      solution.cuttingPlans.push(newCuttingPlan);
      
      // 4. 更新余料管理器状态
      // 标记MW余料为伪余料（已被使用）
      mw.remainder.markAsPseudo();
      
      // 从余料池中移除MW余料
      const mwIndex = remainderManager.remainderPools[groupKey].findIndex(r => r.id === mw.remainder.id);
      if (mwIndex !== -1) {
        remainderManager.remainderPools[groupKey].splice(mwIndex, 1);
      }
      
      // 恢复CD使用的余料到池中（它们现在可以重新使用）
      cd.usedRemainders.forEach(remainder => {
        if (remainder.type === REMAINDER_TYPES.PSEUDO) {
          remainder.type = REMAINDER_TYPES.PENDING; // 恢复为待定状态
          remainderManager.remainderPools[groupKey].push(remainder);
        }
      });
      
      // 重新排序余料池
      remainderManager.remainderPools[groupKey].sort((a, b) => a.length - b.length);
      
      return {
        success: true,
        benefit: benefit,
        newPlan: newCuttingPlan
      };
      
    } catch (error) {
      console.error(`      ❌ 内部交换执行失败: ${error.message}`);
      return {
        success: false,
        reason: error.message
      };
    }
  }

  /**
   * 查找MW余料（在内部优化时查找PENDING状态的余料，因为REAL状态在最后才确定）
   */
  findMWRemainders(solution) {
    const mwRemainders = [];
    
    solution.cuttingPlans.forEach(plan => {
      // 🔧 修复：在内部MW-CD优化时，余料还是PENDING状态
      if (plan.newRemainders) {
        plan.newRemainders.forEach(remainder => {
          if (remainder.type === REMAINDER_TYPES.PENDING && remainder.length >= this.constraints.wasteThreshold) {
            mwRemainders.push({
              remainder: remainder,
              plan: plan
            });
          }
        });
      }
      
      // 同时检查realRemainders（如果已经有的话）
      if (plan.realRemainders) {
        plan.realRemainders.forEach(remainder => {
          if (remainder.type === REMAINDER_TYPES.REAL) {
            mwRemainders.push({
              remainder: remainder,
              plan: plan
            });
          }
        });
      }
    });
    
    return mwRemainders;
  }

  /**
   * 查找CD计划（使用余料组合的）
   */
  findCDPlans(solution) {
    return solution.cuttingPlans.filter(plan => 
      plan.sourceType === 'remainder' && 
      plan.usedRemainders && 
      plan.usedRemainders.length >= 2
    );
  }

  /**
   * 检查是否可以执行交换
   */
  canPerformInterchange(mw, cd) {
    // 简化的交换条件检查
    const mwLength = mw.remainder.length;
    const cdTotalLength = cd.usedRemainders.reduce((sum, r) => sum + r.length, 0);
    
    return Math.abs(mwLength - cdTotalLength) < this.constraints.wasteThreshold;
  }

  /**
   * 执行交换操作
   */
  executeInterchange(solution, mw, cd, groupKey) {
    // 实现MW-CD交换逻辑
    console.log(`🔄 执行MW-CD交换: ${mw.remainder.id} ↔ ${cd.usedRemainders.map(r => r.id).join('+')}`);
    
    // 更新损耗计算
    solution.totalWaste += mw.remainder.length;
    solution.totalRealRemainder -= mw.remainder.length;
    
    // 标记交换记录
    mw.remainder.markAsWaste();
  }

  /**
   * [稳健版] 计算解决方案统计
   * 基于物料守恒定律，确保数据绝对平衡
   */
  calculateSolutionStats(solution) {
    let totalModuleMaterial = 0;
    let totalDesignCutsLength = 0;
    let totalWasteFromPlans = 0;
    let totalModuleUsed = 0;
    let totalPseudoRemainder = 0;
    const usedModuleIds = new Set();
    
    console.log(`[新] 启动稳健的物料守恒统计方法`);

    // 遍历所有切割计划，进行分类记账
    solution.cuttingPlans.forEach(plan => {
      // 1. 累加总投入：只计算模数钢材的投入
      if (plan.sourceType === 'module' && plan.sourceId) {
        if (!usedModuleIds.has(plan.sourceId)) {
          totalModuleMaterial += plan.sourceLength;
          usedModuleIds.add(plan.sourceId);
        }
      }

      // 2. 累加总产出（成品）
      plan.cuts.forEach(cut => {
        totalDesignCutsLength += cut.length * cut.quantity;
      });

      // 3. 累加总废料
      totalWasteFromPlans += plan.waste || 0;
      
      // 4. (调试用) 累加伪余料：伪余料代表被消耗的余料，其长度等于使用余料的切割计划的源长度
      if (plan.sourceType === 'remainder') {
          totalPseudoRemainder += plan.sourceLength;
      }
    });

    totalModuleUsed = usedModuleIds.size;

    // 4. 计算真余料：这是唯一会产生误差的地方，我们通过守恒定律反向计算
    const totalRealRemainder = totalModuleMaterial - totalDesignCutsLength - totalWasteFromPlans;

    // 数据验证
    if (totalRealRemainder < -1) { // 允许微小的浮点误差
      console.error(`❌ 数据完整性严重错误！真余料为负数: ${totalRealRemainder}`);
      console.error(`   投入: ${totalModuleMaterial}, 成品: ${totalDesignCutsLength}, 废料: ${totalWasteFromPlans}`);
    }

    // 设置最终的、绝对准确的统计数据
    solution.totalModuleUsed = totalModuleUsed;
    solution.totalMaterial = totalModuleMaterial; 
    solution.totalWaste = totalWasteFromPlans;
    solution.totalRealRemainder = Math.max(0, totalRealRemainder); // 确保不为负
    solution.totalPseudoRemainder = totalPseudoRemainder;

    console.log(`[新] 统计完成: 模数钢材 ${totalModuleUsed} 根 (${totalModuleMaterial}mm), 废料 ${totalWasteFromPlans}mm, 真余料 ${solution.totalRealRemainder}mm`);
  }

  /**
   * 🔧 计算全局统计信息
   */
  calculateGlobalStats(solutions) {
    console.log('🔧 开始计算全局统计信息...');
    
    let totalModuleUsed = 0;
    let totalWaste = 0;
    let totalPseudoRemainder = 0;
    let totalRealRemainder = 0;
    let totalMaterial = 0;
    let totalCuts = 0;
    let totalWeldingOperations = 0;
    
    // 🔧 修复：直接、简单地累加各个分组的准确统计数据
    Object.entries(solutions).forEach(([groupKey, solution]) => {
      totalModuleUsed += solution.totalModuleUsed || 0;
      totalWaste += solution.totalWaste || 0;
      totalPseudoRemainder += solution.totalPseudoRemainder || 0;
      totalRealRemainder += solution.totalRealRemainder || 0;
      totalMaterial += solution.totalMaterial || 0;
      totalCuts += solution.totalCuts || 0;
      totalWeldingOperations += solution.totalWeldingOperations || 0;
    });
    
    // 🔧 修复：使用LossRateCalculator确保统计口径一致
    const totalLossRate = this.lossRateCalculator.calculateTotalLossRate(solutions);
    
    const globalStats = {
      totalModuleUsed,
      totalWaste,
      totalPseudoRemainder,
      totalRealRemainder,
      totalMaterial,
      totalCuts,
      totalWeldingOperations,
      lossRate: totalLossRate,
      efficiency: totalMaterial > 0 ? ((totalMaterial - totalWaste - totalRealRemainder) / totalMaterial) * 100 : 0
    };
    
    // 最终数据汇总日志
    console.log(`🎯 全局统计汇总:`);
    console.log(`  - 模数钢材: ${totalModuleUsed}根`);
    console.log(`  - 模数钢材总长度: ${totalMaterial}mm`);
    console.log(`  - 废料: ${totalWaste}mm`);
    console.log(`  - 真余料: ${totalRealRemainder}mm`);
    console.log(`  - 损耗率: ${totalLossRate.toFixed(2)}%`);
    console.log(`  - 材料利用率: ${globalStats.efficiency.toFixed(2)}%`);
    console.log(`  - 总切割次数: ${totalCuts}次`);
    console.log(`  - 焊接操作: ${totalWeldingOperations}次`);
    
    return globalStats;
  }

  /**
   * 构建最终优化结果
   */
  buildOptimizationResult(solutions, validation) {
    const endTime = Date.now();
    const executionTime = endTime - this.startTime;
    
    console.log('🔧 开始构建最终优化结果...');
    
    // 🔧 确保前端渲染在后端完全处理完成后进行
    const optimizationResult = new OptimizationResult({
      solutions: solutions,
      totalExecutionTime: executionTime,
      timestamp: new Date().toISOString(),
      version: '3.0',
      constraintValidation: validation,
      // 🔧 关键：添加优化完成状态标记
      processingStatus: {
        isCompleted: true,
        remaindersFinalized: true,
        readyForRendering: true,
        completedAt: new Date().toISOString()
      }
    });

    // 🔧 计算全局统计信息
    const globalStats = this.calculateGlobalStats(solutions);
    optimizationResult.globalStats = globalStats;
    
    // 🔧 收集模数钢材使用统计
    const moduleSteelStats = this.collectModuleSteelUsageStats();
    optimizationResult.moduleSteelUsage = moduleSteelStats;
    
    // 🔧 收集数据库记录
    const databaseRecords = this.collectDatabaseRecords();
    optimizationResult.databaseRecords = databaseRecords;
    
    console.log('✅ 最终优化结果构建完成，数据已准备好供前端渲染');
    console.log(`📊 全局统计: 损耗率 ${globalStats.lossRate.toFixed(2)}%, 执行时间 ${executionTime}ms`);
    
    return optimizationResult;
  }

  /**
   * V3新增：收集模数钢材使用统计（按根数）
   */
  collectModuleSteelUsageStats() {
    const stats = {};
    
    this.moduleSteelPools.forEach((pool, groupKey) => {
      const [specification, crossSection] = this.parseGroupKey(groupKey);
      
      if (!stats[specification]) {
        stats[specification] = {};
      }
      
      const poolStats = pool.getUsageStats();
      Object.entries(poolStats).forEach(([length, count]) => {
        const key = `${length}`;
        stats[specification][key] = (stats[specification][key] || 0) + count;
      });
    });
    
    return stats;
  }

  /**
   * V3新增：收集数据库存储记录
   */
  collectDatabaseRecords() {
    const records = [];
    
    this.moduleSteelPools.forEach((pool, groupKey) => {
      records.push(...pool.getDatabaseRecords());
    });
    
    return records;
  }

  /**
   * V3新增：重置所有模数钢材池
   */
  resetAllPools() {
    this.moduleSteelPools.forEach((pool) => {
      pool.reset();
    });
    this.moduleSteelPools.clear();
    console.log('🔄 所有模数钢材池已重置');
  }

  /**
   * V3新增：批量保存模数钢材使用记录到数据库（预留接口）
   */
  async saveToDatabaseAsync(records) {
    // TODO: 实现数据库集成
    console.log(`💾 准备保存${records.length}条模数钢材使用记录到数据库`);
    
    // 示例：分批保存避免数据库压力
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      console.log(`💾 保存批次${Math.floor(i/batchSize) + 1}: ${batch.length}条记录`);
      
      // await database.batchInsert('module_steel_usage', batch);
    }
    
    return true;
  }

  /**
   * 辅助方法
   */
  createDemandList(steels) {
    return steels.map(steel => ({
      id: steel.id,
      length: steel.length,
      quantity: steel.quantity,
      remaining: steel.quantity,
      crossSection: steel.crossSection
    }));
  }

  isTimeExceeded() {
    return (Date.now() - this.startTime) > this.constraints.timeLimit;
  }
}

/**
 * V3规格化模数钢材池 - 支持动态生成和数据库集成
 */
class SpecificationModuleSteelPool {
  constructor(specification, crossSection, availableLengths = [12000, 10000, 8000, 6000]) {
    this.specification = specification;
    this.crossSection = crossSection;
    this.availableLengths = availableLengths.sort((a, b) => a - b); // 🔧 修复：改为升序排列
    this.usedSteels = []; // 记录实际使用的钢材（用于数据库存储）
    this.counter = 0;     // 钢材编号计数器
  }

  /**
   * 获取指定长度的模数钢材（动态生成）
   */
  getSteel(requiredLength) {
    // 🔧 优化：升序排列后，find()直接找到第一个≥需求长度的（即最短合适的）
    const bestLength = this.availableLengths.find(length => length >= requiredLength);
    
    if (!bestLength) {
      // 如果没有合适的标准长度，使用最长的
      const maxLength = Math.max(...this.availableLengths);
      console.warn(`⚠️ 需求长度${requiredLength}mm超过最大模数钢材${maxLength}mm，使用最长规格`);
      return this.createSteel(maxLength);
    }
    
    const waste = bestLength - requiredLength;
    console.log(`🎯 需求${requiredLength}mm，选择${bestLength}mm（浪费${waste}mm）`);
    return this.createSteel(bestLength);
  }

  /**
   * 创建新的模数钢材实例
   */
  createSteel(length) {
    this.counter++;
    const steel = new ModuleSteel({
      id: `${this.specification}_${this.crossSection}_M${this.counter}`,
      name: `${this.specification}-${length}mm模数钢材`,
      length: length,
      specification: this.specification,
      crossSection: this.crossSection,
      createdAt: new Date().toISOString()
    });
    
    // 记录用于数据库存储
    this.usedSteels.push({
      id: steel.id,
      specification: this.specification,
      crossSection: this.crossSection,
      length: length,
      usedAt: new Date().toISOString()
    });
    
    console.log(`🔧 动态生成模数钢材: ${steel.id} (${this.specification}, ${length}mm)`);
    return steel;
  }

  /**
   * 获取使用统计（按根数）
   */
  getUsageStats() {
    const stats = {};
    this.usedSteels.forEach(steel => {
      const key = `${steel.length}mm`;
      stats[key] = (stats[key] || 0) + 1;
    });
    return stats;
  }

  /**
   * 获取用于数据库存储的数据
   */
  getDatabaseRecords() {
    return this.usedSteels.map(steel => ({
      ...steel,
      poolSpecification: this.specification,
      poolCrossSection: this.crossSection
    }));
  }

  /**
   * 清空使用记录（优化完成后调用）
   */
  reset() {
    this.usedSteels = [];
    this.counter = 0;
  }
}

module.exports = SteelOptimizerV3; 