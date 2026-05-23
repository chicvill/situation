import hashlib
import os
from fastapi import APIRouter, HTTPException
from ..state import load_pool
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

    # admin 계정은 평문/해시 모두 허용 (pool.json 의존 없음)
    if user_id == ADMIN_ID:
        admin_pw_hash = hashlib.sha256(ADMIN_PW.encode()).hexdigest()
        if password not in (ADMIN_PW, admin_pw_hash):
            raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다")
        token = create_token(ADMIN_ID, "", "admin")
        return {"token": token, "role": "admin", "store_id": "", "name": "관리자"}

    pool = load_pool()
    matched = None
    
    # HTTP 환경(로컬 IP)에서는 프론트엔드의 crypto.subtle이 동작하지 않아 평문이 전달됩니다.
    # 비밀번호 길이가 64자(SHA-256 길이)가 아니면 평문으로 간주하고 서버에서 해싱합니다.
    target_pw = password
    if len(password) != 64:
        target_pw = hashlib.sha256(password.encode()).hexdigest()

    for bundle in pool:
        if bundle.get("type") != "PersonalInfos":
            continue
        items = bundle.get("items", [])
        b_id = next((i["value"] for i in items if i.get("name") == "아이디"), None)
        b_pw = next((i["value"] for i in items if i.get("name") == "비밀번호"), None)
        
        # 클라이언트가 보낸 원본(password) 또는 서버 해싱본(target_pw) 중 하나라도 일치하면 통과
        if b_id == user_id and (b_pw == password or b_pw == target_pw):
            matched = bundle
            break

    if not matched:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다")

    items = matched.get("items", [])
    role = next((i["value"] for i in items if i.get("name") == "권한"), "staff")
    store_id = matched.get("store_id", "")
    status = matched.get("status", "pending")
    name = next((i["value"] for i in items if i.get("name") == "이름"), user_id)

    if status != "approved" and role != "admin":
        raise HTTPException(status_code=403, detail="승인 대기 중인 계정입니다. 관리자 승인 후 로그인 가능합니다.")

    token = create_token(user_id, store_id, role)
    return {"token": token, "role": role, "store_id": store_id, "name": name}
