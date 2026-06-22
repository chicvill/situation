import sys
import os
sys.path.append(os.path.abspath('situation-backend'))

from session.db.connection import get_db_conn
import json

conn = get_db_conn()
cur = conn.cursor()

# 1. Active sessions
cur.execute("SELECT session_id, store_id, table_id, status, orders FROM table_sessions WHERE status != 'closed'")
rows = cur.fetchall()
print(f"=== Active Sessions Count: {len(rows)} ===")
for r in rows:
    session_id, store_id, table_id, status, orders = r
    # orders is list of dicts
    print(f"Session: {session_id} | Store: {store_id} | Table: {table_id} | Status: {status}")
    if orders:
        for o in orders:
            print(f"  - OrderID: {o.get('order_id')} | Status: {o.get('status')} | PaymentStatus: {o.get('payment_status')} | Items: {o.get('items')}")
            
# 2. Get ready orders
from session.db.session_db import get_ready_orders
ready = get_ready_orders()
print(f"\n=== Ready Orders in DB (get_ready_orders) Count: {len(ready)} ===")
for o in ready:
    print(f"  - Table: {o.get('table_id')} | OrderID: {o.get('order_id')} | Status: {o.get('status')}")

# 3. Check knowledge_pool.json
pool_path = os.path.abspath('knowledge_pool.json')
print(f"\n=== checking knowledge_pool.json at {pool_path} ===")
if os.path.exists(pool_path):
    with open(pool_path, 'r', encoding='utf-8') as f:
        pool = json.load(f)
    print("Pool length:", len(pool))
    ready_in_pool = [b for b in pool if b.get('type') == 'Orders' and b.get('status') == 'ready']
    print("Ready orders in pool length:", len(ready_in_pool))
    for b in ready_in_pool:
        print(f"  - ID: {b.get('id')} | StoreID: {b.get('store_id')} | Title: {b.get('title')} | Status: {b.get('status')}")
else:
    print("knowledge_pool.json does not exist!")

conn.close()
