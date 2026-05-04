import psycopg2
from psycopg2.extras import RealDictCursor
import os
import json
from datetime import datetime
from dotenv import load_dotenv, find_dotenv

# .env 파일 로드 (상위 디렉토리 포함 자동 탐색)
load_dotenv(find_dotenv())
DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_conn():
    if not DATABASE_URL:
        raise Exception("DATABASE_URL environment variable is missing!")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"❌ DB Connection Error: {e}")
        raise e

def init_db_v2():
    """V2 세션 중심 스키마 초기화"""
    try:
        conn = get_db_conn()
    except Exception:
        return
    
    try:
        cur = conn.cursor()
        
        # 1. 세션 대장 테이블
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_sessions (
                session_id TEXT PRIMARY KEY,
                store_id TEXT NOT NULL,
                table_id TEXT NOT NULL,
                device_id TEXT,
                status TEXT DEFAULT 'active',
                checkin_time TEXT NOT NULL,
                checkout_time TEXT,
                metadata JSONB DEFAULT '{}'
            )
        """)
        
        # 2. 주문 내역 테이블 (세션에 종속)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_orders (
                order_id TEXT PRIMARY KEY,
                session_id TEXT REFERENCES table_sessions(session_id),
                store_id TEXT NOT NULL,
                table_id TEXT NOT NULL,
                device_id TEXT NOT NULL,
                items JSONB NOT NULL,
                total_price INTEGER DEFAULT 0,
                status TEXT DEFAULT 'cooking',
                payment_status TEXT DEFAULT 'unpaid',
                payment_method TEXT,
                order_seq INTEGER DEFAULT 1,
                timestamp TEXT NOT NULL
            )
        """)
        
        # 3. AI 상황 기록 테이블 (지식 인벤토리용)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS situation_pool (
                id SERIAL PRIMARY KEY,
                store_id TEXT NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                items JSONB NOT NULL,
                timestamp TEXT NOT NULL
            )
        """)
        
        # 4. 고객 포인트 테이블
        cur.execute("""
            CREATE TABLE IF NOT EXISTS customer_points (
                phone TEXT PRIMARY KEY,
                points INTEGER DEFAULT 0,
                last_updated TEXT NOT NULL
            )
        """)
        
        try:
            # device_id 컬럼 누락 방지 (기존 테이블 마이그레이션)
            cur.execute("ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS device_id TEXT")
            cur.execute("ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS device_id TEXT")
            
            cur.execute("ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid'")
            cur.execute("ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS payment_method TEXT")
        except Exception as e:
            print(f"⚠️ DB Migration Warning: {e}")
            
        cur.execute("CREATE INDEX IF NOT EXISTS idx_orders_session ON table_orders(session_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sessions_store_table ON table_sessions(store_id, table_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_situation_store ON situation_pool(store_id)")
        cur.execute("ALTER TABLE table_sessions ALTER COLUMN device_id DROP NOT NULL")
        
        conn.commit()
        cur.close()
        conn.close()
        print("✅ Session-centric DB Schema initialized and verified.")
    except Exception as e:
        print(f"❌ DB Init V2 Error: {e}")

def save_situation(data: dict):
    """상황 데이터를 지식 인벤토리에 저장"""
    conn = get_db_conn()
    if not conn: return
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO situation_pool (store_id, type, title, items, timestamp)
            VALUES (%(store_id)s, %(type)s, %(title)s, %(items)s, %(timestamp)s)
        """
        params = {
            'store_id': data.get('store', 'Total'),
            'type': data.get('type', 'Log'),
            'title': data.get('title', 'General Log'),
            'items': json.dumps(data.get('items', [])),
            'timestamp': data.get('timestamp', datetime.now().isoformat())
        }
        cur.execute(query, params)
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Save Situation Error: {e}")

def get_situation_history(store_id: str, limit: int = 50):
    """최근 상황 기록들을 가져옴"""
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if store_id and store_id != "Total":
            cur.execute("""
                SELECT * FROM situation_pool 
                WHERE store_id = %(store_id)s 
                ORDER BY id DESC LIMIT %(limit)s
            """, {'store_id': store_id, 'limit': limit})
        else:
            cur.execute("""
                SELECT * FROM situation_pool 
                ORDER BY id DESC LIMIT %(limit)s
            """, {'limit': limit})
        results = cur.fetchall()
        cur.close()
        conn.close()
        return results
    except Exception as e:
        print(f"Get Situation History Error: {e}")
        return []

def save_session(session_data: dict):
    conn = get_db_conn()
    cur = conn.cursor()
    try:
        # Named Parameter 방식으로 변경 (더 안전함)
        query = """
            INSERT INTO table_sessions (session_id, store_id, table_id, device_id, status, checkin_time, metadata)
            VALUES (%(session_id)s, %(store_id)s, %(table_id)s, %(device_id)s, %(status)s, %(checkin_time)s, %(metadata)s)
            ON CONFLICT (session_id) DO UPDATE SET
                status = EXCLUDED.status,
                checkout_time = EXCLUDED.checkout_time,
                metadata = EXCLUDED.metadata
        """
        params = {
            'session_id': session_data['session_id'],
            'store_id': session_data['store_id'],
            'table_id': session_data['table_id'],
            'device_id': session_data.get('device_id'),
            'status': session_data['status'],
            'checkin_time': session_data['checkin_time'],
            'metadata': json.dumps(session_data.get('metadata', {}))
        }
        cur.execute(query, params)
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Supabase Save Error (Session): {e}")

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
    except Exception as e:
        print(f"Supabase Save Error (Order): {e}")

def get_active_session(store_id: str, table_id: str):
    conn = get_db_conn()
    if not conn: return None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if not store_id or store_id == "Total":
            cur.execute("""
                SELECT * FROM table_sessions 
                WHERE table_id = %(table_id)s AND status != 'closed'
                ORDER BY checkin_time DESC LIMIT 1
            """, {'table_id': table_id})
        else:
            cur.execute("""
                SELECT * FROM table_sessions 
                WHERE store_id = %(store_id)s AND table_id = %(table_id)s AND status != 'closed'
                LIMIT 1
            """, {'store_id': store_id, 'table_id': table_id})
        result = cur.fetchone()
        cur.close()
        conn.close()
        return result
    except Exception as e:
        print(f"Get Active Session Error: {e}")
        return None

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

def update_session_status(session_id: str, status: str):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        if status == 'closed':
            cur.execute("UPDATE table_sessions SET status = %(status)s, checkout_time = %(checkout_time)s WHERE session_id = %(session_id)s", 
                       {'status': status, 'checkout_time': datetime.now().isoformat(), 'session_id': session_id})
        else:
            cur.execute("UPDATE table_sessions SET status = %(status)s WHERE session_id = %(session_id)s", 
                       {'status': status, 'session_id': session_id})
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update Session Status Error: {e}")
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

def get_kitchen_orders(store_id: str = None):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if store_id and store_id != "Total":
            cur.execute("""
                SELECT * FROM table_orders 
                WHERE store_id = %(store_id)s AND status = 'cooking'
                ORDER BY timestamp ASC
            """, {'store_id': store_id})
        else:
            cur.execute("""
                SELECT * FROM table_orders 
                WHERE status = 'cooking'
                ORDER BY timestamp ASC
            """)
        results = cur.fetchall()
        cur.close()
        conn.close()
        return results
    except Exception as e:
        print(f"Get All Active Orders Error: {e}")
        return []

def get_all_active_sessions(store_id: str = None):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        query = "SELECT * FROM table_sessions WHERE status != 'closed'"
        params = {}
        if store_id and store_id != "Total":
            query += " AND store_id = %(store_id)s"
            params['store_id'] = store_id
        
        cur.execute(query, params)
        sessions = cur.fetchall()
        
        for sess in sessions:
            cur.execute("SELECT * FROM table_orders WHERE session_id = %(session_id)s ORDER BY order_seq", 
                       {'session_id': sess['session_id']})
            sess['orders'] = cur.fetchall()
            
        cur.close()
        conn.close()
        return sessions
    except Exception as e:
        print(f"Get All Active Sessions Error: {e}")
        return []
def get_customer_points(phone: str):
    conn = get_db_conn()
    if not conn: return 0
    try:
        cur = conn.cursor()
        cur.execute("SELECT points FROM customer_points WHERE phone = %(phone)s", {'phone': phone})
        result = cur.fetchone()
        cur.close()
        conn.close()
        return result[0] if result else 0
    except Exception as e:
        print(f"Get Points Error: {e}")
        return 0

def update_customer_points(phone: str, points_to_add: int):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO customer_points (phone, points, last_updated)
            VALUES (%(phone)s, %(points)s, %(last_updated)s)
            ON CONFLICT (phone) DO UPDATE SET
                points = customer_points.points + %(points)s,
                last_updated = %(last_updated)s
        """, {
            'phone': phone, 
            'points': points_to_add, 
            'last_updated': datetime.now().isoformat()
        })
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update Points Error: {e}")
        return False
