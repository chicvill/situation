import sys
from session.db.connection import get_db_conn
conn = get_db_conn()
if not conn:
    print("Failed to connect to database")
    sys.exit(1)
cur = conn.cursor()
try:
    cur.execute("ALTER TABLE table_orders ADD COLUMN metadata TEXT;")
    conn.commit()
    print("Successfully added metadata column to table_orders table!")
except Exception as e:
    conn.rollback()
    print("Failed or column already exists:", e)
cur.close()
conn.close()
