import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("DATABASE_URL")

conn = psycopg2.connect(db_url)
cur = conn.cursor()

# Delete sessions that have T002 or T003 with empty device_id
cur.execute("UPDATE table_sessions SET status = 'closed' WHERE table_id IN ('T002', 'T003') AND status != 'closed'")
deleted_count = cur.rowcount
conn.commit()

print(f"Cleaned up {deleted_count} ghost sessions with invalid table ids (T002, T003).")
cur.close()
conn.close()
