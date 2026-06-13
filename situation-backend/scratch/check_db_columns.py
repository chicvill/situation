import sys
from session.db.connection import get_db_conn
conn = get_db_conn()
if not conn:
    print("Failed to connect to database")
    sys.exit(1)
cur = conn.cursor()
cur.execute("SELECT * FROM table_orders LIMIT 1")
print("Columns in table_orders:", [desc[0] for desc in cur.description])
cur.close()
conn.close()
