import hashlib
import os
from fastapi import APIRouter, HTTPException
from werkzeug.security import check_password_hash
from ..database import get_db_conn
from ..auth import create_token

router = APIRouter()

ADMIN_ID = os.getenv("ADMIN_ID", "admin")
ADMIN_PW = os.getenv("ADMIN_PASSWORD", "1212")


@router.post("/api/auth/login")
async def login(data: dict):
    user_id = data.get("id", "").strip()
    password = data.get("password", "")

    if not user_id or not password:
        raise HTTPException(status_code=400, detail="아이디와 비밀번호를 입력해 주세요")

    # admin 환경변수 계정 (평문/SHA-256 모두 허용)
    if user_id == ADMIN_ID:
        admin_pw_hash = hashlib.sha256(ADMIN_PW.encode()).hexdigest()
        if password not in (ADMIN_PW, admin_pw_hash):
            raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다")
        token = create_token(ADMIN_ID, "", "admin")
        return {"token": token, "role": "admin", "store_id": "", "name": "관리자"}

    # DB users 테이블에서 조회
    try:
        conn = get_db_conn()
        cur = conn.cursor()
        cur.execute(
            "SELECT username, password, role, store_id, full_name, is_approved "
            "FROM users WHERE username = %s",
            (user_id,)
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB 오류: {e}")

    if not row:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다")

    db_username, db_password, db_role, db_store_id, db_name, db_approved = row

    # 패스워드 검증: DB 저장 포맷에 따라 자동 분기
    # - werkzeug 포맷 (pbkdf2:sha256:... 또는 scrypt:...): check_password_hash 사용
    # - SHA-256 hex (64자, 프론트 직접 가입 경로): 직접 비교
    # - 그 외 평문: 직접 비교 (레거시 호환)
    pw_valid = False
    try:
        if db_password.startswith(("pbkdf2:", "scrypt:")):
            # werkzeug generate_password_hash로 저장된 계정 (seed/관리자 생성)
            pw_valid = check_password_hash(db_password, password)
        elif len(db_password) == 64 and all(c in "0123456789abcdef" for c in db_password):
            # 클라이언트에서 SHA-256으로 해시 후 저장된 계정 (handleSignup 경로)
            # 클라이언트도 SHA-256 전송하므로 hex 직접 비교
            pw_valid = (db_password == password)
        else:
            # 레거시 평문 또는 기타 포맷: werkzeug 시도 후 직접 비교 폴백
            try:
                pw_valid = check_password_hash(db_password, password)
            except Exception:
                pw_valid = (db_password == password)
    except Exception:
        pw_valid = False

    if not pw_valid:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다")

    if not db_approved and db_role != "admin":
        raise HTTPException(status_code=403, detail="승인 대기 중인 계정입니다. 관리자 승인 후 로그인 가능합니다.")

    store_id = db_store_id or ""
    name = db_name or db_username
    token = create_token(db_username, store_id, db_role)
    return {"token": token, "role": db_role, "store_id": store_id, "name": name}
