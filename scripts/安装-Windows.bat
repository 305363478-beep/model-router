@echo off
chcp 65001 >nul
title Youlin - Windows 安装

echo ========================================
echo   Youlin - Windows 安装程序
echo ========================================
echo.

set "ROUTER_DIR=%USERPROFILE%\.model-router"

echo 正在创建目录...
mkdir "%ROUTER_DIR%\app\bin" 2>nul
mkdir "%ROUTER_DIR%\app\lib" 2>nul
mkdir "%ROUTER_DIR%\config" 2>nul
mkdir "%ROUTER_DIR%\logs" 2>nul

echo 正在复制文件...
xcopy /E /Y "router\bin\*" "%ROUTER_DIR%\app\bin\"
xcopy /E /Y "router\lib\*" "%ROUTER_DIR%\app\lib\"
copy /Y "router\codex-mcp.json" "%ROUTER_DIR%\"

if not exist "%ROUTER_DIR%\config\models.yaml" copy /Y "router\config\models.yaml.example" "%ROUTER_DIR%\config\models.yaml"
if not exist "%ROUTER_DIR%\config\policy.yaml" copy /Y "router\config\policy.yaml.example" "%ROUTER_DIR%\config\policy.yaml"
if not exist "%ROUTER_DIR%\config\secrets.env" copy /Y "router\config\secrets.env.example" "%ROUTER_DIR%\config\secrets.env"

echo.
echo ========================================
echo   安装完成！
echo ========================================
echo.
echo 下一步：
echo   1. 编辑 %ROUTER_DIR%\config\secrets.env 添加 API Key
echo   2. 双击 启动Youlin.bat 启动服务
echo   3. 浏览器访问 http://127.0.0.1:8787/
echo   4. 设置: http://127.0.0.1:8787/settings
echo   5. 迁移: http://127.0.0.1:8787/migrate
echo.
echo 切换 Codex 模型:
echo   在 Settings 页面选择模型，点击 Use in Codex
echo   然后完全退出并重新打开 Codex
echo.
pause
