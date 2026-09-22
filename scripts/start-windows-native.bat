@echo off
title ReelOS Native Windows Appliance
echo ===================================================
echo   ReelOS Luxury Media Appliance - Windows Native
echo ===================================================
echo [info] Direct Hardware Scaling: 16-Core i7-11800H + RTX 3050 Ti
echo [info] Zero-VM Overhead Mode: ~60MB RAM footprint
echo [info] Starting on http://localhost:8080/
echo.

cd /d "%~dp0\.."
where node >nul 2>&1
if errorlevel 1 (
  echo [error] node.exe is not on PATH. Install Node 22 LTS and relaunch.
  pause
  exit /b 1
)

set PORT=8080
set HOST=0.0.0.0
set NODE_ENV=production
set REELOS_STATE=%CD%\.reelos-state
if not exist "%REELOS_STATE%" mkdir "%REELOS_STATE%"

start "" powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File "scripts\reelos-tray.ps1"

echo [info] Binding :8080 — browser opens when the box answers.
start "ReelOS Box" cmd /c "node scripts\with-app-env.mjs node scripts\reelos-box.mjs"

set /a tries=0
:wait
timeout /t 1 /nobreak >nul
curl -s -o nul -m 2 http://127.0.0.1:8080/
if not errorlevel 1 goto open
set /a tries+=1
if %tries% geq 30 (
  echo [error] Box did not bind :8080. Check the ReelOS Box window.
  pause
  exit /b 1
)
goto wait

:open
start http://localhost:8080/
echo [ok] Concierge is at http://localhost:8080/
goto :eof
