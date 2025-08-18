@echo off
echo ========================================
echo 钢材优化系统 V3.0 启动脚本
echo ========================================

echo.
echo 正在启动后端服务器...
start "后端服务器" cmd /k "cd /d %~dp0 && npm start"

echo.
echo 等待2秒后启动前端...
timeout /t 2 /nobreak > nul

echo.
echo 正在启动前端开发服务器...
start "前端服务器" cmd /k "cd /d %~dp0\client && npm start"

echo.
echo ========================================
echo 系统启动完成！
echo 后端服务: http://localhost:5004
echo 前端服务: http://localhost:3000
echo ========================================
echo.
echo 按任意键退出...
pause > nul 