from fastapi import APIRouter
from ..database import get_db_conn

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
async def update_manual(data: dict):
    store_id = data.get("store_id", "store-1")
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
