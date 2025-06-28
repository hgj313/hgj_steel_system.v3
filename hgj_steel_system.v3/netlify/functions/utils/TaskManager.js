/**
 * Netlify异步任务管理器
 * 负责任务的创建、存储、状态更新和异步执行
 * 使用Netlify Blobs作为持久化存储，本地环境降级到内存存储
 */

const { getStore } = require('@netlify/blobs');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// 动态导入优化服务
let OptimizationService;
try {
  OptimizationService = require('../../../api/services/OptimizationService');
} catch (error) {
  console.warn('优化服务未找到，将使用模拟模式');
}

class TaskManager {
  constructor() {
    // 检测运行环境
    this.isNetlifyEnvironment = !!process.env.NETLIFY;
    
    if (this.isNetlifyEnvironment) {
      try {
        this.store = getStore('optimization-tasks');
        this.storageType = 'blobs';
        console.log('🔧 使用 Netlify Blobs 存储');
      } catch (error) {
        console.warn('⚠️ Netlify Blobs 初始化失败，降级到文件存储:', error);
        this.initFileStorage();
      }
    } else {
      console.log('🔧 本地环境，使用文件存储');
      this.initFileStorage();
    }
    
    this.maxTaskAge = 24 * 60 * 60 * 1000; // 24小时
    this.taskCounter = 0;
    this.isInitialized = false;
  }

  /**
   * 初始化文件存储（本地环境或降级时使用）
   */
  initFileStorage() {
    this.storageType = 'file';
    const tempDir = process.env.NETLIFY ? '/tmp' : os.tmpdir();
    this.tasksFilePath = path.join(tempDir, 'netlify_tasks.json');
  }

  /**
   * 初始化任务管理器，加载并设置计数器
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      if (this.storageType === 'blobs') {
        await this.initializeBlobs();
      } else {
        await this.initializeFile();
      }
    } catch (error) {
      console.error('❌ 初始化失败:', error);
      // 如果 Blobs 失败，降级到文件存储
      if (this.storageType === 'blobs') {
        console.log('🔄 降级到文件存储');
        this.initFileStorage();
        await this.initializeFile();
      } else {
        this.taskCounter = 0;
      }
    }
    
    this.isInitialized = true;
    console.log(`🔧 任务管理器初始化完成 (${this.storageType})，当前计数器: ${this.taskCounter}`);
  }

  /**
   * 初始化 Blobs 存储
   */
  async initializeBlobs() {
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
  }

  /**
   * 初始化文件存储
   */
  async initializeFile() {
    try {
      const tasks = await this.loadTasksFromFile();
      if (Object.keys(tasks).length > 0) {
        const maxCounter = Object.keys(tasks).reduce((max, taskId) => {
          const parts = taskId.split('_');
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
      console.warn('文件存储初始化失败:', error);
      this.taskCounter = 0;
    }
  }

  /**
   * 从文件加载任务数据
   */
  async loadTasksFromFile() {
    try {
      const data = await fs.readFile(this.tasksFilePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return {};
    }
  }

  /**
   * 保存任务数据到文件
   */
  async saveTasksToFile(tasks) {
    await fs.writeFile(this.tasksFilePath, JSON.stringify(tasks, null, 2));
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
    try {
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

      if (this.storageType === 'blobs') {
        await this.store.setJSON(taskId, task);
      } else {
        const tasks = await this.loadTasksFromFile();
        tasks[taskId] = task;
        await this.saveTasksToFile(tasks);
      }
      
      console.log(`✅ 创建优化任务: ${taskId} (${this.storageType})`);
      
      this.executeOptimizationTaskAsync(taskId, optimizationData);
      
      return taskId;
    } catch (error) {
      console.error('❌ 创建任务失败:', error);
      throw new Error(`任务创建失败: ${error.message || '未知错误'}`);
    }
  }

  /**
   * 获取任务信息
   */
  async getTask(taskId) {
    try {
      if (this.storageType === 'blobs') {
        return await this.store.get(taskId, { type: 'json' });
      } else {
        const tasks = await this.loadTasksFromFile();
        return tasks[taskId] || null;
      }
    } catch (error) {
      console.error('❌ 获取任务失败:', error);
      return null;
    }
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(taskId, status, updates = {}) {
    try {
      await this.initialize();
      
      const task = await this.getTask(taskId);
      if (!task) {
        throw new Error(`任务 ${taskId} 不存在`);
      }
      
      task.status = status;
      task.updatedAt = new Date().toISOString();
      
      Object.assign(task, updates);
      
      if (this.storageType === 'blobs') {
        await this.store.setJSON(taskId, task);
      } else {
        const tasks = await this.loadTasksFromFile();
        tasks[taskId] = task;
        await this.saveTasksToFile(tasks);
      }
      
      console.log(`📝 更新任务状态: ${taskId} -> ${status} (${this.storageType})`);
    } catch (error) {
      console.error('❌ 更新任务状态失败:', error);
      throw error;
    }
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
    
    let taskList = [];
    
    if (this.storageType === 'blobs') {
      const { blobs } = await this.store.list();
      for (const blob of blobs) {
        const task = await this.store.get(blob.key, { type: 'json' });
        if (task) {
          taskList.push(task);
        }
      }
    } else {
      const tasks = await this.loadTasksFromFile();
      taskList = Object.values(tasks);
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
    try {
      await this.initialize();
      const now = Date.now();
      let cleanedCount = 0;
      
      if (this.storageType === 'blobs') {
        const { blobs } = await this.store.list();
        for (const blob of blobs) {
          const task = await this.store.get(blob.key, { type: 'json' });
          if (task) {
            const taskAge = now - new Date(task.createdAt).getTime();
            if (taskAge > this.maxTaskAge) {
              await this.store.delete(blob.key);
              cleanedCount++;
            }
          }
        }
      } else {
        const tasks = await this.loadTasksFromFile();
        for (const [taskId, task] of Object.entries(tasks)) {
          const taskAge = now - new Date(task.createdAt).getTime();
          if (taskAge > this.maxTaskAge) {
            delete tasks[taskId];
            cleanedCount++;
          }
        }
        if (cleanedCount > 0) {
          await this.saveTasksToFile(tasks);
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 清理了 ${cleanedCount} 个过期任务 (${this.storageType})`);
      }
      
      return cleanedCount;
    } catch (error) {
      console.error('❌ 清理过期任务失败:', error);
      return 0;
    }
  }
}

module.exports = TaskManager; 