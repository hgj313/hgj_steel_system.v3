/**
 * Netlify异步任务管理器
 * 负责任务的创建、存储、状态更新和异步执行
 * 使用Netlify Blobs作为持久化存储
 */

const { getStore } = require('@netlify/blobs');

// 动态导入优化服务
let OptimizationService;
try {
  OptimizationService = require('../../../api/services/OptimizationService');
} catch (error) {
  console.warn('优化服务未找到，将使用模拟模式');
}

class TaskManager {
  constructor() {
    this.store = getStore('optimization-tasks');
    this.maxTaskAge = 24 * 60 * 60 * 1000; // 24小时
    this.taskCounter = 0;
    this.isInitialized = false;
  }

  /**
   * 初始化任务管理器，加载并设置计数器
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      const { blobs } = await this.store.list();
      if (blobs.length > 0) {
        const maxCounter = blobs.reduce((max, blob) => {
          const parts = blob.key.split('_');
          if (parts.length >= 3) {
            const counter = parseInt(parts[2], 10);
            return isNaN(counter) ? max : Math.max(max, counter);
          }
          return max;
        }, 0);
        this.taskCounter = maxCounter;
      } else {
        this.taskCounter = 0;
      }
    } catch (error) {
      console.warn('初始化任务计数器失败，可能存储为空:', error);
      this.taskCounter = 0;
    }
    
    this.isInitialized = true;
    console.log(`🔧 任务管理器初始化完成，当前计数器: ${this.taskCounter}`);
  }

  /**
   * 生成唯一任务ID
   */
  generateTaskId() {
    const timestamp = Date.now();
    const counter = ++this.taskCounter;
    const random = Math.floor(Math.random() * 900) + 100; // 3位随机数
    return `task_${timestamp}_${counter}_${random}`;
  }

  /**
   * 创建新的优化任务
   */
  async createOptimizationTask(optimizationData) {
    await this.initialize();

    const taskId = this.generateTaskId();
    
    const task = {
      id: taskId,
      type: 'optimization',
      status: 'pending',
      progress: 0,
      message: '任务已创建，等待处理',
      inputData: optimizationData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionTime: null,
      results: null,
      error: null
    };

    await this.store.setJSON(taskId, task);
    
    console.log(`✅ 创建优化任务: ${taskId}`);
    
    this.executeOptimizationTaskAsync(taskId, optimizationData);
    
    return taskId;
  }

  /**
   * 获取任务信息
   */
  async getTask(taskId) {
    return await this.store.get(taskId, { type: 'json' });
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(taskId, status, updates = {}) {
    await this.initialize();
    
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }
    
    task.status = status;
    task.updatedAt = new Date().toISOString();
    
    Object.assign(task, updates);
    
    await this.store.setJSON(taskId, task);
    console.log(`📝 更新任务状态: ${taskId} -> ${status}`);
  }

  /**
   * 更新任务进度
   */
  async updateTaskProgress(taskId, progress, message) {
    await this.updateTaskStatus(taskId, 'running', {
      progress: progress,
      message: message
    });
  }

  /**
   * 设置任务结果
   */
  async setTaskResults(taskId, results) {
    const executionTime = await this.calculateExecutionTime(taskId);
    await this.updateTaskStatus(taskId, 'completed', {
      progress: 100,
      message: '优化完成',
      results: results,
      executionTime: executionTime
    });
  }

  /**
   * 设置任务错误
   */
  async setTaskError(taskId, error) {
    const executionTime = await this.calculateExecutionTime(taskId);
    await this.updateTaskStatus(taskId, 'failed', {
      message: '优化失败',
      error: error.message || error,
      executionTime: executionTime
    });
  }

  /**
   * 计算任务执行时间
   */
  async calculateExecutionTime(taskId) {
    const task = await this.getTask(taskId);
    if (!task) return null;
    
    const startTime = new Date(task.createdAt).getTime();
    const endTime = Date.now();
    return endTime - startTime;
  }

  /**
   * 异步执行优化任务（不阻塞主线程）
   */
  executeOptimizationTaskAsync(taskId, optimizationData) {
    // 使用setTimeout确保异步执行
    setTimeout(async () => {
      await this.executeOptimizationTask(taskId, optimizationData);
    }, 100);
  }

  /**
   * 执行优化任务的核心逻辑
   */
  async executeOptimizationTask(taskId, optimizationData) {
    try {
      console.log(`🚀 开始执行优化任务: ${taskId}`);
      
      // 更新状态为运行中
      await this.updateTaskProgress(taskId, 10, '正在初始化优化器...');
      
      // 获取优化服务实例
      const service = this.getOptimizationService();
      
      // 模拟进度更新
      await this.updateTaskProgress(taskId, 20, '正在解析输入数据...');
      
      // 执行优化计算
      await this.updateTaskProgress(taskId, 30, '正在计算最优切割方案...');
      
      const result = await service.optimizeSteel(optimizationData);
      
      if (result.success) {
        console.log(`✅ 优化任务完成: ${taskId}`);
        console.log('执行时间:', result.executionTime + 'ms');
        console.log('总损耗率:', result.result?.totalLossRate + '%');

        // 保存优化结果
        await this.setTaskResults(taskId, result.result);
        
      } else {
        console.log(`❌ 优化任务失败: ${taskId}`, result.error);
        await this.setTaskError(taskId, new Error(result.error || '优化计算失败'));
      }
      
    } catch (error) {
      console.error(`💥 执行优化任务异常: ${taskId}`, error);
      await this.setTaskError(taskId, error);
    }
  }

  /**
   * 获取优化服务实例
   */
  getOptimizationService() {
    if (OptimizationService) {
      return new OptimizationService();
    } else {
      // 创建模拟优化服务
      return this.createMockOptimizationService();
    }
  }

  /**
   * 创建模拟优化服务
   */
  createMockOptimizationService() {
    return {
      optimizeSteel: async (data) => {
        // 模拟计算时间
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return {
          success: true,
          result: {
            totalLossRate: 3.5,
            totalModuleUsed: 100,
            totalWaste: 50,
            solutions: {},
            executionTime: 2000,
            summary: `优化完成，处理了${data.designSteels?.length || 0}种设计钢材`
          },
          optimizationId: 'netlify_' + Date.now(),
          stats: { totalCuts: 10, remaindersGenerated: 5 }
        };
      }
    };
  }

  /**
   * 获取所有任务(内部使用，谨慎)
   */
  async getAllTasks() {
    const { blobs } = await this.store.list();
    const tasks = {};
    for (const blob of blobs) {
      tasks[blob.key] = await this.store.get(blob.key, { type: 'json' });
    }
    return tasks;
  }

  /**
   * 获取任务列表（带过滤和排序）
   */
  async getTaskList(options = {}) {
    const { limit = 20, status = null } = options;
    const { blobs } = await this.store.list();
    
    let taskList = [];
    for (const blob of blobs) {
      // 为了效率，我们可以只获取元数据，但这里为了简单起见，获取完整任务
      const task = await this.store.get(blob.key, { type: 'json' });
      if (task) {
        taskList.push(task);
      }
    }
    
    // 状态过滤
    if (status) {
      taskList = taskList.filter(task => task.status === status);
    }
    
    // 按创建时间倒序
    taskList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // 限制数量
    taskList = taskList.slice(0, limit);
    
    return taskList;
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId) {
    const task = await this.getTask(taskId);
    
    if (!task) {
      throw new Error('任务不存在');
    }
    
    if (task.status !== 'pending' && task.status !== 'running') {
      throw new Error('只能取消待执行或正在执行的任务');
    }
    
    await this.updateTaskStatus(taskId, 'cancelled', {
      message: '任务已被用户取消'
    });
    
    return true;
  }

  /**
   * 清理过期任务
   */
  async cleanupExpiredTasks() {
    await this.initialize();
    const { blobs } = await this.store.list();
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const blob of blobs) {
      // 优化：可以直接检查元数据中的时间戳，如果存储了的话
      const task = await this.store.get(blob.key, { type: 'json' });
      if (task) {
        const taskAge = now - new Date(task.createdAt).getTime();
        if (taskAge > this.maxTaskAge) {
          await this.store.delete(blob.key);
          cleanedCount++;
        }
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 清理了 ${cleanedCount} 个过期任务`);
    }
    
    return cleanedCount;
  }
}

module.exports = TaskManager; 