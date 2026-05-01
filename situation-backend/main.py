# Situation Pro - Legacy Entry Point (Redirected to session/main.py)
# 
# 이제 모든 주문 및 세션 로직은 'session/main.py'에서 처리됩니다.
# 서버 실행 명령어: 
#   py -m uvicorn session.main:app --reload --port 8000

import uvicorn
from session.main import app  # Render 배포를 위해 app 객체를 외부로 노출

if __name__ == "__main__":
    print("🚀 Starting Situation Pro Session Server...")
    uvicorn.run("session.main:app", host="0.0.0.0", port=8000, reload=True)
