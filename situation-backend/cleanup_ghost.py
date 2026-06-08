import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("DATABASE_URL")
if not db_url:
    print("No DATABASE_URL found.")
    exit(1)

conn = psycopg2.connect(db_url)
cur = conn.cursor()

# Find dummy sessions (device_id = 'DEVICE-TEST') and mark them as closed
cur.execute("UPDATE table_sessions SET status = 'closed' WHERE device_id = 'DEVICE-TEST' AND status != 'closed'")
deleted_count = cur.rowcount
conn.commit()

print(f"Cleaned up {deleted_count} dummy ghost sessions from Supabase DB.")
cur.close()
conn.close()
