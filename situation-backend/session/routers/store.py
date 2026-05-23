import json
import os
from typing import Dict, Any
from fastapi import APIRouter, HTTPException
from ..database import get_stores_db, add_store_db, update_store_db, delete_store_db, get_store_use_kitchen, update_store_use_kitchen
from ..models import StoreCreateRequest, StoreUpdateRequest

router = APIRouter()


@router.get("/api/local-ip")
async def get_local_ip():
    """로컬 개발 환경에서 QR 코드 생성 시 LAN IP를 반환"""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        ip = "localhost"
    return {"ip": ip}


@router.get("/api/stores")
async def get_stores():
    return get_stores_db()


@router.get("/api/debug-db")
async def debug_db_endpoint():
    status: Dict[str, Any] = {}
    try:
        db_url = os.getenv("DATABASE_URL")
        status["database_url_configured"] = bool(db_url)
        if db_url:
            status["database_url_masked"] = db_url.split("@")[-1] if "@" in db_url else "configured"

        import psycopg2  # type: ignore  — direct connection for diagnostics
        conn = psycopg2.connect(db_url)
        status["connection_test"] = "SUCCESS"

        cur = conn.cursor()
        # 테이블 존재 여부 확인
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'stores'
            )
        """)
        row = cur.fetchone()
        stores_table_exists = row[0] if row else False
        status["stores_table_exists"] = stores_table_exists

        if stores_table_exists:
            # 컬럼 정보 조회
            cur.execute("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'stores'
            """)
            status["stores_columns"] = [{"column_name": r[0], "data_type": r[1]} for r in cur.fetchall()]

            cur.execute("SELECT COUNT(*) FROM stores")
            count_row = cur.fetchone()
            status["stores_count"] = count_row[0] if count_row else 0
        else:
            status["stores_columns"] = []
            status["stores_count"] = 0

        cur.close()
        conn.close()
    except Exception as e:
        status["connection_test"] = "FAILED"
        status["error"] = str(e)
    return status


@router.post("/api/stores")
async def add_store(store: StoreCreateRequest):
    history_str = json.dumps(store.payment_history or [])
    success = add_store_db(
        store_id=store.store_id,
        store_name=store.store_name,
        owner_name=store.owner_name,
        owner_id=store.owner_id,
        monthly_fee=store.monthly_fee,
        payment_status=store.payment_status,
        payment_history=history_str
    )
    if success:
        return {"status": "success", "message": "Store registered successfully"}
    raise HTTPException(status_code=500, detail="Failed to add store to DB")


@router.put("/api/stores/{store_id}")
async def update_store(store_id: str, store: StoreUpdateRequest):
    history_str = json.dumps(store.payment_history or [])
    success = update_store_db(
        store_id=store_id,
        store_name=store.store_name,
        owner_name=store.owner_name,
        owner_id=store.owner_id,
        monthly_fee=store.monthly_fee,
        payment_status=store.payment_status,
        payment_history=history_str
    )
    if success:
        return {"status": "success", "message": "Store updated successfully"}
    raise HTTPException(status_code=500, detail="Failed to update store in DB")


@router.delete("/api/stores/{store_id}")
async def delete_store(store_id: str):
    success = delete_store_db(store_id)
    if success:
        return {"status": "success", "message": "Store deleted successfully"}
    raise HTTPException(status_code=500, detail="Failed to delete store from DB")


@router.get("/api/stores/{store_id}/settings")
async def get_store_settings(store_id: str):
    from ..database import get_store_use_kitchen, get_reservation_settings
    use_kitchen = get_store_use_kitchen(store_id)
    reservation_settings = get_reservation_settings(store_id)
    return {"store_id": store_id, "use_kitchen": use_kitchen, "reservation_settings": reservation_settings}


@router.put("/api/stores/{store_id}/settings")
async def update_store_settings(store_id: str, data: Dict[str, Any]):
    from ..database import update_store_use_kitchen, update_reservation_settings
    if "use_kitchen" in data:
        use_kitchen = data.get("use_kitchen", True)
        update_store_use_kitchen(store_id, bool(use_kitchen))
    if "reservation_settings" in data:
        update_reservation_settings(store_id, data["reservation_settings"])
    return {"status": "success"}
