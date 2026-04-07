@echo off
REM ============================================================
REM  SAR Engineering Tools — Full Backup (DB + Git Push)
REM  Backs up the database, commits all code changes, pushes to GitHub
REM ============================================================

set PROJECT_DIR=C:\Users\aba.SAR\Desktop\Co-Work\sar-engineering-tools

cd /d "%PROJECT_DIR%"

echo.
echo ========================================
echo  Step 1: Database Backup
echo ========================================
call scripts\backup-db.bat
echo.

echo ========================================
echo  Step 2: Git Status
echo ========================================
git status --short
echo.

echo ========================================
echo  Step 3: Stage All Changes
echo ========================================
git add -A
echo.

echo ========================================
echo  Step 4: Commit
echo ========================================
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set DATE=%datetime:~0,8%
git commit -m "Backup %DATE%"
echo.

echo ========================================
echo  Step 5: Push to GitHub
echo ========================================
git push origin master
echo.

echo ========================================
echo  DONE! Code on GitHub, DB backed up.
echo ========================================
pause
