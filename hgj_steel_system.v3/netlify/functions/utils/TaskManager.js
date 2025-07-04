/**
 * Netlify异步任务管理器 - Neon PostgreSQL版本
 * 负责任务的创建、存储、状态更新
 */
const { neon } = require('@neondatabase/serverless');

class TaskManager {
  constructor() {
    // 从环境变量获取数据库连接字符串
    this.databaseUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
    this.sql = null;
    this.maxTaskAge = 24 * 60 * 60 * 1000; // 24小时
    this.isInitialized = false;
  }

  /**
   * 初始化数据库连接
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      if (!this.databaseUrl) {
        throw new Error('DATABASE_URL 环境变量未设置');
      }

      this.sql = neon(this.databaseUrl);
      await this.ensureTablesExist();
      this.isInitialized = true;
      console.log('🔧 任务管理器初始化完成 (Neon PostgreSQL)');
    } catch (error) {
      console.error('❌ 数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 确保必要的表存在
   */
  async ensureTablesExist() {
    try {
      await this.sql`
        CREATE TABLE IF NOT EXISTS optimization_tasks (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL DEFAULT 'optimization',
          status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
          progress INTEGER DEFAULT 0,
          message TEXT,
          input_data JSONB,
          results JSONB,
          error_message TEXT,
          execution_time INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
      await this.sql`CREATE INDEX IF NOT EXISTS idx_optimization_tasks_status ON optimization_tasks(status)`;
      await this.sql`CREATE INDEX IF NOT EXISTS idx_optimization_tasks_created_at ON optimization_tasks(created_at DESC)`;
      console.log('✅ 数据库表结构检查完成');
    } catch (error) {
      console.error('❌ 创建数据库表失败:', error);
      throw error;
    }
  }

  /**
   * 生成唯一任务ID
   */
  generateTaskId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 900000) + 100000;
    return `task_${timestamp}_${random}`;
  }

  /**
   * 仅创建待处理的任务记录，不执行
   */
  async createPendingTask(optimizationData) {
    try {
      await this.initialize();
      const taskId = this.generateTaskId();
      const result = await this.sql`
        INSERT INTO optimization_tasks (id, type, status, progress, message, input_data, created_at, updated_at) 
        VALUES (${taskId}, 'optimization', 'pending', 0, '任务已创建，等待后台工作者处理', ${JSON.stringify(optimizationData)}, NOW(), NOW())
        RETURNING id
      `;
      if (result.length === 0) throw new Error('任务创建失败');
      console.log(`✅ 创建待处理任务: ${taskId} (Neon PostgreSQL)`);
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
      await this.initialize();
      const result = await this.sql`
        SELECT id, type, status, progress, message, input_data, results, error_message, execution_time, created_at, updated_at
        FROM optimization_tasks WHERE id = ${taskId}
      `;
      if (result.length === 0) return null;
      const task = result[0];
      return {
        id: task.id, type: task.type, status: task.status, progress: task.progress, message: task.message,
        inputData: task.input_data, results: task.results, error: task.error_message,
        executionTime: task.execution_time, createdAt: task.created_at, updatedAt: task.updated_at
      };
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
      const updateFields = { status, updated_at: new Date(), ...updates };
      if (updates.results) updateFields.results = JSON.stringify(updates.results);
      
      await this.sql`
        UPDATE optimization_tasks 
        SET 
          status = ${updateFields.status},
          progress = COALESCE(${updateFields.progress}, progress),
          message = COALESCE(${updateFields.message}, message),
          results = COALESCE(${updateFields.results}, results),
          error_message = COALESCE(${updateFields.error}, error_message),
          execution_time = COALESCE(${updateFields.executionTime}, execution_time),
          updated_at = ${updateFields.updated_at}
        WHERE id = ${taskId}
      `;
      console.log(`📝 更新任务状态: ${taskId} -> ${status}`);
    } catch (error) {
      console.error(`❌ 更新任务[${taskId}]状态失败:`, error);
      throw error;
    }
  }

  /**
   * 更新任务进度
   */
  async updateTaskProgress(taskId, progress, message) {
    await this.updateTaskStatus(taskId, 'running', { progress, message });
  }

  /**
   * 设置任务结果
   */
  async setTaskResults(taskId, results) {
    const task = await this.getTask(taskId);
    if (!task) throw new Error(`任务 ${taskId} 不存在`);
    const executionTime = new Date(task.createdAt).getTime();
    await this.updateTaskStatus(taskId, 'completed', {
      progress: 100,
      message: '优化完成',
      results: results,
      executionTime: Date.now() - executionTime
    });
  }

  /**
   * 设置任务错误
   */
  async setTaskError(taskId, error) {
    await this.updateTaskStatus(taskId, 'failed', { error });
  }
}

module.exports = TaskManager; 