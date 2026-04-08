@echo off
REM ══════════════════════════════════════════════════════════════
REM  SAR Engineering Tools — Deploy to Test Server
REM
REM  Usage:  deploy.bat \\SERVER\share\sar-tools
REM
REM  This script:
REM    1. Backs up the EXISTING database on the target (preserves user data)
REM    2. Copies the new code to the target
REM    3. Restores the database so no user data is lost
REM    4. Runs any pending migrations
REM ══════════════════════════════════════════════════════════════

if "%~1"=="" (
    echo Usage: deploy.bat ^<target-path^>
    echo Example: deploy.bat \\SERVER\share\sar-tools
    echo Example: deploy.bat C:\Apps\sar-tools
    exit /b 1
)

set TARGET=%~1
set TIMESTAMP=%date:~-4%%date:~4,2%%date:~7,2%-%time:~0,2%%time:~3,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUP_NAME=sar-tools-pre-deploy-%TIMESTAMP%.db

echo.
echo ══════════════════════════════════════════════════════════
echo  SAR Engineering Tools — Deployment
echo  Target: %TARGET%
echo ══════════════════════════════════════════════════════════
echo.

REM ── Step 1: Back up existing database on target ──────────
if exist "%TARGET%\data\sar-tools.db" (
    echo [1/5] Backing up existing database...
    if not exist "%TARGET%\data\backups" mkdir "%TARGET%\data\backups"
    copy /Y "%TARGET%\data\sar-tools.db" "%TARGET%\data\backups\%BACKUP_NAME%" >nul
    echo       Saved to: data\backups\%BACKUP_NAME%

    REM Also keep a local copy just in case
    if not exist "data\backups" mkdir "data\backups"
    copy /Y "%TARGET%\data\sar-tools.db" "data\backups\%BACKUP_NAME%" >nul
    echo       Local copy saved too.
) else (
    echo [1/5] No existing database found — fresh install.
)

REM ── Step 2: Build the production bundle ──────────────────
echo [2/5] Building production bundle...
call npm run build
if errorlevel 1 (
    echo [ERROR] Build failed! Aborting deployment.
    exit /b 1
)

REM ── Step 3: Copy files to target ─────────────────────────
echo [3/5] Copying files to %TARGET%...
if not exist "%TARGET%" mkdir "%TARGET%"
if not exist "%TARGET%\data" mkdir "%TARGET%\data"

REM Copy production files
xcopy /E /Y /I dist "%TARGET%\dist" >nul 2>&1
xcopy /E /Y /I shared "%TARGET%\shared" >nul 2>&1
xcopy /E /Y /I server "%TARGET%\server" >nul 2>&1
xcopy /E /Y /I scripts "%TARGET%\scripts" >nul 2>&1
copy /Y package.json "%TARGET%\" >nul
copy /Y package-lock.json "%TARGET%\" >nul 2>&1
copy /Y tsconfig.json "%TARGET%\" >nul
copy /Y drizzle.config.ts "%TARGET%\" >nul 2>&1

echo       Files copied.

REM ── Step 4: Restore the backed-up database ──────────────
if exist "%TARGET%\data\backups\%BACKUP_NAME%" (
    echo [4/5] Restoring user database...
    copy /Y "%TARGET%\data\backups\%BACKUP_NAME%" "%TARGET%\data\sar-tools.db" >nul
    echo       Database restored — no user data lost.
) else (
    echo [4/5] No database to restore — will initialize fresh.
    if exist "data\sar-tools.db" (
        copy /Y "data\sar-tools.db" "%TARGET%\data\sar-tools.db" >nul
        echo       Copied development database as starting point.
    )
)

REM ── Step 5: Run migrations on target ─────────────────────
echo [5/5] Running migrations...
cd /d "%TARGET%"
call npx tsx server/migrate-changelog.ts 2>nul
call npx tsx server/migrate-locations.ts 2>nul
call npx tsx server/migrate-holidays.ts 2>nul
echo       Migrations complete.

echo.
echo ══════════════════════════════════════════════════════════
echo  DEPLOYMENT COMPLETE
echo  Target: %TARGET%
echo.
echo  To start the server on the target machine:
echo    cd %TARGET%
echo    npm install --production
echo    node dist/index.cjs
echo.
echo  Or for development mode:
echo    npm install
echo    npm run dev
echo ══════════════════════════════════════════════════════════
