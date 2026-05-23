@echo off
set BASE_DIR=%~dp0
cd /d "%BASE_DIR%situation-backend"
echo.
echo ======================================================
echo  SITUATION E2E Test Runner
echo ======================================================
echo.
if "%1"=="" (
    "%BASE_DIR%venv\Scripts\python.exe" test_e2e.py
) else (
    "%BASE_DIR%venv\Scripts\python.exe" test_e2e.py --scenario %1
)
echo.
pause