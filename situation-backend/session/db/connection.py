import psycopg2  # type: ignore
from psycopg2.extras import RealDictCursor  # type: ignore
import os
import json
from datetime import datetime
from dotenv import load_dotenv, find_dotenv

# .env 파일 로드 (상위 디렉토리 포함 자동 탐색)
load_dotenv(find_dotenv())
DATABASE_URL = os.getenv("DATABASE_URL")

class SafeConnectionWrapper:
    def __init__(self, conn):
        self._conn = conn
        self._closed = False

    def cursor(self, *args, **kwargs):
        cur = self._conn.cursor(*args, **kwargs)
        return SafeCursorWrapper(cur, self)

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    def close(self):
        if not self._closed:
            try:
                self._conn.close()
            except:
                pass
            self._closed = True

    def __getattr__(self, name):
        return getattr(self._conn, name)

    def __del__(self):
        self.close()

class SafeCursorWrapper:
    def __init__(self, cur, conn_wrapper):
        self._cur = cur
        self._conn_wrapper = conn_wrapper
        self._closed = False

    def close(self):
        if not self._closed:
            try:
                self._cur.close()
            except:
                pass
            self._closed = True

    def __iter__(self):
        return iter(self._cur)

    def __next__(self):
        return next(self._cur)

    def __getattr__(self, name):
        return getattr(self._cur, name)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def __del__(self):
        self.close()

def get_db_conn():
    if not DATABASE_URL:
        raise Exception("DATABASE_URL environment variable is missing!")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return SafeConnectionWrapper(conn)
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
                tardy BOOLEAN DEFAULT FALSE,
                paid BOOLEAN DEFAULT FALSE,
                device_id TEXT
            )
        """)
        try:
            cur.execute("ALTER TABLE table_attendance_logs ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT FALSE")
            cur.execute("ALTER TABLE table_attendance_logs ADD COLUMN IF NOT EXISTS device_id TEXT")
        except Exception:
            pass

        # 11. 스태프 스케줄 테이블 (table_staff_schedules)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_staff_schedules (
                schedule_id TEXT PRIMARY KEY,
                staff_id TEXT NOT NULL,
                store_id TEXT NOT NULL DEFAULT 'default_store',
                day_of_week INTEGER NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL
            )
        """)
        try:
            cur.execute("ALTER TABLE table_staff_schedules ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'default_store'")
        except Exception:
            pass

        # 12. 매장 관리용 테이블 (stores) - 테스트용 안전 연동 및 5대 핵심 가맹점 시딩
        # 기존 운영 중인 테이블 및 외래키 종속성을 해치지 않기 위해 DROP/CASCADE 없이 IF NOT EXISTS로 안전하게 생성합니다.
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
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    ceo_name = EXCLUDED.ceo_name,
                    signature_owner = EXCLUDED.signature_owner,
                    monthly_fee = EXCLUDED.monthly_fee,
                    payment_status = EXCLUDED.payment_status,
                    payment_history = EXCLUDED.payment_history
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
            cur.execute("ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS payment_key TEXT")  # 환불용 토스 결제키
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

                # 4) 현존하는 모든 매장(취홍루, 시크빌 등)의 동적 맞춤형 카탈로그 메뉴 자동 복구 및 시딩
                cur.execute("SELECT id, name FROM stores")
                existing_db_stores = cur.fetchall()
                seeded_ids = {"store-korean", "store-coffee", "store-beef", "store-tofu", "store-bibim"}

                for s_row in existing_db_stores:
                    s_id, s_name = s_row[0], s_row[1]
                    if s_id in seeded_ids:
                        continue

                    items = []
                    # 중국집 / 중식 테마 (취홍루 등)
                    if any(k in s_name for k in ["취홍루", "중화", "반점", "루", "성", "객잔", "중식", "짜장", "짬뽕"]):
                        items = [
                            {"name": "수제 손짜장면", "value": 7500, "icon": "🍜", "category": "식사류", "description": "춘장의 고소함과 쫄깃한 수타면발이 일품인 대표 유니짜장"},
                            {"name": "얼큰 낙지짬뽕", "value": 9500, "icon": "🌶️", "category": "식사류", "description": "신선한 낙지 한 마리와 불향 가득한 해산물 육수의 얼큰함"},
                            {"name": "해물쟁반짜장 (2인)", "value": 18000, "icon": "🍛", "category": "식사류", "description": "오징어, 새우와 면을 춘장에 강한 화력으로 함께 볶아낸 요리"},
                            {"name": "찹쌀 탕수육 (소)", "value": 19000, "icon": "🐖", "category": "요리류", "description": "국내산 등심을 바삭하게 튀겨 쫄깃하고 투명한 소스를 얹은 한 접시"},
                            {"name": "매콤 칠리새우", "value": 26000, "icon": "🍤", "category": "요리류", "description": "새콤매콤 달콤한 특제 소스에 버무린 바삭한 대하 튀김"},
                            {"name": "명품 고추잡채 & 꽃빵", "value": 28000, "icon": "🫓", "category": "요리류", "description": "피망과 돼지고기 채를 고추기름에 볶아 따끈한 꽃빵과 싸 먹는 일품"},
                            {"name": "연태고량주 (중)", "value": 16000, "icon": "🍶", "category": "주류", "description": "파인애플 향이 은은하게 퍼지는 대표 프리미엄 중국 명주"},
                            {"name": "시원한 콜라/사이다", "value": 2000, "icon": "🥤", "category": "음료", "description": "기름진 입맛을 리셋해주는 시원한 청량음료"}
                        ]
                    # 카페 / 베이커리 / 브런치 테마 (시크빌, 카페 등)
                    elif any(k in s_name.lower() or k in s_id.lower() for k in ["시크빌", "cafe", "coffee", "카페", "커피", "디저트", "브런치", "베이커리"]):
                        items = [
                            {"name": "시그니처 아메리카노", "value": 4500, "icon": "☕", "category": "커피", "description": "과테말라 프리미엄 원두로 깊고 바디감 넘치는 오리지널 블랙"},
                            {"name": "벨벳 카페 라떼", "value": 5000, "icon": "🥛", "category": "커피", "description": "실크처럼 부드러운 스팀밀크와 진한 에스프레소의 아늑한 한 잔"},
                            {"name": "에스프레소 마끼아또", "value": 4000, "icon": "☕", "category": "커피", "description": "진한 에스프레소 위에 살포시 얹은 고소한 우유 거품"},
                            {"name": "제주 청귤 에이드", "value": 6000, "icon": "🍹", "category": "음료", "description": "새콤달콤한 청귤 청에 톡 쏘는 탄산수를 블렌딩한 시즌 청량음료"},
                            {"name": "메이플 크로플 & 아이스크림", "value": 6500, "icon": "🧇", "category": "디저트", "description": "버터향 가득한 생지를 구워 젤라또 아이스크림과 메이플 시럽을 토핑"},
                            {"name": "바스크 치즈케이크", "value": 7000, "icon": "🍰", "category": "디저트", "description": "고온에서 그을려 구워내 스모키한 향과 진한 크림치즈의 텍스처"}
                        ]
                    # 전통 한식 테마
                    elif any(k in s_name for k in ["한식", "수라간", "가든", "정식", "식당", "찌개", "밥"]):
                        items = [
                            {"name": "우정 돼지김치찌개 정식", "value": 8500, "icon": "🍲", "category": "식사류", "description": "국내산 암돼지와 푹 익은 김치를 끓여내 구수한 돌솥밥과 제공"},
                            {"name": "전통 제육볶음 반상", "value": 9500, "icon": "🍖", "category": "식사류", "description": "직화로 불향을 가득 입혀 매콤 짭조름하게 볶아낸 점심 인기메뉴"},
                            {"name": "노릇 해물파전", "value": 16000, "icon": "전류", "category": "요리류", "description": "해산물과 실파를 가득 얹어 겉은 바삭하고 속은 촉촉하게 구워낸 파전"},
                            {"name": "참숯 매콤 닭갈비", "value": 24000, "icon": "🐔", "category": "요리류", "description": "매콤한 고추장 양념에 재운 정통 닭갈비를 석쇠에 직화로 구운 요리"},
                            {"name": "시원한 참이슬 소주", "value": 5000, "icon": "🍶", "category": "주류", "description": "한식과 가장 완벽한 마리아주를 자랑하는 소주"},
                            {"name": "탄산음료 (칠성사이다)", "value": 2000, "icon": "🥤", "category": "음료", "description": "시원한 목 넘김의 오리지널 탄산음료"}
                        ]
                    # 기본 패밀리 레스토랑 / 호프 테마 (나머지 일반 매장 전체)
                    else:
                        items = [
                            {"name": "프리미엄 모듬 바베큐 플레이트", "value": 29000, "icon": "🍖", "category": "대표요리", "description": "등갈비, 삼겹살, 소시지를 훈연 참숯 그릴에 직접 구워낸 플래터"},
                            {"name": "바삭 후라이드 치킨", "value": 19000, "icon": "🍗", "category": "대표요리", "description": "고소한 전용 크리스피 밀가루로 바삭하게 튀겨낸 치킨의 정석"},
                            {"name": "매콤 골뱅이 소면 무침", "value": 18000, "icon": "🐚", "category": "사이드/안주", "description": "새콤달콤 매콤한 소스에 쫄깃한 골뱅이와 야채, 소면을 함께 버무린 별미"},
                            {"name": "시원한 어묵 조개탕", "value": 15000, "icon": "🍲", "category": "사이드/안주", "description": "맑고 개운한 조개 육수에 모듬 고급 어묵을 끓여낸 소주 안주 최고봉"},
                            {"name": "살얼음 생맥주 500cc", "value": 4500, "icon": "🍺", "category": "주류", "description": "잔까지 영하로 꽁꽁 얼려 머리가 깨질 듯한 시원함의 오리지널 생맥주"},
                            {"name": "코카콜라 / 스프라이트", "value": 2000, "icon": "🥤", "category": "음료", "description": "언제 마셔도 상쾌한 시원한 탄산음료"}
                        ]

                    dynamic_menu = {
                        "id": f"MENUS_{s_id}",
                        "type": "Menus",
                        "title": "메뉴 정보",
                        "store_id": s_id,
                        "store": s_name,
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "items": items
                    }
                    new_menus.append(dynamic_menu)

                # 새로운 메뉴들을 pool 앞쪽에 추가
                pool_data = new_menus + pool_data

                # 저장
                with open(pool_file, "w", encoding="utf-8") as f:
                    json.dump(pool_data, f, ensure_ascii=False, indent=2)

                print("✅ 5대 매장 및 현존 모든 매장의 카탈로그별 맞춤형 예제 메뉴 시딩이 완료되었습니다.")
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
