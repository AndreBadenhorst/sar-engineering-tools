@echo off
REM ============================================================
REM  SAR Intranet - Codex — Database Backup Script
REM  Run manually or schedule with Windows Task Scheduler
REM ============================================================

set PROJECT_DIR=C:\Users\aba.SAR\Desktop\Co-Work\sar-engineering-tools
set BACKUP_DIR=%PROJECT_DIR%\data\backups
set DB_FILE=%PROJECT_DIR%\data\sar-tools.db

REM Get date in YYYYMMDD format
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set DATE=%datetime:~0,8%
set TIME=%datetime:~8,4%

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

if not exist "%DB_FILE%" (
    echo ERROR: Database file not found: %DB_FILE%
    exit /b 1
)

copy "%DB_FILE%" "%BACKUP_DIR%\sar-tools-%DATE%-%TIME%.db" >nul
if %ERRORLEVEL% equ 0 (
    echo [OK] Database backed up to: sar-tools-%DATE%-%TIME%.db
) else (
    echo [FAIL] Backup failed!
    exit /b 1
)

REM Clean up backups older than 30 days
forfiles /p "%BACKUP_DIR%" /m "sar-tools-*.db" /d -30 /c "cmd /c del @file" 2>nul

echo [OK] Backup complete. Older than 30 days cleaned up.
