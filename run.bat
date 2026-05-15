@echo off
set BASE_DIR=%~dp0
cd /d %BASE_DIR%

echo ======================================================
echo  SITUATION PRO - Intelligent Restaurant System
echo ======================================================
echo.

echo Closing old server windows...
taskkill /F /FI "WINDOWTITLE eq SITUATION-MQTT" /T 2>nul
taskkill /F /FI "WINDOWTITLE eq SITUATION-BACKEND" /T 2>nul
taskkill /F /FI "WINDOWTITLE eq SITUATION-FRONTEND" /T 2>nul
taskkill /F /IM python.exe /T 2>nul
taskkill /F /IM node.exe /T 2>nul
taskkill /F /IM mosquitto.exe /T 2>nul
timeout /t 3 /nobreak >nul
echo Old servers closed.
echo.

echo [0/3] Installing aiomqtt in venv (MQTT support)...
"%BASE_DIR%venv\Scripts\pip.exe" install aiomqtt --quiet
echo aiomqtt ready.
echo.

echo [1/3] Starting MQTT Broker (TCP:1885 / WS:9001)...
wt -w 0 new-tab --title "SITUATION-MQTT" -- cmd /k ""C:\Program Files\mosquitto\mosquitto.exe" -c "%BASE_DIR%mosquitto.conf" -v"
timeout /t 2 /nobreak >nul
echo.

echo [2/3] Starting Backend Server (venv Python)...
wt -w 0 new-tab --title "SITUATION-BACKEND" -- cmd /k "set PYTHONUTF8=1 && cd /d "%BASE_DIR%situation-backend" && "%BASE_DIR%venv\Scripts\python.exe" -m uvicorn session.main:app --reload --host 0.0.0.0 --port 8000"
timeout /t 3 /nobreak >nul
echo.

echo [3/3] Starting Frontend App (React/Vite)...
wt -w 0 new-tab --title "SITUATION-FRONTEND" -- cmd /k "cd /d "%BASE_DIR%situation-room" && npm run dev"

echo.
echo ------------------------------------------------------
echo  MQTT Broker  : TCP localhost:1885 / WS localhost:9001
echo  Backend API  : http://localhost:8000
echo  Frontend     : http://localhost:5173
echo ------------------------------------------------------
echo.
pause
