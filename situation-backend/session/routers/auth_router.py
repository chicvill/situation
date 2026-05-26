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

    # HTTP 환경에서 평문으로 전달될 수 있으므로 평문과 해시 모두 시도
    pw_to_check = password
    if len(password) == 64:
        # 클라이언트가 SHA-256으로 보낸 경우 — werkzeug로 직접 검증 불가, 평문 재시도 처리 불가
        # 서버에서 해시 검증만 진행 (werkzeug 포맷은 check_password_hash로)
        pass

    try:
        pw_valid = check_password_hash(db_password, pw_to_check)
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
