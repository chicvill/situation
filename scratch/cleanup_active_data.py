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
    
    # 1. Find active sessions
    cur.execute("SELECT session_id, table_id, store_id FROM table_sessions WHERE status != 'closed'")
    active_sessions = cur.fetchall()
    
    if not active_sessions:
        print("No active/unpaid sessions found in the database.")
        cur.close()
        conn.close()
        exit(0)
        
    print(f"Found {len(active_sessions)} active sessions to clean up:")
    session_ids = []
    for s in active_sessions:
        print(f"  - Session: {s[0]} (Table: {s[1]}, Store: {s[2]})")
        session_ids.append(s[0])
        
    # Convert list to tuple for SQL IN clause
    sess_tuple = tuple(session_ids)
    
    # If only one session, handle tuple format in SQL (e.g. IN ('SESS-1'))
    if len(session_ids) == 1:
        query_placeholder = f"('{session_ids[0]}')"
    else:
        query_placeholder = str(sess_tuple)
        
    # 2. Delete dependent data first
    print("\nDeleting dependent data...")
    
    # table_orders
    cur.execute(f"DELETE FROM table_orders WHERE session_id IN {query_placeholder}")
    deleted_orders = cur.rowcount
    print(f"  - Deleted {deleted_orders} orders from table_orders")
    
    # table_calls
    cur.execute(f"DELETE FROM table_calls WHERE session_id IN {query_placeholder}")
    deleted_calls = cur.rowcount
    print(f"  - Deleted {deleted_calls} calls from table_calls")
    
    # table_parkings
    cur.execute(f"DELETE FROM table_parkings WHERE session_id IN {query_placeholder}")
    deleted_parkings = cur.rowcount
    print(f"  - Deleted {deleted_parkings} parking records from table_parkings")
    
    # 3. Delete from table_sessions
    cur.execute("DELETE FROM table_sessions WHERE status != 'closed'")
    deleted_sessions = cur.rowcount
    print(f"  - Deleted {deleted_sessions} sessions from table_sessions")
    
    # Commit changes
    conn.commit()
    print("\nDatabase transaction successfully committed! All active/unpaid data cleared.")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"Error during cleanup: {e}")
    if 'conn' in locals() and conn:
        conn.rollback()
        print("Transaction rolled back due to error.")
