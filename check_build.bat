@echo off
echo ======================================================
echo  [SITUATION PRO] Frontend Build Error Checker
echo ======================================================
echo.
echo Running TypeScript Compiler (npm run build)...
echo Please wait...
echo.
cd /d "%~dp0situation-room"
call npm run build
echo.
echo ======================================================
echo Check finished! 
echo If you see an error above (like TS2345, ERR!, etc),
echo please copy the error text and show it to me!
echo ======================================================
pause
