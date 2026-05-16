@echo off
chcp 65001 >nul
title Youlin
cd /d "%~dp0"

set "ROUTER_DIR=%USERPROFILE%\.model-router"

:: Check if Node.js is available
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js。请先安装 Node.js：https://nodejs.org
    pause
    exit /b 1
)

:: First run: copy files if not yet installed
if not exist "%ROUTER_DIR%\app\bin\router-ui.js" (
    echo [首次运行] 正在安装 Youlin...
    mkdir "%ROUTER_DIR%\app\bin" 2>nul
    mkdir "%ROUTER_DIR%\app\lib" 2>nul
    mkdir "%ROUTER_DIR%\config" 2>nul
    mkdir "%ROUTER_DIR%\logs" 2>nul
    xcopy /E /Y "router\bin\*" "%ROUTER_DIR%\app\bin\" >nul
    xcopy /E /Y "router\lib\*" "%ROUTER_DIR%\app\lib\" >nul
    copy /Y "router\codex-mcp.json" "%ROUTER_DIR%" >nul
    if not exist "%ROUTER_DIR%\config\models.yaml" copy /Y "router\config\models.yaml.example" "%ROUTER_DIR%\config\models.yaml" >nul
    if not exist "%ROUTER_DIR%\config\policy.yaml" copy /Y "router\config\policy.yaml.example" "%ROUTER_DIR%\config\policy.yaml" >nul
    if not exist "%ROUTER_DIR%\config\secrets.env" copy /Y "router\config\secrets.env.example" "%ROUTER_DIR%\config\secrets.env" >nul
    echo 安装完成！
)

:: Keep the desktop shortcut using the blue Youlin icon.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$desktop=[Environment]::GetFolderPath('Desktop'); $shortcut=Join-Path $desktop 'Youlin.lnk'; $target=Join-Path (Get-Location).Path '启动Youlin.bat'; $icon=Join-Path $env:USERPROFILE '.model-router\app\bin\youlin.ico'; $ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut($shortcut); $s.TargetPath=$target; $s.WorkingDirectory=(Get-Location).Path; if(Test-Path $icon){ $s.IconLocation=$icon }; $s.Description='Youlin Codex Model Switcher'; $s.Save()" >nul 2>nul

:: Start the server in background
echo 启动 Youlin 服务...
start /B node "%ROUTER_DIR%\app\bin\router-ui.js" --port 8787 > "%ROUTER_DIR%\logs\ui.log" 2>&1

:: Wait for server to start
echo 等待服务就绪...
:waitloop
timeout /t 1 /nobreak >nul
curl -s http://127.0.0.1:8787/api/status >nul 2>nul
if %errorlevel% neq 0 goto waitloop

:: Open desktop app - try Edge app mode first, fallback to default browser
echo 打开 Youlin 桌面应用...

:: Try Microsoft Edge in app mode (best native feel)
start msedge --app=http://127.0.0.1:8787/desktop --new-window >nul 2>nul
if %errorlevel% equ 0 goto :done

:: Try Google Chrome in app mode
start chrome --app=http://127.0.0.1:8787/desktop --new-window >nul 2>nul
if %errorlevel% equ 0 goto :done

:: Fallback: open in default browser
start http://127.0.0.1:8787/desktop

:done
echo Youlin 已启动！
echo 桌面应用: http://127.0.0.1:8787/desktop
echo 关闭此窗口不会停止 Youlin 服务。
