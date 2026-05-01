Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " SITUATION PRO - Intelligent Restaurant System" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# Backend
Write-Host "[1/2] Starting Backend Server..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/c cd situation-backend && py -m uvicorn session.main:app --reload --port 8000" -WindowStyle Normal

# Frontend
Write-Host "[2/2] Starting Frontend App..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/c cd situation-room && npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "------------------------------------------------------"
Write-Host " Server and Frontend are starting in new windows."
Write-Host " Please wait a few seconds, then visit:"
Write-Host " http://localhost:5173"
Write-Host "------------------------------------------------------"
Write-Host ""
Pause
