import json
from datetime import datetime
from typing import Optional
from psycopg2.extras import RealDictCursor  # type: ignore
from .connection import get_db_conn


def save_order(order_data: dict):
    conn = get_db_conn()
    if not conn: return
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO table_orders (
                order_id, session_id, store_id, table_id, device_id, items,
                total_price, status, payment_status, payment_method, order_seq, timestamp
            )
            VALUES (
                %(order_id)s, %(session_id)s, %(store_id)s, %(table_id)s, %(device_id)s, %(items)s,
                %(total_price)s, %(status)s, %(payment_status)s, %(payment_method)s, %(order_seq)s, %(timestamp)s
            )
            ON CONFLICT (order_id) DO UPDATE SET
                status = EXCLUDED.status,
                payment_status = EXCLUDED.payment_status
        """
        params = {
            'order_id': order_data['order_id'],
            'session_id': order_data['session_id'],
            'store_id': order_data['store_id'],
            'table_id': order_data['table_id'],
            'device_id': order_data['device_id'],
            'items': json.dumps(order_data['items']),
            'total_price': order_data['total_price'],
            'status': order_data['status'],
            'payment_status': order_data.get('payment_status', 'unpaid'),
            'payment_method': order_data.get('payment_method'),
            'order_seq': order_data['order_seq'],
            'timestamp': order_data['timestamp']
        }
        cur.execute(query, params)
        conn.commit()
        cur.close()
        conn.close()
        print(f"✅ [save_order] Successfully saved order {order_data['order_id']} to DB.")
        return True
    except Exception as e:
        print(f"❌ [save_order] ERROR: Failed to save order {order_data.get('order_id')}: {e}")
        return False

def get_orders_by_session(session_id: str):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT * FROM table_orders
            WHERE session_id = %(session_id)s
            ORDER BY order_seq ASC, timestamp ASC
        """, {'session_id': session_id})
        results = cur.fetchall()
        cur.close()
        conn.close()
        return results
    except Exception as e:
        print(f"Get Orders By Session Error: {e}")
        return []

def update_order_items(order_id: str, items: list, total_price: float):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("UPDATE table_orders SET items = %(items)s, total_price = %(total_price)s WHERE order_id = %(order_id)s",
                   {'items': json.dumps(items), 'total_price': total_price, 'order_id': order_id})
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update Order Items Error: {e}")
        return False

def update_order_status(order_id: str, status: str):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("UPDATE table_orders SET status = %(status)s WHERE order_id = %(order_id)s",
                   {'status': status, 'order_id': order_id})
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update Order Status Error: {e}")
        return False

def update_order_payment_status(order_id: str, payment_status: str):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("UPDATE table_orders SET payment_status = %(ps)s WHERE order_id = %(oid)s",
                   {'ps': payment_status, 'oid': order_id})
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update Order Payment Status Error: {e}")
        return False

def get_max_order_seq(session_id: str):
    conn = get_db_conn()
    if not conn: return 0
    try:
        cur = conn.cursor()
        cur.execute("SELECT MAX(order_seq) FROM table_orders WHERE session_id = %(session_id)s",
                   {'session_id': session_id})
        result = cur.fetchone()
        cur.close()
        conn.close()
        return result[0] if result and result[0] else 0
    except Exception as e:
        print(f"Get Max Order Seq Error: {e}")
        return 0

def get_kitchen_orders(store_id: Optional[str] = None):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if store_id and store_id != "Total":
            cur.execute("""
                SELECT * FROM table_orders
                WHERE store_id = %(store_id)s AND status IN ('cooking', 'pending_payment')
                ORDER BY timestamp ASC
            """, {'store_id': store_id})
        else:
            cur.execute("""
                SELECT * FROM table_orders
                WHERE status IN ('cooking', 'pending_payment')
                ORDER BY timestamp ASC
            """)
        results = cur.fetchall()
        cur.close()
        conn.close()
        return results
    except Exception as e:
        print(f"Get All Active Orders Error: {e}")
        return []

def get_all_active_orders_as_bundles(store_id: Optional[str] = None):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # We want to fetch all active order statuses that represent cooking, ready, or served
        query = "SELECT * FROM table_orders WHERE status IN ('cooking', 'ready', 'served')"
        params = {}
        if store_id and store_id != "Total":
            query += " AND store_id = %(store_id)s"
            params['store_id'] = store_id

        cur.execute(query, params)
        orders = cur.fetchall()
        cur.close()
        conn.close()

        bundles = []
        for order in orders:
            items_raw = order.get('items')
            items_list = []
            if isinstance(items_raw, str):
                try: items_list = json.loads(items_raw)
                except: pass
            elif isinstance(items_raw, list):
                items_list = items_raw

            bundle_items = []
            for item in items_list:
                name = item.get('name', '알 수 없음')
                qty_val = item.get('quantity') if item.get('quantity') is not None else item.get('qty')
                qty = qty_val if qty_val is not None else 1
                bundle_items.append({'name': name, 'value': str(qty)})

            timestamp_val = order.get('timestamp')
            if isinstance(timestamp_val, datetime):
                timestamp_str = timestamp_val.strftime("%Y-%m-%d %H:%M:%S")
            else:
                timestamp_str = str(timestamp_val or '')

            bundles.append({
                'id': order['order_id'],
                'type': 'Orders',
                'title': f"테이블 {order['table_id']} 주문",
                'store_id': order['store_id'],
                'status': order['status'],
                'timestamp': timestamp_str,
                'table': order['table_id'],
                'items': bundle_items
            })
        return bundles
    except Exception as e:
        print(f"Get All Active Orders As Bundles Error: {e}")
        return []
