@echo off
chcp 65001 >nul
title Youlin - Codex Model Switcher

echo ========================================
echo   Youlin - Codex Model Switcher
echo ========================================
echo.

set "ROUTER_DIR=%USERPROFILE%\.model-router"

if not exist "%ROUTER_DIR%\app\bin\router-ui.js" (
    echo [首次运行] 正在安装...
    mkdir "%ROUTER_DIR%\app\bin" 2>nul
    mkdir "%ROUTER_DIR%\app\lib" 2>nul
    mkdir "%ROUTER_DIR%\config" 2>nul
    mkdir "%ROUTER_DIR%\logs" 2>nul
    xcopy /E /Y "router\bin\*" "%ROUTER_DIR%\app\bin\"
    xcopy /E /Y "router\lib\*" "%ROUTER_DIR%\app\lib\"
    copy /Y "router\codex-mcp.json" "%ROUTER_DIR%\"
    if not exist "%ROUTER_DIR%\config\models.yaml" copy /Y "router\config\models.yaml.example" "%ROUTER_DIR%\config\models.yaml"
    if not exist "%ROUTER_DIR%\config\policy.yaml" copy /Y "router\config\policy.yaml.example" "%ROUTER_DIR%\config\policy.yaml"
    if not exist "%ROUTER_DIR%\config\secrets.env" copy /Y "router\config\secrets.env.example" "%ROUTER_DIR%\config\secrets.env"
    echo 安装完成！
    echo.
)

echo 启动 Router UI: http://127.0.0.1:8787/
echo 按 Ctrl+C 停止
echo.

node "%ROUTER_DIR%\app\bin\router-ui.js" --port 8787
pause
