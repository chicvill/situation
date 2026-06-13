import sys
import os

# Ensure situation-backend is in sys.path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "situation-backend"))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "situation-backend", ".env"))

from session.db.connection import get_db_conn

conn = get_db_conn()
if conn:
    cur = conn.cursor()
    cur.execute("SELECT username, role, store_id, full_name, is_approved FROM users")
    rows = cur.fetchall()
    print("=== Users in database ===")
    for row in rows:
        print(row)
    cur.close()
    conn.close()
else:
    print("Could not connect to database")
