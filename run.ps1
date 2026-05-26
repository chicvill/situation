$BASE = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " SITUATION PRO - Intelligent Restaurant System" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# 기존 프로세스 종료
Write-Host "Closing old server processes..." -ForegroundColor Gray
Get-Process -Name "mosquitto" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "python"    -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "node"      -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# aiomqtt 설치 확인
Write-Host "[0/3] Checking aiomqtt..." -ForegroundColor Gray
& "$BASE\venv\Scripts\pip.exe" install aiomqtt --quiet

# [1/3] MQTT 브로커
Write-Host "[1/3] Starting MQTT Broker (TCP:1885 / WS:9001)..." -ForegroundColor Yellow
Start-Process -FilePath "C:\Program Files\mosquitto\mosquitto.exe" `
    -ArgumentList "-c `"$BASE\mosquitto.conf`" -v" `
    -WindowStyle Normal
Start-Sleep -Seconds 2

# [2/3] 백엔드 (venv Python)
Write-Host "[2/3] Starting Backend Server (port 8000)..." -ForegroundColor Yellow
$env:PYTHONUTF8 = "1"
Start-Process cmd -ArgumentList "/k cd /d `"$BASE\situation-backend`" && `"$BASE\venv\Scripts\python.exe`" -m uvicorn session.main:app --reload --host 0.0.0.0 --port 8000" -WindowStyle Normal
Start-Sleep -Seconds 3

# [3/3] 프론트엔드
Write-Host "[3/3] Starting Frontend App (port 3000)..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/k cd /d `"$BASE\situation-room`" && npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "------------------------------------------------------"
Write-Host " MQTT Broker  : TCP localhost:1885 / WS localhost:9001"
Write-Host " Backend API  : http://localhost:8000"
Write-Host " Frontend Local : http://localhost:3000"
Write-Host " Frontend Mobile: http://192.168.219.152:3000 (스마트폰/태블릿 접속)"
Write-Host "------------------------------------------------------"
Write-Host ""
Pause
