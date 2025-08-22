/**
 * Netlify后台函数 - 优化任务工作者
 * 负责执行耗时长的钢材优化计算
 * 增强版: 添加重试机制、超时保护、数据持久化强化和错误恢复能力
 */
// 使用绝对路径导入，确保在任何环境下都能可靠地加载模块
const TaskManager = require('./utils/TaskManager');
const OptimizationService = require('../../api/services/OptimizationService');
const fs = require('fs').promises;
const path = require('path');

// 全局配置
const MAX_RETRY_ATTEMPTS = 5; // 增加重试次数以提高稳定性
const INITIAL_RETRY_DELAY_MS = 200; // 初始重试延迟
const MAX_RETRY_DELAY_MS = 2000; // 最大重试延迟
const PROGRESS_UPDATE_INTERVAL_MS = 2000; // 进度更新防抖间隔
const MAX_EXECUTION_WARNING_MS = 90000; // 90秒执行警告阈值

// 任务状态内存备份，用于紧急恢复
const inMemoryTaskBackup = new Map();

exports.handler = async (event, context) => {
  // 初始化TaskManager
  const taskManager = new TaskManager();
  let taskId = 'unknown_task'; // 默认为未知任务ID
  let isTaskPersisted = false; // 标记任务是否已持久化到数据库
  
  // 设置执行超时警告
  const timeoutId = setTimeout(() => {
    console.warn(`[${taskId}] ⚠️ 优化任务执行时间过长 (> 90秒)，可能面临Lambda超时风险！`);
  }, MAX_EXECUTION_WARNING_MS);
  
  try {
    // 解析请求体并获取任务ID
    const requestBody = JSON.parse(event.body);
    taskId = requestBody?.taskId || 'unknown_task';
    const optimizationData = requestBody?.optimizationData;
    
    if (!taskId || !optimizationData) {
      throw new Error(`缺少必要参数: ${!taskId ? 'taskId' : 'optimizationData'}`);
    }
    
    console.log(`[${taskId}] 🚀 后台工作者已启动，开始执行优化...`);

    // TaskManager初始化 - 增强版重试逻辑
    let initAttempts = MAX_RETRY_ATTEMPTS;
    let retryDelay = INITIAL_RETRY_DELAY_MS;
    while (initAttempts > 0) {
      try {
        await taskManager.initialize();
        console.log(`[${taskId}] ✅ TaskManager初始化成功`);
        
        // 初始化后立即测试数据库目录可写性
        await testDatabaseWritable();
        console.log(`[${taskId}] ✅ 数据库目录可写性测试通过`);
        
        break;
      } catch (initError) {
        initAttempts--;
        console.error(`[${taskId}] ❌ TaskManager初始化失败 (剩余尝试: ${initAttempts}):`, initError.message);
        
        if (initAttempts === 0) {
          throw new Error(`TaskManager初始化失败，已尝试${MAX_RETRY_ATTEMPTS}次: ${initError.message}`);
        }
        
        // 指数退避策略
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
      }
    }

    // 检查任务是否存在 - 增强版重试逻辑
    let taskExists = false;
    let taskCheckAttempts = MAX_RETRY_ATTEMPTS;
    let retryDelay = INITIAL_RETRY_DELAY_MS;
    while (taskCheckAttempts > 0 && !taskExists) {
      try {
        // 这里假设TaskManager有检查任务存在的方法，或使用getTask替代
        const task = await taskManager.getTask(taskId);
        taskExists = !!task;
        
        if (taskExists) {
          // 将任务状态备份到内存中
          inMemoryTaskBackup.set(taskId, {
            ...task,
            lastBackupTime: Date.now()
          });
          isTaskPersisted = true;
          console.log(`[${taskId}] 💾 任务数据已备份到内存`);
        } else {
          console.warn(`[${taskId}] ⚠️ 任务不存在，等待可能的创建延迟 (剩余尝试: ${taskCheckAttempts-1})`);
          taskCheckAttempts--;
          
          // 对于任务不存在的情况，使用更长的等待时间
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (checkError) {
        taskCheckAttempts--;
        console.error(`[${taskId}] ❌ 任务检查失败 (剩余尝试: ${taskCheckAttempts}):`, checkError.message);
        
        if (taskCheckAttempts === 0) {
          // 即使无法验证任务存在性，也尝试继续执行
          console.warn(`[${taskId}] ⚠️ 无法验证任务存在性，但将继续执行优化`);
          break;
        }
        
        // 指数退避策略
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
      }
    }

    // 更新任务状态为"运行中" - 增强版重试逻辑
    let statusUpdateAttempts = MAX_RETRY_ATTEMPTS;
    let retryDelay = INITIAL_RETRY_DELAY_MS;
    while (statusUpdateAttempts > 0) {
      try {
        await taskManager.updateTaskStatus(taskId, 'running', {
          progress: 10,
          message: '优化算法已启动...'
        });
        console.log(`[${taskId}] ✅ 任务状态已更新为"运行中"`);
        
        // 更新内存备份
        if (inMemoryTaskBackup.has(taskId)) {
          const currentBackup = inMemoryTaskBackup.get(taskId);
          inMemoryTaskBackup.set(taskId, {
            ...currentBackup,
            status: 'running',
            progress: 10,
            message: '优化算法已启动...',
            lastBackupTime: Date.now()
          });
        }
        
        break;
      } catch (statusError) {
        statusUpdateAttempts--;
        console.error(`[${taskId}] ❌ 更新任务状态失败 (剩余尝试: ${statusUpdateAttempts}):`, statusError.message);
        
        if (statusUpdateAttempts === 0) {
          console.warn(`[${taskId}] ⚠️ 继续执行优化，但无法更新任务状态`);
          
          // 尝试使用备用文件保存策略
          try {
            await saveTaskStatusToBackupFile(taskId, 'running', {
              progress: 10,
              message: '优化算法已启动...'
            });
          } catch (backupError) {
            console.error(`[${taskId}] ❌ 备用文件保存也失败:`, backupError);
          }
          
          break; // 即使状态更新失败，也继续执行优化
        }
        
        // 指数退避策略
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
      }
    }

    // 实例化优化服务
    const service = new OptimizationService();
    console.log(`[${taskId}] ✅ OptimizationService 实例化成功`);

    // 定义进度回调函数 - 增强版防抖和重试逻辑
    const progressCallback = async (progress, message) => {
      try {
        // 防抖逻辑 - 限制更新频率
        const now = Date.now();
        const lastUpdate = progressCallback.lastUpdate || 0;
        const lastValue = progressCallback.lastValue || -1;
        const shouldUpdate = now - lastUpdate > PROGRESS_UPDATE_INTERVAL_MS || 
                           Math.abs(progress - lastValue) > 5; // 进度变化超过5%也更新
        
        if (shouldUpdate) {
          const newProgress = Math.max(10, Math.round(progress));
          console.log(`[${taskId}] 📊 进度更新: ${newProgress}% - ${message}`);
          
          // 更新内存备份
          if (inMemoryTaskBackup.has(taskId)) {
            const currentBackup = inMemoryTaskBackup.get(taskId);
            inMemoryTaskBackup.set(taskId, {
              ...currentBackup,
              progress: newProgress,
              message: message,
              lastBackupTime: Date.now()
            });
          }
          
          // 进度更新添加重试逻辑
          let progressAttempts = 3; // 增加进度更新的重试次数
          let retryDelay = INITIAL_RETRY_DELAY_MS;
          while (progressAttempts > 0) {
            try {
              await taskManager.updateTaskProgress(taskId, newProgress, message);
              progressCallback.lastUpdate = now;
              progressCallback.lastValue = progress;
              break;
            } catch (progressError) {
              progressAttempts--;
              console.error(`[${taskId}] ❌ 进度更新失败 (剩余尝试: ${progressAttempts}):`, progressError.message);
              
              if (progressAttempts > 0) {
                // 指数退避策略
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
              } else {
                console.warn(`[${taskId}] ⚠️ 进度更新失败，但继续执行优化`);
                
                // 尝试使用备用文件保存策略
                try {
                  await saveTaskStatusToBackupFile(taskId, 'running', {
                    progress: newProgress,
                    message: message
                  });
                } catch (backupError) {
                  console.error(`[${taskId}] ❌ 备用文件进度保存也失败:`, backupError);
                }
              }
            }
          }
        }
      } catch (callbackError) {
        console.error(`[${taskId}] ❌ 进度回调异常:`, callbackError.message);
        // 进度回调失败不应中断主流程
      }
    };
    
    // 初始化回调状态
    progressCallback.lastUpdate = 0;
    progressCallback.lastValue = -1;

    // 运行优化算法
    console.log(`[${taskId}] 🛠️ 调用 service.run()...`);
    const startTime = Date.now();
    const results = await service.run(optimizationData, progressCallback);
    const executionTime = Date.now() - startTime;
    console.log(`[${taskId}] ✅ service.run() 完成，耗时: ${executionTime}ms`);
    
    // 设置最终结果 - 增强版重试逻辑
    let resultsAttempts = MAX_RETRY_ATTEMPTS;
    let retryDelay = INITIAL_RETRY_DELAY_MS;
    while (resultsAttempts > 0) {
      try {
        // 先尝试获取任务，如果404错误则需要特殊处理
        let task;
        try {
          task = await taskManager.getTask(taskId);
        } catch (getTaskError) {
          if (getTaskError.message.includes('404') || getTaskError.message.includes('不存在')) {
            console.warn(`[${taskId}] ⚠️ 检测到任务404错误，需要重新创建任务...`);
            // 尝试重新创建任务并设置结果
            const taskData = {
              id: taskId,
              createdAt: new Date().toISOString(),
              status: 'completed',
              progress: 100,
              results: {
                ...results,
                executionTime: `${(executionTime / 1000).toFixed(2)}s`
              },
              isRecreated: true
            };
            // 使用增强的TaskManager API，利用setTaskResults方法的createIfNotExists参数
            console.log(`[${taskId}] ⚠️ 使用增强的TaskManager API重新创建任务并保存结果`);
            try {
              // 直接调用setTaskResults方法，并设置createIfNotExists为true
              // 这将自动处理任务不存在时的创建逻辑
              await taskManager.setTaskResults(taskId, {
                ...results,
                executionTime: `${(executionTime / 1000).toFixed(2)}s`
              }, true); // 设置createIfNotExists为true
              
              console.log(`[${taskId}] ✅ 任务已通过增强的TaskManager API重新创建并保存结果`);
              
              // 更新内存备份
              inMemoryTaskBackup.set(taskId, {
                id: taskId,
                status: 'completed',
                progress: 100,
                results: results,
                executionTime: `${(executionTime / 1000).toFixed(2)}s`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isRecreated: true,
                lastBackupTime: Date.now()
              });
            } catch (dbError) {
              console.error(`[${taskId}] ❌ 直接数据库操作失败:`, dbError);
              // 如果数据库操作也失败，尝试使用备用文件保存
              await saveTaskResultsToBackupFile(taskId, {
                ...results,
                executionTime: `${(executionTime / 1000).toFixed(2)}s`,
                isBackupOnly: true
              });
              console.log(`[${taskId}] ⚠️ 已将结果保存到备用文件，系统恢复后可手动恢复`);
            }
          } else {
            throw getTaskError;
          }
        }
        
        // 正常情况下保存结果
        if (task) {
          await taskManager.setTaskResults(taskId, {
            ...results,
            executionTime: `${(executionTime / 1000).toFixed(2)}s`
          });
          console.log(`[${taskId}] 🎉 任务成功完成，结果已保存`);
        }
        
        // 清除内存备份
        inMemoryTaskBackup.delete(taskId);
        
        break;
      } catch (resultsError) {
        resultsAttempts--;
        console.error(`[${taskId}] ❌ 保存任务结果失败 (剩余尝试: ${resultsAttempts}):`, resultsError.message);
        
        if (resultsAttempts === 0) {
          // 即使结果保存失败，也返回成功状态，避免Netlify重试
          console.error(`[${taskId}] ⚠️ 致命错误: 优化成功但结果保存失败`);
          
          // 尝试至少记录错误到备用文件
          try {
            await saveTaskResultsToBackupFile(taskId, {
              ...results,
              executionTime: `${(executionTime / 1000).toFixed(2)}s`
            });
          } catch (backupError) {
            console.error(`[${taskId}] ❌ 备用文件结果保存也失败:`, backupError);
          }
          
          return {
            statusCode: 200,
            body: JSON.stringify({ 
              success: true, 
              warning: '优化成功但结果可能未保存' 
            })
          };
        }
        
        // 指数退避策略
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
      }
    }

  } catch (error) {
    // 确保taskId已定义
    taskId = JSON.parse(event.body)?.taskId || taskId;
    const errorMessage = `后台工作者捕获到致命错误: ${error.message}. Stack: ${error.stack}`;
    console.error(`[${taskId}] ❌ 优化任务执行失败:`, error);
    
    // 尝试记录错误状态 - 增强版重试逻辑
    let errorAttempts = MAX_RETRY_ATTEMPTS;
    let retryDelay = INITIAL_RETRY_DELAY_MS;
    let errorLogged = false;
    
    while (errorAttempts > 0) {
      try {
        // 先尝试获取任务，如果404错误则需要特殊处理
        let task;
        try {
          task = await taskManager.getTask(taskId);
        } catch (getTaskError) {
          if (getTaskError.message.includes('404') || getTaskError.message.includes('不存在')) {
            console.warn(`[${taskId}] ⚠️ 检测到任务404错误，尝试重新创建并设置错误状态...`);
            // 使用增强的TaskManager API，利用setTaskError方法的createIfNotExists参数
            console.log(`[${taskId}] ⚠️ 使用增强的TaskManager API重新创建任务并设置错误状态`);
            try {
              // 直接调用setTaskError方法，并设置createIfNotExists为true
              // 这将自动处理任务不存在时的创建逻辑
              // 获取原始输入数据，确保在重新创建任务时保留
              const eventBody = JSON.parse(event.body);
              const inputData = eventBody?.inputData || null;
              
              // 传递inputData参数，确保新创建的任务包含原始输入数据
              await taskManager.setTaskError(taskId, errorMessage, true, inputData);
              
              console.log(`[${taskId}] ✅ 任务已通过增强的TaskManager API重新创建并设置错误状态`);
              
              // 更新内存备份，包含原始输入数据
              inMemoryTaskBackup.set(taskId, {
                id: taskId,
                status: 'failed',
                error: errorMessage,
                inputData: inputData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isRecreated: true,
                lastBackupTime: Date.now()
              });
              
              errorLogged = true;
            } catch (dbError) {
              console.error(`[${taskId}] ❌ 直接数据库操作失败:`, dbError);
              // 如果数据库操作也失败，尝试使用备用文件保存错误状态
              await saveTaskStatusToBackupFile(taskId, 'failed', {
                error: errorMessage,
                isBackupOnly: true
              });
              console.log(`[${taskId}] ⚠️ 已将错误状态保存到备用文件，系统恢复后可手动恢复`);
              
              errorLogged = true;
            }
          } else {
            throw getTaskError;
          }
        }
        
        // 正常情况下设置错误状态
        if (task && !errorLogged) {
          await taskManager.setTaskError(taskId, errorMessage);
          console.log(`[${taskId}] ⚠️ 任务错误状态已记录`);
          errorLogged = true;
        }
        
        break;
      } catch (dbError) {
        errorAttempts--;
        console.error(`[${taskId}] ❌ 在捕获到执行错误后，更新数据库也失败了 (剩余尝试: ${errorAttempts}):`, dbError);
        
        if (errorAttempts > 0) {
          // 指数退避策略
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
        } else {
          console.error(`[${taskId}] ❌ 致命错误: 无法记录任务失败状态`);
          
          // 尝试使用备用文件保存错误状态
          try {
            await saveTaskStatusToBackupFile(taskId, 'failed', {
              error: errorMessage
            });
          } catch (backupError) {
            console.error(`[${taskId}] ❌ 备用文件错误状态保存也失败:`, backupError);
          }
        }
      }
    }
    
    // 清除内存备份
    inMemoryTaskBackup.delete(taskId);
    
    // 即使失败，也需要成功返回，避免Netlify重试
    return {
      statusCode: 200,
      body: JSON.stringify({ success: false, error: errorMessage })
    };
  } finally {
    // 清除超时警告
    clearTimeout(timeoutId);
    console.log(`[${taskId}] 🏁 后台工作者执行流程已完成`);
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
};

// 辅助函数: 测试数据库目录可写性
async function testDatabaseWritable() {
  try {
    // 确定临时文件路径
    const tempDir = process.env.NETLIFY ? '/tmp' : '.';
    const testFilePath = path.join(tempDir, 'db_test_write.txt');
    
    // 尝试写入和读取文件
    await fs.writeFile(testFilePath, `Test write at ${Date.now()}`);
    const content = await fs.readFile(testFilePath, 'utf8');
    
    // 清理测试文件
    try {
      await fs.unlink(testFilePath);
    } catch (cleanupError) {
      console.warn(`⚠️ 测试文件清理失败，但不影响正常运行:`, cleanupError);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ 数据库目录可写性测试失败:`, error);
    throw new Error(`数据库目录写入测试失败: ${error.message}`);
  }
}

// 辅助函数: 使用备用文件保存任务状态
async function saveTaskStatusToBackupFile(taskId, status, additionalData = {}) {
  try {
    // 确定备份文件路径
    const backupDir = process.env.NETLIFY ? '/tmp/backups' : './backups';
    
    // 确保备份目录存在
    await fs.mkdir(backupDir, { recursive: true });
    
    // 创建时间戳
    const timestamp = Date.now();
    
    // 构建备份数据
    const backupData = {
      taskId,
      status,
      timestamp: timestamp,
      ...additionalData,
      isBackupFile: true
    };
    
    // 保存带时间戳的版本，便于历史追踪
    const backupFilePath = path.join(backupDir, `task_${taskId}_status_${timestamp}.json`);
    await fs.writeFile(backupFilePath, JSON.stringify(backupData, null, 2));
    console.log(`[${taskId}] 💾 任务状态已保存到备用文件: ${backupFilePath}`);
    
    // 同时保存一个不带时间戳的最新版本，便于快速恢复
    const latestBackupFilePath = path.join(backupDir, `task_${taskId}_status_latest.json`);
    try {
      await fs.writeFile(latestBackupFilePath, JSON.stringify(backupData, null, 2));
      console.log(`[${taskId}] 💾 任务状态已保存到最新备份文件: ${latestBackupFilePath}`);
    } catch (latestError) {
      console.error(`[${taskId}] ❌ 保存最新任务状态备份失败:`, latestError);
    }
    
    return backupFilePath;
  } catch (error) {
    console.error(`[${taskId}] ❌ 备用文件保存失败:`, error);
    throw error;
  }
}

// 辅助函数: 使用备用文件保存任务结果
async function saveTaskResultsToBackupFile(taskId, results) {
  try {
    // 确定备份文件路径
    const backupDir = process.env.NETLIFY ? '/tmp/backups' : './backups';
    
    // 确保备份目录存在
    await fs.mkdir(backupDir, { recursive: true });
    
    // 创建时间戳
    const timestamp = Date.now();
    
    // 构建备份数据
    const backupData = {
      taskId,
      results,
      timestamp: timestamp,
      isBackupFile: true
    };
    
    // 保存带时间戳的版本，便于历史追踪
    const backupFilePath = path.join(backupDir, `task_${taskId}_results_${timestamp}.json`);
    await fs.writeFile(backupFilePath, JSON.stringify(backupData, null, 2));
    console.log(`[${taskId}] 💾 任务结果已保存到备用文件: ${backupFilePath}`);
    
    // 同时保存一个不带时间戳的最新版本，便于快速恢复
    const latestBackupFilePath = path.join(backupDir, `task_${taskId}_results_latest.json`);
    try {
      await fs.writeFile(latestBackupFilePath, JSON.stringify(backupData, null, 2));
      console.log(`[${taskId}] 💾 任务结果已保存到最新备份文件: ${latestBackupFilePath}`);
    } catch (latestError) {
      console.error(`[${taskId}] ❌ 保存最新任务结果备份失败:`, latestError);
    }
    
    // 为了支持getTask方法，创建一个包含完整任务信息的备份
    const fullTaskBackupFile = path.join(backupDir, `task_${taskId}_full_latest.json`);
    const fullBackupData = {
      id: taskId,
      type: 'optimization',
      status: 'completed',
      progress: 100,
      message: '任务已完成',
      results: results,
      timestamp: timestamp,
      isBackupFile: true
    };
    
    try {
      await fs.writeFile(fullTaskBackupFile, JSON.stringify(fullBackupData, null, 2));
      console.log(`[${taskId}] 💾 完整任务信息已保存到备份文件: ${fullTaskBackupFile}`);
    } catch (fullError) {
      console.error(`[${taskId}] ❌ 保存完整任务信息备份失败:`, fullError);
    }
    
    return backupFilePath;
  } catch (error) {
    console.error(`[${taskId}] ❌ 备用文件结果保存失败:`, error);
    throw error;
  }
}