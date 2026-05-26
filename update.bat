@echo off
echo ============================================
echo   Foreign Direct Investment - Deploy Update
echo ============================================
echo.

cd /d "%~dp0"

echo Adding all changes...
git add -A

echo.
set /p MSG="Commit message (or press Enter for default): "
if "%MSG%"=="" set MSG=Update dashboard data %date%

echo.
echo Committing: %MSG%
git commit -m "%MSG%"

echo.
echo Pushing to GitHub...
git push origin main

echo.
echo ============================================
echo   Deploy complete!
echo ============================================
pause
