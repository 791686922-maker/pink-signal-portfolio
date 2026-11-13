@echo off
chcp 65001 >nul
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo 未找到 npm，请先安装 Node.js 20 或更高版本。
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo 正在安装网页依赖，请稍候...
  call npm install
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)

echo 粉色信号农场正在启动。关闭此窗口即可停止服务。
call npm run dev -- --host 127.0.0.1 --open
