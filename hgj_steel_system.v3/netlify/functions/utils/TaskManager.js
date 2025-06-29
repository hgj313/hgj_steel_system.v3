/**
 * Netlify异步任务管理器 - Neon PostgreSQL版本
 * 负责任务的创建、存储、状态更新和异步执行
 * 使用Neon PostgreSQL作为持久化存储
 * 完整支持原始优化系统功能
 */

const { neon } = require('@neondatabase/serverless');
const path = require('path');

// 动态导入优化服务 - 使用绝对路径和更强的错误处理
let OptimizationService = null;
let optimizationServiceError = null;

// 尝试加载完整的优化服务
try {
  console.log('🔍 尝试加载完整的 OptimizationService...');
  
  // 使用绝对路径从项目根目录加载
  const servicePath = path.resolve(process.cwd(), 'api', 'services', 'OptimizationService.js');
  console.log(`📂 服务路径: ${servicePath}`);
  
  OptimizationService = require(servicePath);
  console.log('✅ OptimizationService 加载成功');
} catch (error) {
  console.warn('⚠️ OptimizationService 加载失败:', error.message);
  optimizationServiceError = error;
  
  // 尝试相对路径加载
  try {
    console.log('🔄 尝试相对路径加载...');
    OptimizationService = require('../../../api/services/OptimizationService');
    console.log('✅ OptimizationService 相对路径加载成功');
    optimizationServiceError = null;
  } catch (relativeError) {
    console.warn('⚠️ 相对路径加载也失败:', relativeError.message);
    optimizationServiceError = relativeError;
  }
}

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
      
      // 测试连接并确保表存在
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
      // 创建优化任务表（如果不存在）
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

      // 创建索引以提高查询性能
      await this.sql`
        CREATE INDEX IF NOT EXISTS idx_optimization_tasks_status 
        ON optimization_tasks(status)
      `;
      
      await this.sql`
        CREATE INDEX IF NOT EXISTS idx_optimization_tasks_created_at 
        ON optimization_tasks(created_at DESC)
      `;

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
    const random = Math.floor(Math.random() * 900000) + 100000; // 6位随机数
    return `task_${timestamp}_${random}`;
  }

  /**
   * 创建新的优化任务
   */
  async createOptimizationTask(optimizationData) {
    try {
      await this.initialize();

      const taskId = this.generateTaskId();
      
      const result = await this.sql`
        INSERT INTO optimization_tasks (
          id, type, status, progress, message, input_data, created_at, updated_at
        ) VALUES (
          ${taskId}, 
          'optimization', 
          'pending', 
          0, 
          '任务已创建，等待处理', 
          ${JSON.stringify(optimizationData)}, 
          NOW(), 
          NOW()
        )
        RETURNING id
      `;

      if (result.length === 0) {
        throw new Error('任务创建失败');
      }
      
      console.log(`✅ 创建优化任务: ${taskId} (Neon PostgreSQL)`);
      
      // 异步执行优化任务
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
      await this.initialize();
      
      const result = await this.sql`
        SELECT 
          id,
          type,
          status,
          progress,
          message,
          input_data,
          results,
          error_message,
          execution_time,
          created_at,
          updated_at
        FROM optimization_tasks 
        WHERE id = ${taskId}
      `;

      if (result.length === 0) {
        return null;
      }

      const task = result[0];
      
      // 转换数据格式以匹配前端期望
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
      
      const updateFields = {
        status: status,
        updated_at: new Date()
      };

      if (updates.progress !== undefined) {
        updateFields.progress = updates.progress;
      }
      if (updates.message !== undefined) {
        updateFields.message = updates.message;
      }
      if (updates.results !== undefined) {
        updateFields.results = JSON.stringify(updates.results);
      }
      if (updates.error !== undefined) {
        updateFields.error_message = updates.error;
      }
      if (updates.executionTime !== undefined) {
        updateFields.execution_time = updates.executionTime;
      }

      // 使用COALESCE确保即使传入null或undefined也不会覆盖已有值
      await this.sql`
        UPDATE optimization_tasks 
        SET 
          status = ${updateFields.status},
          progress = COALESCE(${updateFields.progress}, progress),
          message = COALESCE(${updateFields.message}, message),
          results = COALESCE(${updateFields.results}, results),
          error_message = COALESCE(${updateFields.error_message}, error_message),
          execution_time = COALESCE(${updateFields.execution_time}, execution_time),
          updated_at = ${updateFields.updated_at}
        WHERE id = ${taskId}
      `;

      console.log(`📝 更新任务状态: ${taskId} -> ${status} (Neon PostgreSQL)`);
    } catch (error) {
      console.error(`❌ 更新任务[${taskId}]状态失败:`, error);
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
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }
    
    const startTime = new Date(task.createdAt).getTime();
    const endTime = Date.now();
    const executionTime = endTime - startTime;

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
  async setTaskError(taskId, error, executionTime = null) {
    try {
      await this.initialize();
      const updates = { 
        error,
        ...(executionTime && { executionTime })
      };
      await this.updateTaskStatus(taskId, 'failed', updates);
      console.log(`[${taskId}] 任务已被标记为失败: ${error}`);
    } catch (dbError) {
      console.error(`[${taskId}] 更新任务错误状态失败:`, dbError);
    }
  }

  /**
   * 异步执行优化任务
   * 这是一个非阻塞的调用
   */
  executeOptimizationTaskAsync(taskId, optimizationData) {
    // 立即返回，不等待执行完成
    this.executeOptimizationTask(taskId, optimizationData).catch(error => {
      console.error(`[${taskId}] 异步任务执行的顶层捕获:`, error);
      // 确保即使出现意外错误，也尝试将任务标记为失败
      this.setTaskError(taskId, `一个意外的错误发生: ${error.message}`).catch(console.error);
    });
  }

  /**
   * 执行优化任务的实际逻辑
   */
  async executeOptimizationTask(taskId, optimizationData) {
    console.log(`[${taskId}] 开始执行优化任务...`);
    const startTime = Date.now();

    try {
      // 确保在异步执行上下文中初始化
      await this.initialize();

      // 步骤 1: 更新任务为"运行中"，进度10%
      console.log(`[${taskId}] 步骤 1/5: 更新任务状态为 'running', 进度 10%`);
      await this.updateTaskStatus(taskId, 'running', {
        progress: 10,
        message: '优化算法正在启动...'
      });

      // 步骤 2: 获取优化服务
      console.log(`[${taskId}] 步骤 2/5: 获取 OptimizationService`);
      const service = this.getOptimizationService();
      console.log(`[${taskId}] OptimizationService 获取成功`);

      // 步骤 3: 定义进度回调
      const progressCallback = async (progress, message) => {
        // 防止进度从10%回退到0%
        const newProgress = Math.max(10, Math.round(progress));
        console.log(`[${taskId}] 进度更新: ${newProgress}% - ${message}`);
        await this.updateTaskProgress(taskId, newProgress, message);
      };

      // 步骤 4: 运行优化算法
      console.log(`[${taskId}] 步骤 3/5: 调用 service.run()`);
      const results = await service.run(optimizationData, progressCallback);
      console.log(`[${taskId}] service.run() 完成`);
      
      const executionTime = Date.now() - startTime;

      // 步骤 5: 设置最终结果
      console.log(`[${taskId}] 步骤 4/5: 设置任务结果`);
      await this.setTaskResults(taskId, {
        ...results,
        executionTime: `${(executionTime / 1000).toFixed(2)}s`
      });
      console.log(`[${taskId}] 步骤 5/5: 任务成功完成`);

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`[${taskId}] 优化任务执行失败:`, error);
      await this.setTaskError(
        taskId, 
        `算法执行失败: ${error.message}`,
        executionTime
      );
    }
  }

  /**
   * 获取优化服务实例
   * 优先使用完整的 OptimizationService，确保功能完整性
   */
  getOptimizationService() {
    console.log(`🔍 检查 OptimizationService 可用性...`);
    
    if (OptimizationService && !optimizationServiceError) {
      console.log(`✅ 使用完整的 OptimizationService`);
      try {
        const service = new OptimizationService();
        console.log(`🎯 完整优化服务实例化成功`);
        return service;
      } catch (error) {
        console.error(`❌ 创建 OptimizationService 实例失败:`, error);
        console.error(`📋 详细错误信息:`, error.stack);
        
        // 记录依赖加载问题的详细信息
        this.logDependencyDiagnostics(error);
        
        throw new Error(`完整优化服务不可用: ${error.message}`);
      }
    } else {
      console.error(`❌ OptimizationService 不可用`);
      if (optimizationServiceError) {
        console.error(`📋 加载错误详情:`, optimizationServiceError.message);
        console.error(`📋 错误堆栈:`, optimizationServiceError.stack);
        this.logDependencyDiagnostics(optimizationServiceError);
      }
      
      throw new Error(`完整优化服务不可用，请检查依赖配置`);
    }
  }

  /**
   * 记录依赖诊断信息
   */
  logDependencyDiagnostics(error) {
    console.log(`\n🔍 === 依赖诊断信息 ===`);
    console.log(`📂 当前工作目录: ${process.cwd()}`);
    console.log(`🌐 Node.js 版本: ${process.version}`);
    console.log(`⚙️ 运行环境: ${process.env.NODE_ENV || 'unknown'}`);
    console.log(`🔧 Netlify 环境: ${process.env.NETLIFY ? 'Yes' : 'No'}`);
    
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log(`❌ 模块未找到错误: ${error.message}`);
      
      // 尝试检查文件是否存在
      const fs = require('fs');
      const possiblePaths = [
        path.resolve(process.cwd(), 'api', 'services', 'OptimizationService.js'),
        path.resolve(process.cwd(), 'core', 'optimizer', 'SteelOptimizerV3.js'),
        path.resolve(process.cwd(), 'api', 'types', 'index.js')
      ];
      
      possiblePaths.forEach(filePath => {
        try {
          const exists = fs.existsSync(filePath);
          console.log(`📁 ${filePath}: ${exists ? '✅ 存在' : '❌ 不存在'}`);
        } catch (checkError) {
          console.log(`📁 ${filePath}: ❓ 检查失败 - ${checkError.message}`);
        }
      });
    }
    
    console.log(`=== 依赖诊断信息结束 ===\n`);
  }

  /**
   * 获取任务列表（带过滤和排序）
   */
  async getTaskList(options = {}) {
    try {
      await this.initialize();
      
      const { limit = 20, status = null } = options;
      
      let query;
      if (status) {
        query = this.sql`
          SELECT 
            id, type, status, progress, message, 
            execution_time, created_at, updated_at
          FROM optimization_tasks 
          WHERE status = ${status}
          ORDER BY created_at DESC 
          LIMIT ${limit}
        `;
      } else {
        query = this.sql`
          SELECT 
            id, type, status, progress, message, 
            execution_time, created_at, updated_at
          FROM optimization_tasks 
          ORDER BY created_at DESC 
          LIMIT ${limit}
        `;
      }
      
      const result = await query;
      
      // 转换数据格式
      return result.map(task => ({
        id: task.id,
        type: task.type,
        status: task.status,
        progress: task.progress,
        message: task.message,
        executionTime: task.execution_time,
        createdAt: task.created_at,
        updatedAt: task.updated_at
      }));
    } catch (error) {
      console.error('❌ 获取任务列表失败:', error);
      return [];
    }
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
      
      const result = await this.sql`
        DELETE FROM optimization_tasks 
        WHERE created_at < NOW() - INTERVAL '24 hours'
        AND status IN ('completed', 'failed', 'cancelled')
        RETURNING id
      `;
      
      const cleanedCount = result.length;
      
      if (cleanedCount > 0) {
        console.log(`🧹 清理了 ${cleanedCount} 个过期任务 (Neon PostgreSQL)`);
      }
      
      return cleanedCount;
    } catch (error) {
      console.error('❌ 清理过期任务失败:', error);
      return 0;
    }
  }
}

module.exports = TaskManager; 