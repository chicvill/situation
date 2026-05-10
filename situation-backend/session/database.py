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
        
        # 12. 매장 관리용 테이블 (stores) - 테스트용 강제 초기화 및 5대 핵심 가맹점 시딩
        # 사장님의 요청에 따라 가맹점 테이블을 완전히 초기화하고, 정교하게 디자인된 5개의 대표 테스트 매장 데이터를 삽입합니다.
        cur.execute("DROP TABLE IF EXISTS stores")
        
        cur.execute("""
            CREATE TABLE stores (
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
        
        # 5개의 입체적이고 완벽한 시나리오 테스트용 가맹점 데이터
        initial_stores = [
            (
                "store-korean", 
                "대장금 수라간", 
                "신사임당", 
                "owner-korean", 
                150000, 
                "정상", 
                json.dumps([
                    {"date": "2026-03-01", "amount": 150000, "status": "완료"},
                    {"date": "2026-04-01", "amount": 150000, "status": "완료"},
                    {"date": "2026-05-01", "amount": 150000, "status": "완료"}
                ])
            ),
            (
                "store-coffee", 
                "그레이스 하이테크 커피", 
                "이지은", 
                "owner-coffee", 
                80000, 
                "미납", 
                json.dumps([
                    {"date": "2026-03-01", "amount": 80000, "status": "완료"},
                    {"date": "2026-04-01", "amount": 80000, "status": "완료"},
                    {"date": "2026-05-01", "amount": 0, "status": "미납"}
                ])
            ),
            (
                "store-beef", 
                "대관령 황금 한우", 
                "강감찬", 
                "owner-beef", 
                250000, 
                "정상", 
                json.dumps([
                    {"date": "2026-03-01", "amount": 250000, "status": "완료"},
                    {"date": "2026-04-01", "amount": 250000, "status": "완료"},
                    {"date": "2026-05-01", "amount": 250000, "status": "완료"}
                ])
            ),
            (
                "store-tofu", 
                "한옥마을 수제 초당순두부", 
                "이순신", 
                "owner-tofu", 
                120000, 
                "연체", 
                json.dumps([
                    {"date": "2026-03-01", "amount": 120000, "status": "완료"},
                    {"date": "2026-04-01", "amount": 0, "status": "연체"},
                    {"date": "2026-05-01", "amount": 0, "status": "미납"}
                ])
            ),
            (
                "store-bibim", 
                "우정 전주 돌솥비빔밥", 
                "홍길동", 
                "owner-bibim", 
                100000, 
                "정상", 
                json.dumps([
                    {"date": "2026-04-01", "amount": 100000, "status": "완료"},
                    {"date": "2026-05-01", "amount": 100000, "status": "완료"}
                ])
            )
        ]
        
        for s in initial_stores:
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
                    row_sync = cur.fetchone()
                    if row_sync and row_sync[0] == 0:
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
        
        # 3. 메뉴 정보 초기화 및 신규 5개 매장에 맞는 카탈로그 분류형 메뉴 일괄 시딩
        if os.path.exists(pool_file):
            try:
                with open(pool_file, "r", encoding="utf-8") as f:
                    pool_data = json.load(f)
                
                # 기존 "type": "Menus"인 데이터들 모두 제거
                pool_data = [item for item in pool_data if item.get("type") != "Menus"]
                
                # 5개 매장의 고급 분류형 예제 메뉴들 정의
                new_menus = [
                    # 1) 대장금 수라간 (store-korean)
                    {
                        "id": "MENUS_store-korean",
                        "type": "Menus",
                        "title": "메뉴 정보",
                        "store_id": "store-korean",
                        "store": "대장금 수라간",
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "items": [
                            {"name": "수라간 정식", "value": 25000, "icon": "🍱", "category": "식사류", "description": "궁중 요리의 진수를 맛볼 수 있는 정갈한 한 상 정식"},
                            {"name": "떡갈비 구이", "value": 18000, "icon": "🥩", "category": "식사류", "description": "수제 가마솥 방식으로 부드럽게 구워낸 떡갈비"},
                            {"name": "구절판", "value": 35000, "icon": "🎨", "category": "요리류", "description": "아홉 가지 밀전병 쌈 요리"},
                            {"name": "신선로", "value": 45000, "icon": "🍲", "category": "요리류", "description": "화로에 보글보글 끓여 먹는 궁중 신선로 전골"},
                            {"name": "감홍로 전통주", "value": 15000, "icon": "🍶", "category": "주류/음료", "description": "육당 최남선이 꼽은 조선 3대 명주 중 하나"},
                            {"name": "수제 식혜", "value": 3000, "icon": "🥤", "category": "주류/음료", "description": "직접 엿기름을 발효시켜 빚어낸 전통 식혜"}
                        ]
                    },
                    # 2) 그레이스 하이테크 커피 (store-coffee)
                    {
                        "id": "MENUS_store-coffee",
                        "type": "Menus",
                        "title": "메뉴 정보",
                        "store_id": "store-coffee",
                        "store": "그레이스 하이테크 커피",
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "items": [
                            {"name": "스마트 아메리카노", "value": 4500, "icon": "☕", "category": "에스프레소", "description": "정밀 추출 기술로 내린 고소하고 깔끔한 원두커피"},
                            {"name": "벨벳 카페 라떼", "value": 5000, "icon": "🥛", "category": "에스프레소", "description": "실크 같은 마이크로폼 우유와 진한 에스프레소의 조화"},
                            {"name": "하이테크 아인슈페너", "value": 6500, "icon": "🍦", "category": "시그니처", "description": "차가운 더치커피 위에 얹은 달콤하고 묵직한 수제 크림"},
                            {"name": "에메랄드 말차 라떼", "value": 6000, "icon": "🍵", "category": "시그니처", "description": "유기농 보성 말차의 풍미가 살아있는 시그니처 음료"},
                            {"name": "메이플 수플레 팬케이크", "value": 12000, "icon": "🥞", "category": "디저트", "description": "입안에서 사르르 녹는 폭신폭신한 수플레 팬케이크"},
                            {"name": "바스크 탄 치즈케이크", "value": 7000, "icon": "🍰", "category": "디저트", "description": "고온에서 그을려 깊은 스모키 향과 꾸덕함을 품은 치즈케이크"}
                        ]
                    },
                    # 3) 대관령 황금 한우 (store-beef)
                    {
                        "id": "MENUS_store-beef",
                        "type": "Menus",
                        "title": "메뉴 정보",
                        "store_id": "store-beef",
                        "store": "대관령 황금 한우",
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "items": [
                            {"name": "황금 한우 꽃등심", "value": 48000, "icon": "🥩", "category": "한우 구이", "description": "최상급 투플러스 마블링의 극강의 고소함을 담은 등심(150g)"},
                            {"name": "황금 한우 안심", "value": 52000, "icon": "🥩", "category": "한우 구이", "description": "육질이 부드럽고 담백한 명품 안심 부위(150g)"},
                            {"name": "전통 육회", "value": 28000, "icon": "🍳", "category": "한우 구이", "description": "참기름 and 마늘로 맛을 내 배와 함께 즐기는 신선한 생육회"},
                            {"name": "차돌 된장찌개", "value": 8000, "icon": "🍲", "category": "식사류", "description": "고소한 한우 차돌박이가 듬뿍 들어가 국물이 깊은 찌개"},
                            {"name": "평양 물냉면", "value": 9000, "icon": "🍜", "category": "식사류", "description": "순메밀 면발과 육향 가득한 육수로 완성한 정통 평양식 물냉면"},
                            {"name": "지리산 참 복분자주", "value": 12000, "icon": "🍷", "category": "주류", "description": "대관령 소고기의 맛을 극대화해 주는 수제 복분자주"}
                        ]
                    },
                    # 4) 한옥마을 수제 초당순두부 (store-tofu)
                    {
                        "id": "MENUS_store-tofu",
                        "type": "Menus",
                        "title": "메뉴 정보",
                        "store_id": "store-tofu",
                        "store": "한옥마을 수제 초당순두부",
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "items": [
                            {"name": "초당 맑은 순두부", "value": 9000, "icon": "🥣", "category": "순두부류", "description": "국산 콩과 동해 바닷물로 빚어낸 고소하고 담백한 전통 순두부"},
                            {"name": "매콤 짬뽕 순두부", "value": 10500, "icon": "🌶️", "category": "순두부류", "description": "불향 가득한 해물 육수에 몽글몽글한 순두부를 더한 해장 별미"},
                            {"name": "걸쭉 들깨 순두부", "value": 10000, "icon": "🍲", "category": "순두부류", "description": "들깨가루를 듬뿍 넣어 씹을수록 깊고 고소한 순두부"},
                            {"name": "수제 도토리묵무침", "value": 15000, "icon": "🥗", "category": "곁들임", "description": "직접 쑨 쌉싸름한 묵을 새콤달콤 매콤하게 버무린 별미"},
                            {"name": "바삭 메밀전병", "value": 8000, "icon": "🌯", "category": "곁들임", "description": "메밀전 피에 칼칼한 속을 넣어 노릇노릇 부쳐낸 전병"},
                            {"name": "가평 잣 막걸리", "value": 5000, "icon": "🍶", "category": "전통음료", "description": "잣의 고소한 향이 입안에 맴도는 부드러운 전통 탁주"}
                        ]
                    },
                    # 5) 우정 전주 돌솥비빔밥 (store-bibim)
                    {
                        "id": "MENUS_store-bibim",
                        "type": "Menus",
                        "title": "메뉴 정보",
                        "store_id": "store-bibim",
                        "store": "우정 전주 돌솥비빔밥",
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "items": [
                            {"name": "전통 전주 돌솥비빔밥", "value": 11000, "icon": "🍚", "category": "비빔밥", "description": "신선한 육회와 온갖 나물이 뜨거운 돌솥에서 지글지글 비벼지는 시그니처"},
                            {"name": "치즈 제육 돌솥비빔밥", "value": 12000, "icon": "🧀", "category": "비빔밥", "description": "매콤하게 볶아낸 제육과 고소한 모짜렐라 치즈의 환상적인 퓨전 돌솥"},
                            {"name": "톡톡 날치알 돌솥비빔밥", "value": 10000, "icon": "🥚", "category": "비빔밥", "description": "톡톡 터지는 날치알과 단무지, 김가루가 어우러진 대중적인 돌솥"},
                            {"name": "노릇 해물파전", "value": 16000, "icon": "🥞", "category": "사이드", "description": "쪽파와 신선한 오징어, 새우를 가득 얹어 튀기듯 구운 해물파전"},
                            {"name": "탄산 사이다", "value": 2000, "icon": "🥤", "category": "음료", "description": "시원하고 청량한 오리지널 칠성사이다"}
                        ]
                    }
                ]
                
                # 새로운 메뉴들을 pool 앞쪽에 추가
                pool_data = new_menus + pool_data
                
                # 저장
                with open(pool_file, "w", encoding="utf-8") as f:
                    json.dump(pool_data, f, ensure_ascii=False, indent=2)
                
                print("✅ 5대 매장의 카탈로그별 예제 메뉴가 성공적으로 일괄 리셋/시딩되었습니다.")
            except Exception as m_err:
                print(f"⚠️ Failed to seed menu catalogs: {m_err}")
        
        # 4. 사장님의 요청에 따른 모든 실시간 주문/세션/호출/대기 내역 완전 청소
        try:
            cur.execute("TRUNCATE TABLE table_orders CASCADE")
            cur.execute("TRUNCATE TABLE table_sessions CASCADE")
            cur.execute("TRUNCATE TABLE table_calls CASCADE")
            cur.execute("TRUNCATE TABLE table_waitings CASCADE")
            cur.execute("TRUNCATE TABLE table_reservations CASCADE")
            cur.execute("TRUNCATE TABLE table_parkings CASCADE")
            cur.execute("TRUNCATE TABLE customer_points CASCADE")
            print("🧹 All orders, sessions, calls, waitings, and points cleared for fresh testing.")
        except Exception as clear_err:
            try:
                cur.execute("DELETE FROM table_orders")
                cur.execute("DELETE FROM table_sessions")
                cur.execute("DELETE FROM table_calls")
                cur.execute("DELETE FROM table_waitings")
                cur.execute("DELETE FROM table_reservations")
                cur.execute("DELETE FROM table_parkings")
                cur.execute("DELETE FROM customer_points")
                print("🧹 All orders, sessions, calls, waitings, and points deleted via DELETE fallbacks.")
            except Exception as del_err:
                print(f"⚠️ Failed to clear order history: {del_err}")
        
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
        cur.execute("""
            SELECT 
                id AS store_id, 
                name AS store_name, 
                ceo_name AS owner_name, 
                COALESCE(signature_owner, 'owner-' || id) AS owner_id, 
                COALESCE(monthly_fee, 0) AS monthly_fee, 
                COALESCE(payment_status, '정상') AS payment_status,
                payment_history,
                COALESCE(created_at::text, NOW()::text) AS timestamp
            FROM stores 
            ORDER BY created_at DESC
        """)
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
            INSERT INTO stores (id, name, ceo_name, signature_owner, monthly_fee, payment_status, payment_history, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        """, (store_id, store_name, owner_name, owner_id, monthly_fee, payment_status, payment_history))
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
            SET name = %s, ceo_name = %s, signature_owner = %s, monthly_fee = %s, payment_status = %s, payment_history = %s
            WHERE id = %s
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
        cur.execute("DELETE FROM stores WHERE id = %s", (store_id,))
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Delete Store DB Error: {e}")
        return False
