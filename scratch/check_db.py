import os
import psycopg2
from psycopg2.extras import RealDictCursor

# Read .env file
if os.path.exists(".env"):
    with open(".env", "r") as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                os.environ["DATABASE_URL"] = line.split("=", 1)[1].strip()

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("DATABASE_URL not found in .env")
    exit(1)
conn = psycopg2.connect(db_url)
cur = conn.cursor(cursor_factory=RealDictCursor)

print("--- Active Sessions ---")
cur.execute("SELECT * FROM table_sessions WHERE status != 'closed'")
sessions = cur.fetchall()
for s in sessions:
    print(s)

print("\n--- Stores ---")
cur.execute("SELECT * FROM stores")
stores = cur.fetchall()
for s in stores:
    print(s)

cur.close()
conn.close()
