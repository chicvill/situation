@echo off
set BASE_DIR=%~dp0
cd /d %BASE_DIR%
py run_all.py
if %errorlevel% neq 0 python run_all.py
pause
