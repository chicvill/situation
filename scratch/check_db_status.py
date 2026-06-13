import psycopg2
import os
from dotenv import load_dotenv

# Load env
load_dotenv()
db_url = os.environ.get("DATABASE_URL")
if not db_url:
    print("Error: DATABASE_URL not found.")
    exit(1)

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("=== [1] Active Sessions (status != 'closed') ===")
    cur.execute("""
        SELECT session_id, store_id, table_id, device_id, status, checkin_time 
        FROM table_sessions 
        WHERE status != 'closed'
        ORDER BY checkin_time DESC
    """)
    sessions = cur.fetchall()
    if sessions:
        print(f"Found {len(sessions)} active sessions:")
        for s in sessions:
            print(f"  Session ID: {s[0]} | Store: {s[1]} | Table: {s[2]} | Device: {s[3]} | Status: {s[4]} | Checkin: {s[5]}")
    else:
        print("No active sessions found.")
        
    print("\n=== [2] Unpaid Orders (payment_status != 'paid') ===")
    cur.execute("""
        SELECT order_id, session_id, store_id, table_id, device_id, items, total_price, status, payment_status, timestamp 
        FROM table_orders 
        WHERE payment_status != 'paid'
        ORDER BY timestamp DESC
    """)
    orders = cur.fetchall()
    if orders:
        print(f"Found {len(orders)} unpaid/pending orders:")
        for o in orders:
            print(f"  Order ID: {o[0]} | Session: {o[1]} | Store: {o[2]} | Table: {o[3]} | Device: {o[4]} | Price: {o[6]} | Status: {o[7]} | Payment: {o[8]} | Time: {o[9]}")
            print(f"    Items: {o[5]}")
    else:
        print("No unpaid/pending orders found.")
        
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"Error checking DB: {e}")
