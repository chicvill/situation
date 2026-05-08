@echo off
set BASE_DIR=%~dp0
cd /d %BASE_DIR%

echo ======================================================
echo  SITUATION PRO - GitHub Update & Run
echo ======================================================
echo.

echo [1/3] Pulling latest changes from GitHub (main)...
git pull origin main

echo.
echo [2/3] Cleaning up old processes...
taskkill /F /IM python.exe /T 2>nul
taskkill /F /IM node.exe /T 2>nul
echo.

echo [3/3] Starting Backend and Frontend Servers...
start "SITUATION-BACKEND" cmd /c "cd situation-backend && ..\venv\Scripts\python.exe -m uvicorn session.main:app --reload --host 0.0.0.0 --port 8000"
start "SITUATION-FRONTEND" cmd /c "cd situation-room && npm run dev"

echo.
echo ------------------------------------------------------
echo  System has been updated and restarted!
echo  Please wait a few seconds, then visit:
echo  http://localhost:5173
echo ------------------------------------------------------
echo.
pause
