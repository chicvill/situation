from datetime import datetime
from typing import Optional
from psycopg2.extras import RealDictCursor  # type: ignore
from .connection import get_db_conn


def save_attendance_checkin(log_id: str, staff_id: str, store_id: str, check_in_time: str, tardy: bool = False, device_id: str = None):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO table_attendance_logs (log_id, staff_id, store_id, check_in_time, status, tardy, device_id)
            VALUES (%(log_id)s, %(staff_id)s, %(store_id)s, %(check_in_time)s, 'working', %(tardy)s, %(device_id)s)
            ON CONFLICT (log_id) DO UPDATE SET
                check_in_time = EXCLUDED.check_in_time,
                tardy = EXCLUDED.tardy,
                device_id = EXCLUDED.device_id
        """
        cur.execute(query, {
            'log_id': log_id,
            'staff_id': staff_id,
            'store_id': store_id,
            'check_in_time': check_in_time,
            'tardy': tardy,
            'device_id': device_id
        })
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Save Attendance Checkin Error: {e}")
        return False

def get_today_checkin(staff_id: str):
    """당일 출근 기록 조회 (중복 스캔 방지용)"""
    conn = get_db_conn()
    if not conn: return None
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT log_id, device_id, check_in_time, tardy
            FROM table_attendance_logs
            WHERE staff_id = %(staff_id)s AND check_in_time LIKE %(today)s
            ORDER BY check_in_time ASC
            LIMIT 1
        """, {'staff_id': staff_id, 'today': f"{today}%"})
        row = cur.fetchone()
        cur.close()
        conn.close()
        return row
    except Exception as e:
        print(f"Get Today Checkin Error: {e}")
        return None

def save_attendance_checkout(staff_id: str, log_id: str, check_out_time: str, work_minutes: int, device_id: str = None):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE table_attendance_logs
            SET check_out_time = %(check_out_time)s,
                work_minutes = %(work_minutes)s,
                status = 'completed',
                device_id = COALESCE(%(device_id)s, device_id)
            WHERE log_id = %(log_id)s AND staff_id = %(staff_id)s AND status = 'working'
        """, {
            'log_id': log_id,
            'staff_id': staff_id,
            'check_out_time': check_out_time,
            'work_minutes': work_minutes,
            'device_id': device_id
        })
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Save Attendance Checkout Error: {e}")
        return False

def get_today_checkout(staff_id: str):
    """당일 퇴근 기록 조회 (중복 스캔 방지용)"""
    conn = get_db_conn()
    if not conn: return None
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT log_id, device_id, check_out_time, work_minutes
            FROM table_attendance_logs
            WHERE staff_id = %(staff_id)s AND check_out_time LIKE %(today)s
            ORDER BY check_out_time DESC LIMIT 1
        """, {'staff_id': staff_id, 'today': f"{today}%"})
        row = cur.fetchone()
        cur.close()
        conn.close()
        return dict(row) if row else None
    except Exception as e:
        print(f"Get Today Checkout Error: {e}")
        return None

def get_active_attendance_log(staff_id: str):
    conn = get_db_conn()
    if not conn: return None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM table_attendance_logs WHERE staff_id = %(staff_id)s AND status = 'working' LIMIT 1", {'staff_id': staff_id})
        row = cur.fetchone()
        cur.close()
        conn.close()
        return row
    except Exception as e:
        print(f"Get Active Attendance Log Error: {e}")
        return None

def get_recent_device_scan(device_id: str, minutes: int = 5):
    """동일 기기의 최근 N분 내 스캔 기록 조회 — 대리 출퇴근 방지"""
    if not device_id or device_id in ('unknown', ''):
        return None
    conn = get_db_conn()
    if not conn:
        return None
    try:
        from datetime import timedelta
        cutoff = (datetime.now() - timedelta(minutes=minutes)).isoformat()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT log_id, staff_id, device_id, check_in_time, check_out_time
            FROM table_attendance_logs
            WHERE device_id = %(device_id)s
              AND (
                  check_in_time  >= %(cutoff)s
               OR check_out_time >= %(cutoff)s
              )
            ORDER BY GREATEST(
                COALESCE(check_in_time::timestamp,  '1970-01-01'::timestamp),
                COALESCE(check_out_time::timestamp, '1970-01-01'::timestamp)
            ) DESC
            LIMIT 1
        """, {'device_id': device_id, 'cutoff': cutoff})
        row = cur.fetchone()
        cur.close()
        conn.close()
        return dict(row) if row else None
    except Exception as e:
        print(f"Get Recent Device Scan Error: {e}")
        return None


def get_staff_attendance_logs(staff_id: str, month: Optional[str] = None):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        query = "SELECT * FROM table_attendance_logs WHERE staff_id = %(staff_id)s"
        params = {'staff_id': staff_id}
        if month:
            query += " AND check_in_time LIKE %(month)s"
            params['month'] = f"{month}%"
        query += " ORDER BY check_in_time DESC"
        cur.execute(query, params)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        print(f"Get Staff Attendance Logs Error: {e}")
        return []

def get_all_attendance_as_bundles(store_id: Optional[str] = None):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        query = """
            SELECT l.*, s.name as staff_name FROM table_attendance_logs l
            LEFT JOIN table_staff_accounts s ON l.staff_id = s.staff_id
        """
        params = {}
        if store_id and store_id != "Total":
            query += " WHERE l.store_id = %(store_id)s"
            params['store_id'] = store_id
        query += " ORDER BY l.check_in_time DESC LIMIT 100"

        cur.execute(query, params)
        logs = cur.fetchall()
        cur.close()
        conn.close()

        bundles = []
        for log in logs:
            action_type = "퇴근" if log['check_out_time'] else "출근"
            tardy_str = " (지각)" if log['tardy'] else ""
            paid_str = " (지급완료)" if log.get('paid') else " (미지급)"
            staff_display_name = log['staff_name'] or f"미등록({log['staff_id']})"
            title = f"근태 기록: {staff_display_name}님 {action_type} 완료{tardy_str}{paid_str}"
            timestamp = log['check_out_time'] or log['check_in_time'] or ''

            bundles.append({
                "id": log['log_id'],
                "type": "Attendance",
                "title": title,
                "store_id": log['store_id'],
                "status": log['status'],
                "timestamp": timestamp,
                "items": [
                    {"name": "직원명", "value": staff_display_name},
                    {"name": "아이디", "value": log['staff_id']},
                    {"name": "상태", "value": log['status']},
                    {"name": "출근시간", "value": str(log['check_in_time'] or '')},
                    {"name": "퇴근시간", "value": str(log['check_out_time'] or '')},
                    {"name": "지각여부", "value": "지각" if log['tardy'] else "정상"},
                    {"name": "근무분수", "value": str(log['work_minutes'] or 0)},
                    {"name": "정산상태", "value": "지급" if log.get('paid') else "미지급"}
                ]
            })
        return bundles
    except Exception as e:
        print(f"Get All Attendance As Bundles Error: {e}")
        return []
