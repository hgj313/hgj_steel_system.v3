/**
 * 约束验证器 - V3.0核心模块
 * 实现约束W的预检查和冲突解决方案提供
 */

const { OptimizationConstraints } = require('../../api/types');

class ConstraintValidator {
  constructor() {
    this.validationHistory = [];
  }

  /**
   * 综合验证所有约束条件
   */
  validateAllConstraints(designSteels, moduleSteels, constraints) {
    const results = {
      isValid: true,
      violations: [],
      suggestions: [],
      warnings: []
    };

    // 验证基础约束
    const basicValidation = this.validateBasicConstraints(constraints);
    if (!basicValidation.isValid) {
      results.isValid = false;
      results.violations.push(...basicValidation.violations);
    }

    // 验证焊接约束W
    const weldingValidation = this.validateWeldingConstraint(designSteels, moduleSteels, constraints);
    if (!weldingValidation.isValid) {
      results.isValid = false;
      results.violations.push(...weldingValidation.violations);
      results.suggestions.push(...weldingValidation.suggestions);
    }

    // 验证数据完整性
    const dataValidation = this.validateDataIntegrity(designSteels, moduleSteels);
    if (!dataValidation.isValid) {
      results.isValid = false;
      results.violations.push(...dataValidation.violations);
    }

    // 添加警告信息
    results.warnings.push(...this.generateWarnings(designSteels, moduleSteels, constraints));

    // 记录验证历史
    this.validationHistory.push({
      timestamp: new Date().toISOString(),
      result: JSON.parse(JSON.stringify(results))
    });

    return results;
  }

  /**
   * 验证基础约束条件
   */
  validateBasicConstraints(constraints) {
    const violations = [];

    if (constraints.wasteThreshold <= 0) {
      violations.push({
        type: 'wasteThreshold',
        message: '废料阈值必须大于0',
        current: constraints.wasteThreshold,
        suggested: 100
      });
    }

    if (constraints.targetLossRate < 0 || constraints.targetLossRate > 50) {
      violations.push({
        type: 'targetLossRate',
        message: '目标损耗率必须在0-50%之间',
        current: constraints.targetLossRate,
        suggested: 5
      });
    }

    if (constraints.timeLimit <= 0) {
      violations.push({
        type: 'timeLimit',
        message: '计算时间限制必须大于0',
        current: constraints.timeLimit,
        suggested: 30000
      });
    }

    if (constraints.maxWeldingSegments < 1) {
      violations.push({
        type: 'maxWeldingSegments',
        message: '最大焊接段数必须≥1',
        current: constraints.maxWeldingSegments,
        suggested: 1
      });
    }

    return {
      isValid: violations.length === 0,
      violations
    };
  }

  /**
   * 验证焊接约束W
   * 关键功能：检查W=1时是否存在冲突
   */
  validateWeldingConstraint(designSteels, moduleSteels, constraints) {
    if (moduleSteels.length === 0) {
      return {
        isValid: false,
        violations: [{
          type: 'noModuleSteel',
          message: '至少需要一种模数钢材',
          suggestions: []
        }],
        suggestions: []
      };
    }

    const maxModuleLength = Math.max(...moduleSteels.map(m => m.length));
    const maxDesignLength = Math.max(...designSteels.map(d => d.length));
    const conflictSteels = designSteels.filter(d => d.length > maxModuleLength);

    // 检查W约束冲突
    if (conflictSteels.length > 0 && constraints.maxWeldingSegments === 1) {
      const requiredLength = Math.max(...conflictSteels.map(s => s.length));
      const requiredSegments = Math.ceil(maxDesignLength / maxModuleLength);

      return {
        isValid: false,
        violations: [{
          type: 'weldingConstraintViolation',
          message: `约束W=1与设计需求冲突`,
          details: {
            maxModuleLength,
            conflictCount: conflictSteels.length,
            maxConflictLength: requiredLength,
            conflictSteels: conflictSteels.slice(0, 5) // 只显示前5个
          }
        }],
        suggestions: [
          {
            type: 'addLongerModule',
            priority: 1,
            title: '方案A：添加更长的模数钢材',
            description: `建议添加长度≥${requiredLength}mm的模数钢材`,
            details: {
              requiredLength: requiredLength,
              currentMaxLength: maxModuleLength,
              additionalLength: requiredLength - maxModuleLength
            },
            implementation: {
              action: 'addModuleSteel',
              minLength: requiredLength,
              recommendedLengths: this.generateRecommendedLengths(requiredLength)
            }
          },
          {
            type: 'increaseWelding',
            priority: 2,
            title: '方案B：增加允许焊接段数',
            description: `建议将允许焊接段数W增加到≥${requiredSegments}`,
            details: {
              currentW: constraints.maxWeldingSegments,
              requiredW: requiredSegments,
              maxSegmentsNeeded: requiredSegments
            },
            implementation: {
              action: 'updateConstraint',
              parameter: 'maxWeldingSegments',
              minValue: requiredSegments,
              recommendedValue: requiredSegments
            }
          }
        ]
      };
    }

    // 检查是否存在效率警告
    const efficiencyWarnings = this.checkWeldingEfficiency(designSteels, moduleSteels, constraints);

    return {
      isValid: true,
      violations: [],
      suggestions: [],
      efficiencyWarnings
    };
  }

  /**
   * 验证数据完整性
   */
  validateDataIntegrity(designSteels, moduleSteels) {
    const violations = [];

    // 检查设计钢材
    if (designSteels.length === 0) {
      violations.push({
        type: 'noDesignSteel',
        message: '至少需要一个设计钢材'
      });
    }

    designSteels.forEach((steel, index) => {
      if (!steel.length || steel.length <= 0) {
        violations.push({
          type: 'invalidDesignLength',
          message: `设计钢材${index + 1}：长度必须大于0`,
          steelIndex: index
        });
      }
      if (!steel.quantity || steel.quantity <= 0) {
        violations.push({
          type: 'invalidDesignQuantity',
          message: `设计钢材${index + 1}：数量必须大于0`,
          steelIndex: index
        });
      }
      if (!steel.crossSection || steel.crossSection <= 0) {
        violations.push({
          type: 'invalidCrossSection',
          message: `设计钢材${index + 1}：截面面积必须大于0`,
          steelIndex: index
        });
      }
    });

    // 检查模数钢材
    if (moduleSteels.length === 0) {
      violations.push({
        type: 'noModuleSteel',
        message: '至少需要一种模数钢材'
      });
    }

    moduleSteels.forEach((steel, index) => {
      if (!steel.length || steel.length <= 0) {
        violations.push({
          type: 'invalidModuleLength',
          message: `模数钢材${index + 1}：长度必须大于0`,
          steelIndex: index
        });
      }
    });

    return {
      isValid: violations.length === 0,
      violations
    };
  }

  /**
   * 生成警告信息
   */
  generateWarnings(designSteels, moduleSteels, constraints) {
    const warnings = [];

    // 检查损耗率可能过高的情况
    const avgDesignLength = designSteels.reduce((sum, s) => sum + s.length, 0) / designSteels.length;
    const avgModuleLength = moduleSteels.reduce((sum, s) => sum + s.length, 0) / moduleSteels.length;
    
    if (avgDesignLength < avgModuleLength * 0.3) {
      warnings.push({
        type: 'highWasteRisk',
        level: 'warning',
        message: '设计钢材平均长度较短，可能导致较高的损耗率',
        suggestion: '考虑优化设计尺寸或调整模数钢材规格'
      });
    }

    // 检查约束设置是否合理
    if (constraints.maxWeldingSegments === 1 && moduleSteels.length > 1) {
      warnings.push({
        type: 'constraintEfficiency',
        level: 'info',
        message: 'W=1且有多种模数钢材，系统将自动选择最优规格',
        suggestion: '考虑增加W值以获得更灵活的优化结果'
      });
    }

    // 检查时间限制
    const totalDesignCount = designSteels.reduce((sum, s) => sum + s.quantity, 0);
    if (constraints.timeLimit < totalDesignCount && totalDesignCount > 1000) {
      warnings.push({
        type: 'timeLimitRisk',
        level: 'warning',
        message: '设计钢材数量较多，建议增加时间限制以获得更好的优化结果',
        suggestion: `建议时间限制设置为≥${Math.ceil(totalDesignCount / 10)}秒`
      });
    }

    return warnings;
  }

  /**
   * 检查焊接效率
   */
  checkWeldingEfficiency(designSteels, moduleSteels, constraints) {
    const warnings = [];
    
    // 计算需要焊接的设计钢材数量
    const maxModuleLength = Math.max(...moduleSteels.map(m => m.length));
    const needWeldingCount = designSteels.filter(d => {
      const segmentsNeeded = Math.ceil(d.length / maxModuleLength);
      return segmentsNeeded > constraints.maxWeldingSegments;
    }).length;

    if (needWeldingCount > 0) {
      warnings.push({
        type: 'weldingEfficiency',
        level: 'info',
        message: `有${needWeldingCount}个设计钢材可能需要更多焊接段数`,
        details: { needWeldingCount, totalCount: designSteels.length }
      });
    }

    return warnings;
  }

  /**
   * 生成推荐的模数钢材长度
   */
  generateRecommendedLengths(requiredLength) {
    const standardLengths = [6000, 9000, 12000, 15000, 18000];
    const recommended = [];

    // 添加刚好满足要求的长度
    recommended.push(requiredLength);

    // 添加标准长度中大于等于要求的
    standardLengths.forEach(length => {
      if (length >= requiredLength && !recommended.includes(length)) {
        recommended.push(length);
      }
    });

    // 按长度排序
    return recommended.sort((a, b) => a - b).slice(0, 3);
  }

  /**
   * 获取约束违规的用户友好描述
   */
  getViolationSummary(violations) {
    if (violations.length === 0) {
      return '所有约束条件均已满足';
    }

    const categories = {
      critical: [],
      warning: [],
      info: []
    };

    violations.forEach(violation => {
      const severity = this.getViolationSeverity(violation.type);
      categories[severity].push(violation);
    });

    let summary = '';
    if (categories.critical.length > 0) {
      summary += `❌ ${categories.critical.length}个严重问题需要解决\n`;
    }
    if (categories.warning.length > 0) {
      summary += `⚠️ ${categories.warning.length}个警告\n`;
    }
    if (categories.info.length > 0) {
      summary += `ℹ️ ${categories.info.length}个提示`;
    }

    return summary.trim();
  }

  /**
   * 获取违规严重程度
   */
  getViolationSeverity(violationType) {
    const severityMap = {
      'weldingConstraintViolation': 'critical',
      'noDesignSteel': 'critical',
      'noModuleSteel': 'critical',
      'invalidDesignLength': 'critical',
      'invalidDesignQuantity': 'critical',
      'invalidCrossSection': 'critical',
      'invalidModuleLength': 'critical',
      'wasteThreshold': 'warning',
      'targetLossRate': 'warning',
      'timeLimit': 'warning',
      'maxWeldingSegments': 'warning'
    };

    return severityMap[violationType] || 'info';
  }

  /**
   * 清空验证历史
   */
  clearHistory() {
    this.validationHistory = [];
  }

  /**
   * 获取验证历史
   */
  getValidationHistory() {
    return this.validationHistory.slice();
  }
}

module.exports = ConstraintValidator; 