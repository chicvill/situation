@echo off
set BASE_DIR=%~dp0
cd /d %BASE_DIR%

echo ======================================================
echo  SITUATION PRO - Intelligent Restaurant System
echo ======================================================
echo.

echo 🧹 Cleaning up old processes and freeing port 8001...
taskkill /F /IM python.exe /T 2>nul
taskkill /F /IM node.exe /T 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8001 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
echo.

echo [1/2] Starting Backend Server (Session Based)...
start "SITUATION-BACKEND" cmd /k "cd situation-backend && ..\venv\Scripts\python.exe -m uvicorn session.main:app --reload --host 0.0.0.0 --port 8001"

echo [2/2] Starting Frontend App (React/Vite)...
start "SITUATION-FRONTEND" cmd /k "cd situation-room && npm run dev"

echo.
echo ------------------------------------------------------
echo  Server and Frontend are starting in new windows.
echo  Please wait a few seconds, then visit:
echo  http://localhost:5173
echo ------------------------------------------------------
echo.
pause
