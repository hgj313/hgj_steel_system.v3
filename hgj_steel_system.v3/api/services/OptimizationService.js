/**
 * 优化服务 - V3.0 API层
 * 提供统一的优化接口，支持模块化调用
 */

const SteelOptimizerV3 = require('../../core/optimizer/SteelOptimizerV3');
const { 
  DesignSteel, 
  ModuleSteel, 
  OptimizationConstraints,
  LossRateCalculator 
} = require('../types');

class OptimizationService {
  constructor() {
    this.activeOptimizers = new Map(); // 存储活跃的优化器实例
    this.optimizationHistory = [];
    this.lossRateCalculator = new LossRateCalculator();
  }

  /**
   * 执行钢材优化
   * 主要API入口点
   */
  async optimizeSteel(requestData) {
    try {
      // 1. 验证和转换输入数据
      const validationResult = this.validateInput(requestData);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: '输入数据验证失败',
          details: validationResult.errors,
          suggestions: validationResult.suggestions
        };
      }

      // 2. 创建数据对象
      const designSteels = this.createDesignSteels(requestData.designSteels);
      const moduleSteels = this.createModuleSteels(requestData.moduleSteels);
      const constraints = this.createConstraints(requestData.constraints);

      // 3. 生成优化ID并创建优化器
      const optimizationId = this.generateOptimizationId();
      const optimizer = new SteelOptimizerV3(designSteels, moduleSteels, constraints);
      
      // 4. 存储优化器实例
      this.activeOptimizers.set(optimizationId, {
        optimizer,
        startTime: Date.now(),
        status: 'running'
      });

      // 5. 执行优化
      const optimizationOutput = await optimizer.optimize();

      // 6. 更新状态和处理结果
      const optimizerInfo = this.activeOptimizers.get(optimizationId);
      if (optimizerInfo) {
        optimizerInfo.status = optimizationOutput.success ? 'completed' : 'failed';
        optimizerInfo.result = optimizationOutput; // 保存原始输出
      }
      
      // 7. 汇总计算最终结果
      const finalResult = this.aggregateResults(optimizationOutput);

      // 8. 记录优化历史
      this.recordOptimizationHistory({
        id: optimizationId,
        input: requestData,
        result: finalResult, // 记录汇总后的结果
        timestamp: new Date().toISOString()
      });

      // 9. 清理完成的优化器
      setTimeout(() => {
        this.activeOptimizers.delete(optimizationId);
      }, 300000);

      // 10. 构建最终响应
      const response = {
        success: optimizationOutput.success,
        optimizationId: optimizationId,
        result: optimizationOutput.success ? finalResult : null,
        error: optimizationOutput.success ? null : optimizationOutput.error,
        stats: optimizationOutput.stats,
        executionTime: Date.now() - optimizerInfo.startTime,
        processingStatus: {
          isCompleted: true,
          readyForRendering: true,
          completedAt: new Date().toISOString()
        }
      };

      return response;

    } catch (error) {
      console.error('优化服务错误:', error);
      return {
        success: false,
        error: `优化过程出现异常: ${error.message}`,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  }

  /**
   * 新增：汇总优化器结果
   * 从详细的solutions计算顶层统计数据
   */
  aggregateResults(optimizationOutput) {
    if (!optimizationOutput.success || !optimizationOutput.result?.solutions) {
      return null;
    }

    const aggregated = {
      solutions: optimizationOutput.result.solutions,
      totalModuleUsed: 0,
      totalMaterial: 0,
      totalWaste: 0,
      totalRealRemainder: 0,
      totalPseudoRemainder: 0,
      totalLossRate: 0,
      totalDesignSteelLength: 0,
      executionTime: optimizationOutput.result.executionTime || 0,
    };

    // 遍历所有规格的解决方案进行累加
    for (const specKey in aggregated.solutions) {
      const solution = aggregated.solutions[specKey];
      aggregated.totalModuleUsed += solution.totalModuleUsed || 0;
      aggregated.totalMaterial += solution.totalMaterial || 0;
      aggregated.totalWaste += solution.totalWaste || 0;
      aggregated.totalRealRemainder += solution.totalRealRemainder || 0;
      aggregated.totalPseudoRemainder += solution.totalPseudoRemainder || 0;
      aggregated.totalDesignSteelLength += solution.totalDesignSteelLength || 0;
    }

    // 计算最终总损耗率
    if (aggregated.totalMaterial > 0) {
      aggregated.totalLossRate = parseFloat(
        (((aggregated.totalWaste + aggregated.totalRealRemainder) / aggregated.totalMaterial) * 100).toFixed(2)
      );
    }

    return aggregated;
  }

  /**
   * 验证约束W是否可行
   * 在正式优化前进行预检查
   */
  async validateWeldingConstraints(requestData) {
    try {
      const designSteels = this.createDesignSteels(requestData.designSteels);
      const moduleSteels = this.createModuleSteels(requestData.moduleSteels);
      const constraints = this.createConstraints(requestData.constraints);

      // 创建临时优化器进行约束验证
      const optimizer = new SteelOptimizerV3(designSteels, moduleSteels, constraints);
      const validation = optimizer.constraintValidator.validateAllConstraints(
        designSteels, 
        moduleSteels, 
        constraints
      );

      return {
        success: true,
        validation: validation,
        suggestions: validation.suggestions || [],
        warnings: validation.warnings || []
      };

    } catch (error) {
      return {
        success: false,
        error: `约束验证失败: ${error.message}`
      };
    }
  }

  /**
   * 获取优化进度
   */
  getOptimizationProgress(optimizationId) {
    const optimizerInfo = this.activeOptimizers.get(optimizationId);
    
    if (!optimizerInfo) {
      return {
        success: false,
        error: '优化ID不存在或已过期'
      };
    }

    const runningTime = Date.now() - optimizerInfo.startTime;
    
    return {
      success: true,
      status: optimizerInfo.status,
      runningTime: runningTime,
      result: optimizerInfo.result || null
    };
  }

  /**
   * 取消优化
   */
  cancelOptimization(optimizationId) {
    const optimizerInfo = this.activeOptimizers.get(optimizationId);
    
    if (!optimizerInfo) {
      return {
        success: false,
        error: '优化ID不存在或已完成'
      };
    }

    // 标记为取消
    optimizerInfo.status = 'cancelled';
    this.activeOptimizers.delete(optimizationId);

    return {
      success: true,
      message: '优化已取消'
    };
  }

  /**
   * 验证输入数据
   */
  validateInput(requestData) {
    const errors = [];
    const suggestions = [];

    // 检查设计钢材
    if (!requestData.designSteels || !Array.isArray(requestData.designSteels)) {
      errors.push('设计钢材数据缺失或格式错误');
    } else if (requestData.designSteels.length === 0) {
      errors.push('至少需要一个设计钢材');
    } else {
      requestData.designSteels.forEach((steel, index) => {
        if (!steel.length || steel.length <= 0) {
          errors.push(`设计钢材${index + 1}: 长度无效`);
        }
        if (!steel.quantity || steel.quantity <= 0) {
          errors.push(`设计钢材${index + 1}: 数量无效`);
        }
        if (!steel.crossSection || steel.crossSection <= 0) {
          errors.push(`设计钢材${index + 1}: 截面面积无效`);
        }
      });
    }

    // 检查模数钢材
    if (!requestData.moduleSteels || !Array.isArray(requestData.moduleSteels)) {
      errors.push('模数钢材数据缺失或格式错误');
    } else if (requestData.moduleSteels.length === 0) {
      errors.push('至少需要一种模数钢材');
    } else {
      requestData.moduleSteels.forEach((steel, index) => {
        if (!steel.length || steel.length <= 0) {
          errors.push(`模数钢材${index + 1}: 长度无效`);
        }
        if (!steel.name || steel.name.trim() === '') {
          errors.push(`模数钢材${index + 1}: 名称不能为空`);
        }
      });
    }

    // 检查约束条件
    if (requestData.constraints) {
      const c = requestData.constraints;
      if (c.wasteThreshold !== undefined && c.wasteThreshold <= 0) {
        errors.push('废料阈值必须大于0');
      }
      if (c.expectedLossRate !== undefined && (c.expectedLossRate < 0 || c.expectedLossRate > 50)) {
        errors.push('期望损耗率必须在0-50%之间');
      }
      if (c.weldingSegments !== undefined && c.weldingSegments < 1) {
        errors.push('允许焊接段数必须≥1');
      }
    }

    // 生成建议
    if (requestData.designSteels && requestData.moduleSteels) {
      const maxDesignLength = Math.max(...requestData.designSteels.map(s => s.length));
      const maxModuleLength = Math.max(...requestData.moduleSteels.map(s => s.length));
      
      if (maxDesignLength > maxModuleLength) {
        const W = requestData.constraints?.weldingSegments || 1;
        if (W === 1) {
          suggestions.push({
            type: 'weldingConstraintConflict',
            message: '检测到可能的焊接约束冲突',
            recommendation: '建议在正式优化前运行约束验证'
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      suggestions: suggestions
    };
  }

  /**
   * 创建设计钢材对象
   */
  createDesignSteels(designSteelsData) {
    return designSteelsData.map((steel, index) => new DesignSteel({
      id: steel.id || `design_${index + 1}`,
      length: steel.length,
      quantity: steel.quantity,
      crossSection: steel.crossSection,
      displayId: steel.displayId || '',
      componentNumber: steel.componentNumber || '',
      specification: steel.specification || '',
      partNumber: steel.partNumber || ''
    }));
  }

  /**
   * 创建模数钢材对象
   */
  createModuleSteels(moduleSteelsData) {
    return moduleSteelsData.map((steel, index) => new ModuleSteel({
      id: steel.id || `module_${index + 1}`,
      name: steel.name,
      length: steel.length
    }));
  }

  /**
   * 创建约束对象
   */
  createConstraints(constraintsData = {}) {
    return new OptimizationConstraints({
      wasteThreshold: constraintsData.wasteThreshold || 100,
      targetLossRate: constraintsData.targetLossRate || 5,
      timeLimit: constraintsData.timeLimit || 30000,
      maxWeldingSegments: constraintsData.maxWeldingSegments || 1
    });
  }

  /**
   * 生成优化ID
   */
  generateOptimizationId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `opt_${timestamp}_${random}`;
  }

  /**
   * 记录优化历史
   */
  recordOptimizationHistory(record) {
    this.optimizationHistory.push(record);
    
    // 保持历史记录数量在合理范围内
    if (this.optimizationHistory.length > 100) {
      this.optimizationHistory = this.optimizationHistory.slice(-50);
    }
  }

  /**
   * 获取优化历史
   */
  getOptimizationHistory(limit = 20) {
    return {
      success: true,
      history: this.optimizationHistory
        .slice(-limit)
        .reverse()
        .map(record => ({
          id: record.id,
          timestamp: record.timestamp,
          success: record.result?.success || false,
          executionTime: record.result?.result?.executionTime || 0,
          totalLossRate: record.result?.result?.totalLossRate || 0,
          totalModuleUsed: record.result?.result?.totalModuleUsed || 0
        }))
    };
  }

  /**
   * 获取系统统计
   */
  getSystemStats() {
    const activeCount = this.activeOptimizers.size;
    const totalOptimizations = this.optimizationHistory.length;
    const successfulOptimizations = this.optimizationHistory.filter(
      record => record.result?.success
    ).length;

    return {
      success: true,
      stats: {
        activeOptimizations: activeCount,
        totalOptimizations: totalOptimizations,
        successfulOptimizations: successfulOptimizations,
        successRate: totalOptimizations > 0 ? 
          ((successfulOptimizations / totalOptimizations) * 100).toFixed(2) : 0,
        averageExecutionTime: this.calculateAverageExecutionTime()
      }
    };
  }

  /**
   * 计算平均执行时间
   */
  calculateAverageExecutionTime() {
    const successfulRecords = this.optimizationHistory.filter(
      record => record.result?.success
    );
    
    if (successfulRecords.length === 0) return 0;
    
    const totalTime = successfulRecords.reduce(
      (sum, record) => sum + (record.result?.result?.executionTime || 0), 
      0
    );
    
    return Math.round(totalTime / successfulRecords.length);
  }

  /**
   * 清理过期的优化器
   */
  cleanupExpiredOptimizers() {
    const now = Date.now();
    const expireTime = 300000; // 5分钟
    
    for (const [id, info] of this.activeOptimizers.entries()) {
      if (now - info.startTime > expireTime) {
        this.activeOptimizers.delete(id);
      }
    }
  }

  /**
   * 获取活跃优化器列表
   */
  getActiveOptimizers() {
    const result = [];
    
    for (const [id, info] of this.activeOptimizers.entries()) {
      result.push({
        id: id,
        status: info.status,
        startTime: info.startTime,
        runningTime: Date.now() - info.startTime
      });
    }
    
    return {
      success: true,
      activeOptimizers: result
    };
  }
}

module.exports = OptimizationService; 