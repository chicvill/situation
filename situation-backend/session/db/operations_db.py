import time
from datetime import datetime
from typing import Optional
from psycopg2.extras import RealDictCursor  # type: ignore
from .connection import get_db_conn


# --- 5-1. 스마트 대기 관리 (Waiting) ---
def save_waiting(waiting_data: dict):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO table_waitings (waiting_id, store_id, phone_number, party_size, status, timestamp)
            VALUES (%(waiting_id)s, %(store_id)s, %(phone_number)s, %(party_size)s, %(status)s, %(timestamp)s)
            ON CONFLICT (waiting_id) DO UPDATE SET
                status = EXCLUDED.status
        """
        cur.execute(query, {
            'waiting_id': waiting_data['waiting_id'],
            'store_id': waiting_data.get('store_id', 'store-1'),
            'phone_number': waiting_data['phone_number'],
            'party_size': waiting_data['party_size'],
            'status': waiting_data.get('status', 'waiting'),
            'timestamp': waiting_data.get('timestamp', datetime.now().isoformat())
        })
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Save Waiting Error: {e}")
        return False

def get_active_waitings(store_id: Optional[str] = None):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if store_id and store_id != "Total":
            cur.execute("""
                SELECT * FROM table_waitings
                WHERE status IN ('waiting', 'called') AND store_id = %(store_id)s
                ORDER BY timestamp ASC
            """, {'store_id': store_id})
        else:
            cur.execute("SELECT * FROM table_waitings WHERE status IN ('waiting', 'called') ORDER BY timestamp ASC")
        results = cur.fetchall()
        cur.close()
        conn.close()
        return results
    except Exception as e:
        print(f"Get Active Waitings Error: {e}")
        return []

def update_waiting_status(waiting_id: str, status: str):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("UPDATE table_waitings SET status = %(status)s WHERE waiting_id = %(waiting_id)s",
                   {'status': status, 'waiting_id': waiting_id})
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update Waiting Status Error: {e}")
        return False


# --- 5-2. 스마트 직원 호출 (Staff Call) ---
def save_call(call_data: dict):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO table_calls (call_id, table_id, session_id, call_type, status, timestamp)
            VALUES (%(call_id)s, %(table_id)s, %(session_id)s, %(call_type)s, %(status)s, %(timestamp)s)
            ON CONFLICT (call_id) DO UPDATE SET
                status = EXCLUDED.status
        """
        cur.execute(query, {
            'call_id': call_data['call_id'],
            'table_id': call_data['table_id'],
            'session_id': call_data['session_id'],
            'call_type': call_data['call_type'],
            'status': call_data.get('status', 'pending'),
            'timestamp': call_data.get('timestamp', datetime.now().isoformat())
        })
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Save Call Error: {e}")
        return False

def get_active_calls(table_id: Optional[str] = None, store_id: Optional[str] = None):
    max_retries = 3
    for attempt in range(max_retries):
        conn = get_db_conn()
        if not conn: return []
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            # JOIN 대신 서브쿼리 사용 → 락 순서 충돌(데드락) 방지
            if store_id and store_id != "Total":
                if table_id:
                    cur.execute("""
                        SELECT * FROM table_calls
                        WHERE table_id = %(table_id)s
                          AND status = 'pending'
                          AND session_id IN (
                              SELECT session_id FROM table_sessions
                              WHERE store_id = %(store_id)s
                          )
                        ORDER BY timestamp ASC
                    """, {'table_id': table_id, 'store_id': store_id})
                else:
                    cur.execute("""
                        SELECT * FROM table_calls
                        WHERE status = 'pending'
                          AND session_id IN (
                              SELECT session_id FROM table_sessions
                              WHERE store_id = %(store_id)s
                          )
                        ORDER BY timestamp ASC
                    """, {'store_id': store_id})
            else:
                if table_id:
                    cur.execute(
                        "SELECT * FROM table_calls WHERE table_id = %(table_id)s AND status = 'pending' ORDER BY timestamp ASC",
                        {'table_id': table_id}
                    )
                else:
                    cur.execute("SELECT * FROM table_calls WHERE status = 'pending' ORDER BY timestamp ASC")
            results = cur.fetchall()
            cur.close()
            conn.close()
            return results
        except Exception as e:
            try:
                conn.rollback()
                conn.close()
            except Exception:
                pass
            err_msg = str(e)
            if 'deadlock' in err_msg.lower() and attempt < max_retries - 1:
                print(f"⚠️ Get Active Calls deadlock (attempt {attempt + 1}), retrying...")
                time.sleep(0.1 * (attempt + 1))
                continue
            print(f"Get Active Calls Error: {e}")
            return []
    return []

def update_call_status(call_id: str, status: str):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("UPDATE table_calls SET status = %(status)s WHERE call_id = %(call_id)s",
                   {'status': status, 'call_id': call_id})
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update Call Status Error: {e}")
        return False


# --- 5-3. 실시간 사전 예약 (Reservation) ---
def save_reservation(res_data: dict):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO table_reservations (reservation_id, customer_name, phone_number, party_size, reserved_time, table_id, status)
            VALUES (%(reservation_id)s, %(customer_name)s, %(phone_number)s, %(party_size)s, %(reserved_time)s, %(table_id)s, %(status)s)
            ON CONFLICT (reservation_id) DO UPDATE SET
                status = EXCLUDED.status,
                table_id = EXCLUDED.table_id
        """
        cur.execute(query, {
            'reservation_id': res_data['reservation_id'],
            'customer_name': res_data['customer_name'],
            'phone_number': res_data['phone_number'],
            'party_size': res_data['party_size'],
            'reserved_time': res_data['reserved_time'],
            'table_id': res_data['table_id'],
            'status': res_data.get('status', 'requested')
        })
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Save Reservation Error: {e}")
        return False

def get_active_reservations():
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM table_reservations WHERE status IN ('requested', 'confirmed') ORDER BY reserved_time ASC")
        results = cur.fetchall()
        cur.close()
        conn.close()
        return results
    except Exception as e:
        print(f"Get Active Reservations Error: {e}")
        return []

def update_reservation_status(res_id: str, status: str):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("UPDATE table_reservations SET status = %(status)s WHERE reservation_id = %(res_id)s",
                   {'status': status, 'res_id': res_id})
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update Reservation Status Error: {e}")
        return False


# --- 5-4. 원클릭 셀프 주차 할인 (Parking) ---
def save_parking(park_data: dict):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO table_parkings (parking_id, session_id, vehicle_number, discount_minutes, status, timestamp)
            VALUES (%(parking_id)s, %(session_id)s, %(vehicle_number)s, %(discount_minutes)s, %(status)s, %(timestamp)s)
            ON CONFLICT (parking_id) DO UPDATE SET
                status = EXCLUDED.status
        """
        cur.execute(query, {
            'parking_id': park_data['parking_id'],
            'session_id': park_data['session_id'],
            'vehicle_number': park_data['vehicle_number'],
            'discount_minutes': park_data['discount_minutes'],
            'status': park_data.get('status', 'applied'),
            'timestamp': park_data.get('timestamp', datetime.now().isoformat())
        })
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Save Parking Error: {e}")
        return False

def get_parking_by_session(session_id: str):
    conn = get_db_conn()
    if not conn: return None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM table_parkings WHERE session_id = %(session_id)s LIMIT 1", {'session_id': session_id})
        result = cur.fetchone()
        cur.close()
        conn.close()
        return result
    except Exception as e:
        print(f"Get Parking By Session Error: {e}")
        return None

def get_active_parkings_db(store_id: Optional[str] = None):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if store_id and store_id != "Total":
            cur.execute("""
                SELECT p.*, s.table_id FROM table_parkings p
                JOIN table_sessions s ON p.session_id = s.session_id
                WHERE s.store_id = %(store_id)s
                ORDER BY p.timestamp DESC
            """, {'store_id': store_id})
        else:
            cur.execute("""
                SELECT p.*, s.table_id FROM table_parkings p
                JOIN table_sessions s ON p.session_id = s.session_id
                ORDER BY p.timestamp DESC
            """)
        results = cur.fetchall()
        cur.close()
        conn.close()
        return results
    except Exception as e:
        print(f"Get Active Parkings DB Error: {e}")
        return []
