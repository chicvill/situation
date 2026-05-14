import json
from datetime import datetime
from typing import Optional
from psycopg2.extras import RealDictCursor  # type: ignore
from .connection import get_db_conn


def save_session(session_data: dict):
    conn = get_db_conn()
    cur = conn.cursor()
    try:
        # Named Parameter 방식으로 변경 (더 안전함)
        query = """
            INSERT INTO table_sessions (session_id, store_id, table_id, device_id, status, checkin_time, metadata)
            VALUES (%(session_id)s, %(store_id)s, %(table_id)s, %(device_id)s, %(status)s, %(checkin_time)s, %(metadata)s)
            ON CONFLICT (session_id) DO UPDATE SET
                status = EXCLUDED.status,
                checkout_time = EXCLUDED.checkout_time,
                metadata = EXCLUDED.metadata
        """
        params = {
            'session_id': session_data['session_id'],
            'store_id': session_data['store_id'],
            'table_id': session_data['table_id'],
            'device_id': session_data.get('device_id'),
            'status': session_data['status'],
            'checkin_time': session_data['checkin_time'],
            'metadata': json.dumps(session_data.get('metadata', {}))
        }
        cur.execute(query, params)
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Supabase Save Error (Session): {e}")

def get_active_session(store_id: str, table_id: str):
    conn = get_db_conn()
    if not conn: return None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if not store_id or store_id == "Total":
            cur.execute("""
                SELECT * FROM table_sessions
                WHERE table_id = %(table_id)s AND status != 'closed'
                ORDER BY checkin_time DESC LIMIT 1
            """, {'table_id': table_id})
        else:
            cur.execute("""
                SELECT * FROM table_sessions
                WHERE store_id = %(store_id)s AND table_id = %(table_id)s AND status != 'closed'
                ORDER BY checkin_time DESC LIMIT 1
            """, {'store_id': store_id, 'table_id': table_id})
        result = cur.fetchone()
        cur.close()
        conn.close()
        return result
    except Exception as e:
        print(f"Get Active Session Error: {e}")
        return None

def get_session_by_id(session_id: str):
    conn = get_db_conn()
    if not conn: return None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM table_sessions WHERE session_id = %(session_id)s", {'session_id': session_id})
        result = cur.fetchone()
        cur.close()
        conn.close()
        return result
    except Exception as e:
        print(f"Get Session By Id Error: {e}")
        return None

def update_session_status(session_id: str, status: str):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        if status == 'closed':
            cur.execute("UPDATE table_sessions SET status = %(status)s, checkout_time = %(checkout_time)s WHERE session_id = %(session_id)s",
                       {'status': status, 'checkout_time': datetime.now().isoformat(), 'session_id': session_id})
        else:
            cur.execute("UPDATE table_sessions SET status = %(status)s WHERE session_id = %(session_id)s",
                       {'status': status, 'session_id': session_id})
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update Session Status Error: {e}")
        return False

def update_session_device_id(session_id: str, device_id: str):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("UPDATE table_sessions SET device_id = %(device_id)s WHERE session_id = %(session_id)s",
                   {'device_id': device_id, 'session_id': session_id})
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update Session Device ID Error: {e}")
        return False

def get_all_active_sessions(store_id: Optional[str] = None):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        query = "SELECT * FROM table_sessions WHERE status != 'closed'"
        params = {}
        if store_id and store_id != "Total":
            query += " AND store_id = %(store_id)s"
            params['store_id'] = store_id

        cur.execute(query, params)
        sessions = cur.fetchall()

        for sess in sessions:
            cur.execute("SELECT * FROM table_orders WHERE session_id = %(session_id)s ORDER BY order_seq",
                       {'session_id': sess['session_id']})
            sess['orders'] = cur.fetchall()

        cur.close()
        conn.close()
        return sessions
    except Exception as e:
        print(f"Get All Active Sessions Error: {e}")
        return []
