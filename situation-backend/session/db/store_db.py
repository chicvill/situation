from psycopg2.extras import RealDictCursor  # type: ignore
from .connection import get_db_conn


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
