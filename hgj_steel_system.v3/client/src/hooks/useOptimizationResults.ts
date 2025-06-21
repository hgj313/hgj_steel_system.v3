import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { DesignSteel, OptimizationResult } from '../types';
import { generateDisplayIds, regroupOptimizationResultsBySpecification } from '../utils/steelUtils';

// 统计数据接口
export interface TotalStats {
  totalModuleCount: number;
  totalModuleLength: number;
  totalWaste: number;
  totalRealRemainder: number;
  totalPseudoRemainder: number;
  overallLossRate: number;
}

// 图表数据接口
export interface ChartDataPoint {
  specification: string;
  groupKey: string;
  lossRate: number;
  moduleUsed: number;
  waste: number;
  realRemainder: number;
  pseudoRemainder: number;
}

export interface PieDataPoint {
  name: string;
  value: number;
  fill: string;
}

export interface ChartData {
  lossRateData: ChartDataPoint[];
  pieData: PieDataPoint[];
}

// 需求验证数据接口
export interface RequirementValidationItem {
  key: string;
  id: string;
  specification: string;
  crossSection: number;
  length: number;
  quantity: number;
  produced: number;
  satisfied: boolean;
  difference: number;
  groupKey?: string;
}

// 模数钢材统计接口
export interface ModuleUsageItem {
  key: string;
  specification: string;
  length: number | string;
  count: number;
  totalLength: number;
  isSubtotal?: boolean;
  isTotal?: boolean;
}

// 处理后的优化结果接口
export interface ProcessedOptimizationResults {
  totalStats: TotalStats;
  chartData: ChartData;
  requirementValidation: RequirementValidationItem[];
  moduleUsageStats: {
    sortedStats: ModuleUsageItem[];
    groupKeyTotals: Record<string, { count: number; totalLength: number }>;
    grandTotal: { count: number; totalLength: number };
  };
  regroupedResults: Record<string, any>;
  designIdToDisplayIdMap: Map<string, string>;
  isAllRequirementsSatisfied: boolean;
  hasDataError: boolean;
  errorMessage?: string;
}

/**
 * 统一的优化结果数据处理Hook
 * 解决错误引用值问题，确保所有数据都来自同一个权威源
 */
export const useOptimizationResults = (
  results: OptimizationResult | null,
  designSteels: DesignSteel[],
  moduleSteels: any[]
): ProcessedOptimizationResults => {
  // 生成显示ID映射
  const designSteelsWithIds = useMemo(() => {
    return generateDisplayIds(designSteels || []);
  }, [designSteels]);

  const designIdToDisplayIdMap = useMemo(() => {
    const map = new Map<string, string>();
    designSteelsWithIds.forEach(steel => {
      map.set(steel.id, steel.displayId || steel.id);
    });
    return map;
  }, [designSteelsWithIds]);

  // 权威统计数据 - 直接来自后端，不重新计算
  const totalStats = useMemo((): TotalStats => {
    if (!results) {
      return {
        totalModuleCount: 0,
        totalModuleLength: 0,
        totalWaste: 0,
        totalRealRemainder: 0,
        totalPseudoRemainder: 0,
        overallLossRate: 0,
      };
    }

    // ⚠️ 关键：直接使用后端计算的权威数据，避免前端重复计算
    const overallLossRate = results.totalMaterial > 0 
      ? ((results.totalRealRemainder + results.totalWaste) / results.totalMaterial) * 100 
      : 0;

    return {
      totalModuleCount: results.totalModuleUsed || 0,
      totalModuleLength: results.totalMaterial || 0,
      totalWaste: results.totalWaste || 0,
      totalRealRemainder: results.totalRealRemainder || 0,
      totalPseudoRemainder: results.totalPseudoRemainder || 0,
      overallLossRate: parseFloat(overallLossRate.toFixed(2)),
    };
  }, [results]);

  // 图表数据处理
  const chartData = useMemo((): ChartData => {
    if (!results?.solutions) {
      return { lossRateData: [], pieData: [] };
    }

    const groupKeys = Object.keys(results.solutions);
    const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

    const lossRateData = groupKeys.map(groupKey => {
      const solution = results.solutions[groupKey];
      const [specification, crossSectionStr] = groupKey.split('_');
      const displayName = `${specification}(${crossSectionStr}mm²)`;
      
      // ⚠️ 使用solution中的统计数据，保持一致性
      const totalMaterial = solution.cuttingPlans?.reduce((sum: number, plan: any) => {
        return sum + (plan.sourceType === 'module' ? plan.sourceLength : 0);
      }, 0) || 0;
      
      const lossRate = totalMaterial > 0 ? ((solution.totalWaste + solution.totalRealRemainder) / totalMaterial) * 100 : 0;
      
      return {
        specification: displayName,
        groupKey: groupKey,
        lossRate: parseFloat(lossRate.toFixed(2)),
        moduleUsed: solution.totalModuleUsed || 0,
        waste: solution.totalWaste || 0,
        realRemainder: solution.totalRealRemainder || 0,
        pseudoRemainder: solution.totalPseudoRemainder || 0
      };
    });

    const pieData = groupKeys.map((groupKey, index) => {
      const [specification, crossSectionStr] = groupKey.split('_');
      const displayName = `${specification}(${crossSectionStr}mm²)`;
      
      return {
        name: displayName,
        value: results.solutions[groupKey].totalModuleUsed || 0,
        fill: colors[index % colors.length]
      };
    });

    return { lossRateData, pieData };
  }, [results]);

  // 需求验证数据处理
  const requirementValidation = useMemo((): RequirementValidationItem[] => {
    if (!results?.solutions) return [];

    return designSteelsWithIds.map(steel => {
      // 计算该设计钢材的实际生产数量
      let produced = 0;
      Object.values(results.solutions).forEach((solution: any) => {
        solution.cuttingPlans?.forEach((plan: any) => {
          plan.cuts?.forEach((cut: any) => {
            if (cut.designId === steel.id) {
              produced += cut.quantity;
            }
          });
        });
      });

      return {
        key: steel.id,
        id: steel.displayId || steel.id,
        specification: steel.specification || '未知规格',
        crossSection: steel.crossSection,
        length: steel.length,
        quantity: steel.quantity,
        produced: produced,
        satisfied: produced >= steel.quantity,
        difference: produced - steel.quantity,
        groupKey: steel.groupKey
      };
    });
  }, [results, designSteelsWithIds]);

  // 模数钢材统计数据处理
  const moduleUsageStats = useMemo(() => {
    if (!results?.solutions) {
      return { 
        sortedStats: [], 
        groupKeyTotals: {}, 
        grandTotal: { count: 0, totalLength: 0 } 
      };
    }

    // 按组合键统计模数钢材使用情况
    const moduleUsageStatsMap: Record<string, {
      groupKey: string;
      specification: string;
      crossSection: number;
      length: number;
      count: number;
      totalLength: number;
    }> = {};

    Object.entries(results.solutions).forEach(([groupKey, solution]) => {
      const [specification, crossSectionStr] = groupKey.split('_');
      const crossSection = parseInt(crossSectionStr);
      
      // 统计唯一的模数钢材条数（按sourceId）
      const uniqueModuleBars: Record<string, { length: number; sourceId: string }> = {};
      
      (solution as any).details?.forEach((detail: any) => {
        // 只统计原始模数钢材，忽略余料
        if (detail.sourceType === 'module' && detail.sourceId) {
          const length = detail.moduleLength || detail.sourceLength;
          const sourceId = detail.sourceId;
          
          // 每个唯一的sourceId代表一根物理钢材
          if (!uniqueModuleBars[sourceId]) {
            uniqueModuleBars[sourceId] = {
              length: length,
              sourceId: sourceId
            };
          }
        }
      });
      
      // 按长度分组并计算数量
      const moduleBarCounts: Record<number, number> = {};
      Object.values(uniqueModuleBars).forEach(bar => {
        if (!moduleBarCounts[bar.length]) {
          moduleBarCounts[bar.length] = 0;
        }
        moduleBarCounts[bar.length] += 1;
      });
      
      // 添加到统计数据
      Object.entries(moduleBarCounts).forEach(([lengthStr, count]) => {
        const length = parseInt(lengthStr);
        const key = `${groupKey}_${length}`;
        if (!moduleUsageStatsMap[key]) {
          moduleUsageStatsMap[key] = {
            groupKey: groupKey,
            specification: specification,
            crossSection: crossSection,
            length: length,
            count: 0,
            totalLength: 0
          };
        }
        moduleUsageStatsMap[key].count += count;
        moduleUsageStatsMap[key].totalLength += length * count;
      });
    });

    const sortedStats = Object.values(moduleUsageStatsMap).map(stat => ({
      ...stat,
      key: `${stat.groupKey}_${stat.length}`
    })).sort((a, b) => {
      if (a.specification !== b.specification) {
        return a.specification.localeCompare(b.specification);
      }
      if (a.crossSection !== b.crossSection) {
        return a.crossSection - b.crossSection;
      }
      return a.length - b.length;
    });

    const groupKeyTotals: Record<string, { count: number; totalLength: number }> = {};
    sortedStats.forEach(stat => {
      if (!groupKeyTotals[stat.groupKey]) {
        groupKeyTotals[stat.groupKey] = { count: 0, totalLength: 0 };
      }
      groupKeyTotals[stat.groupKey].count += stat.count;
      groupKeyTotals[stat.groupKey].totalLength += stat.totalLength;
    });

    const grandTotal = {
      count: sortedStats.reduce((sum, stat) => sum + stat.count, 0),
      totalLength: sortedStats.reduce((sum, stat) => sum + stat.totalLength, 0)
    };

    return { sortedStats, groupKeyTotals, grandTotal };
  }, [results]);

  // 重新分组的结果数据
  const regroupedResults = useMemo(() => {
    if (!results?.solutions) return {};
    const regrouped = regroupOptimizationResultsBySpecification(results.solutions);
    
    // 注入displayId到切割计划中
    Object.values(regrouped).forEach((solution: any) => {
      solution.cuttingPlans?.forEach((plan: any) => {
        plan.cuts?.forEach((cut: any) => {
          cut.displayId = designIdToDisplayIdMap.get(cut.designId) || cut.designId;
        });
      });
    });
    return regrouped;
  }, [results, designIdToDisplayIdMap]);

  // 检查所有需求是否满足
  const isAllRequirementsSatisfied = useMemo(() => {
    return requirementValidation.every(item => item.satisfied);
  }, [requirementValidation]);

  // 错误检查
  const { hasDataError, errorMessage } = useMemo(() => {
    if (!results) {
      return { hasDataError: true, errorMessage: '暂无优化结果数据' };
    }

    if (!results.solutions || Object.keys(results.solutions).length === 0) {
      return { hasDataError: true, errorMessage: '优化结果为空，请检查输入数据' };
    }

    // 检查数据合理性
    if (totalStats.totalModuleCount === 0 && totalStats.totalModuleLength === 0) {
      return { hasDataError: true, errorMessage: '模数钢材用量为0，可能存在数据异常' };
    }

    return { hasDataError: false };
  }, [results, totalStats]);

  return {
    totalStats,
    chartData,
    requirementValidation,
    moduleUsageStats,
    regroupedResults,
    designIdToDisplayIdMap,
    isAllRequirementsSatisfied,
    hasDataError,
    errorMessage
  };
}; 

/**
 * 异步优化任务处理Hook
 * 实现提交任务、轮询状态、获取结果的完整流程
 */
export const useAsyncOptimization = () => {
  const [currentTask, setCurrentTask] = useState<{
    taskId: string | null;
    status: 'idle' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    message: string;
    results: OptimizationResult | null;
    error: string | null;
    executionTime: number;
  }>({
    taskId: null,
    status: 'idle',
    progress: 0,
    message: '',
    results: null,
    error: null,
    executionTime: 0
  });

  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 提交优化任务
  const submitOptimization = useCallback(async (optimizationData: any) => {
    try {
      console.log('🚀 提交优化任务...');
      
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(optimizationData)
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ 任务创建成功:', result.taskId);
        
        setCurrentTask({
          taskId: result.taskId,
          status: 'pending',
          progress: 0,
          message: result.message || '任务已创建',
          results: null,
          error: null,
          executionTime: 0
        });

        // 开始轮询任务状态
        startPolling(result.taskId);
        
        return { success: true, taskId: result.taskId };
      } else {
        console.error('❌ 任务创建失败:', result.error);
        setCurrentTask(prev => ({
          ...prev,
          status: 'failed',
          error: result.error
        }));
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ 提交优化任务异常:', error);
      const errorMessage = error instanceof Error ? error.message : '网络错误';
      setCurrentTask(prev => ({
        ...prev,
        status: 'failed',
        error: errorMessage
      }));
      return { success: false, error: errorMessage };
    }
  }, []);

  // 开始轮询任务状态
  const startPolling = useCallback((taskId: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    setIsPolling(true);
    
    const pollTaskStatus = async () => {
      try {
        const response = await fetch(`/api/task/${taskId}`);
        const result = await response.json();

        if (result.success) {
          setCurrentTask(prev => ({
            ...prev,
            status: result.status,
            progress: result.progress || 0,
            message: result.message || '',
            executionTime: result.executionTime || 0,
            results: result.results || null,
            error: result.error || null
          }));

          // 如果任务完成、失败或取消，停止轮询
          if (['completed', 'failed', 'cancelled'].includes(result.status)) {
            stopPolling();
            console.log(`📋 任务${result.status}:`, taskId);
          }
        } else {
          console.error('❌ 轮询任务状态失败:', result.error);
          // 继续轮询，可能是临时网络问题
        }
      } catch (error) {
        console.error('❌ 轮询请求异常:', error);
        // 继续轮询，可能是临时网络问题
      }
    };

    // 立即执行一次
    pollTaskStatus();
    
    // 每2秒轮询一次
    pollingRef.current = setInterval(pollTaskStatus, 2000);
  }, []);

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // 取消任务
  const cancelTask = useCallback(async () => {
    if (!currentTask.taskId) {
      return { success: false, error: '没有活跃的任务' };
    }

    try {
      const response = await fetch(`/api/task/${currentTask.taskId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ 任务已取消');
        stopPolling();
        setCurrentTask(prev => ({
          ...prev,
          status: 'cancelled',
          message: '任务已取消'
        }));
        return { success: true };
      } else {
        console.error('❌ 取消任务失败:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ 取消任务异常:', error);
      const errorMessage = error instanceof Error ? error.message : '网络错误';
      return { success: false, error: errorMessage };
    }
  }, [currentTask.taskId, stopPolling]);

  // 重置任务状态
  const resetTask = useCallback(() => {
    stopPolling();
    setCurrentTask({
      taskId: null,
      status: 'idle',
      progress: 0,
      message: '',
      results: null,
      error: null,
      executionTime: 0
    });
  }, [stopPolling]);

  // 获取任务历史
  const getTaskHistory = useCallback(async (limit = 20) => {
    try {
      const response = await fetch(`/api/tasks?limit=${limit}`);
      const result = await response.json();

      if (result.success) {
        return { success: true, tasks: result.tasks, total: result.total };
      } else {
        console.error('❌ 获取任务历史失败:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ 获取任务历史异常:', error);
      const errorMessage = error instanceof Error ? error.message : '网络错误';
      return { success: false, error: errorMessage };
    }
  }, []);

  // 组件卸载时清理轮询
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    // 任务状态
    currentTask,
    isPolling,
    
    // 任务操作
    submitOptimization,
    cancelTask,
    resetTask,
    
    // 工具方法
    getTaskHistory,
    
    // 便捷状态判断
    isIdle: currentTask.status === 'idle',
    isPending: currentTask.status === 'pending',
    isRunning: currentTask.status === 'running',
    isCompleted: currentTask.status === 'completed',
    isFailed: currentTask.status === 'failed',
    isCancelled: currentTask.status === 'cancelled',
    isActive: ['pending', 'running'].includes(currentTask.status),
    hasResults: currentTask.status === 'completed' && !!currentTask.results,
    hasError: currentTask.status === 'failed' && !!currentTask.error
  };
}; 