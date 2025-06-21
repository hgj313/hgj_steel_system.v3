/**
 * 简单的服务器测试
 */

console.log('开始测试...');

try {
  // 测试数据库模块
  console.log('1. 测试数据库模块...');
  const databaseManager = require('./database/Database');
  console.log('✅ 数据库模块加载成功');
  
  // 测试Express
  console.log('2. 测试Express...');
  const express = require('express');
  const app = express();
  console.log('✅ Express加载成功');
  
  // 测试基本路由
  app.get('/test', (req, res) => {
    res.json({ success: true, message: '测试成功' });
  });
  
  // 启动服务器
  console.log('3. 启动测试服务器...');
  const server = app.listen(5005, () => {
    console.log('✅ 测试服务器启动成功，端口5005');
    server.close();
    console.log('✅ 测试完成');
  });
  
} catch (error) {
  console.error('❌ 测试失败:', error);
  console.error('错误详情:', error.stack);
} 