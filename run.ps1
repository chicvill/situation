Write-Host "🚀 시스템 수호자 Antigravity 가동 시작" -ForegroundColor Cyan
Write-Host "📂 현재 경로: $PSScriptRoot" -ForegroundColor Gray

if (Test-Path "$PSScriptRoot\run_all.py") {
    py "$PSScriptRoot\run_all.py"
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "py 명령 실패. python으로 재시도합니다..."
        python "$PSScriptRoot\run_all.py"
    }
} else {
    Write-Error "run_all.py 파일을 찾을 수 없습니다."
}

Write-Host "계속하려면 아무 키나 누르세요..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
