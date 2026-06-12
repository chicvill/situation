from datetime import datetime
from typing import Optional
from psycopg2.extras import RealDictCursor  # type: ignore
from .connection import get_db_conn


def _ensure_accumulated_column():
    conn = get_db_conn()
    if not conn: return
    try:
        cur = conn.cursor()
        cur.execute("ALTER TABLE customer_points ADD COLUMN IF NOT EXISTS accumulated_points INTEGER DEFAULT 0")
        cur.execute("UPDATE customer_points SET accumulated_points = points WHERE accumulated_points = 0 AND points > 0")
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Points migration error: {e}")

_ensure_accumulated_column()


def normalize_phone(phone) -> str:
    if not phone:
        return ""
    phone_str = str(phone)
    digits = "".join(c for c in phone_str if c.isdigit())
    if digits.startswith("010"):
        if len(digits) == 11:
            return f"{digits[:3]}-{digits[3:7]}-{digits[7:]}"
        elif len(digits) == 10:
            return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"
    elif digits.startswith("02"):
        if len(digits) == 9:
            return f"{digits[:2]}-{digits[2:5]}-{digits[5:]}"
        elif len(digits) == 10:
            return f"{digits[:2]}-{digits[2:6]}-{digits[6:]}"
    elif len(digits) >= 9 and any(digits.startswith(prefix) for prefix in ["031", "032", "033", "041", "042", "043", "051", "052", "053", "054", "055", "061", "062", "063", "064"]):
        if len(digits) == 10:
            return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"
        elif len(digits) == 11:
            return f"{digits[:3]}-{digits[3:7]}-{digits[7:]}"
    if len(digits) == 11:
        return f"{digits[:3]}-{digits[3:7]}-{digits[7:]}"
    elif len(digits) == 10:
        return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"
    return phone_str


def get_customer_points(phone: str, store_id: str = 'store-1'):
    phone = normalize_phone(phone)
    conn = get_db_conn()
    if not conn: return {'usable_points': 0, 'accumulated_points': 0, 'top_percent_accumulated': 100}
    try:
        cur = conn.cursor()
        cur.execute("""
            WITH ranked AS (
                SELECT phone, points, COALESCE(accumulated_points, 0) AS accumulated_points,
                    CEIL(100.0 * RANK() OVER (ORDER BY COALESCE(accumulated_points, 0) DESC)
                         / NULLIF(COUNT(*) OVER (), 0)) AS top_pct
                FROM customer_points WHERE store_id = %(store_id)s
            )
            SELECT points, accumulated_points, top_pct FROM ranked WHERE phone = %(phone)s
        """, {'phone': phone, 'store_id': store_id})
        result = cur.fetchone()
        cur.close()
        conn.close()
        if not result:
            return {'usable_points': 0, 'accumulated_points': 0, 'top_percent_accumulated': 100}
        return {
            'usable_points': result[0] or 0,
            'accumulated_points': result[1] or 0,
            'top_percent_accumulated': int(result[2] or 100),
        }
    except Exception as e:
        print(f"Get Points Error: {e}")
        return {'usable_points': 0, 'accumulated_points': 0, 'top_percent_accumulated': 100}


def update_customer_points(phone: str, points_to_add: int, store_id: str = 'store-1'):
    phone = normalize_phone(phone)
    if points_to_add < 0:
        print(f"Update Points Error: negative points ({points_to_add}) rejected for {phone}")
        return False
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO customer_points (phone, store_id, points, accumulated_points, last_updated)
            VALUES (%(phone)s, %(store_id)s, %(points)s, %(points)s, %(now)s)
            ON CONFLICT (phone, store_id) DO UPDATE SET
                points = customer_points.points + %(points)s,
                accumulated_points = COALESCE(customer_points.accumulated_points, 0) + %(points)s,
                last_updated = %(now)s
        """, {
            'phone': phone,
            'store_id': store_id,
            'points': points_to_add,
            'now': datetime.now().isoformat()
        })
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update Points Error: {e}")
        return False


def use_customer_points(phone: str, points_to_use: int, store_id: str = 'store-1'):
    phone = normalize_phone(phone)
    if points_to_use <= 0:
        return False
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE customer_points
            SET points = points - %(pts)s, last_updated = %(now)s
            WHERE phone = %(phone)s AND store_id = %(store_id)s AND points >= %(pts)s
        """, {'phone': phone, 'pts': points_to_use, 'store_id': store_id, 'now': datetime.now().isoformat()})
        updated = cur.rowcount
        conn.commit()
        cur.close()
        conn.close()
        return updated > 0
    except Exception as e:
        print(f"Use Points Error: {e}")
        return False


def get_points_list_db(store_id: Optional[str] = None):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        base_select = """
            SELECT *,
                CEIL(100.0 * RANK() OVER (ORDER BY COALESCE(accumulated_points, 0) DESC)
                     / NULLIF(COUNT(*) OVER (), 0)) AS top_percent_accumulated,
                CEIL(100.0 * RANK() OVER (ORDER BY points DESC)
                     / NULLIF(COUNT(*) OVER (), 0)) AS top_percent_usable
            FROM customer_points
        """
        if store_id and store_id != "Total":
            cur.execute(base_select + " WHERE store_id = %(store_id)s ORDER BY last_updated DESC", {'store_id': store_id})
        else:
            cur.execute(base_select + " ORDER BY last_updated DESC")
        results = cur.fetchall()
        cur.close()
        conn.close()
        return [dict(r) for r in results]
    except Exception as e:
        print(f"Get Points List DB Error: {e}")
        return []
