from fastapi import APIRouter, Depends
from ..database import get_db_conn
from ..auth import verify_token

router = APIRouter()


@router.get("/api/store/manual")
async def get_manual(store_id: str = "store-1"):
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("SELECT manual FROM store_configs WHERE store_id = %s", (store_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return {"manual": row[0] if row else ""}


@router.post("/api/store/manual")
async def update_manual(data: dict, user: dict = Depends(verify_token)):
    # store_id는 토큰에서 추출 — 요청 본문의 store_id는 무시
    store_id = user["store_id"]
    manual = data.get("manual", "")
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO store_configs (store_id, manual)
        VALUES (%s, %s)
        ON CONFLICT (store_id) DO UPDATE SET manual = EXCLUDED.manual
    """, (store_id, manual))
    conn.commit()
    cur.close()
    conn.close()
    return {"status": "success"}
