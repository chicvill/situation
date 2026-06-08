import psycopg2
import json

conn = psycopg2.connect('dbname=chicvill user=chicvill password=chicvill host=localhost')
cur = conn.cursor()
cur.execute("SELECT session_id, table_id, orders FROM table_sessions WHERE status != 'closed' AND table_id = '2'")
rows = cur.fetchall()
for r in rows:
    print(f"Session: {r[0]}, Table: {r[1]}")
    orders = r[2]
    for o in orders:
        print(f"  Order: {o.get('status')}, {o.get('payment_status')}, Items: {[i.get('name') for i in o.get('items', [])]}")
