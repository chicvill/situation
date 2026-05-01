@echo off
set BASE_DIR=%~dp0
cd /d %BASE_DIR%

echo ======================================================
echo  SITUATION PRO - Intelligent Restaurant System
echo ======================================================
echo.

echo 🧹 Cleaning up old processes...
taskkill /F /IM python.exe /T 2>nul
taskkill /F /IM node.exe /T 2>nul
echo.

echo [1/2] Starting Backend Server (Session Based)...
start "SITUATION-BACKEND" cmd /c "cd situation-backend && py -m uvicorn session.main:app --reload --host 0.0.0.0 --port 8000"

echo [2/2] Starting Frontend App (React/Vite)...
start "SITUATION-FRONTEND" cmd /c "cd situation-room && npm run dev"

echo.
echo ------------------------------------------------------
echo  Server and Frontend are starting in new windows.
echo  Please wait a few seconds, then visit:
echo  http://localhost:5173
echo ------------------------------------------------------
echo.
pause
