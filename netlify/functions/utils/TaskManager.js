/**
 * Netlify异步任务管理器 - 与系统核心一致的lowdb版本
 * 增强版：统一数据结构命名，完善错误处理，详细日志记录
 */
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const fs = require('fs').promises;
const path = require('path');
const fsSync = require('fs');

class TaskManager {
  constructor() {
    // 针对不同环境使用不同的数据库路径
    // 在Netlify Functions中，使用/tmp目录（唯一可写的目录）
    // 本地开发环境使用相对路径
    const isNetlify = process.env.NETLIFY === 'true' || process.env.URL?.includes('netlify.app');
    this.dbPath = process.env.DB_PATH || 
                  (isNetlify ? 
                   path.join('/tmp', 'steel_system.json') : 
                   path.join(__dirname, '..', '..', '..', 'server', 'database', 'steel_system.json'));
    this.db = null;
    this.isInitialized = false;
    this.initPromise = null;
  }

  async initialize() {
    // 防止重复初始化，尤其在异步环境下
    if (this.initPromise) {
      return this.initPromise;
    }
    
    if (this.isInitialized) return;
    
    console.log(`🔧 开始初始化TaskManager，环境: ${process.env.NETLIFY === 'true' ? 'Netlify' : 'Local'}`);
    console.log(`📁 数据库路径: ${this.dbPath}`);
    
    this.initPromise = (async () => {
      try {
        // 确保数据库目录存在
        const dbDir = path.dirname(this.dbPath);
        console.log(`🔍 检查数据库目录: ${dbDir}`);
        
        try {
          await fs.access(dbDir);
          console.log(`✅ 数据库目录已存在: ${dbDir}`);
        } catch (accessError) {
          console.log(`📁 数据库目录不存在，创建中: ${dbDir}`);
          try {
            await fs.mkdir(dbDir, { recursive: true });
            console.log(`✅ 数据库目录创建成功: ${dbDir}`);
          } catch (mkdirError) {
            console.error('❌ 创建数据库目录失败:', mkdirError);
            throw new Error(`创建数据库目录失败: ${mkdirError.message}`);
          }
        }

        // 使用lowdb初始化数据库
        console.log(`📚 初始化lowdb数据库...`);
        
        // 检查文件是否存在，如果不存在，创建一个空的JSON文件
        try {
          await fs.access(this.dbPath);
          console.log(`✅ 数据库文件已存在: ${this.dbPath}`);
        } catch (fileError) {
          console.log(`📝 数据库文件不存在，创建空文件: ${this.dbPath}`);
          try {
            await fs.writeFile(this.dbPath, '{}', 'utf8');
            console.log(`✅ 空数据库文件创建成功`);
          } catch (writeError) {
            console.error('❌ 创建数据库文件失败:', writeError);
            throw new Error(`创建数据库文件失败: ${writeError.message}`);
          }
        }
        
        const adapter = new JSONFile(this.dbPath);
        this.db = new Low(adapter, { optimizationTasks: [] });
        
        // 读取数据库
        console.log(`📖 读取数据库文件...`);
        try {
          await this.db.read();
          console.log(`✅ 数据库读取成功`);
        } catch (readError) {
          console.error('❌ 数据库读取失败，可能是文件格式错误:', readError);
          // 尝试重置数据库
          console.log('🔄 尝试重置数据库...');
          this.db.data = { optimizationTasks: [] };
          await this.db.write();
          console.log(`✅ 数据库已重置`);
        }
        
        // 确保optimizationTasks数组存在
        if (!this.db.data.optimizationTasks) {
          console.log(`🚨 optimizationTasks数组不存在，创建中...`);
          this.db.data.optimizationTasks = [];
          await this.db.write();
          console.log(`✅ optimizationTasks数组创建成功`);
        }
        
        this.isInitialized = true;
        console.log('✅ 任务管理器初始化完成 (lowdb)');
        return true;
      } catch (error) {
        console.error('❌ 任务管理器初始化失败:', error);
        console.error('❌ 错误详情:', error.stack);
        throw new Error(`任务管理器初始化失败: ${error.message}`);
      }
    })();
    
    return this.initPromise;
  }

  // 保存数据库更改到文件 - 增强版：增加重试机制和更详细的日志
  async saveDatabase(maxRetries = 3, retryDelay = 100) {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        console.log(`💾 开始保存数据库到: ${this.dbPath}`);
        await this.db.write();
        
        // 验证保存是否成功
        const adapter = new this.db.adapter.constructor(this.dbPath);
        const tempDb = new Low(adapter, { optimizationTasks: [] });
        await tempDb.read();
        
        console.log(`✅ 数据库保存成功，当前任务总数: ${tempDb.data.optimizationTasks?.length || 0}`);
        return true;
      } catch (error) {
        retries++;
        console.error(`❌ 保存数据库失败 (尝试 ${retries}/${maxRetries}):`, error.message);
        
        if (retries >= maxRetries) {
          console.error('❌ 数据库保存最终失败，所有重试均失败');
          throw new Error(`保存数据库失败，已尝试 ${maxRetries} 次: ${error.message}`);
        }
        
        console.log(`🔄 等待 ${retryDelay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2; // 指数退避
      }
    }
    return false;
  }

  generateTaskId() {
    return `task_${Date.now()}_${Math.floor(Math.random() * 900000) + 100000}`;
  }

  async createPendingTask(optimizationData) {
    try {
      await this.initialize();
      const taskId = this.generateTaskId();
      
      console.log(`📝 准备创建任务: ${taskId}`);
      
      // 统一使用驼峰命名风格，与客户端保持一致
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
      
      this.db.data.optimizationTasks.push(newTask);
      
      console.log(`💾 保存新任务到数据库: ${taskId}`);
      await this.saveDatabase();
      
      console.log(`✅ 创建待处理任务成功: ${taskId}`);
      return taskId;
    } catch (error) {
      console.error('❌ 创建任务失败:', error);
      throw new Error(`创建任务失败: ${error.message}`);
    }
  }

  async getTask(taskId) {
    try {
      // 确保数据库已初始化
      await this.initialize();
      
      // 重新读取数据库以获取最新状态，不依赖内存缓存
      console.log(`🔍 查找任务: ${taskId} (重新读取数据库)`);
      
      // 创建新的数据库实例以确保读取最新数据
      const adapter = new this.db.adapter.constructor(this.dbPath);
      const tempDb = new Low(adapter, { optimizationTasks: [] });
      await tempDb.read();
      
      // 确保optimizationTasks数组存在
      if (!tempDb.data.optimizationTasks) {
        tempDb.data.optimizationTasks = [];
      }
      
      const task = tempDb.data.optimizationTasks.find(t => t.id === taskId);
      
      if (!task) {
        console.log(`⚠️ 任务不存在: ${taskId} (数据库中未找到)`);
        return null;
      }
      
      console.log(`✅ 找到任务: ${taskId}, 状态: ${task.status}`);
      
      // 返回任务信息
      return {
        id: task.id, 
        type: task.type, 
        status: task.status, 
        progress: task.progress, 
        message: task.message,
        inputData: task.inputData, 
        results: task.results, 
        error: task.error,
        executionTime: task.executionTime, 
        createdAt: task.createdAt, 
        updatedAt: task.updatedAt
      };
    } catch (error) {
      console.error('❌ 获取任务失败:', error);
      throw new Error(`获取任务失败: ${error.message}`);
    }
  }

  async updateTaskStatus(taskId, status, updates = {}) {
    try {
      await this.initialize();
      console.log(`🔄 准备更新任务状态: ${taskId} -> ${status}`);
      
      const taskIndex = this.db.data.optimizationTasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) {
        console.error(`❌ 任务不存在: ${taskId}`);
        throw new Error(`任务 ${taskId} 不存在`);
      }
      
      const task = this.db.data.optimizationTasks[taskIndex];
      task.status = status;
      task.updatedAt = new Date().toISOString();
      
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
        task.error = updates.error;
      }
      if (updates.executionTime !== undefined) {
        task.executionTime = updates.executionTime;
      }
      
      this.db.data.optimizationTasks[taskIndex] = task;
      
      console.log(`💾 保存更新后的任务状态: ${taskId}`);
      await this.saveDatabase();
      
      console.log(`✅ 更新任务状态成功: ${taskId} -> ${status}`);
    } catch (error) {
      console.error('❌ 更新任务状态失败:', error);
      throw new Error(`更新任务状态失败: ${error.message}`);
    }
  }

  async updateTaskProgress(taskId, progress, message) {
    await this.updateTaskStatus(taskId, 'running', { progress, message });
  }

  async setTaskResults(taskId, results) {
    try {
      console.log(`🏁 准备设置任务结果: ${taskId}`);
      
      const task = await this.getTask(taskId);
      if (!task) {
        console.error(`❌ 任务不存在: ${taskId}`);
        throw new Error(`任务 ${taskId} 不存在`);
      }
      
      const createdAtTime = new Date(task.createdAt).getTime();
      const executionTime = Date.now() - createdAtTime;
      
      console.log(`✅ 任务计算完成，执行时间: ${executionTime}ms`);
      
      await this.updateTaskStatus(taskId, 'completed', {
        progress: 100, 
        message: '优化完成', 
        results,
        executionTime: `${(executionTime / 1000).toFixed(2)}s`
      });
      
      console.log(`✅ 任务结果已保存: ${taskId}`);
    } catch (error) {
      console.error('❌ 设置任务结果失败:', error);
      throw new Error(`设置任务结果失败: ${error.message}`);
    }
  }

  async setTaskError(taskId, error) {
    try {
      console.log(`❌ 准备标记任务为失败: ${taskId}`);
      
      await this.updateTaskStatus(taskId, 'failed', { error });
      
      console.log(`✅ 任务已标记为失败: ${taskId}`);
    } catch (updateError) {
      console.error('❌ 标记任务失败状态失败:', updateError);
      throw new Error(`标记任务失败状态失败: ${updateError.message}`);
    }
  }

  async getTaskList(options = {}) {
    try {
      await this.initialize();
      console.log(`📋 获取任务列表，选项:`, JSON.stringify(options));
      
      const { limit = 20, status = null } = options;
      
      let tasks = [...this.db.data.optimizationTasks];
      
      // 按创建时间倒序排序
      tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // 过滤状态
      if (status) {
        tasks = tasks.filter(task => task.status === status);
        console.log(`🔍 按状态过滤后任务数量: ${tasks.length}`);
      }
      
      // 限制数量
      tasks = tasks.slice(0, limit);
      
      console.log(`✅ 获取任务列表成功，返回数量: ${tasks.length}`);
      
      // 转换格式，保持一致的驼峰命名
      return tasks.map(task => ({
        id: task.id,
        status: task.status,
        progress: task.progress,
        message: task.message,
        executionTime: task.executionTime,
        createdAt: task.createdAt
      }));
    } catch (error) {
      console.error('❌ 获取任务列表失败:', error);
      throw new Error(`获取任务列表失败: ${error.message}`);
    }
  }

  async cleanupExpiredTasks() {
    try {
      await this.initialize();
      console.log(`🧹 开始清理过期任务...`);
      
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const initialLength = this.db.data.optimizationTasks.length;
      
      // 使用驼峰命名的createdAt字段
      this.db.data.optimizationTasks = this.db.data.optimizationTasks.filter(task => {
        const taskCreatedAt = new Date(task.createdAt);
        const isExpired = taskCreatedAt < twentyFourHoursAgo && 
                         ['completed', 'failed', 'cancelled'].includes(task.status);
        return !isExpired;
      });
      
      const deletedCount = initialLength - this.db.data.optimizationTasks.length;
      if (deletedCount > 0) {
        console.log(`💾 保存清理后的数据库，删除了 ${deletedCount} 个过期任务`);
        await this.saveDatabase();
        console.log(`✅ 成功清理了 ${deletedCount} 个过期任务`);
      } else {
        console.log(`✅ 没有需要清理的过期任务`);
      }
      
      return deletedCount;
    } catch (error) {
      console.error('❌ 清理过期任务失败:', error);
      throw new Error(`清理过期任务失败: ${error.message}`);
    }
  }
}

module.exports = TaskManager;