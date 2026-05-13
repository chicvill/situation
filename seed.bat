@echo off
set BASE_DIR=%~dp0
cd /d %BASE_DIR%

echo ======================================================
1. Running Database Seeding Script...
echo ======================================================
echo.

.\venv\Scripts\python.exe seed_db.py

echo.
echo ======================================================
echo Done! Please check if the stores are restored now.
echo ======================================================
echo.
pause
