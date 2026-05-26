import os
import psycopg2
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())
DATABASE_URL = os.getenv("DATABASE_URL")

print("🔌 Connecting to DB...")
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# 1. Print all stores
cur.execute("SELECT id, name, ceo_name, signature_owner FROM stores")
stores = cur.fetchall()
print("\n=== STORES IN DB ===")
for s in stores:
    print(s)

# 2. Print active sessions
cur.execute("SELECT session_id, store_id, table_id, status FROM table_sessions")
sessions = cur.fetchall()
print("\n=== ACTIVE SESSIONS ===")
for s in sessions:
    print(s)

# 3. Print unique bundle types and their store_ids
cur.execute("SELECT type, store_id, COUNT(*) FROM knowledge_bundles GROUP BY type, store_id")
bundles = cur.fetchall()
print("\n=== BUNDLES IN DB ===")
for b in bundles:
    print(b)

# 4. Check specific store-chicvill or store-8214 entries in bundles
cur.execute("SELECT id, type, store_id, title FROM knowledge_bundles WHERE store_id LIKE '%chic%' OR store_id LIKE '%8214%' LIMIT 30")
specific_bundles = cur.fetchall()
print("\n=== SPECIFIC BUNDLES IN DB ===")
for sb in specific_bundles:
    print(sb)


cur.close()
conn.close()
