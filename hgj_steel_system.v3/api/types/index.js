/**
 * 钢材采购优化系统 V3.0 - 核心类型定义
 * 包含新的余料系统、约束W和模块化架构
 */

// ==================== 基础数据类型 ====================

/**
 * 设计钢材类型
 */
class DesignSteel {
  constructor({
    id,
    length,
    quantity,
    crossSection,
    displayId = '',
    componentNumber = '',
    specification = '',
    partNumber = ''
  }) {
    this.id = id;
    this.length = length;
    this.quantity = quantity;
    this.crossSection = crossSection;
    this.displayId = displayId;
    this.componentNumber = componentNumber;
    this.specification = specification;
    this.partNumber = partNumber;
  }
}

/**
 * 模数钢材类型
 */
class ModuleSteel {
  constructor({ id, name, length }) {
    this.id = id;
    this.name = name;
    this.length = length;
  }
}

/**
 * 余料类型 - V3.0新设计
 * 支持伪余料/真余料/废料的状态管理
 */
class RemainderV3 {
  constructor({
    id,
    length,
    type = 'pending', // 'pseudo' | 'real' | 'waste' | 'pending'
    isConsumed = false,
    sourceChain = [],
    crossSection,
    createdAt = new Date().toISOString(),
    consumedAt = null,
    originalLength = null,
    parentId = null
  }) {
    this.id = id;
    this.length = length;
    this.type = type; // 余料类型：伪余料/真余料/废料/待定
    this.isConsumed = isConsumed; // 是否被后续使用
    this.sourceChain = sourceChain; // 来源链
    this.crossSection = crossSection;
    this.createdAt = createdAt;
    this.consumedAt = consumedAt;
    this.originalLength = originalLength; // 原始长度
    this.parentId = parentId; // 父余料ID
  }

  /**
   * 标记为伪余料（已被使用）
   */
  markAsPseudo() {
    this.type = 'pseudo';
    this.isConsumed = true;
    this.consumedAt = new Date().toISOString();
  }

  /**
   * 标记为真余料（未使用，计入损耗）
   */
  markAsReal() {
    this.type = 'real';
    this.isConsumed = false;
  }

  /**
   * 标记为废料
   */
  markAsWaste() {
    this.type = 'waste';
  }
}

// ==================== 约束系统 ====================

/**
 * 优化约束条件
 */
class OptimizationConstraints {
  constructor({
    wasteThreshold = 500,
    weldingSegments = 2,
    maxIterations = 1000,
    timeLimit = 30000,
    // V3新增：动态焊接约束
    allowDynamicWelding = true,
    maxWeldingSegments = 10,
    minWeldingSegments = 1,
    weldingCostPerSegment = 0.1, // 每段焊接的成本系数
    weldingTimePerSegment = 5    // 每段焊接的时间成本(秒)
  } = {}) {
    this.wasteThreshold = wasteThreshold;
    this.weldingSegments = weldingSegments;
    this.maxIterations = maxIterations;
    this.timeLimit = timeLimit;
    
    // V3动态焊接约束
    this.allowDynamicWelding = allowDynamicWelding;
    this.maxWeldingSegments = maxWeldingSegments;
    this.minWeldingSegments = minWeldingSegments;
    this.weldingCostPerSegment = weldingCostPerSegment;
    this.weldingTimePerSegment = weldingTimePerSegment;
    
    // 验证约束参数
    this.validateConstraints();
  }

  /**
   * V3新增：验证约束参数的合理性
   */
  validateConstraints() {
    if (this.weldingSegments < this.minWeldingSegments) {
      throw new Error(`焊接段数${this.weldingSegments}不能小于最小值${this.minWeldingSegments}`);
    }
    
    if (this.weldingSegments > this.maxWeldingSegments) {
      throw new Error(`焊接段数${this.weldingSegments}不能大于最大值${this.maxWeldingSegments}`);
    }
    
    if (this.wasteThreshold <= 0) {
      throw new Error(`废料阈值${this.wasteThreshold}必须大于0`);
    }
  }

  /**
   * V3新增：动态设置焊接段数
   */
  setWeldingSegments(segments) {
    if (segments < this.minWeldingSegments || segments > this.maxWeldingSegments) {
      throw new Error(`焊接段数${segments}超出允许范围[${this.minWeldingSegments}, ${this.maxWeldingSegments}]`);
    }
    
    this.weldingSegments = segments;
    console.log(`🔧 动态设置焊接约束: 允许${segments}段焊接`);
  }

  /**
   * V3新增：计算焊接成本
   */
  calculateWeldingCost(segments) {
    if (segments <= 1) return 0;
    return (segments - 1) * this.weldingCostPerSegment;
  }

  /**
   * V3新增：计算焊接时间成本
   */
  calculateWeldingTime(segments) {
    if (segments <= 1) return 0;
    return (segments - 1) * this.weldingTimePerSegment;
  }

  /**
   * V3新增：获取焊接约束信息
   */
  getWeldingConstraintInfo() {
    return {
      current: this.weldingSegments,
      min: this.minWeldingSegments,
      max: this.maxWeldingSegments,
      allowDynamic: this.allowDynamicWelding,
      costPerSegment: this.weldingCostPerSegment,
      timePerSegment: this.weldingTimePerSegment
    };
  }

  /**
   * 验证焊接段数约束的可行性
   * 检查设计钢材长度是否超出模数钢材能力范围
   */
  validateWeldingConstraint(designSteels, moduleSteels) {
    const maxModuleLength = Math.max(...moduleSteels.map(m => m.length));
    const conflictSteels = designSteels.filter(d => d.length > maxModuleLength);
    
    if (conflictSteels.length > 0 && this.maxWeldingSegments === 1) {
      return {
        isValid: false,
        conflicts: conflictSteels,
        maxModuleLength,
        suggestions: [
          {
            type: 'addLongerModule',
            description: `建议添加长度≥${Math.max(...conflictSteels.map(s => s.length))}mm的模数钢材`,
            requiredLength: Math.max(...conflictSteels.map(s => s.length))
          },
          {
            type: 'increaseWelding',
            description: `建议将最大焊接段数增加到≥${Math.ceil(Math.max(...conflictSteels.map(s => s.length)) / maxModuleLength)}段`,
            requiredSegments: Math.ceil(Math.max(...conflictSteels.map(s => s.length)) / maxModuleLength)
          }
        ]
      };
    }

    return { isValid: true, conflicts: [], suggestions: [] };
  }

  /**
   * 获取约束条件的友好显示名称
   */
  getDisplayNames() {
    return {
      wasteThreshold: '废料阈值',
      weldingSegments: '焊接段数',
      maxIterations: '最大迭代次数',
      timeLimit: '计算时间限制',
      allowDynamicWelding: '动态焊接约束',
      maxWeldingSegments: '最大焊接段数',
      minWeldingSegments: '最小焊接段数',
      weldingCostPerSegment: '每段焊接的成本系数',
      weldingTimePerSegment: '每段焊接的时间成本(秒)'
    };
  }

  /**
   * 获取约束条件的详细说明
   */
  getDescriptions() {
    return {
      wasteThreshold: '余料长度小于此值时视为废料，无法再次利用',
      weldingSegments: '单根设计钢材允许的焊接段数，1段表示不允许焊接',
      maxIterations: '算法最大迭代次数，超过后返回当前最优解',
      timeLimit: '算法计算的最大允许时间，超时后返回当前最优解',
      allowDynamicWelding: '是否允许动态调整焊接段数',
      maxWeldingSegments: '单根设计钢材允许的最大焊接段数，1段表示不允许焊接',
      minWeldingSegments: '单根设计钢材允许的最小焊接段数，1段表示不允许焊接',
      weldingCostPerSegment: '每段焊接的成本系数，影响焊接成本',
      weldingTimePerSegment: '每段焊接的时间成本(秒)，影响焊接时间'
    };
  }
}

// ==================== 切割和优化结果 ====================

/**
 * 切割详情类型 - V3.0增强
 */
class CuttingDetail {
  constructor({
    sourceType, // 'module' | 'remainder'
    sourceId,
    sourceLength,
    moduleType = '',
    moduleLength = 0,
    designId,
    length,
    quantity,
    remainderInfo = null, // 余料信息
    weldingCount = 1      // 焊接段数
  }) {
    this.sourceType = sourceType;
    this.sourceId = sourceId;
    this.sourceLength = sourceLength;
    this.moduleType = moduleType;
    this.moduleLength = moduleLength;
    this.designId = designId;
    this.length = length;
    this.quantity = quantity;
    this.remainderInfo = remainderInfo;
    this.weldingCount = weldingCount;
  }
}

/**
 * 切割计划类型 - V3.0增强
 */
class CuttingPlan {
  constructor({
    sourceType,
    sourceId,
    sourceDescription,
    sourceLength,
    moduleType = '',
    moduleLength = 0,
    cuts = [],
    newRemainders = [],
    pseudoRemainders = [], // 伪余料
    realRemainders = [],   // 真余料
    waste = 0,
    usedRemainders = []
  }) {
    this.sourceType = sourceType;
    this.sourceId = sourceId;
    this.sourceDescription = sourceDescription;
    this.sourceLength = sourceLength;
    this.moduleType = moduleType;
    this.moduleLength = moduleLength;
    this.cuts = cuts;
    this.newRemainders = newRemainders;
    this.pseudoRemainders = pseudoRemainders;
    this.realRemainders = realRemainders;
    this.waste = waste;
    this.usedRemainders = usedRemainders;
  }
}

/**
 * 优化解决方案 - V3.0增强
 */
class OptimizationSolution {
  constructor({
    cuttingPlans = [],
    totalModuleUsed = 0,
    totalWaste = 0,
    totalPseudoRemainder = 0,  // 伪余料总长度
    totalRealRemainder = 0,    // 真余料总长度
    details = [],
    lossRateBreakdown = {}     // 损耗率分解
  }) {
    this.cuttingPlans = cuttingPlans;
    this.totalModuleUsed = totalModuleUsed;
    this.totalWaste = totalWaste;
    this.totalPseudoRemainder = totalPseudoRemainder;
    this.totalRealRemainder = totalRealRemainder;
    this.details = details;
    this.lossRateBreakdown = lossRateBreakdown;
  }
}

/**
 * 优化结果类型 - V3.0重构
 */
class OptimizationResult {
  constructor({
    solutions = {},
    totalLossRate = 0,
    totalModuleUsed = 0,
    totalWaste = 0,
    totalPseudoRemainder = 0,
    totalRealRemainder = 0,
    totalMaterial = 0,
    executionTime = 0,
    lossRateValidation = null, // 损耗率验证结果
    constraintValidation = null // 约束验证结果
  }) {
    this.solutions = solutions;
    this.totalLossRate = totalLossRate;
    this.totalModuleUsed = totalModuleUsed;
    this.totalWaste = totalWaste;
    this.totalPseudoRemainder = totalPseudoRemainder;
    this.totalRealRemainder = totalRealRemainder;
    this.totalMaterial = totalMaterial;
    this.executionTime = executionTime;
    this.lossRateValidation = lossRateValidation;
    this.constraintValidation = constraintValidation;
  }
}

// ==================== 损耗率计算 ====================

/**
 * 损耗率计算器 - V3.0新设计
 */
class LossRateCalculator {
  constructor() {
    this.PRECISION = 4; // 浮点精度
    this.ERROR_THRESHOLD = 0.01; // 误差阈值
  }

  /**
   * 计算单规格损耗率
   * 公式：(真余料+废料)/该规格模数钢材总长度*100%
   */
  calculateSpecificationLossRate(specSolution) {
    const totalWasteAndReal = specSolution.totalWaste + specSolution.totalRealRemainder;
    const totalModuleMaterial = this.calculateTotalModuleMaterial(specSolution);
    
    if (totalModuleMaterial === 0) return 0;
    
    return parseFloat(((totalWasteAndReal / totalModuleMaterial) * 100).toFixed(this.PRECISION));
  }

  /**
   * 计算总损耗率
   * 公式：各规格真余料废料总和/各规格模数钢材总长度总和*100%
   */
  calculateTotalLossRate(allSolutions) {
    let totalWasteAndReal = 0;
    let totalModuleMaterial = 0;

    Object.values(allSolutions).forEach(solution => {
      totalWasteAndReal += solution.totalWaste + solution.totalRealRemainder;
      totalModuleMaterial += this.calculateTotalModuleMaterial(solution);
    });

    if (totalModuleMaterial === 0) return 0;

    return parseFloat(((totalWasteAndReal / totalModuleMaterial) * 100).toFixed(this.PRECISION));
  }

  /**
   * 验证损耗率计算正确性
   * 检查加权平均是否等于总损耗率
   */
  validateLossRateCalculation(allSolutions) {
    const totalLossRate = this.calculateTotalLossRate(allSolutions);
    
    // 计算加权平均
    let weightedSum = 0;
    let totalWeight = 0;

    const specResults = Object.values(allSolutions).map(solution => {
      const specLossRate = this.calculateSpecificationLossRate(solution);
      const weight = this.calculateTotalModuleMaterial(solution);
      
      weightedSum += specLossRate * weight;
      totalWeight += weight;

      return {
        lossRate: specLossRate,
        weight: weight,
        contribution: specLossRate * weight
      };
    });

    const weightedAverage = totalWeight > 0 ? 
      parseFloat((weightedSum / totalWeight).toFixed(this.PRECISION)) : 0;

    const difference = Math.abs(totalLossRate - weightedAverage);
    const isValid = difference <= this.ERROR_THRESHOLD;

    return {
      isValid,
      totalLossRate,
      weightedAverage,
      difference,
      specResults,
      errorMessage: isValid ? null : `损耗率计算存在误差: ${difference.toFixed(4)}%`
    };
  }

  /**
   * 计算规格的模数钢材总长度
   */
  calculateTotalModuleMaterial(solution) {
    // 🔧 修复：直接读取由`calculateSolutionStats`预计算好的准确值
    // 这个值基于物料守恒定律，是最可靠的数据源
    if (solution && solution.totalMaterial !== undefined) {
      return solution.totalMaterial;
    }

    // 备用逻辑：如果预计算值不存在，则从头计算（保持健壮性）
    console.warn('⚠️ calculateTotalModuleMaterial：预计算的totalMaterial不存在，从切割计划重新计算');
    return solution.cuttingPlans
      .filter(plan => plan.sourceType === 'module')
      .reduce((sum, plan) => sum + (plan.sourceLength || plan.moduleLength || 0), 0);
  }
}

// ==================== 导出定义 ====================

module.exports = {
  // 基础类型
  DesignSteel,
  ModuleSteel,
  RemainderV3,
  
  // 约束系统
  OptimizationConstraints,
  
  // 切割和结果
  CuttingDetail,
  CuttingPlan,
  OptimizationSolution,
  OptimizationResult,
  
  // 计算器
  LossRateCalculator,
  
  // 常量
  REMAINDER_TYPES: {
    PENDING: 'pending',
    PSEUDO: 'pseudo',
    REAL: 'real',
    WASTE: 'waste'
  },
  
  SOURCE_TYPES: {
    MODULE: 'module',
    REMAINDER: 'remainder'
  }
}; 