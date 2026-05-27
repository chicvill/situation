import json
from datetime import datetime
from typing import Optional
from psycopg2.extras import RealDictCursor  # type: ignore
from .connection import get_db_conn


def save_staff(staff_data: dict):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO table_staff_accounts (staff_id, store_id, name, role, hourly_wage, status, contract_period)
            VALUES (%(staff_id)s, %(store_id)s, %(name)s, %(role)s, %(hourly_wage)s, %(status)s, %(contract_period)s)
            ON CONFLICT (staff_id) DO UPDATE SET
                store_id = EXCLUDED.store_id,
                name = EXCLUDED.name,
                role = EXCLUDED.role,
                status = EXCLUDED.status,
                hourly_wage = EXCLUDED.hourly_wage,
                contract_period = EXCLUDED.contract_period
        """
        cur.execute(query, {
            'staff_id': staff_data['staff_id'],
            'store_id': staff_data['store_id'],
            'name': staff_data['name'],
            'role': staff_data['role'],
            'hourly_wage': staff_data['hourly_wage'],
            'status': staff_data.get('status', 'pending'),
            'contract_period': json.dumps(staff_data['contract_period']) if isinstance(staff_data['contract_period'], (dict, list)) else staff_data['contract_period']
        })
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Save Staff Error: {e}")
        return False

def get_staff(staff_id: str):
    conn = get_db_conn()
    if not conn: return None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM table_staff_accounts WHERE staff_id = %(staff_id)s", {'staff_id': staff_id})
        res = cur.fetchone()
        if res and isinstance(res['contract_period'], str):
            res['contract_period'] = json.loads(res['contract_period'])
        cur.close()
        conn.close()
        return res
    except Exception as e:
        print(f"Get Staff Error: {e}")
        return None

def get_active_staff_list(store_id: str = "default_store"):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM table_staff_accounts WHERE store_id = %(store_id)s", {'store_id': store_id})
        rows = cur.fetchall()
        for r in rows:
            if r and isinstance(r['contract_period'], str):
                r['contract_period'] = json.loads(r['contract_period'])
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        print(f"Get Active Staff List Error: {e}")
        return []

def update_staff_status(staff_id: str, status: str):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("UPDATE table_staff_accounts SET status = %(status)s WHERE staff_id = %(staff_id)s",
                   {'status': status, 'staff_id': staff_id})
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update Staff Status Error: {e}")
        return False

def save_schedule(sched_data: dict):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO table_staff_schedules (schedule_id, staff_id, store_id, day_of_week, start_time, end_time)
            VALUES (%(schedule_id)s, %(staff_id)s, %(store_id)s, %(day_of_week)s, %(start_time)s, %(end_time)s)
            ON CONFLICT (schedule_id) DO UPDATE SET
                store_id = EXCLUDED.store_id,
                day_of_week = EXCLUDED.day_of_week,
                start_time = EXCLUDED.start_time,
                end_time = EXCLUDED.end_time
        """
        cur.execute(query, {
            'schedule_id': sched_data['schedule_id'],
            'staff_id': sched_data['staff_id'],
            'store_id': sched_data.get('store_id', 'default_store'),
            'day_of_week': sched_data['day_of_week'],
            'start_time': sched_data['start_time'],
            'end_time': sched_data['end_time']
        })
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Save Schedule Error: {e}")
        return False

def get_staff_schedules(staff_id: str, store_id: Optional[str] = None):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if store_id and store_id != "Total":
            cur.execute("""
                SELECT * FROM table_staff_schedules
                WHERE staff_id = %(staff_id)s AND store_id = %(store_id)s
                ORDER BY day_of_week ASC
            """, {'staff_id': staff_id, 'store_id': store_id})
        else:
            cur.execute("SELECT * FROM table_staff_schedules WHERE staff_id = %(staff_id)s ORDER BY day_of_week ASC", {'staff_id': staff_id})
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        print(f"Get Staff Schedules Error: {e}")
        return []

def get_all_staff_as_bundles(store_id: Optional[str] = None):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if store_id and store_id != "Total":
            cur.execute("SELECT * FROM table_staff_accounts WHERE store_id = %(store_id)s", {'store_id': store_id})
        else:
            cur.execute("SELECT * FROM table_staff_accounts")
        staffs = cur.fetchall()

        bundles = []
        for staff in staffs:
            staff_id = staff['staff_id']
            # Fetch schedules
            cur.execute("SELECT * FROM table_staff_schedules WHERE staff_id = %(staff_id)s AND store_id = %(store_id)s", {'staff_id': staff_id, 'store_id': staff['store_id']})
            schedules = cur.fetchall()

            # Fetch attendance logs
            cur.execute("SELECT * FROM table_attendance_logs WHERE staff_id = %(staff_id)s AND store_id = %(store_id)s", {'staff_id': staff_id, 'store_id': staff['store_id']})
            logs = cur.fetchall()

            # Split logs into paid and unpaid based on their paid status
            unpaid_logs = [log for log in logs if not log.get('paid')]
            paid_logs = [log for log in logs if log.get('paid')]

            from ..hr_calc import calculate_payroll_for_logs
            unpaid_calc = calculate_payroll_for_logs(unpaid_logs, hourly_wage)
            paid_calc = calculate_payroll_for_logs(paid_logs, hourly_wage)

            total_hours = unpaid_calc['total_hours'] + paid_calc['total_hours']
            paid_wage = paid_calc['net_payroll']
            unpaid_wage = unpaid_calc['net_payroll']
            total_wage = paid_wage + unpaid_wage

            contract_period = staff['contract_period']
            if isinstance(contract_period, str):
                try: contract_period = json.loads(contract_period)
                except: contract_period = {}

            items = [
                {"name": "이름", "value": staff['name']},
                {"name": "아이디", "value": staff_id},
                {"name": "직책", "value": "점장" if staff['role'] == "manager" else "점원"},
                {"name": "시급", "value": str(hourly_wage)},
                {"name": "상태", "value": staff['status']},
                {"name": "누적시간", "value": f"{total_hours:.1f}"},
                {"name": "누적임금", "value": str(total_wage)},
                {"name": "지불된임금", "value": str(paid_wage)},
                {"name": "미지급임금", "value": str(unpaid_wage)},
                {"name": "계약정보", "value": json.dumps(contract_period)},
                {"name": "스케줄", "value": json.dumps(schedules)}
            ]

            bundles.append({
                "id": f"EMP-{staff_id}",
                "type": "Employee",
                "title": f"{staff['name']} 사원 정보",
                "store_id": staff['store_id'],
                "status": staff['status'],
                "timestamp": datetime.now().isoformat(),
                "items": items
            })
        cur.close()
        conn.close()
        return bundles
    except Exception as e:
        print(f"Get All Staff As Bundles Error: {e}")
        return []
