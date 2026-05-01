@echo off
set BASE_DIR=%~dp0
cd /d %BASE_DIR%

echo ======================================================
echo  SITUATION PRO - System Startup (Port 8001)
echo ======================================================
echo.

echo [1/2] Starting Backend on Port 8001...
start "BACKEND" cmd /k "cd situation-backend && py -m uvicorn session.main:app --reload --host 0.0.0.0 --port 8001"

echo [2/2] Starting Frontend...
start "FRONTEND" cmd /c "cd situation-room && npm run dev"

echo.
echo Please visit: http://localhost:5173
echo (Backend is now running on port 8001)
echo.
pause
