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
    
    // 改进的路径处理，确保跨平台兼容性
    let dbPath;
    if (process.env.DB_PATH) {
      dbPath = process.env.DB_PATH;
    } else if (isNetlify) {
      // 在Netlify环境中使用绝对路径的/tmp目录
      dbPath = path.posix.join('/tmp', 'steel_system.json');
    } else {
      // 在本地环境中使用相对路径
      dbPath = path.join(__dirname, '..', '..', '..', 'server', 'database', 'steel_system.json');
    }
    
    // 标准化路径格式，处理不同操作系统的差异
    this.dbPath = path.normalize(dbPath);
    
    this.db = null;
    this.isInitialized = false;
    this.initPromise = null;
    
    console.log(`📊 TaskManager初始化配置: 环境=${isNetlify ? 'Netlify' : 'Local'}, 数据库路径=${this.dbPath}`);
  }

  async initialize() {
    // 防止重复初始化，尤其在异步环境下
    if (this.initPromise) {
      console.log(`🔄 初始化已在进行中，重用现有promise`);
      return this.initPromise;
    }
    
    if (this.isInitialized) {
      console.log(`✅ TaskManager已初始化，跳过初始化步骤`);
      return;
    }
    
    const isNetlify = process.env.NETLIFY === 'true' || process.env.URL?.includes('netlify.app');
    console.log(`🔧 开始初始化TaskManager，环境: ${isNetlify ? 'Netlify' : 'Local'}`);
    console.log(`📁 数据库路径: ${this.dbPath}`);
    
    // 增加初始化超时保护
    this.initPromise = Promise.race([
      (async () => {
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
            // 在Netlify环境中，如果创建目录失败，尝试使用备用路径
            if (isNetlify) {
              console.log('🔄 在Netlify环境中尝试备用路径...');
              // 尝试使用process.cwd()作为备用
              this.dbPath = path.join(process.cwd(), 'steel_system.json');
              console.log(`📁 切换到备用数据库路径: ${this.dbPath}`);
              dbDir = path.dirname(this.dbPath);
              try {
                await fs.mkdir(dbDir, { recursive: true });
                console.log(`✅ 备用数据库目录创建成功: ${dbDir}`);
              } catch (backupMkdirError) {
                console.error('❌ 备用数据库目录创建也失败:', backupMkdirError);
                throw new Error(`创建数据库目录失败: ${mkdirError.message}`);
              }
            } else {
              throw new Error(`创建数据库目录失败: ${mkdirError.message}`);
            }
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
        try {
          await this.db.write();
          console.log(`✅ 数据库已重置`);
        } catch (writeError) {
          console.error('❌ 数据库重置失败:', writeError);
          throw new Error(`数据库重置失败: ${writeError.message}`);
        }
        }
        
        // 确保optimizationTasks数组存在
        if (!this.db.data.optimizationTasks) {
          console.log(`🚨 optimizationTasks数组不存在，创建中...`);
          this.db.data.optimizationTasks = [];
          try {
            await this.db.write();
            console.log(`✅ optimizationTasks数组创建成功`);
          } catch (writeError) {
            console.error('❌ 创建optimizationTasks数组失败:', writeError);
            // 即使写入失败，我们仍然继续，因为数组已在内存中创建
            console.log('⚠️ 继续使用内存中的optimizationTasks数组');
          }
        }
        
        console.log(`📊 数据库初始状态: 任务总数=${this.db.data.optimizationTasks?.length || 0}`);
        
        this.isInitialized = true;
        console.log('✅ 任务管理器初始化完成 (lowdb)');
        return true;
      } catch (error) {
        console.error('❌ 任务管理器初始化失败:', error);
        console.error('❌ 错误详情:', error.stack);
        throw new Error(`任务管理器初始化失败: ${error.message}`);
      }
    })(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('初始化超时: 超过5秒未能完成初始化')), 5000);
    })
  ]).finally(() => {
    // 无论成功失败，都重置initPromise，以便下次可以重新尝试初始化
    this.initPromise = null;
  });
  
  return this.initPromise;
  }

  // 保存数据库更改到文件 - 增强版：增加重试机制和更详细的日志
  async saveDatabase(maxRetries = 3, retryDelay = 100) {
    // 确保初始化完成
    if (!this.isInitialized) {
      console.log('⚠️ 数据库未初始化，尝试初始化...');
      try {
        await this.initialize();
      } catch (error) {
        console.error('❌ 初始化失败，无法保存数据库:', error);
        throw error;
      }
    }
    
    const isNetlify = process.env.NETLIFY === 'true' || process.env.URL?.includes('netlify.app');
    
    try {
      // 添加重试逻辑，处理临时文件系统问题
      let retries = 0;
      while (retries < maxRetries) {
        try {
          // 在Netlify环境中，为了增加可靠性，先写入临时文件，再重命名
          if (isNetlify) {
            console.log('🌐 在Netlify环境中使用临时文件策略保存数据库');
            
            // 1. 创建临时文件路径
            const tempDbPath = `${this.dbPath}.tmp.${Date.now()}`;
            
            // 2. 写入临时文件
            const tempAdapter = new this.db.adapter.constructor(tempDbPath);
            const tempDb = new Low(tempAdapter);
            tempDb.data = JSON.parse(JSON.stringify(this.db.data)); // 深拷贝数据
            await tempDb.write();
            
            // 3. 重命名临时文件为目标文件（原子操作）
            try {
              // 先尝试删除目标文件（如果存在）
              try {
                await fs.unlink(this.dbPath);
              } catch (unlinkError) {
                // 如果文件不存在，忽略错误
                if (unlinkError.code !== 'ENOENT') throw unlinkError;
              }
              // 在Windows上，需要使用特殊处理
              if (process.platform === 'win32') {
                // 直接覆盖文件（在Windows上重命名可能会有问题）
                await fs.copyFile(tempDbPath, this.dbPath);
                // 复制成功后删除临时文件
                await fs.unlink(tempDbPath);
              } else {
                // 在非Windows系统上执行原子重命名
                await fs.rename(tempDbPath, this.dbPath);
              }
            } catch (renameError) {
              console.error('❌ 重命名临时文件失败:', renameError);
              // 清理临时文件
              try { await fs.unlink(tempDbPath); } catch {}
              throw renameError;
            }
            
            console.log(`✅ 数据库通过临时文件策略保存成功: ${this.dbPath}`);
          } else {
            // 在本地环境中，使用标准的写入方法
            await this.db.write();
            console.log(`✅ 数据库标准保存成功: ${this.dbPath}`);
          }
          
          // 验证保存是否成功
          const adapter = new this.db.adapter.constructor(this.dbPath);
          const tempDb = new Low(adapter, { optimizationTasks: [] });
          await tempDb.read();
          
          console.log(`✅ 数据库保存成功，当前任务总数: ${tempDb.data.optimizationTasks?.length || 0}`);
          return true;
        } catch (error) {
          retries++;
          if (retries >= maxRetries) {
            console.error('❌ 数据库保存最终失败，所有重试均失败:', error);
            
            // 在Netlify环境中，如果保存失败，尝试使用备用路径
            if (isNetlify) {
              try {
                const backupDbPath = path.join('/tmp', `steel_system_backup_${Date.now()}.json`);
                console.log(`🔄 尝试使用备用路径保存数据库: ${backupDbPath}`);
                
                const backupAdapter = new this.db.adapter.constructor(backupDbPath);
                const backupDb = new Low(backupAdapter);
                backupDb.data = JSON.parse(JSON.stringify(this.db.data)); // 深拷贝数据
                await backupDb.write();
                
                console.log(`✅ 数据库已保存到备用路径: ${backupDbPath}`);
                // 返回true，因为我们成功保存了数据，只是路径不同
                return true;
              } catch (backupError) {
                console.error('❌ 备用路径保存也失败:', backupError);
                // 备用路径也失败，抛出原始错误
              }
            }
            
            throw new Error(`保存数据库失败，已尝试 ${maxRetries} 次: ${error.message}`);
          }
          console.warn(`⚠️ 数据库保存失败，${maxRetries - retries}次重试中...`, error);
          // 等待一段时间后重试，时间逐渐增加
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryDelay *= 2; // 指数退避
        }
      }
    } catch (error) {
      console.error('❌ 数据库保存操作异常:', error);
      console.error('❌ 错误详情:', error.stack);
      throw error;
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
    // 输入验证
    if (!taskId || typeof taskId !== 'string') {
      console.error('❌ 无效的任务ID:', taskId);
      return null;
    }
    
    console.log(`🔍 开始查询任务: ID=${taskId}`);
    
    // 确保初始化完成
    try {
      await this.initialize();
    } catch (initError) {
      console.error('❌ 初始化失败，无法查询任务:', initError);
      return null;
    }
    
    const isNetlify = process.env.NETLIFY === 'true' || process.env.URL?.includes('netlify.app');
    const env = isNetlify ? 'Netlify' : 'Local';
    
    // 环境信息日志
    console.log(`📊 查询环境: ${env}, 数据库路径=${this.dbPath}`);
    
    // 定义查询策略数组，按优先级尝试不同的查询方法
    const queryStrategies = [
      // 策略1: 在Netlify环境中，每次都重新读取文件以获取最新状态
      async () => {
        if (!isNetlify) return null; // 只在Netlify环境中使用
        console.log('🌐 策略1: 重新读取数据库文件以获取最新状态');
        try {
          // 创建一个临时的lowdb实例，仅用于读取最新的数据库状态
          const adapter = new this.db.adapter.constructor(this.dbPath);
          const tempDb = new Low(adapter, { optimizationTasks: [] });
          await tempDb.read();
          const task = tempDb.data.optimizationTasks?.find(t => t.id === taskId);
          console.log(`🔍 策略1结果: 任务ID=${taskId}, 找到=${!!task}`);
          return task || null;
        } catch (error) {
          console.error('❌ 策略1失败:', error);
          return null;
        }
      },
      
      // 策略2: 使用主数据库实例查询
      async () => {
        console.log('📦 策略2: 使用主数据库实例查询');
        try {
          // 检查数据库中的任务数组
          if (!this.db.data.optimizationTasks || !Array.isArray(this.db.data.optimizationTasks)) {
            console.error('❌ 数据库中的任务数组无效:', typeof this.db.data.optimizationTasks);
            return null;
          }
          
          // 记录当前数据库中的任务总数
          console.log(`📊 当前数据库中的任务总数: ${this.db.data.optimizationTasks.length}`);
          
          // 记录最近添加的几个任务ID，帮助调试
          if (this.db.data.optimizationTasks.length > 0) {
            const recentTasks = this.db.data.optimizationTasks.slice(-3).map(t => t.id);
            console.log(`📋 最近的3个任务ID: ${recentTasks.join(', ')}`);
          }
          
          // 检查是否有任务ID前缀匹配
          const prefixMatches = this.db.data.optimizationTasks.filter(t => 
            t.id.startsWith(taskId.substring(0, 5))
          ).map(t => t.id);
          if (prefixMatches.length > 0) {
            console.log(`🔍 找到前缀匹配的任务ID: ${prefixMatches.join(', ')}`);
          }
          
          // 查找特定任务
          const task = this.db.data.optimizationTasks.find(t => t.id === taskId);
          
          if (task) {
            console.log(`✅ 策略2成功: 找到任务: ID=${taskId}, 状态=${task.status}`);
          } else {
            console.log(`❌ 策略2失败: 未找到任务: ID=${taskId}`);
          }
          
          return task || null;
        } catch (error) {
          console.error('❌ 策略2执行错误:', error);
          return null;
        }
      },
      
      // 策略3: 直接使用fs.readFile读取文件并手动解析（最底层的后备方案）
      async () => {
        console.log('🛠️ 策略3: 直接读取文件并手动解析');
        try {
          // 检查数据库文件是否存在
          try {
            await fs.access(this.dbPath);
            console.log(`✅ 数据库文件存在: ${this.dbPath}`);
          } catch (accessError) {
            console.error(`❌ 数据库文件不存在: ${this.dbPath}`, accessError);
            return null;
          }
          
          // 直接读取文件内容
          const fileContent = await fs.readFile(this.dbPath, 'utf-8');
          const dbData = JSON.parse(fileContent);
          
          // 查找任务
          if (dbData.optimizationTasks && Array.isArray(dbData.optimizationTasks)) {
            const task = dbData.optimizationTasks.find(t => t.id === taskId);
            if (task) {
              console.log(`✅ 策略3成功: 找到任务: ID=${taskId}, 状态=${task.status}`);
            } else {
              console.log(`❌ 策略3失败: 未找到任务: ID=${taskId}`);
            }
            return task || null;
          }
          return null;
        } catch (error) {
          console.error('❌ 策略3执行错误:', error);
          return null;
        }
      }
    ];
    
    // 按顺序尝试各种查询策略，直到找到任务或所有策略都失败
    for (let i = 0; i < queryStrategies.length; i++) {
      const task = await queryStrategies[i]();
      if (task) {
        // 返回标准化的任务信息
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
      }
    }
    
    console.log(`❌ 所有查询策略均失败: 未找到任务 ID=${taskId}`);
    return null;
  }

  async updateTaskStatus(taskId, status, updates = {}, createIfNotExists = false) {
    try {
      await this.initialize();
      console.log(`🔄 准备更新任务状态: ${taskId} -> ${status}`);
      
      let taskIndex = this.db.data.optimizationTasks.findIndex(t => t.id === taskId);
      
      if (taskIndex === -1) {
        if (createIfNotExists) {
          console.warn(`⚠️ 任务不存在，根据参数创建新任务: ${taskId}`);
          
          // 创建新任务
          const newTask = {
            id: taskId,
            type: 'optimization',
            status: status,
            progress: updates.progress || 0,
            message: updates.message || '任务已创建',
            inputData: updates.inputData || null,
            results: updates.results || null,
            error: updates.error || null,
            executionTime: updates.executionTime || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isRecreated: true
          };
          
          this.db.data.optimizationTasks.push(newTask);
          taskIndex = this.db.data.optimizationTasks.length - 1;
          console.log(`✅ 已创建新任务: ${taskId}`);
        } else {
          console.error(`❌ 任务不存在: ${taskId}`);
          throw new Error(`任务 ${taskId} 不存在`);
        }
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

  async setTaskResults(taskId, results, createIfNotExists = false) {
    try {
      console.log(`🏁 准备设置任务结果: ${taskId}`);
      
      if (createIfNotExists) {
        // 如果允许创建不存在的任务，直接调用updateTaskStatus
        const executionTime = 0; // 新创建的任务无法计算准确的执行时间
        
        console.log(`✅ 设置任务结果，允许创建不存在的任务: ${taskId}`);
        
        await this.updateTaskStatus(taskId, 'completed', {
          progress: 100, 
          message: '优化完成', 
          results,
          executionTime: `${(executionTime / 1000).toFixed(2)}s`
        }, true); // 设置createIfNotExists为true
      } else {
        // 原有逻辑：先检查任务是否存在
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
      }
      
      console.log(`✅ 任务结果已保存: ${taskId}`);
    } catch (error) {
      console.error('❌ 设置任务结果失败:', error);
      throw new Error(`设置任务结果失败: ${error.message}`);
    }
  }

  async setTaskError(taskId, error, createIfNotExists = false) {
    try {
      console.log(`❌ 准备标记任务为失败: ${taskId}`);
      
      await this.updateTaskStatus(taskId, 'failed', { error }, createIfNotExists);
      
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