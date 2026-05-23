import json
import os
from psycopg2.extras import RealDictCursor  # type: ignore
from .connection import get_db_conn

POOL_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "knowledge_pool.json")


def seed_stores_from_pool():
    """stores 테이블이 비어있을 때 pool.json에서 고유 매장을 자동 시딩."""
    conn = get_db_conn()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM stores")
        count = cur.fetchone()[0]
        if count > 0:
            cur.close()
            conn.close()
            return

        if not os.path.exists(POOL_FILE):
            cur.close()
            conn.close()
            return

        with open(POOL_FILE, encoding="utf-8") as f:
            pool = json.load(f)

        seen = {}
        for bundle in pool:
            sid = bundle.get("store_id", "")
            sname = bundle.get("store", "")
            if sid and sname and sid not in seen:
                seen[sid] = sname

        for sid, sname in seen.items():
            cur.execute("""
                INSERT INTO stores (id, name, ceo_name, signature_owner, monthly_fee, payment_status, payment_history, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (id) DO NOTHING
            """, (sid, sname, "", sid, 0, "정상", "[]"))
            print(f"  매장 자동 시딩: {sname} ({sid})")

        conn.commit()
        cur.close()
        conn.close()
        print(f"✅ Pool.json에서 {len(seen)}개 매장 시딩 완료")
    except Exception as e:
        print(f"⚠️ seed_stores_from_pool Error: {e}")


def get_stores_db():
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT
                id AS store_id,
                name AS store_name,
                ceo_name AS owner_name,
                COALESCE(signature_owner, 'owner-' || id) AS owner_id,
                COALESCE(monthly_fee, 0) AS monthly_fee,
                COALESCE(payment_status, '정상') AS payment_status,
                payment_history,
                COALESCE(created_at::text, NOW()::text) AS timestamp
            FROM stores
            ORDER BY created_at DESC
        """)
        results = cur.fetchall()
        cur.close()
        conn.close()
        return results
    except Exception as e:
        print(f"Get Stores DB Error: {e}")
        return []

def add_store_db(store_id: str, store_name: str, owner_name: str, owner_id: str, monthly_fee: int, payment_status: str, payment_history: str):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO stores (id, name, ceo_name, signature_owner, monthly_fee, payment_status, payment_history, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        """, (store_id, store_name, owner_name, owner_id, monthly_fee, payment_status, payment_history))
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Add Store DB Error: {e}")
        return False

def update_store_db(store_id: str, store_name: str, owner_name: str, owner_id: str, monthly_fee: int, payment_status: str, payment_history: str):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE stores
            SET name = %s, ceo_name = %s, signature_owner = %s, monthly_fee = %s, payment_status = %s, payment_history = %s
            WHERE id = %s
        """, (store_name, owner_name, owner_id, monthly_fee, payment_status, payment_history, store_id))
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update Store DB Error: {e}")
        return False

def delete_store_db(store_id: str):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM stores WHERE id = %s", (store_id,))
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Delete Store DB Error: {e}")
        return False

def get_store_use_kitchen(store_id: str) -> bool:
    conn = get_db_conn()
    if not conn: return True
    try:
        cur = conn.cursor()
        cur.execute("SELECT use_kitchen FROM stores WHERE id = %s", (store_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row is None or row[0] is None:
            return True
        return bool(row[0])
    except Exception as e:
        print(f"Get Store use_kitchen Error: {e}")
        return True

def update_store_use_kitchen(store_id: str, use_kitchen: bool) -> bool:
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("UPDATE stores SET use_kitchen = %s WHERE id = %s", (use_kitchen, store_id))
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update Store use_kitchen Error: {e}")
        return False

def get_reservation_settings(store_id: str) -> dict:
    conn = get_db_conn()
    if not conn: return {"start": "11:00", "end": "20:00"}
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT reservation_settings FROM stores WHERE id = %s", (store_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row and row['reservation_settings']:
            return row['reservation_settings']
        return {"start": "11:00", "end": "20:00"}
    except Exception as e:
        print(f"Get reservation_settings Error: {e}")
        return {"start": "11:00", "end": "20:00"}

def update_reservation_settings(store_id: str, settings: dict) -> bool:
    conn = get_db_conn()
    if not conn: return False
    try:
        import json
        cur = conn.cursor()
        cur.execute("UPDATE stores SET reservation_settings = %s WHERE id = %s", (json.dumps(settings), store_id))
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update reservation_settings Error: {e}")
        return False
