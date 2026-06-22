@echo off
:: 1. 코드 페이지를 UTF-8(65001)로 변경하여 한글 깨짐 방지
chcp 65001 >nul

echo ==========================================
echo    AI 관상가 앱 개발 서버를 시작합니다
echo ==========================================

:: 2. 라이브러리 설치 확인
if not exist node_modules (
    echo [정보] 필수 라이브러리를 설치 중입니다. 잠시만 기다려주세요...
    call npm install
)

:: 3. Vite 서버 실행
echo [실행] 개발 서버를 구동합니다...
call npm run dev

pause