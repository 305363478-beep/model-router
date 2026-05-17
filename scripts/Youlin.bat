@echo off
chcp 65001 >nul
title Youlin
cd /d "%~dp0"
set "APP_ROOT=%~dp0"
if not exist "%APP_ROOT%router\bin" set "APP_ROOT=%~dp0.."

set "ROUTER_DIR=%USERPROFILE%\.model-router"

:: Check if Node.js is available
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [Error] Node.js not found. Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)

:: Sync program files on every launch. User config files are preserved below.
echo Syncing Youlin program files...
mkdir "%ROUTER_DIR%\app\bin" 2>nul
mkdir "%ROUTER_DIR%\app\lib" 2>nul
mkdir "%ROUTER_DIR%\app\config" 2>nul
mkdir "%ROUTER_DIR%\config" 2>nul
mkdir "%ROUTER_DIR%\logs" 2>nul
xcopy /E /Y "%APP_ROOT%\router\bin\*" "%ROUTER_DIR%\app\bin\" >nul
xcopy /E /Y "%APP_ROOT%\router\lib\*" "%ROUTER_DIR%\app\lib\" >nul
xcopy /E /Y "%APP_ROOT%\router\config\*" "%ROUTER_DIR%\app\config\" >nul
copy /Y "%APP_ROOT%\router\codex-mcp.json" "%ROUTER_DIR%" >nul
if not exist "%ROUTER_DIR%\config\models.yaml" copy /Y "%APP_ROOT%\router\config\models.yaml.example" "%ROUTER_DIR%\config\models.yaml" >nul
if not exist "%ROUTER_DIR%\config\policy.yaml" copy /Y "%APP_ROOT%\router\config\policy.yaml.example" "%ROUTER_DIR%\config\policy.yaml" >nul
if not exist "%ROUTER_DIR%\config\secrets.env" copy /Y "%APP_ROOT%\router\config\secrets.env.example" "%ROUTER_DIR%\config\secrets.env" >nul

:: Keep the installed icon and desktop shortcuts using the blue Youlin icon.
if exist "%APP_ROOT%\router\bin\youlin.ico" copy /Y "%APP_ROOT%\router\bin\youlin.ico" "%ROUTER_DIR%\app\bin\youlin.ico" >nul
if exist "%APP_ROOT%\router\bin\youlin.png" copy /Y "%APP_ROOT%\router\bin\youlin.png" "%ROUTER_DIR%\app\bin\youlin.png" >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "$desktop=[Environment]::GetFolderPath('Desktop'); $target=Join-Path (Get-Location).Path 'Youlin.bat'; $icon=Join-Path $env:USERPROFILE '.model-router\app\bin\youlin.ico'; $ws=New-Object -ComObject WScript.Shell; foreach($name in @('Youlin.lnk','Youlin Switcher.lnk')){ $shortcut=Join-Path $desktop $name; $s=$ws.CreateShortcut($shortcut); $s.TargetPath=$target; $s.WorkingDirectory=(Get-Location).Path; if(Test-Path $icon){ $s.IconLocation=$icon }; $s.Description='Youlin Codex Model Switcher'; $s.Save() }; ie4uinit.exe -show" >nul 2>nul

:: Start the server in background
echo Starting Youlin service...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8787/api/status' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } } catch { exit 1 }" >nul 2>nul
if %errorlevel% neq 0 (
    start "Youlin Router" /MIN cmd /c "node ""%ROUTER_DIR%\app\bin\router-ui.js"" --port 8787 >> ""%ROUTER_DIR%\logs\ui.log"" 2>&1"
)

:: Wait for server to start
echo Waiting for service...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline=(Get-Date).AddSeconds(30); do { Start-Sleep -Milliseconds 500; try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8787/api/status' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } } catch {} } while ((Get-Date) -lt $deadline); exit 1"
if %errorlevel% neq 0 (
    echo [Error] Youlin service failed to start.
    echo Please check the log: "%ROUTER_DIR%\logs\ui.log"
    pause
    exit /b 1
)

:: Open desktop app - try Edge/Chrome app mode (no address bar), fallback to browser
echo Opening Youlin desktop app...

:: Try Microsoft Edge by full path (pre-installed on Windows 10/11)
set "_EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%_EDGE%" set "_EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%_EDGE%" (
    start "" "%_EDGE%" --app=http://127.0.0.1:8787/desktop --new-window
    goto :done
)

:: Try Google Chrome by full path
set "_CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%_CHROME%" set "_CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%_CHROME%" (
    start "" "%_CHROME%" --app=http://127.0.0.1:8787/desktop --new-window
    goto :done
)

:: Fallback: open in default browser
start http://127.0.0.1:8787/desktop

:done
echo Youlin started!
echo Desktop app: http://127.0.0.1:8787/desktop
echo Closing this window will NOT stop the Youlin service.
