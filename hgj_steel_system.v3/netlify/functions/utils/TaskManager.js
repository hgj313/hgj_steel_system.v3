/**
 * Netlify异步任务管理器 - Neon PostgreSQL版本
 * 负责任务的创建、存储、状态更新和异步执行
 * 使用Neon PostgreSQL作为持久化存储
 */

const { neon } = require('@neondatabase/serverless');

// 动态导入优化服务
let OptimizationService;
try {
  OptimizationService = require('../../../api/services/OptimizationService');
} catch (error) {
  console.warn('优化服务未找到，将使用模拟模式');
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
      
      // 构建更新字段
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

      const result = await this.sql`
        UPDATE optimization_tasks 
        SET 
          status = ${updateFields.status},
          progress = ${updateFields.progress || 0},
          message = ${updateFields.message || ''},
          results = ${updateFields.results || null},
          error_message = ${updateFields.error_message || null},
          execution_time = ${updateFields.execution_time || null},
          updated_at = NOW()
        WHERE id = ${taskId}
        RETURNING id
      `;

      if (result.length === 0) {
        throw new Error(`任务 ${taskId} 不存在`);
      }
      
      console.log(`📝 更新任务状态: ${taskId} -> ${status} (Neon PostgreSQL)`);
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
  async setTaskError(taskId, error) {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }
    
    const startTime = new Date(task.createdAt).getTime();
    const endTime = Date.now();
    const executionTime = endTime - startTime;

    await this.updateTaskStatus(taskId, 'failed', {
      message: '优化失败',
      error: error.message || error,
      executionTime: executionTime
    });
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
      console.log(`📊 输入数据 - 设计钢材: ${optimizationData.designSteels?.length || 0}条`);
      console.log(`📊 输入数据 - 模数钢材: ${optimizationData.moduleSteels?.length || 0}条`);
      
      // 更新状态为运行中
      await this.updateTaskProgress(taskId, 10, '正在初始化优化器...');
      
      // 获取优化服务实例
      console.log(`🔧 正在获取优化服务实例...`);
      const service = this.getOptimizationService();
      console.log(`✅ 优化服务实例获取成功`);
      
      // 模拟进度更新
      await this.updateTaskProgress(taskId, 20, '正在解析输入数据...');
      
      // 执行优化计算
      await this.updateTaskProgress(taskId, 30, '正在计算最优切割方案...');
      
      console.log(`🧮 开始执行优化计算...`);
      const result = await service.optimizeSteel(optimizationData);
      console.log(`🧮 优化计算完成，结果:`, result.success ? '成功' : '失败');
      
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
      console.error(`💥 错误堆栈:`, error.stack);
      await this.setTaskError(taskId, error);
    }
  }

  /**
   * 获取优化服务实例
   */
  getOptimizationService() {
    console.log(`🔍 检查 OptimizationService 可用性...`);
    if (OptimizationService) {
      console.log(`✅ 使用真实的 OptimizationService`);
      try {
        return new OptimizationService();
      } catch (error) {
        console.error(`❌ 创建 OptimizationService 失败:`, error);
        console.log(`🔄 降级到模拟优化服务`);
        return this.createMockOptimizationService();
      }
    } else {
      console.log(`⚠️ OptimizationService 不可用，使用模拟优化服务`);
      return this.createMockOptimizationService();
    }
  }

  /**
   * 创建模拟优化服务
   */
  createMockOptimizationService() {
    console.log(`🎭 创建模拟优化服务`);
    return {
      optimizeSteel: async (data) => {
        console.log(`🎭 模拟优化开始，输入数据:`, {
          designSteels: data.designSteels?.length || 0,
          moduleSteels: data.moduleSteels?.length || 0
        });
        
        // 模拟计算时间
        console.log(`⏰ 模拟计算中...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log(`🎭 模拟优化完成`);
        
        return {
          success: true,
          result: {
            totalLossRate: 3.5,
            totalModuleUsed: 100,
            totalWaste: 50,
            solutions: {
              'Q235_6': {
                cuttingPlans: [
                  {
                    moduleLength: 12000,
                    cuts: [
                      { designId: 'design_1', length: 6000, quantity: 2 }
                    ],
                    waste: 0,
                    efficiency: 100
                  }
                ]
              }
            },
            executionTime: 3000,
            summary: `模拟优化完成，处理了${data.designSteels?.length || 0}种设计钢材`,
            completeStats: {
              totalStats: {
                totalModuleCount: 1,
                totalModuleLength: 12000,
                totalWaste: 0,
                overallLossRate: 3.5
              }
            }
          },
          optimizationId: 'netlify_mock_' + Date.now(),
          stats: { totalCuts: 2, remaindersGenerated: 0 }
        };
      }
    };
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