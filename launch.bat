@echo off
cd /d %~dp0

echo [FIX] Starting Backend on 127.0.0.1:9000...
start "BACKEND" cmd /k "cd situation-backend && py -m uvicorn session.main:app --reload --host 127.0.0.1 --port 9000"

echo [FIX] Starting Frontend...
start "FRONTEND" cmd /c "cd situation-room && npm run dev"

echo.
echo Please visit: http://localhost:5173
echo.
pause
