@echo off
chcp 65001 >nul
title Youlin - Windows 安装

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js。请先安装 Node.js 18+：https://nodejs.org
    pause
    exit /b 1
)
cd /d "%~dp0"
set "APP_ROOT=%~dp0"
if not exist "%APP_ROOT%router\bin" set "APP_ROOT=%~dp0.."

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
xcopy /E /Y "%APP_ROOT%\router\bin\*" "%ROUTER_DIR%\app\bin\"
xcopy /E /Y "%APP_ROOT%\router\lib\*" "%ROUTER_DIR%\app\lib\"
copy /Y "%APP_ROOT%\router\codex-mcp.json" "%ROUTER_DIR%"

if not exist "%ROUTER_DIR%\config\models.yaml" copy /Y "%APP_ROOT%\router\config\models.yaml.example" "%ROUTER_DIR%\config\models.yaml"
if not exist "%ROUTER_DIR%\config\policy.yaml" copy /Y "%APP_ROOT%\router\config\policy.yaml.example" "%ROUTER_DIR%\config\policy.yaml"
if not exist "%ROUTER_DIR%\config\secrets.env" copy /Y "%APP_ROOT%\router\config\secrets.env.example" "%ROUTER_DIR%\config\secrets.env"

echo 正在创建桌面快捷方式...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$desktop=[Environment]::GetFolderPath('Desktop'); $target=Join-Path (Get-Location).Path '启动Youlin.bat'; $icon=Join-Path $env:USERPROFILE '.model-router\app\bin\youlin.ico'; $ws=New-Object -ComObject WScript.Shell; foreach($name in @('Youlin.lnk','Youlin Switcher.lnk')){ $shortcut=Join-Path $desktop $name; $s=$ws.CreateShortcut($shortcut); $s.TargetPath=$target; $s.WorkingDirectory=(Get-Location).Path; if(Test-Path $icon){ $s.IconLocation=$icon }; $s.Description='Youlin Codex Model Switcher'; $s.Save() }; ie4uinit.exe -show"

echo.
echo ========================================
echo   安装完成！
echo ========================================
echo.
echo 下一步：
echo   1. 编辑 %ROUTER_DIR%\config\secrets.env 添加 API Key
echo   2. 双击桌面 Youlin 图标启动 Youlin 桌面应用
echo   3. 应用会自动以独立窗口打开
echo.
echo 功能：
echo   - 供应商 Tab: 添加模型、配置 API Key、快速切换
echo   - 线程迁移 Tab: 跨模型迁移聊天记录
echo   - 左侧栏: 当前配置状态、一键切换预设
echo.
echo 切换 Codex 模型后需完全退出并重新打开 Codex。
echo.
pause
