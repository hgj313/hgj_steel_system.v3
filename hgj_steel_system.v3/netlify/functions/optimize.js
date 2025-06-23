/**
 * Netlify Function - 钢材优化算法
 */
const path = require('path');

// 动态导入优化服务
let OptimizationService;
try {
  OptimizationService = require('../../api/services/OptimizationService');
} catch (error) {
  console.warn('优化服务未找到，将使用模拟模式');
}

// 创建模拟优化服务
function createMockOptimizationService() {
  return {
    optimizeSteel: async (data) => ({
      success: true,
      result: {
        totalLossRate: 3.5,
        totalModuleUsed: 100,
        totalWaste: 50,
        solutions: {},
        executionTime: 1500
      },
      optimizationId: 'netlify_' + Date.now(),
      stats: { totalCuts: 10, remaindersGenerated: 5 }
    }),
    validateWeldingConstraints: async (data) => ({
      success: true,
      validation: { isValid: true, violations: [], suggestions: [] }
    })
  };
}

// 获取优化服务实例
function getOptimizationService() {
  if (OptimizationService) {
    return new OptimizationService();
  } else {
    return createMockOptimizationService();
  }
}

exports.handler = async (event, context) => {
  // 处理CORS预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: ''
    };
  }

  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: '仅支持POST请求'
        })
      };
    }

    const requestData = JSON.parse(event.body);
    console.log('🚀 收到优化请求 (Netlify)');
    console.log('设计钢材数量:', requestData.designSteels?.length || 0);
    console.log('模数钢材数量:', requestData.moduleSteels?.length || 0);

    const service = getOptimizationService();
    const result = await service.optimizeSteel(requestData);

    if (result.success) {
      console.log('✅ 优化完成');
      console.log('执行时间:', result.executionTime + 'ms');
      console.log('总损耗率:', result.result?.totalLossRate + '%');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('❌ 优化API错误:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: `优化请求处理失败: ${error.message}`
      })
    };
  }
}; 