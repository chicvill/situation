import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DEBUG_MONITOR", "1")

from session.db.connection import get_db_conn
from session.debug_writer import record_event

conn = get_db_conn()
cur = conn.cursor()

cur.execute("DELETE FROM table_calls WHERE call_id LIKE 'CALL-SIM-%'")
print("calls deleted:", cur.rowcount)

cur.execute("DELETE FROM table_waitings WHERE waiting_id LIKE 'WAIT-SIM-%'")
print("waitings deleted:", cur.rowcount)

cur.execute("DELETE FROM table_parkings WHERE parking_id LIKE 'PARK-SIM-%'")
print("parkings deleted:", cur.rowcount)

cur.execute("DELETE FROM table_reservations WHERE reservation_id LIKE 'RES-SIM-%'")
print("reservations deleted:", cur.rowcount)

cur.execute("DELETE FROM customer_points WHERE phone IN ('010-1111-2222','010-5555-6666','010-7777-8888')")
print("sim points deleted:", cur.rowcount)

conn.commit()
cur.close()
conn.close()

record_event("SIM_CLEANUP", {}, seat_requests=[])
print("state.json updated")
