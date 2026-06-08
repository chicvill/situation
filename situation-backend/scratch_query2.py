import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("DATABASE_URL")

conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("SELECT session_id, table_id, device_id, status FROM table_sessions WHERE session_id LIKE '%1ACAD5D5%'")
rows = cur.fetchall()
for r in rows:
    print(r)

cur.execute("SELECT session_id, table_id, device_id, status FROM table_sessions WHERE status != 'closed'")
rows2 = cur.fetchall()
print("\nAll active sessions:")
for r in rows2:
    print(r)

cur.close()
conn.close()
