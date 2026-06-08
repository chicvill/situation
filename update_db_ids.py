import sys
import os

# Add situation-backend to sys.path to import the DB connection module
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'situation-backend'))
from session.db.connection import get_db_conn

def update_ids():
    conn = get_db_conn()
    cur = conn.cursor()

    mapping = {
        "01000000005": "01082817377",
        "01011000005": "01082817378",
        "01022000005": "01082817379"
    }

    try:
        for old_id, new_id in mapping.items():
            print(f"Updating {old_id} -> {new_id}")
            
            # Update users table
            cur.execute("UPDATE users SET username = %s WHERE username = %s", (new_id, old_id))
            print(f"  users updated: {cur.rowcount}")
            
            # Update staff accounts
            cur.execute("UPDATE table_staff_accounts SET staff_id = %s WHERE staff_id = %s", (new_id, old_id))
            print(f"  table_staff_accounts updated: {cur.rowcount}")
            
            # Update staff schedules
            cur.execute("UPDATE table_staff_schedules SET staff_id = %s WHERE staff_id = %s", (new_id, old_id))
            
            # Update attendance logs
            cur.execute("UPDATE table_attendance_logs SET staff_id = %s WHERE staff_id = %s", (new_id, old_id))
            
            # Update payroll records
            cur.execute("UPDATE table_payroll_records SET staff_id = %s WHERE staff_id = %s", (new_id, old_id))

        conn.commit()
        print("Database update successful!")
    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    update_ids()
