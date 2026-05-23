@echo off
set BASE_DIR=%~dp0
cd /d %BASE_DIR%

echo ======================================================
echo  SITUATION PRO - Intelligent Restaurant System
echo ======================================================
echo.

echo Closing old server windows...
taskkill /F /FI "WINDOWTITLE eq SITUATION-BACKEND" /T 2>nul
taskkill /F /FI "WINDOWTITLE eq SITUATION-FRONTEND" /T 2>nul
taskkill /F /IM python.exe /T 2>nul
taskkill /F /IM node.exe /T 2>nul
timeout /t 2 /nobreak >nul
echo Old servers closed.
echo.

echo [0/2] Checking Python dependencies...
"%BASE_DIR%venv\Scripts\pip.exe" install aiomqtt python-dotenv --quiet
echo Dependencies ready.
echo.

echo [1/2] Starting Backend Server (venv Python)...
set PYTHONUTF8=1
wt -w 0 new-tab --title "SITUATION-BACKEND" -- cmd /k "cd /d "%BASE_DIR%situation-backend" && "%BASE_DIR%venv\Scripts\python.exe" -m uvicorn session.main:app --reload --host 0.0.0.0 --port 8000"
timeout /t 5 /nobreak >nul
echo.

echo [2/2] Starting Frontend App (React/Vite)...
wt -w 0 new-tab --title "SITUATION-FRONTEND" -- cmd /k "cd /d "%BASE_DIR%situation-room" && npm run dev"

echo.
echo ------------------------------------------------------
echo  MQTT Broker  : HiveMQ Cloud (TLS 8883 / WSS 8884)
echo  Backend API  : http://localhost:8000
echo  Frontend Dev : http://localhost:5173
echo  Frontend Prod: situation-room/dist  (npm run build)
echo ------------------------------------------------------
echo.
pause
