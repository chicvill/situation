from datetime import datetime
from typing import Optional
from psycopg2.extras import RealDictCursor  # type: ignore
from .connection import get_db_conn


def get_customer_points(phone: str, store_id: str = 'store-1'):
    conn = get_db_conn()
    if not conn: return 0
    try:
        cur = conn.cursor()
        cur.execute("SELECT points FROM customer_points WHERE phone = %(phone)s AND store_id = %(store_id)s", {'phone': phone, 'store_id': store_id})
        result = cur.fetchone()
        cur.close()
        conn.close()
        return result[0] if result else 0
    except Exception as e:
        print(f"Get Points Error: {e}")
        return 0

def update_customer_points(phone: str, points_to_add: int, store_id: str = 'store-1'):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO customer_points (phone, store_id, points, last_updated)
            VALUES (%(phone)s, %(store_id)s, %(points)s, %(last_updated)s)
            ON CONFLICT (phone, store_id) DO UPDATE SET
                points = customer_points.points + %(points)s,
                last_updated = %(last_updated)s
        """, {
            'phone': phone,
            'store_id': store_id,
            'points': points_to_add,
            'last_updated': datetime.now().isoformat()
        })
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update Points Error: {e}")
        return False

def get_points_list_db(store_id: Optional[str] = None):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if store_id and store_id != "Total":
            cur.execute("""
                SELECT * FROM customer_points
                WHERE store_id = %(store_id)s
                ORDER BY last_updated DESC
            """, {'store_id': store_id})
        else:
            cur.execute("""
                SELECT * FROM customer_points
                ORDER BY last_updated DESC
            """)
        results = cur.fetchall()
        cur.close()
        conn.close()
        return results
    except Exception as e:
        print(f"Get Points List DB Error: {e}")
        return []
