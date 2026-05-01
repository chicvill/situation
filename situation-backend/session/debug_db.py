import psycopg2
from psycopg2.extras import RealDictCursor
import os
import json
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())
DATABASE_URL = os.getenv("DATABASE_URL")

def check_db():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    print("--- [1] Active Sessions ---")
    cur.execute("SELECT session_id, store_id, table_id, status FROM table_sessions WHERE status = 'active'")
    sessions = cur.fetchall()
    for s in sessions:
        print(f"Session: {s['session_id']} | Table: {s['table_id']} | Store: {s['store_id']}")
        
        print(f"  --- Orders for {s['session_id']} ---")
        cur.execute("SELECT order_id, total_price, status, items FROM table_orders WHERE session_id = %s", (s['session_id'],))
        orders = cur.fetchall()
        if not orders:
            print("  (No orders found)")
        for o in orders:
            print(f"  Order: {o['order_id']} | Price: {o['total_price']} | Status: {o['status']}")
            print(f"  Items: {o['items']}")
            
    conn.close()

if __name__ == "__main__":
    check_db()
