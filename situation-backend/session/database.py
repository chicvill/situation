import psycopg2  # type: ignore
from psycopg2.extras import RealDictCursor  # type: ignore
import os
import json
from datetime import datetime
from typing import Optional
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
        
        # 4. 고객 포인트 테이블 (다중 매장 완벽 분리 연동)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS customer_points (
                phone TEXT NOT NULL,
                store_id TEXT NOT NULL DEFAULT 'store-1',
                points INTEGER DEFAULT 0,
                last_updated TEXT NOT NULL,
                PRIMARY KEY (phone, store_id)
            )
        """)
        try:
            cur.execute("ALTER TABLE customer_points ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'store-1'")
            cur.execute("ALTER TABLE customer_points DROP CONSTRAINT IF EXISTS customer_points_pkey")
            cur.execute("ALTER TABLE customer_points ADD PRIMARY KEY (phone, store_id)")
        except Exception as e:
            # Migration might already be applied or constraint names differ, safe to ignore
            pass
        
        # 5. 스마트 대기 테이블 (table_waitings)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_waitings (
                waiting_id TEXT PRIMARY KEY,
                store_id TEXT NOT NULL DEFAULT 'store-1',
                phone_number TEXT NOT NULL,
                party_size INTEGER NOT NULL,
                status TEXT DEFAULT 'waiting',
                timestamp TEXT NOT NULL
            )
        """)
        try:
            cur.execute("ALTER TABLE table_waitings ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'store-1'")
        except Exception as e:
            pass
        
        # 6. 스마트 직원 호출 테이블 (table_calls)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_calls (
                call_id TEXT PRIMARY KEY,
                table_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                call_type TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                timestamp TEXT NOT NULL
            )
        """)
        
        # 7. 실시간 사전 예약 테이블 (table_reservations)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_reservations (
                reservation_id TEXT PRIMARY KEY,
                customer_name TEXT NOT NULL,
                phone_number TEXT NOT NULL,
                party_size INTEGER NOT NULL,
                reserved_time TEXT NOT NULL,
                table_id TEXT NOT NULL,
                status TEXT DEFAULT 'requested'
            )
        """)
        
        # 8. 원클릭 셀프 주차 테이블 (table_parkings)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_parkings (
                parking_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                vehicle_number TEXT NOT NULL,
                discount_minutes INTEGER NOT NULL,
                status TEXT DEFAULT 'applied',
                timestamp TEXT NOT NULL
            )
        """)
        
        # 9. 스태프 마스터 테이블 (table_staff_accounts)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_staff_accounts (
                staff_id TEXT PRIMARY KEY,
                store_id TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                hourly_wage INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                contract_period JSONB NOT NULL
            )
        """)

        # 10. 일일 출퇴근 타임카드 테이블 (table_attendance_logs)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_attendance_logs (
                log_id TEXT PRIMARY KEY,
                staff_id TEXT NOT NULL,
                store_id TEXT NOT NULL,
                check_in_time TEXT,
                check_out_time TEXT,
                work_minutes INTEGER,
                status TEXT DEFAULT 'working',
                tardy BOOLEAN DEFAULT FALSE
            )
        """)

        # 11. 스태프 스케줄 테이블 (table_staff_schedules)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_staff_schedules (
                schedule_id TEXT PRIMARY KEY,
                staff_id TEXT NOT NULL,
                day_of_week INTEGER NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL
            )
        """)
        
        # 12. 매장 관리용 테이블 (stores)
        # 만약 기존에 stores 테이블이 있고 'id' 컬럼이 있는 경우 (실제 가맹점 운영 테이블)
        # 새롭게 생성하지 않고 기존 테이블 구조를 마이그레이션 합니다.
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'stores' AND column_name = 'id'
            )
        """)
        is_production_stores = cur.fetchone()[0]

        if is_production_stores:
            # 기존 프로덕션 테이블에 결제 기록 관리용 컬럼 추가
            cur.execute("ALTER TABLE stores ADD COLUMN IF NOT EXISTS payment_history JSONB DEFAULT '[]'")
        else:
            # 신규 설치인 경우의 스키마 (프로덕션 규격에 맞춰 생성)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS stores (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    ceo_name TEXT NOT NULL,
                    signature_owner TEXT NOT NULL,
                    monthly_fee INTEGER DEFAULT 0,
                    payment_status TEXT DEFAULT '정상',
                    payment_history JSONB DEFAULT '[]',
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
        
        # 1. 초기 기본 가맹점 정보 삽입
        initial_stores = [
            ("store-1", "우정돌솥밥", "홍길동", "owner-1", 50000, "정상", json.dumps([{"date": "2026-05-01", "amount": 50000, "status": "완료"}])),
            ("store-2", "한옥초당순두부", "이순신", "owner-2", 60000, "미납", json.dumps([{"date": "2026-05-01", "amount": 0, "status": "미납"}])),
            ("store-3", "대관령한우구이", "강감찬", "owner-3", 100000, "정상", json.dumps([{"date": "2026-05-01", "amount": 100000, "status": "완료"}]))
        ]
        for s in initial_stores:
            cur.execute("SELECT COUNT(*) FROM stores WHERE id = %s", (s[0],))
            if cur.fetchone()[0] == 0:
                cur.execute("""
                    INSERT INTO stores (id, name, ceo_name, signature_owner, monthly_fee, payment_status, payment_history, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                """, s)

        # 2. knowledge_pool.json 데이터에 포함된 매장들 자동 동기화 및 복구
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        pool_file = os.path.join(base_dir, "knowledge_pool.json")
        if os.path.exists(pool_file):
            try:
                with open(pool_file, "r", encoding="utf-8") as f:
                    pool_data = json.load(f)
                
                # pool에서 고유 매장 정보 추출
                pool_stores = {}
                for item in pool_data:
                    s_id = item.get("store_id")
                    s_name = item.get("store")
                    if s_id and s_name:
                        pool_stores[s_id] = s_name
                
                # 추출된 매장 정보를 DB에 동기화
                for s_id, s_name in pool_stores.items():
                    cur.execute("SELECT COUNT(*) FROM stores WHERE id = %s", (s_id,))
                    if cur.fetchone()[0] == 0:
                        # 신규로 감지된 매장 추가 (예: 대장금 수라간 등)
                        cur.execute("""
                            INSERT INTO stores (id, name, ceo_name, signature_owner, monthly_fee, payment_status, payment_history, created_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                        """, (s_id, s_name, "미지정 점주", f"owner-{s_id}", 50000, "정상", json.dumps([])))
                        print(f"🔄 Auto-imported store '{s_name}' ({s_id}) from knowledge_pool.json into PostgreSQL.")
            except Exception as pe:
                print(f"⚠️ Failed to auto-sync stores from knowledge_pool: {pe}")
        
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

def get_session_by_id(session_id: str):
    conn = get_db_conn()
    if not conn: return None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM table_sessions WHERE session_id = %(session_id)s", {'session_id': session_id})
        result = cur.fetchone()
        cur.close()
        conn.close()
        return result
    except Exception as e:
        print(f"Get Session By Id Error: {e}")
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

def get_kitchen_orders(store_id: Optional[str] = None):
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

def get_all_active_sessions(store_id: Optional[str] = None):
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
def get_customer_points(phone: str, store_id: str = 'store-1'):
    conn = get_db_conn()
    if not conn: return 0
    try:
        cur = conn.cursor()
        cur.execute("SELECT points FROM customer_points WHERE phone = %(phone)s AND store_id = %(store_id)s", {'phone': phone, 'store_id': store_id})
        result = cur.fetchone()
        cur.close()
        conn.close()
        return result[0] if result else 0
    except Exception as e:
        print(f"Get Points Error: {e}")
        return 0

def update_customer_points(phone: str, points_to_add: int, store_id: str = 'store-1'):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO customer_points (phone, store_id, points, last_updated)
            VALUES (%(phone)s, %(store_id)s, %(points)s, %(last_updated)s)
            ON CONFLICT (phone, store_id) DO UPDATE SET
                points = customer_points.points + %(points)s,
                last_updated = %(last_updated)s
        """, {
            'phone': phone, 
            'store_id': store_id,
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

# --- 🚶 5-1. 스마트 대기 관리 (Waiting) ---
def save_waiting(waiting_data: dict):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO table_waitings (waiting_id, store_id, phone_number, party_size, status, timestamp)
            VALUES (%(waiting_id)s, %(store_id)s, %(phone_number)s, %(party_size)s, %(status)s, %(timestamp)s)
            ON CONFLICT (waiting_id) DO UPDATE SET
                status = EXCLUDED.status
        """
        cur.execute(query, {
            'waiting_id': waiting_data['waiting_id'],
            'store_id': waiting_data.get('store_id', 'store-1'),
            'phone_number': waiting_data['phone_number'],
            'party_size': waiting_data['party_size'],
            'status': waiting_data.get('status', 'waiting'),
            'timestamp': waiting_data.get('timestamp', datetime.now().isoformat())
        })
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Save Waiting Error: {e}")
        return False

def get_active_waitings(store_id: Optional[str] = None):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if store_id and store_id != "Total":
            cur.execute("""
                SELECT * FROM table_waitings 
                WHERE status IN ('waiting', 'called') AND store_id = %(store_id)s 
                ORDER BY timestamp ASC
            """, {'store_id': store_id})
        else:
            cur.execute("SELECT * FROM table_waitings WHERE status IN ('waiting', 'called') ORDER BY timestamp ASC")
        results = cur.fetchall()
        cur.close()
        conn.close()
        return results
    except Exception as e:
        print(f"Get Active Waitings Error: {e}")
        return []

def update_waiting_status(waiting_id: str, status: str):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("UPDATE table_waitings SET status = %(status)s WHERE waiting_id = %(waiting_id)s",
                   {'status': status, 'waiting_id': waiting_id})
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update Waiting Status Error: {e}")
        return False

# --- 🛎️ 5-2. 스마트 직원 호출 (Staff Call) ---
def save_call(call_data: dict):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO table_calls (call_id, table_id, session_id, call_type, status, timestamp)
            VALUES (%(call_id)s, %(table_id)s, %(session_id)s, %(call_type)s, %(status)s, %(timestamp)s)
            ON CONFLICT (call_id) DO UPDATE SET
                status = EXCLUDED.status
        """
        cur.execute(query, {
            'call_id': call_data['call_id'],
            'table_id': call_data['table_id'],
            'session_id': call_data['session_id'],
            'call_type': call_data['call_type'],
            'status': call_data.get('status', 'pending'),
            'timestamp': call_data.get('timestamp', datetime.now().isoformat())
        })
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Save Call Error: {e}")
        return False

def get_active_calls(table_id: Optional[str] = None, store_id: Optional[str] = None):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if store_id and store_id != "Total":
            if table_id:
                cur.execute("""
                    SELECT c.* FROM table_calls c
                    JOIN table_sessions s ON c.session_id = s.session_id
                    WHERE c.table_id = %(table_id)s AND c.status = 'pending' AND s.store_id = %(store_id)s
                    ORDER BY c.timestamp ASC
                """, {'table_id': table_id, 'store_id': store_id})
            else:
                cur.execute("""
                    SELECT c.* FROM table_calls c
                    JOIN table_sessions s ON c.session_id = s.session_id
                    WHERE c.status = 'pending' AND s.store_id = %(store_id)s
                    ORDER BY c.timestamp ASC
                """, {'store_id': store_id})
        else:
            if table_id:
                cur.execute("SELECT * FROM table_calls WHERE table_id = %(table_id)s AND status = 'pending' ORDER BY timestamp ASC", {'table_id': table_id})
            else:
                cur.execute("SELECT * FROM table_calls WHERE status = 'pending' ORDER BY timestamp ASC")
        results = cur.fetchall()
        cur.close()
        conn.close()
        return results
    except Exception as e:
        print(f"Get Active Calls Error: {e}")
        return []

def update_call_status(call_id: str, status: str):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("UPDATE table_calls SET status = %(status)s WHERE call_id = %(call_id)s",
                   {'status': status, 'call_id': call_id})
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update Call Status Error: {e}")
        return False

# --- 📆 5-3. 실시간 사전 예약 (Reservation) ---
def save_reservation(res_data: dict):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO table_reservations (reservation_id, customer_name, phone_number, party_size, reserved_time, table_id, status)
            VALUES (%(reservation_id)s, %(customer_name)s, %(phone_number)s, %(party_size)s, %(reserved_time)s, %(table_id)s, %(status)s)
            ON CONFLICT (reservation_id) DO UPDATE SET
                status = EXCLUDED.status,
                table_id = EXCLUDED.table_id
        """
        cur.execute(query, {
            'reservation_id': res_data['reservation_id'],
            'customer_name': res_data['customer_name'],
            'phone_number': res_data['phone_number'],
            'party_size': res_data['party_size'],
            'reserved_time': res_data['reserved_time'],
            'table_id': res_data['table_id'],
            'status': res_data.get('status', 'requested')
        })
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Save Reservation Error: {e}")
        return False

def get_active_reservations():
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM table_reservations WHERE status IN ('requested', 'confirmed') ORDER BY reserved_time ASC")
        results = cur.fetchall()
        cur.close()
        conn.close()
        return results
    except Exception as e:
        print(f"Get Active Reservations Error: {e}")
        return []

def update_reservation_status(res_id: str, status: str):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("UPDATE table_reservations SET status = %(status)s WHERE reservation_id = %(res_id)s",
                   {'status': status, 'res_id': res_id})
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update Reservation Status Error: {e}")
        return False

# --- 🚗 5-4. 원클릭 셀프 주차 할인 (Parking) ---
def save_parking(park_data: dict):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO table_parkings (parking_id, session_id, vehicle_number, discount_minutes, status, timestamp)
            VALUES (%(parking_id)s, %(session_id)s, %(vehicle_number)s, %(discount_minutes)s, %(status)s, %(timestamp)s)
            ON CONFLICT (parking_id) DO UPDATE SET
                status = EXCLUDED.status
        """
        cur.execute(query, {
            'parking_id': park_data['parking_id'],
            'session_id': park_data['session_id'],
            'vehicle_number': park_data['vehicle_number'],
            'discount_minutes': park_data['discount_minutes'],
            'status': park_data.get('status', 'applied'),
            'timestamp': park_data.get('timestamp', datetime.now().isoformat())
        })
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Save Parking Error: {e}")
        return False

def get_parking_by_session(session_id: str):
    conn = get_db_conn()
    if not conn: return None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM table_parkings WHERE session_id = %(session_id)s LIMIT 1", {'session_id': session_id})
        result = cur.fetchone()
        cur.close()
        conn.close()
        return result
    except Exception as e:
        print(f"Get Parking By Session Error: {e}")
        return None

# --- 👥 9. 통합 매장 직원 및 근로 관리 (Staff & Labor Management) ---
def save_staff(staff_data: dict):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO table_staff_accounts (staff_id, store_id, name, role, hourly_wage, status, contract_period)
            VALUES (%(staff_id)s, %(store_id)s, %(name)s, %(role)s, %(hourly_wage)s, %(status)s, %(contract_period)s)
            ON CONFLICT (staff_id) DO UPDATE SET
                status = EXCLUDED.status,
                hourly_wage = EXCLUDED.hourly_wage,
                contract_period = EXCLUDED.contract_period
        """
        cur.execute(query, {
            'staff_id': staff_data['staff_id'],
            'store_id': staff_data['store_id'],
            'name': staff_data['name'],
            'role': staff_data['role'],
            'hourly_wage': staff_data['hourly_wage'],
            'status': staff_data.get('status', 'pending'),
            'contract_period': json.dumps(staff_data['contract_period']) if isinstance(staff_data['contract_period'], (dict, list)) else staff_data['contract_period']
        })
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Save Staff Error: {e}")
        return False

def get_staff(staff_id: str):
    conn = get_db_conn()
    if not conn: return None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM table_staff_accounts WHERE staff_id = %(staff_id)s", {'staff_id': staff_id})
        res = cur.fetchone()
        if res and isinstance(res['contract_period'], str):
            res['contract_period'] = json.loads(res['contract_period'])
        cur.close()
        conn.close()
        return res
    except Exception as e:
        print(f"Get Staff Error: {e}")
        return None

def get_active_staff_list(store_id: str = "default_store"):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM table_staff_accounts WHERE store_id = %(store_id)s", {'store_id': store_id})
        rows = cur.fetchall()
        for r in rows:
            if r and isinstance(r['contract_period'], str):
                r['contract_period'] = json.loads(r['contract_period'])
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        print(f"Get Active Staff List Error: {e}")
        return []

def update_staff_status(staff_id: str, status: str):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("UPDATE table_staff_accounts SET status = %(status)s WHERE staff_id = %(staff_id)s",
                   {'status': status, 'staff_id': staff_id})
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update Staff Status Error: {e}")
        return False

def save_schedule(sched_data: dict):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO table_staff_schedules (schedule_id, staff_id, day_of_week, start_time, end_time)
            VALUES (%(schedule_id)s, %(staff_id)s, %(day_of_week)s, %(start_time)s, %(end_time)s)
            ON CONFLICT (schedule_id) DO UPDATE SET
                day_of_week = EXCLUDED.day_of_week,
                start_time = EXCLUDED.start_time,
                end_time = EXCLUDED.end_time
        """
        cur.execute(query, {
            'schedule_id': sched_data['schedule_id'],
            'staff_id': sched_data['staff_id'],
            'day_of_week': sched_data['day_of_week'],
            'start_time': sched_data['start_time'],
            'end_time': sched_data['end_time']
        })
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Save Schedule Error: {e}")
        return False

def get_staff_schedules(staff_id: str):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM table_staff_schedules WHERE staff_id = %(staff_id)s ORDER BY day_of_week ASC", {'staff_id': staff_id})
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        print(f"Get Staff Schedules Error: {e}")
        return []

def save_attendance_checkin(log_id: str, staff_id: str, store_id: str, check_in_time: str, tardy: bool = False):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO table_attendance_logs (log_id, staff_id, store_id, check_in_time, status, tardy)
            VALUES (%(log_id)s, %(staff_id)s, %(store_id)s, %(check_in_time)s, 'working', %(tardy)s)
            ON CONFLICT (log_id) DO UPDATE SET
                check_in_time = EXCLUDED.check_in_time,
                tardy = EXCLUDED.tardy
        """
        cur.execute(query, {
            'log_id': log_id,
            'staff_id': staff_id,
            'store_id': store_id,
            'check_in_time': check_in_time,
            'tardy': tardy
        })
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Save Attendance Checkin Error: {e}")
        return False

def save_attendance_checkout(staff_id: str, check_out_time: str, work_minutes: int):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE table_attendance_logs 
            SET check_out_time = %(check_out_time)s, 
                work_minutes = %(work_minutes)s, 
                status = 'completed'
            WHERE staff_id = %(staff_id)s AND status = 'working'
        """, {
            'staff_id': staff_id,
            'check_out_time': check_out_time,
            'work_minutes': work_minutes
        })
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Save Attendance Checkout Error: {e}")
        return False

def get_active_attendance_log(staff_id: str):
    conn = get_db_conn()
    if not conn: return None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM table_attendance_logs WHERE staff_id = %(staff_id)s AND status = 'working' LIMIT 1", {'staff_id': staff_id})
        row = cur.fetchone()
        cur.close()
        conn.close()
        return row
    except Exception as e:
        print(f"Get Active Attendance Log Error: {e}")
        return None

def get_staff_attendance_logs(staff_id: str, month: Optional[str] = None):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        query = "SELECT * FROM table_attendance_logs WHERE staff_id = %(staff_id)s"
        params = {'staff_id': staff_id}
        if month:
            query += " AND check_in_time LIKE %(month)s"
            params['month'] = f"{month}%"
        query += " ORDER BY check_in_time DESC"
        cur.execute(query, params)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        print(f"Get Staff Attendance Logs Error: {e}")
        return []

def get_active_parkings_db(store_id: Optional[str] = None):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if store_id and store_id != "Total":
            cur.execute("""
                SELECT p.*, s.table_id FROM table_parkings p
                JOIN table_sessions s ON p.session_id = s.session_id
                WHERE s.store_id = %(store_id)s
                ORDER BY p.timestamp DESC
            """, {'store_id': store_id})
        else:
            cur.execute("""
                SELECT p.*, s.table_id FROM table_parkings p
                JOIN table_sessions s ON p.session_id = s.session_id
                ORDER BY p.timestamp DESC
            """)
        results = cur.fetchall()
        cur.close()
        conn.close()
        return results
    except Exception as e:
        print(f"Get Active Parkings DB Error: {e}")
        return []

def get_points_list_db(store_id: Optional[str] = None):
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if store_id and store_id != "Total":
            cur.execute("""
                SELECT * FROM customer_points
                WHERE store_id = %(store_id)s
                ORDER BY last_updated DESC
            """, {'store_id': store_id})
        else:
            cur.execute("""
                SELECT * FROM customer_points
                ORDER BY last_updated DESC
            """)
        results = cur.fetchall()
        cur.close()
        conn.close()
        return results
    except Exception as e:
        print(f"Get Points List DB Error: {e}")
        return []

def get_stores_db():
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM stores ORDER BY timestamp DESC")
        results = cur.fetchall()
        cur.close()
        conn.close()
        return results
    except Exception as e:
        print(f"Get Stores DB Error: {e}")
        return []

def add_store_db(store_id: str, store_name: str, owner_name: str, owner_id: str, monthly_fee: int, payment_status: str, payment_history: str):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO stores (store_id, store_name, owner_name, owner_id, monthly_fee, payment_status, payment_history, timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (store_id, store_name, owner_name, owner_id, monthly_fee, payment_status, payment_history, datetime.now().isoformat()))
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Add Store DB Error: {e}")
        return False

def update_store_db(store_id: str, store_name: str, owner_name: str, owner_id: str, monthly_fee: int, payment_status: str, payment_history: str):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE stores 
            SET store_name = %s, owner_name = %s, owner_id = %s, monthly_fee = %s, payment_status = %s, payment_history = %s
            WHERE store_id = %s
        """, (store_name, owner_name, owner_id, monthly_fee, payment_status, payment_history, store_id))
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Update Store DB Error: {e}")
        return False

def delete_store_db(store_id: str):
    conn = get_db_conn()
    if not conn: return False
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM stores WHERE store_id = %s", (store_id,))
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Delete Store DB Error: {e}")
        return False
