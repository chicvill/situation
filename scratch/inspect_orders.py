import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("DATABASE_URL")
conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("SELECT order_id, session_id, store_id, table_id, status, payment_status, total_price, timestamp FROM table_orders ORDER BY timestamp DESC LIMIT 20")
rows = cur.fetchall()
print(f"Total orders found in DB: {len(rows)}")
for r in rows:
    print(f"Order: {r[0]} | Session: {r[1]} | Store: {r[2]} | Table: {r[3]} | Status: {r[4]} | Payment: {r[5]} | Price: {r[6]} | Time: {r[7]}")
    
cur.close()
conn.close()
