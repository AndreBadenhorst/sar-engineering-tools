@echo off
REM ══════════════════════════════════════════════════════════════
REM  Pull latest database from test server BEFORE redeploying
REM
REM  Usage:  pull-data.bat \\SERVER\share\sar-tools
REM
REM  This copies the live database from the server to your local
REM  data/backups/ folder so you can inspect it or use it as
REM  the starting point for the next deployment.
REM ══════════════════════════════════════════════════════════════

if "%~1"=="" (
    echo Usage: pull-data.bat ^<server-path^>
    echo Example: pull-data.bat \\SERVER\share\sar-tools
    exit /b 1
)

set SOURCE=%~1
set TIMESTAMP=%date:~-4%%date:~4,2%%date:~7,2%-%time:~0,2%%time:~3,2%
set TIMESTAMP=%TIMESTAMP: =0%

if not exist "%SOURCE%\data\sar-tools.db" (
    echo [ERROR] No database found at %SOURCE%\data\sar-tools.db
    exit /b 1
)

if not exist "data\backups" mkdir "data\backups"

echo Pulling database from %SOURCE%...
copy /Y "%SOURCE%\data\sar-tools.db" "data\backups\server-snapshot-%TIMESTAMP%.db" >nul
echo Saved to: data\backups\server-snapshot-%TIMESTAMP%.db

echo.
echo To use this as your dev database:
echo   copy data\backups\server-snapshot-%TIMESTAMP%.db data\sar-tools.db
echo.
echo To deploy back to server (preserving this data):
echo   scripts\deploy.bat %SOURCE%
