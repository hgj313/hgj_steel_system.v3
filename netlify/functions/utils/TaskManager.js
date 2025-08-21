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
      input_data: optimizationData,
      results: null,
      error_message: null,
      execution_time: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    this.db.optimizationTasks.push(newTask);
    await this.saveDatabase();
    
    console.log(`✅ 创建待处理任务: ${taskId}`);
    return taskId;
  }

  async getTask(taskId) {
    await this.initialize();
    const task = this.db.optimizationTasks.find(t => t.id === taskId);
    if (!task) return null;
    
    return {
      id: task.id, 
      type: task.type, 
      status: task.status, 
      progress: task.progress, 
      message: task.message,
      inputData: task.input_data, 
      results: task.results, 
      error: task.error_message,
      executionTime: task.execution_time, 
      createdAt: task.created_at, 
      updatedAt: task.updated_at
    };
  }

  async updateTaskStatus(taskId, status, updates = {}) {
    await this.initialize();
    const taskIndex = this.db.optimizationTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      throw new Error(`任务 ${taskId} 不存在`);
    }
    
    const task = this.db.optimizationTasks[taskIndex];
    task.status = status;
    task.updated_at = new Date().toISOString();
    
    if (updates.progress !== undefined) {
      task.progress = updates.progress;
    }
    if (updates.message !== undefined) {
      task.message = updates.message;
    }
    if (updates.results !== undefined) {
      task.results = updates.results;
    }
    if (updates.error !== undefined) {
      task.error_message = updates.error;
    }
    if (updates.executionTime !== undefined) {
      task.execution_time = updates.executionTime;
    }
    
    this.db.optimizationTasks[taskIndex] = task;
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
    
    let tasks = [...this.db.optimizationTasks];
    
    // 按创建时间倒序排序
    tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // 过滤状态
    if (status) {
      tasks = tasks.filter(task => task.status === status);
    }
    
    // 限制数量
    tasks = tasks.slice(0, limit);
    
    // 转换格式
    return tasks.map(task => ({
      id: task.id,
      status: task.status,
      progress: task.progress,
      message: task.message,
      execution_time: task.execution_time,
      created_at: task.created_at
    }));
  }

  async cleanupExpiredTasks() {
    await this.initialize();
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const initialLength = this.db.optimizationTasks.length;
    this.db.optimizationTasks = this.db.optimizationTasks.filter(task => {
      const taskCreatedAt = new Date(task.created_at);
      const isExpired = taskCreatedAt < twentyFourHoursAgo && 
                       ['completed', 'failed', 'cancelled'].includes(task.status);
      return !isExpired;
    });
    
    const deletedCount = initialLength - this.db.optimizationTasks.length;
    if (deletedCount > 0) {
      await this.saveDatabase();
      console.log(`🧹 清理了 ${deletedCount} 个过期任务。`);
    }
    
    return deletedCount;
  }
}

module.exports = TaskManager;