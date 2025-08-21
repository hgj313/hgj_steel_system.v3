/**
 * Netlify异步任务管理器 - 与系统核心一致的lowdb版本
 * 最终修复版：提供所有必需方法，职责单一
 */
const fs = require('fs');
const path = require('path');

class TaskManager {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', '..', 'database', 'steel_system.json');
    this.db = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // 模拟加载现有数据库文件
      let dbData = { optimizationTasks: [] };
      if (fs.existsSync(this.dbPath)) {
        const fileContent = fs.readFileSync(this.dbPath, 'utf8');
        dbData = JSON.parse(fileContent);
      }
      
      // 确保optimizationTasks数组存在
      if (!dbData.optimizationTasks) {
        dbData.optimizationTasks = [];
      }
      
      this.db = dbData;
      this.isInitialized = true;
      console.log('🔧 任务管理器初始化完成 (lowdb)');
    } catch (error) {
      console.error('❌ 任务管理器初始化失败:', error);
      throw new Error('任务管理器初始化失败');
    }
  }

  // 保存数据库更改到文件
  async saveDatabase() {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.db, null, 2));
    } catch (error) {
      console.error('❌ 保存数据库失败:', error);
      throw new Error('保存数据库失败');
    }
  }

  generateTaskId() {
    return `task_${Date.now()}_${Math.floor(Math.random() * 900000) + 100000}`;
  }

  async createPendingTask(optimizationData) {
    await this.initialize();
    const taskId = this.generateTaskId();
    
    const newTask = {
      id: taskId,
      type: 'optimization',
      status: 'pending',
      progress: 0,
      message: '任务已创建，等待后台处理',
      inputData: optimizationData,
      results: null,
      error: null,
      executionTime: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.db.optimizationTasks.push(newTask);
    await this.saveDatabase();
    console.log(`✅ 创建待处理任务: ${taskId}`);
    return taskId;
  }

  async getTask(taskId) {
    await this.initialize();
    const task = this.db.optimizationTasks.find(t => t.id === taskId);
    return task || null;
  }

  async updateTaskStatus(taskId, status, updates = {}) {
    await this.initialize();
    const taskIndex = this.db.optimizationTasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      throw new Error(`任务 ${taskId} 不存在`);
    }
    
    // 更新任务属性
    this.db.optimizationTasks[taskIndex].status = status;
    this.db.optimizationTasks[taskIndex].updatedAt = new Date().toISOString();
    
    // 应用其他更新字段
    if (updates.progress !== undefined) {
      this.db.optimizationTasks[taskIndex].progress = updates.progress;
    }
    if (updates.message) {
      this.db.optimizationTasks[taskIndex].message = updates.message;
    }
    if (updates.results !== undefined) {
      this.db.optimizationTasks[taskIndex].results = updates.results;
    }
    if (updates.error) {
      this.db.optimizationTasks[taskIndex].error = updates.error;
    }
    if (updates.executionTime !== undefined) {
      this.db.optimizationTasks[taskIndex].executionTime = updates.executionTime;
    }
    
    await this.saveDatabase();
    console.log(`📝 更新任务状态: ${taskId} -> ${status}`);
  }

  async updateTaskProgress(taskId, progress, message) {
    await this.updateTaskStatus(taskId, 'running', { progress, message });
  }

  async setTaskResults(taskId, results) {
    const task = await this.getTask(taskId);
    if (!task) throw new Error(`任务 ${taskId} 不存在`);
    const executionTime = new Date(task.createdAt).getTime();
    await this.updateTaskStatus(taskId, 'completed', {
      progress: 100, message: '优化完成', results,
      executionTime: Date.now() - executionTime
    });
  }

  async setTaskError(taskId, error) {
    await this.updateTaskStatus(taskId, 'failed', { error });
  }

  async getTaskList(options = {}) {
    await this.initialize();
    const { limit = 20, status = null } = options;
    
    // 筛选任务
    let filteredTasks = [...this.db.optimizationTasks];
    
    // 如果指定了状态，进行过滤
    if (status) {
      filteredTasks = filteredTasks.filter(task => task.status === status);
    }
    
    // 按创建时间降序排序
    filteredTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // 限制结果数量
    const limitedTasks = filteredTasks.slice(0, limit);
    
    // 返回与原始API兼容的结果结构
    return limitedTasks.map(task => ({
      id: task.id,
      status: task.status,
      progress: task.progress,
      message: task.message,
      execution_time: task.executionTime,
      created_at: task.createdAt
    }));
  }

  async cleanupExpiredTasks() {
    await this.initialize();
    
    // 计算24小时前的时间戳
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    // 筛选出需要清理的任务
    const tasksToKeep = this.db.optimizationTasks.filter(task => {
      // 保留未过期的任务或状态不是已完成、失败、取消的任务
      const taskCreatedAt = new Date(task.createdAt).getTime();
      const shouldKeep = taskCreatedAt >= twentyFourHoursAgo || 
                        !['completed', 'failed', 'cancelled'].includes(task.status);
      return shouldKeep;
    });
    
    // 计算被清理的任务数量
    const cleanedCount = this.db.optimizationTasks.length - tasksToKeep.length;
    
    // 更新任务列表
    this.db.optimizationTasks = tasksToKeep;
    
    // 保存更改
    if (cleanedCount > 0) {
      await this.saveDatabase();
      console.log(`🧹 清理了 ${cleanedCount} 个过期任务。`);
    }
    
    return cleanedCount;
  }
}

module.exports = TaskManager;