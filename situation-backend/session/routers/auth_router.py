from fastapi import APIRouter, HTTPException
from ..state import load_pool
from ..auth import create_token

router = APIRouter()


@router.post("/api/auth/login")
async def login(data: dict):
    user_id = data.get("id", "").strip()
    password = data.get("password", "")

    if not user_id or not password:
        raise HTTPException(status_code=400, detail="아이디와 비밀번호를 입력해 주세요")

    pool = load_pool()
    matched = None
    for bundle in pool:
        if bundle.get("type") != "PersonalInfos":
            continue
        items = bundle.get("items", [])
        b_id = next((i["value"] for i in items if i.get("name") == "아이디"), None)
        b_pw = next((i["value"] for i in items if i.get("name") == "비밀번호"), None)
        if b_id == user_id and b_pw == password:
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
