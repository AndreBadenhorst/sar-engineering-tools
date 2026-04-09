@echo off
title SAR Intranet - Codex - Server
color 0A

echo.
echo  ====================================================
echo   SAR Intranet - Codex - Dev Server
echo  ====================================================
echo.
echo   This window runs the server. Keep it open!
echo   Close this window to stop the server.
echo.
echo   Once started, open your browser to:
echo.
echo       http://localhost:5000
echo.
echo  ====================================================
echo.

cd /d "%~dp0"

REM Check if node_modules exists, install if not
if not exist "node_modules" (
    echo  [SETUP] Installing dependencies (first time only)...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo  [ERROR] npm install failed. Make sure Node.js is installed.
        echo          Download from: https://nodejs.org
        pause
        exit /b 1
    )
    echo.
)

:start
REM Kill anything already on port 5000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING 2^>nul') do (
    echo  [INFO] Stopping previous server on port 5000 (PID %%a)...
    taskkill /PID %%a /F >nul 2>&1
)

echo  [STARTING] Server launching on http://localhost:5000 ...
echo.

REM Start the dev server (Vite + Express)
call npx cross-env NODE_ENV=development npx tsx server/index.ts

REM If we get here, the server stopped
echo.
echo  ====================================================
echo   Server stopped. Press any key to restart, or
echo   close this window to exit.
echo  ====================================================
pause >nul
goto :start
