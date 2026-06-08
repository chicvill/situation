"""
seed_db.py — DB 초기화 + 3개 매장 기본 데이터 시딩

실행:
    cd situation-backend
    python seed_db.py
"""
import json
import os
import sys
import uuid
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from session.db.connection import get_db_conn, init_db_v2

NOW = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
POOL_FILE = os.path.join(os.path.dirname(__file__), "knowledge_pool.json")

# ─────────────────────────────────────────────────────────────────
# 매장 정의
# ─────────────────────────────────────────────────────────────────
STORES = [
    {
        "id": "store-1",
        "name": "미소 한식당",
        "ceo_name": "김미소",
        "signature_owner": "owner-1",
        "monthly_fee": 120000,
        "payment_status": "정상",
    },
    {
        "id": "store-2",
        "name": "블루버드 카페",
        "ceo_name": "이하늘",
        "signature_owner": "owner-2",
        "monthly_fee": 80000,
        "payment_status": "정상",
    },
    {
        "id": "store-3",
        "name": "나폴리 피자",
        "ceo_name": "박나폴",
        "signature_owner": "owner-3",
        "monthly_fee": 100000,
        "payment_status": "정상",
    },
    {
        "id": "store-Mbh",
        "name": "일산국밥",
        "ceo_name": "민병훈",
        "signature_owner": "owner-Mbh",
        "monthly_fee": 50000,
        "payment_status": "정상",
    },
    {
        "id": "store-chicvill",
        "name": "시크빌",
        "ceo_name": "김종심",
        "signature_owner": "owner-store-chicvill",
        "monthly_fee": 150000,
        "payment_status": "정상",
    },
]

# ─────────────────────────────────────────────────────────────────
# 메뉴 정의
# ─────────────────────────────────────────────────────────────────
MENUS = [
    {
        "id": "MENUS_store-1",
        "type": "Menus",
        "title": "메뉴 정보",
        "store_id": "store-1",
        "store": "미소 한식당",
        "timestamp": NOW,
        "items": [
            {"name": "된장찌개",    "value": 9000,  "icon": "🍲", "category": "찌개류",  "description": "국산 된장과 두부, 감자를 넣어 구수하게 끓인 전통 찌개"},
            {"name": "김치찌개",    "value": 9000,  "icon": "🌶️", "category": "찌개류",  "description": "묵은지와 돼지고기로 깊은 맛을 낸 김치찌개"},
            {"name": "제육볶음",    "value": 11000, "icon": "🥘", "category": "볶음류",  "description": "양념 돼지고기를 파·양파와 함께 볶은 매콤한 제육볶음"},
            {"name": "불고기 정식", "value": 15000, "icon": "🥩", "category": "정식류",  "description": "국내산 소불고기에 밥·국·반찬이 함께 나오는 정식"},
            {"name": "비빔밥",      "value": 10000, "icon": "🍚", "category": "밥류",    "description": "계절 나물 and 고추장을 넣어 비벼 먹는 건강 비빔밥"},
            {"name": "돌솥비빔밥",  "value": 12000, "icon": "🫕", "category": "밥류",    "description": "달궈진 돌솥에 누룽지까지 즐기는 프리미엄 비빔밥"},
            {"name": "막걸리",      "value": 5000,  "icon": "🍶", "category": "주류/음료", "description": "국산 쌀로 빚은 생막걸리 (750ml)"},
            {"name": "보리차",      "value": 0,     "icon": "☕", "category": "주류/음료", "description": "무료 제공 보리차"},
        ],
    },
    {
        "id": "MENUS_store-2",
        "type": "Menus",
        "title": "메뉴 정보",
        "store_id": "store-2",
        "store": "블루버드 카페",
        "timestamp": NOW,
        "items": [
            {"name": "아메리카노",    "value": 4500, "icon": "☕",  "category": "커피",   "description": "에티오피아 원두를 사용한 깔끔하고 산뜻한 아메리카노"},
            {"name": "카페라떼",      "value": 5500, "icon": "🥛",  "category": "커피",   "description": "부드러운 우유 거품 and 에스프레소의 조화"},
            {"name": "카푸치노",      "value": 5500, "icon": "☕",  "category": "커피",   "description": "진한 에스프레소에 풍성한 우유 거품을 얹은 카푸치노"},
            {"name": "바닐라 라떼",   "value": 6000, "icon": "✨",  "category": "커피",   "description": "달콤한 바닐라 시럽을 가미한 부드러운 라떼"},
            {"name": "얼그레이 티",   "value": 4500, "icon": "🍵",  "category": "논커피", "description": "베르가못 향이 가득한 정통 얼그레이 홍차"},
            {"name": "스무디",        "value": 6500, "icon": "🥤",  "category": "논커피", "description": "딸기·망고·블루베리 중 선택 가능한 생과일 스무디"},
            {"name": "크루아상",      "value": 4000, "icon": "🥐",  "category": "디저트", "description": "매일 아침 직접 구워내는 바삭한 버터 크루아상"},
            {"name": "치즈 케이크",   "value": 6500, "icon": "🍰",  "category": "디저트", "description": "뉴욕 스타일의 진하고 크리미한 치즈 케이크"},
            {"name": "아보카도 토스트","value": 8500, "icon": "🥑",  "category": "푸드",   "description": "신선한 아보카도와 수란을 올린 브런치 토스트"},
        ],
    },
    {
        "id": "MENUS_store-3",
        "type": "Menus",
        "title": "메뉴 정보",
        "store_id": "store-3",
        "store": "나폴리 피자",
        "timestamp": NOW,
        "items": [
            {"name": "마르게리타",    "value": 16000, "icon": "🍕", "category": "피자",  "description": "토마토·모짜렐라·바질만으로 완성한 나폴리 정통 피자"},
            {"name": "페퍼로니",      "value": 18000, "icon": "🍕", "category": "피자",  "description": "매콤한 페퍼로니를 듬뿍 올린 인기 1위 피자"},
            {"name": "포카치아",      "value": 12000, "icon": "🍕", "category": "피자",  "description": "올리브 오일과 로즈마리로 맛을 낸 이탈리아 빵"},
            {"name": "까르보나라",    "value": 14000, "icon": "🍝", "category": "파스타", "description": "판체타·달걀·파르미지아노로 만든 진한 크림 파스타"},
            {"name": "봉골레",        "value": 15000, "icon": "🍝", "category": "파스타", "description": "신선한 바지락과 마늘·화이트와인의 바다 향 파스타"},
            {"name": "아라비아타",    "value": 13000, "icon": "🍝", "category": "파스타", "description": "매콤한 고추와 토마토소스의 단순하지만 강렬한 파스타"},
            {"name": "티라미수",      "value": 8000,  "icon": "🍮", "category": "디저트", "description": "에스프레소에 적신 사보이아르디와 마스카르포네 크림"},
            {"name": "하우스 와인",   "value": 9000,  "icon": "🍷", "category": "주류/음료", "description": "이탈리아산 하우스 레드·화이트 와인 (잔)"},
            {"name": "아란치니",      "value": 7000,  "icon": "🍙", "category": "사이드", "description": "치즈를 넣어 튀긴 이탈리아 쌀 튀김 3개"},
        ],
    },
    {
        "id": "MENUS_store-Mbh",
        "type": "Menus",
        "title": "메뉴 정보",
        "store_id": "store-Mbh",
        "store": "일산국밥",
        "timestamp": NOW,
        "items": [
            {"name": "순대국밥",      "value": 9000,  "icon": "🍲", "category": "식사류",  "description": "직접 만든 토종순대와 부드러운 머리고기가 가득한 국밥"},
            {"name": "돼지국밥",      "value": 9000,  "icon": "🍲", "category": "식사류",  "description": "진하게 우려낸 사골 육수에 담백한 돼지고기를 듬뿍 넣은 국밥"},
            {"name": "모듬순대",      "value": 15000, "icon": "🍥", "category": "안주류",  "description": "토종순대, 야채순대와 머리고기 수육 모듬 (소)"},
            {"name": "소주",          "value": 5000,  "icon": "🍶", "category": "주류/음료", "description": "참이슬 / 처음처럼 / 진로"},
            {"name": "맥주",          "value": 6000,  "icon": "🍺", "category": "주류/음료", "description": "카스 / 테라 / 켈리"},
            {"name": "보리차",        "value": 0,     "icon": "☕", "category": "주류/음료", "description": "구수한 보리차 (무료제공)"},
        ],
    },
    {
        "id": "MENUS_store-chicvill",
        "type": "Menus",
        "title": "메뉴 정보",
        "store_id": "store-chicvill",
        "store": "시크빌",
        "timestamp": NOW,
        "items": [
            {"name": "명품 한우 갈비살", "value": 42000, "icon": "🥩", "category": "구이류", "description": "한우 고유의 고소한 맛과 부드러운 육질이 일품인 최상급 갈비살 (150g)"},
            {"name": "명품 한우 등심", "value": 45000, "icon": "🥩", "category": "구이류", "description": "풍부한 마블링에서 우러나는 진한 풍미의 최고급 등심 (150g)"},
            {"name": "명품 한우 안심", "value": 48000, "icon": "🥩", "category": "구이류", "description": "가장 부드럽고 담백하며 육즙이 가득한 프리미엄 안심 (150g)"},
            {"name": "한우 생육회", "value": 28000, "icon": "🥩", "category": "요리류", "description": "당일 도축한 한우 우둔살을 특제 양념으로 맛깔나게 버무린 육회 (150g)"},
            {"name": "시골 순두부찌개", "value": 9000, "icon": "🍲", "category": "식사류", "description": "정선 콩으로 만든 고소한 순두부와 국산 멸치 육수로 끓인 찌개"},
            {"name": "한우 차돌된장찌개", "value": 10000, "icon": "🍲", "category": "식사류", "description": "구수한 된장에 부드러운 한우 차돌박이를 듬뿍 넣고 끓여낸 찌개"},
            {"name": "함흥 비빔냉면", "value": 9000, "icon": "🍜", "category": "식사류", "description": "직접 뽑은 쫄깃한 면발과 매콤새콤한 수제 비빔 양념의 함흥 냉면"},
            {"name": "함흥 물냉면", "value": 9000, "icon": "🍜", "category": "식사류", "description": "깊고 깔끔한 소고기 육수에 얼음을 동동 띄워 시원하게 즐기는 물냉면"},
            {"name": "소주", "value": 5000, "icon": "🍶", "category": "주류/음료", "description": "참이슬 / 처음처럼 / 진로 중 선택"},
            {"name": "맥주", "value": 6000, "icon": "🍺", "category": "주류/음료", "description": "카스 / 테라 / 켈리 중 선택"},
            {"name": "프리미엄 콜드브루 커피", "value": 4500, "icon": "☕", "category": "주류/음료", "description": "시크빌이 직접 내린 깊고 풍부한 에티오피아 콜드브루"},
            {"name": "보리차", "value": 0, "icon": "☕", "category": "주류/음료", "description": "정성으로 끓여낸 구수한 옥수수 보리차 (무료제공)"},
        ],
    },
]

# ─────────────────────────────────────────────────────────────────
# 스태프 정의 (데모 시나리오 기준 동기화)
# ─────────────────────────────────────────────────────────────────
STAFF = {
    "store-1": [
        {
            "name": "이민준", "role": "manager", "hourly_wage": 13000, "phone": "01011000001",
            "contract": {"start": "2025-01-15", "end": "2026-12-31", "employment_type": "정규직", "gender": "남성", "birth_date": "1995-03-12"}
        },
        {
            "name": "김수아", "role": "staff", "hourly_wage": 11500, "phone": "01022000001",
            "contract": {"start": "2025-09-01", "end": "2026-08-31", "employment_type": "알바", "gender": "여성", "birth_date": "2003-07-22"}
        },
    ],
    "store-2": [
        {
            "name": "박지호", "role": "manager", "hourly_wage": 13000, "phone": "01011000002",
            "contract": {"start": "2025-03-01", "end": "2027-02-28", "employment_type": "정규직", "gender": "남성", "birth_date": "1992-11-05"}
        },
        {
            "name": "최은지", "role": "staff", "hourly_wage": 11500, "phone": "01022000002",
            "contract": {"start": "2026-02-01", "end": "2027-01-31", "employment_type": "알바", "gender": "여성", "birth_date": "2004-01-14"}
        },
    ],
    "store-3": [
        {
            "name": "정현우", "role": "manager", "hourly_wage": 13000, "phone": "01011000003",
            "contract": {"start": "2025-06-01", "end": "2027-05-31", "employment_type": "정규직", "gender": "남성", "birth_date": "1990-08-30"}
        },
        {
            "name": "강민서", "role": "staff", "hourly_wage": 11000, "phone": "01022000003",
            "contract": {"start": "2026-01-15", "end": "2026-12-31", "employment_type": "알바", "gender": "여성", "birth_date": "2002-05-18"}
        },
    ],
    "store-Mbh": [
        {
            "name": "한소희", "role": "manager", "hourly_wage": 13000, "phone": "01011000004",
            "contract": {"start": "2025-04-01", "end": "2027-03-31", "employment_type": "정규직", "gender": "여성", "birth_date": "1994-02-09"}
        },
        {
            "name": "오준혁", "role": "staff", "hourly_wage": 11000, "phone": "01022000004",
            "contract": {"start": "2026-03-01", "end": "2026-11-30", "employment_type": "알바", "gender": "남성", "birth_date": "2001-09-25"}
        },
    ],
    "store-chicvill": [
        {
            "name": "서채원", "role": "manager", "hourly_wage": 14000, "phone": "01011000005",
            "contract": {"start": "2025-02-01", "end": "2027-01-31", "employment_type": "정규직", "gender": "여성", "birth_date": "1993-12-01"}
        },
        {
            "name": "임지수", "role": "staff", "hourly_wage": 12000, "phone": "01022000005",
            "contract": {"start": "2025-11-01", "end": "2026-10-31", "employment_type": "알바", "gender": "여성", "birth_date": "2000-04-07"}
        },
    ],
}


# 스케줄: 월~금 11:00–22:00, 토~일 10:00–23:00
SCHEDULES = [
    (0, "11:00", "22:00"), (1, "11:00", "22:00"), (2, "11:00", "22:00"),
    (3, "11:00", "22:00"), (4, "11:00", "22:00"),
    (5, "10:00", "23:00"), (6, "10:00", "23:00"),
]


# ─────────────────────────────────────────────────────────────────
# 헬퍼
# ─────────────────────────────────────────────────────────────────
def _uid(prefix=""):
    return f"{prefix}{uuid.uuid4().hex[:8].upper()}"


# ─────────────────────────────────────────────────────────────────
# STEP 1 — 테이블 초기화
# ─────────────────────────────────────────────────────────────────
def drop_tables(conn):
    cur = conn.cursor()
    tables = [
        "table_sessions",
        "table_orders",
        "table_calls",
        "table_parkings",
        "knowledge_bundles",
        "situation_pool",
        "table_staff_accounts",
        "table_staff_schedules",
        "table_attendance_logs",
        "table_waitings",
        "table_reservations",
        "stores",
        "customer_points",
    ]
    for t in tables:
        cur.execute(f"DROP TABLE IF EXISTS {t} CASCADE")
        print(f"  DROP {t}")
    conn.commit()
    cur.close()
    print("✅ 모든 테이블 삭제 완료")


# ─────────────────────────────────────────────────────────────────
# STEP 2 — 매장 시딩
# ─────────────────────────────────────────────────────────────────
def seed_stores(conn):
    cur = conn.cursor()
    for s in STORES:
        history = [
            {"date": "2026-03-10", "amount": s["monthly_fee"], "status": "완료"},
            {"date": "2026-04-10", "amount": s["monthly_fee"], "status": "완료"},
            {"date": "2026-05-10", "amount": s["monthly_fee"], "status": "완료"}
        ]
        cur.execute("""
            INSERT INTO stores
                (id, name, ceo_name, signature_owner, monthly_fee, payment_status,
                 payment_history, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (id) DO NOTHING
        """, (
            s["id"], s["name"], s["ceo_name"], s["signature_owner"],
            s["monthly_fee"], s["payment_status"], json.dumps(history, ensure_ascii=False),
        ))
        print(f"  매장 추가: {s['name']} ({s['id']})")
    conn.commit()
    cur.close()


# ─────────────────────────────────────────────────────────────────
# STEP 3 — 스태프 시딩
# ─────────────────────────────────────────────────────────────────
def seed_staff(conn):
    cur = conn.cursor()
    staff_ids = {}
    for store_id, members in STAFF.items():
        store_staff_ids = []
        for m in members:
            sid = m["phone"]  # 데모의 표준 전화번호를 staff_id로 직접 사용!
            cur.execute("""
                INSERT INTO table_staff_accounts
                    (staff_id, store_id, name, role, hourly_wage, status, contract_period)
                VALUES (%s, %s, %s, %s, %s, 'active', %s)
            """, (sid, store_id, m["name"], m["role"], m["hourly_wage"],
                  json.dumps(m["contract"], ensure_ascii=False)))

            for day, start, end in SCHEDULES:
                cur.execute("""
                    INSERT INTO table_staff_schedules
                        (schedule_id, staff_id, store_id, day_of_week, start_time, end_time)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (_uid("SCH-"), sid, store_id, day, start, end))

            store_staff_ids.append(sid)
            print(f"  스태프 추가: {m['name']} ({m['role']}) → {store_id}")
        staff_ids[store_id] = store_staff_ids
    conn.commit()
    cur.close()
    return staff_ids


def seed_users(conn):
    from werkzeug.security import generate_password_hash
    cur = conn.cursor()
    
    # users 테이블 비우기 (외래키 제약조건 방지 CASCADE)
    try:
        cur.execute("TRUNCATE users CASCADE")
    except Exception:
        conn.rollback()
        cur.execute("DELETE FROM users")
    
    users_to_seed = []
    
    # 1. 최고 관리자 (Admin)
    users_to_seed.append(("admin", "1212", "admin", None, "어드민01", True))
    
    # 2. 5개 매장의 점주 (Owners)
    stores_info = [
        ("store-1", "미소 한식당", "01000000001", "김미소"),
        ("store-2", "블루버드 카페", "01000000002", "이하늘"),
        ("store-3", "나폴리 피자", "01000000003", "박나폴"),
        ("store-Mbh", "일산국밥", "01000000004", "민병훈"),
        ("store-chicvill", "시크빌", "01082817377", "김종심"),
    ]
    for store_id, store_name, phone, ceo_name in stores_info:
        users_to_seed.append((phone, "1212", "owner", store_id, f"{ceo_name} 사장", True))
        
    # 3. 5개 매장의 점장(manager) 및 점원(staff) (STAFF 딕셔너리 기반)
    for store_id, members in STAFF.items():
        for m in members:
            phone = m["phone"]
            role = m["role"]
            name = m["name"]
            users_to_seed.append((phone, "1212", role, store_id, name, True))
            
    # users 테이블에 해시 암호화 주입
    print("\n[STEP 3-2] 사용자 계정(users) 시딩")
    import hashlib
    for username, password, role, store_id, full_name, is_approved in users_to_seed:
        # 프론트엔드가 SHA-256으로 해싱해서 보내므로, DB에는 SHA-256 해시의 Werkzeug 해시를 저장해야 일치합니다.
        pw_sha = hashlib.sha256(password.encode()).hexdigest()
        pw_hash = generate_password_hash(pw_sha)
        cur.execute("""
            INSERT INTO users (username, password, role, store_id, full_name, is_approved, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (username) DO NOTHING
        """, (username, pw_hash, role, store_id, full_name, is_approved))
        print(f"  사용자 계정 생성: {username} ({role}) -> {store_id}")
        
    conn.commit()
    cur.close()



# ─────────────────────────────────────────────────────────────────
# STEP 4 — 메뉴 (knowledge_pool.json 교체)
# ─────────────────────────────────────────────────────────────────
def seed_menus():
    pool_data = []
    # 1. 메뉴 번들 추가
    pool_data.extend(MENUS)
    
    # 2. 데모용 점장/점원 가입 정보(PersonalInfos) 번들 추가 (비밀번호: SHA-256 해싱 "1212")
    import hashlib
    pw_sha = hashlib.sha256(b"1212").hexdigest()
    
    store_names = {s["id"]: s["name"] for s in STORES}
    
    for store_id, members in STAFF.items():
        store_name = store_names.get(store_id, "")
        for m in members:
            phone = m["phone"]
            name = m["name"]
            role = m["role"]
            
            pid = f"USER-{phone}"
            pool_data.append({
                "id": pid,
                "type": "PersonalInfos",
                "title": f"{name}님 계정 ({'점장' if role == 'manager' else '점원'})",
                "items": [
                    {"name": "이름", "value": name},
                    {"name": "아이디", "value": phone},
                    {"name": "비밀번호", "value": pw_sha},
                    {"name": "권한", "value": role}
                ],
                "status": "approved",
                "timestamp": NOW,
                "store": store_name,
                "store_id": store_id
            })
            
    with open(POOL_FILE, "w", encoding="utf-8") as f:
        json.dump(pool_data, f, ensure_ascii=False, indent=2)
    print(f"✅ knowledge_pool.json 저장 완료 (Menus: {len(MENUS)}개, PersonalInfos: {len(pool_data) - len(MENUS)}개)")


# ─────────────────────────────────────────────────────────────────
# STEP 5 — 테스트 세션 (매장당 2테이블, 주문 포함) - 삭제 (실제 사용 시 혼선 방지)
# ─────────────────────────────────────────────────────────────────
def seed_sessions(conn):
    # 실제 운영 환경이나 테스트 환경에서 의도치 않은 유령 주문이 카운터에 나타나는 것을 
    # 방지하기 위해, 더 이상 초기화 시 가짜 활성 세션을 만들지 않습니다.
    pass


def seed_archive_data(conn):
    import random
    from datetime import timedelta
    from session.db.session_db import init_archive_table
    
    print("\n[7/7] 역사적 60일 매출 데이터 시딩 (session_archive)")
    init_archive_table()
    
    cur = conn.cursor()
    cur.execute("DELETE FROM session_archive")
    
    # 60일 전부터 어제까지 매출 데이터 생성
    end_date = datetime.now() - timedelta(days=1)
    start_date = datetime.now() - timedelta(days=60)
    
    # 각 매장 정의
    stores_list = [
        {"id": "store-1", "name": "미소 한식당", "menus": MENUS[0]["items"]},
        {"id": "store-2", "name": "블루버드 카페", "menus": MENUS[1]["items"]},
        {"id": "store-3", "name": "나폴리 피자", "menus": MENUS[2]["items"]},
        {"id": "store-Mbh", "name": "일산국밥", "menus": MENUS[3]["items"]},
        {"id": "store-chicvill", "name": "시크빌", "menus": MENUS[4]["items"]}
    ]
    
    total_sessions_count = 0
    total_revenue_count = 0
    
    current_date = start_date
    while current_date <= end_date:
        date_str = current_date.strftime("%Y-%m-%d")
        dow = current_date.weekday()  # 0=월, 4=금, 5=토, 6=일
        is_weekend = dow in (4, 5, 6) # 금, 토, 일
        
        for store in stores_list:
            store_id = store["id"]
            menus = store["menus"]
            
            # --- 1. 요일별 손님 방문 건수 (객수) 정의 ---
            # 현실 데이터: 주중은 소폭 편차가 있으나 대체로 안정적이고, 주말은 매출이 2.5x~3.5x 폭증함.
            # 월요일은 소폭 조용하며, 금/토요일은 피크, 일요일 저녁은 월요병 영향으로 소폭 감소.
            if dow == 0:     # 월요일
                sessions_count = random.randint(4, 7)
            elif dow in (1, 2):  # 화, 수요일
                sessions_count = random.randint(5, 8)
            elif dow == 3:   # 목요일 (주말 직전 소폭 증가)
                sessions_count = random.randint(6, 9)
            elif dow == 4:   # 금요일 (불금 효과)
                sessions_count = random.randint(15, 23)
            elif dow == 5:   # 토요일 (최대 피크)
                sessions_count = random.randint(18, 26)
            else:            # 일요일 (가족 외식 위주, 저녁 조기 종료)
                sessions_count = random.randint(12, 18)
                
            for s_idx in range(sessions_count):
                session_id = f"SESS-ARCH-{uuid.uuid4().hex[:8].upper()}"
                table_id = f"T{random.randint(1, 6):02d}"
                
                # --- 2. 현실적인 이용시간대(Peak Hour) 설정 ---
                # 한식당/피자집/시크빌: 점심 피크(11:30~13:30) & 저녁 피크(17:30~20:30)
                # 카페: 점심 직후 피크(12:00~15:00) & 나른한 오후(15:00~17:30)
                checkout_hour = 12
                checkout_minute = random.randint(0, 59)
                
                if store_id in ("store-1", "store-3", "store-chicvill"):
                    time_rand = random.random()
                    if time_rand < 0.35:     # 점심 Peak Checkout (12:30 ~ 14:30)
                        checkout_hour = random.choice([12, 13, 14])
                        if checkout_hour == 12: checkout_minute = random.randint(30, 59)
                        elif checkout_hour == 14: checkout_minute = random.randint(0, 30)
                    elif time_rand < 0.85:   # 저녁 Peak Checkout (18:30 ~ 21:30)
                        checkout_hour = random.choice([18, 19, 20, 21])
                        if checkout_hour == 18: checkout_minute = random.randint(30, 59)
                        elif checkout_hour == 21: checkout_minute = random.randint(0, 30)
                    else:                    # 애매한 틈새 시간 (14:30 ~ 18:30)
                        checkout_hour = random.choice([14, 15, 16, 17, 18])
                        if checkout_hour == 14: checkout_minute = random.randint(31, 59)
                        elif checkout_hour == 18: checkout_minute = random.randint(0, 29)
                else:  # 카페 (블루버드 카페)
                    time_rand = random.random()
                    if time_rand < 0.15:     # 모닝 커피 타임 (08:30 ~ 11:30)
                        checkout_hour = random.choice([8, 9, 10, 11])
                        if checkout_hour == 8: checkout_minute = random.randint(30, 59)
                        elif checkout_hour == 11: checkout_minute = random.randint(0, 30)
                    elif time_rand < 0.60:   # 점심 식후 대폭발 (12:00 ~ 15:00)
                        checkout_hour = random.choice([12, 13, 14, 15])
                        if checkout_hour == 15: checkout_minute = random.randint(0, 15)
                    elif time_rand < 0.90:   # 오후 디저트 타임 (15:00 ~ 18:30)
                        checkout_hour = random.choice([15, 16, 17, 18])
                        if checkout_hour == 15: checkout_minute = random.randint(16, 59)
                        elif checkout_hour == 18: checkout_minute = random.randint(0, 30)
                    else:                    # 저녁 차 한 잔 (18:30 ~ 21:30)
                        checkout_hour = random.choice([18, 19, 20, 21])
                        if checkout_hour == 18: checkout_minute = random.randint(31, 59)
                
                checkin_time_str = f"{date_str} {checkout_hour:02d}:{checkout_minute:02d}:00"
                
                # --- 3. 현실적인 동반 인원수(Party Size) 및 메뉴 주문 조합(Meal Combos) ---
                party_size = random.choice([1, 2, 2, 2, 3, 4, 4, 5, 6]) # 2인과 4인이 지배적
                if is_weekend:
                    party_size = random.choice([2, 3, 4, 4, 4, 5, 6]) # 주말은 단체/가족 위주
                    
                chosen_items = []
                items_map = {}
                
                # 각 스토어별 시나리오 구성
                if store_id == "store-1":  # 미소 한식당
                    # 1) 주중 직장인 점심/가벼운 저녁
                    if not is_weekend and checkout_hour < 17:
                        # 찌개 및 비빔밥 1인당 1개 주문
                        main_names = ["된장찌개", "김치찌개", "비빔밥", "돌솥비빔밥"]
                        for _ in range(party_size):
                            chosen_name = random.choice(main_names)
                            chosen_items.append((chosen_name, 1))
                        # 사이드로 제육볶음 하나 나눠먹기 (50% 확률)
                        if party_size >= 2 and random.random() < 0.5:
                            chosen_items.append(("제육볶음", 1))
                    # 2) 주말 또는 주중 저녁 모임 (고기 및 막걸리)
                    else:
                        # 불고기 정식 및 제육볶음 위주 메인 주문
                        for _ in range(max(1, party_size // 2)):
                            chosen_items.append(("불고기 정식", random.randint(1, 2)))
                        for _ in range(max(1, party_size // 2)):
                            chosen_items.append(("제육볶음", random.randint(1, 2)))
                        # 식사 대용 돌솥비빔밥 추가
                        if random.random() < 0.6:
                            chosen_items.append(("돌솥비빔밥", random.randint(1, 2)))
                        # 주류: 저녁/주말에는 막걸리 대거 주문 (70% 확률)
                        if random.random() < 0.7:
                            chosen_items.append(("막걸리", random.randint(1, 3)))
                            
                elif store_id == "store-2":  # 블루버드 카페
                    # 1) 아침/주중 모닝
                    if checkout_hour < 11:
                        # 아메리카노 + 크루아상 조합 대다수
                        for _ in range(party_size):
                            chosen_items.append(("아메리카노", 1))
                        if random.random() < 0.7:
                            chosen_items.append(("크루아상", random.randint(1, party_size)))
                    # 2) 점심 직후 / 오후 Peak
                    else:
                        # 1인 1음료 기본
                        drink_names = ["아메리카노", "카페라떼", "카푸치노", "바닐라 라떼", "얼그레이 티", "스무디"]
                        # 주말에는 스무디와 바닐라 라떼 가중치 UP
                        if is_weekend:
                            drink_names = ["아메리카노", "바닐라 라떼", "스무디", "스무디", "카페라떼"]
                            
                        for _ in range(party_size):
                            chosen_items.append((random.choice(drink_names), 1))
                            
                        # 디저트 및 브런치 (치즈케이크, 아보카도 토스트) 추가
                        if random.random() < 0.8:
                            dessert_names = ["치즈 케이크", "크루아상", "아보카도 토스트"]
                            chosen_items.append((random.choice(dessert_names), random.randint(1, max(1, party_size // 2))))
                            
                elif store_id == "store-3":  # 나폴리 피자
                    # 피자/파스타는 보통 쉐어하여 먹음
                    # 2인: 피자 1 + 파스타 1 + 음료 2
                    # 4인: 피자 2 + 파스타 2 + 음료 4 + 사이드
                    pizza_names = ["마르게리타", "페퍼로니", "포카치아"]
                    pasta_names = ["까르보나라", "봉골레", "아라비아타"]
                    
                    pizzas_qty = max(1, party_size // 2)
                    pastas_qty = max(1, party_size // 2)
                    
                    # 주말에는 매콤하고 대중적인 페퍼로니 피자가 강세
                    if is_weekend:
                        pizza_names = ["페퍼로니", "페퍼로니", "마르게리타"]
                    
                    for _ in range(pizzas_qty):
                        chosen_items.append((random.choice(pizza_names), 1))
                    for _ in range(pastas_qty):
                        chosen_items.append((random.choice(pasta_names), 1))
                        
                    # 사이드 아란치니 추가 (40% 확률)
                    if random.random() < 0.4:
                        chosen_items.append(("아란치니", 1))
                        
                    # 음료 및 하우스 와인
                    if is_weekend or checkout_hour >= 18:
                        # 주말/저녁에는 와인 주문 대량 발생 (60% 확률)
                        if random.random() < 0.6:
                            chosen_items.append(("하우스 와인", random.randint(1, party_size)))
                        # 디저트 티라미수 추가
                        if random.random() < 0.5:
                            chosen_items.append(("티라미수", random.randint(1, 2)))
                            
                else:  # store-chicvill (시크빌 - 프리미엄 한우 전문점)
                    # 1) 평일 점심 (11:30 ~ 15:00)
                    if not is_weekend and checkout_hour < 15:
                        # 주로 찌개류와 비빔밥/식사류
                        meal_names = ["시골 순두부찌개", "한우 차돌된장찌개", "함흥 비빔냉면", "함흥 물냉면"]
                        for _ in range(party_size):
                            chosen_items.append((random.choice(meal_names), 1))
                        # 간혹 고기 1~2인분 추가 주문 (20% 확률)
                        if random.random() < 0.2:
                            chosen_items.append((random.choice(["명품 한우 갈비살", "명품 한우 등심"]), random.randint(1, 2)))
                        # 후식용 콜드브루 커피 주문 (60% 확률)
                        if random.random() < 0.6:
                            chosen_items.append(("프리미엄 콜드브루 커피", random.randint(1, max(1, party_size // 2))))
                            
                    # 2) 평일 저녁 (17:30 ~ 22:00)
                    elif not is_weekend and checkout_hour >= 17:
                        # 회식/접대 중심: 인원수 대비 많은 고기 주문 (1.2 ~ 1.8배)
                        bbq_qty = int(party_size * random.uniform(1.2, 1.8))
                        bbq_names = ["명품 한우 등심", "명품 한우 안심", "명품 한우 갈비살"]
                        for _ in range(bbq_qty):
                            chosen_items.append((random.choice(bbq_names), 1))
                        # 육회 쉐어링 주문 (70% 확률)
                        if party_size >= 2 and random.random() < 0.7:
                            chosen_items.append(("한우 생육회", 1))
                        # 후식 식사 주문 (된장찌개, 순두부찌개, 냉면 등) (80% 확률)
                        if random.random() < 0.8:
                            for _ in range(max(1, party_size // 2)):
                                chosen_items.append((random.choice(["시골 순두부찌개", "한우 차돌된장찌개", "함흥 물냉면", "함흥 비빔냉면"]), 1))
                        # 술 대량 동반 (소주, 맥주) (85% 확률)
                        if random.random() < 0.85:
                            chosen_items.append(("소주", random.randint(1, party_size + 1)))
                            chosen_items.append(("맥주", random.randint(1, party_size + 2)))
                            
                    # 3) 주말 전체 (금, 토, 일 전체)
                    else:
                        # 가족/친지 모임 중심: 고기 기본 인원수만큼 주문
                        bbq_qty = party_size + random.randint(0, 1)
                        bbq_names = ["명품 한우 등심", "명품 한우 안심", "명품 한우 갈비살"]
                        for _ in range(bbq_qty):
                            chosen_items.append((random.choice(bbq_names), 1))
                        # 육회 주문 (50% 확률)
                        if random.random() < 0.5:
                            chosen_items.append(("한우 생육회", 1))
                        # 후식 식사 주문 (90% 확률)
                        if random.random() < 0.9:
                            for _ in range(max(1, party_size - 1)):
                                chosen_items.append((random.choice(["시골 순두부찌개", "한우 차돌된장찌개", "함흥 물냉면", "함흥 비빔냉면"]), 1))
                        # 주류 및 소프팅 음료 (60% 확률)
                        if random.random() < 0.6:
                            chosen_items.append((random.choice(["소주", "맥주"]), random.randint(1, party_size)))
                        # 디저트용 콜드브루 커피 (50% 확률)
                        if random.random() < 0.5:
                            chosen_items.append(("프리미엄 콜드브루 커피", random.randint(1, party_size)))
                
                # --- 4. 메뉴 리스트 정리 및 매출/이용시간 비례 산출 ---
                total_revenue = 0
                order_count = 0
                
                for m_name, qty in chosen_items:
                    # 메뉴 원 데이터 찾기
                    menu_item = next((item for item in menus if item["name"] == m_name), None)
                    if not menu_item:
                        continue
                    price = int(str(menu_item["value"]).replace(",", "")) if "value" in menu_item else 0
                    
                    if m_name in items_map:
                        items_map[m_name]["qty"] += qty
                    else:
                        items_map[m_name] = {
                            "name": m_name,
                            "qty": qty,
                            "price": price
                        }
                    total_revenue += price * qty
                    order_count += 1
                
                # 주문 종류가 없으면 루프 건너뛰기
                if not items_map:
                    continue
                    
                # 테이블 이용 시간(duration) 계산: 매출액 및 음료 수에 따라 정밀 비례
                # 커피 한두 잔은 30~45분, 고기나 피자에 주류 동반 시 90~120분!
                if store_id == "store-2":  # 카페는 상대적으로 짧음
                    duration = random.randint(25, 50) + (party_size * 5)
                else:
                    duration = random.randint(45, 80) + (order_count * 8)
                    if any(alc in items_map for alc in ["하우스 와인", "막걸리", "소주", "맥주"]):
                        duration += random.randint(20, 40) # 술이 있으면 연장!
                
                # checkout_time에서 duration을 빼서 checkin_time 역산
                checkout_dt = datetime.strptime(checkin_time_str, "%Y-%m-%d %H:%M:%S")
                checkin_dt = checkout_dt - timedelta(minutes=duration)
                
                checkin_time = checkin_dt.strftime("%Y-%m-%d %H:%M:%S")
                checkout_time = checkout_dt.strftime("%Y-%m-%d %H:%M:%S")
                archived_at = checkout_time
                
                cur.execute("""
                    INSERT INTO session_archive
                        (session_id, store_id, table_id, checkin_time, checkout_time,
                         duration_minutes, order_count, total_revenue, cancelled_count,
                         items_summary, archived_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 0, %s::jsonb, %s)
                """, (
                    session_id,
                    store_id,
                    table_id,
                    checkin_time,
                    checkout_time,
                    duration,
                    order_count,
                    total_revenue,
                    json.dumps(list(items_map.values()), ensure_ascii=False),
                    archived_at
                ))
                total_sessions_count += 1
                total_revenue_count += total_revenue
                
        current_date += timedelta(days=1)
        
    conn.commit()
    cur.close()
    print(f"  \u2705 {total_sessions_count}개 역사적 세션 아카이브 시딩 완료 (\ucd1d \ub9e4\ucd9c: {total_revenue_count:,}\uc6d0)")
# ─────────────────────────────────────────────────────────────────
# 근태, 포인트, 예약 데이터 시딩
# ─────────────────────────────────────────────────────────────────
def seed_attendance_logs(conn, staff_ids):
    import random
    from datetime import datetime, timedelta
    
    print("\n[8/8] 스태프 30일 근태 및 정산 정보 시딩 (table_attendance_logs)")
    
    cur = conn.cursor()
    cur.execute("DELETE FROM table_attendance_logs")
    
    end_date = datetime.now() - timedelta(days=1)
    start_date = datetime.now() - timedelta(days=30)
    
    cur.execute("SELECT staff_id, store_id, name, role, hourly_wage FROM table_staff_accounts")
    staff_members = cur.fetchall()
    
    total_logs = 0
    for staff in staff_members:
        staff_id, store_id, name, role, hourly_wage = staff
        
        if role == "매니저":
            work_dows = {2, 3, 4, 5, 6} # 수, 목, 금, 토, 일
        elif role == "셰프":
            work_dows = {0, 3, 4, 5, 6} # 월, 목, 금, 토, 일
        else: # 홀서빙, 바리스타, 주방보조
            hash_val = sum(ord(c) for c in staff_id)
            if hash_val % 3 == 0:
                work_dows = {0, 1, 4} # 월, 화, 금
            elif hash_val % 3 == 1:
                work_dows = {2, 3, 5} # 수, 목, 토
            else:
                work_dows = {4, 5, 6} # 금, 토, 일
                
        current_date = start_date
        while current_date <= end_date:
            dow = current_date.weekday()
            
            if dow in work_dows:
                if random.random() < 0.03:
                    current_date += timedelta(days=1)
                    continue
                    
                is_weekend = dow in (5, 6)
                sched_start_str = "10:00" if is_weekend else "11:00"
                sched_end_str = "23:00" if is_weekend else "22:00"
                
                is_tardy = random.random() < 0.07
                date_str = current_date.strftime("%Y-%m-%d")
                
                start_h, start_m = map(int, sched_start_str.split(":"))
                sched_start_dt = datetime(current_date.year, current_date.month, current_date.day, start_h, start_m)
                
                if is_tardy:
                    arrival_offset = random.randint(10, 35)
                else:
                    arrival_offset = random.randint(-15, 2)
                    
                checkin_dt = sched_start_dt + timedelta(minutes=arrival_offset)
                checkin_time = checkin_dt.strftime("%Y-%m-%d %H:%M:%S")
                
                end_h, end_m = map(int, sched_end_str.split(":"))
                sched_end_dt = datetime(current_date.year, current_date.month, current_date.day, end_h, end_m)
                departure_offset = random.randint(0, 12)
                checkout_dt = sched_end_dt + timedelta(minutes=departure_offset)
                checkout_time = checkout_dt.strftime("%Y-%m-%d %H:%M:%S")
                
                work_minutes = int((checkout_dt - checkin_dt).total_seconds() / 60)
                
                days_ago = (datetime.now() - checkin_dt).days
                if days_ago > 7:
                    is_paid = True
                else:
                    is_paid = False
                    
                log_id = f"LOG-{uuid.uuid4().hex[:8].upper()}"
                device_id = f"KIOSK-{store_id[:6].upper()}"
                
                cur.execute("""
                    INSERT INTO table_attendance_logs
                        (log_id, staff_id, store_id, check_in_time, check_out_time,
                         work_minutes, status, tardy, paid, device_id)
                    VALUES (%s, %s, %s, %s, %s, %s, 'completed', %s, %s, %s)
                """, (
                    log_id, staff_id, store_id, checkin_time, checkout_time,
                    work_minutes, is_tardy, is_paid, device_id
                ))
                total_logs += 1
                
            current_date += timedelta(days=1)
            
    conn.commit()
    cur.close()
    print(f"  ✅ {total_logs}개 근태 타임카드 시딩 완료 (지급/미지급 상태 연동)")


def seed_customer_points(conn):
    import random
    from datetime import datetime
    print("\n[9/9] 단골 고객 포인트 시딩 (customer_points)")
    
    cur = conn.cursor()
    cur.execute("DELETE FROM customer_points")
    
    customers = [
        ("010-1234-5678", 12500),
        ("010-9876-5432", 4200),
        ("010-5555-8888", 23000),
        ("010-1111-2222", 9000),
        ("010-3333-4444", 1550),
        ("010-7777-9999", 34000),
        ("010-2222-3333", 800),
        ("010-4444-5555", 11200),
        ("010-8888-0000", 5500),
        ("010-6666-7777", 19200),
        ("010-9999-1111", 700),
        ("010-2222-8888", 15000),
        ("010-3333-7777", 2800),
        ("010-5555-1111", 45000),
        ("010-7777-3333", 6700),
        ("010-1234-1234", 1850),
        ("010-5678-5678", 9800),
        ("010-9999-9999", 3100),
        ("010-7777-7777", 12000),
        ("010-8888-8888", 21500)
    ]
    
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    stores = ["store-1", "store-2", "store-3", "store-chicvill"]
    
    total_points = 0
    for store_id in stores:
        selected_customers = random.sample(customers, k=random.randint(12, 18))
        for phone, points in selected_customers:
            cur.execute("""
                INSERT INTO customer_points (phone, store_id, points, last_updated)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (phone, store_id) DO UPDATE SET
                    points = EXCLUDED.points,
                    last_updated = EXCLUDED.last_updated
            """, (phone, store_id, points, now_str))
            total_points += 1
            
    conn.commit()
    cur.close()
    print(f"  ✅ {total_points}개 단골 고객 포인트 정보 시딩 완료")


def seed_reservations_and_waitings(conn):
    import random
    from datetime import datetime, timedelta
    print("\n[10/10] 사전 예약 및 스마트 대기열 시딩 (table_reservations & table_waitings)")
    
    cur = conn.cursor()
    cur.execute("DELETE FROM table_reservations")
    cur.execute("DELETE FROM table_waitings")
    
    stores = ["store-1", "store-2", "store-3", "store-chicvill"]
    names = ["강태오", "윤서현", "정재형", "한지민", "송중기", "김수현", "배수지", "박서준", "이민호", "전지현"]
    phones = ["010-2345-6789", "010-3456-7890", "010-4567-8901", "010-5678-9012", "010-6789-0123", "010-7890-1234", "010-8901-2345", "010-9012-3456", "010-0123-4567", "010-1234-5678"]
    
    total_res = 0
    for store_id in stores:
        for offset_days in range(1, 8):
            if random.random() < 0.5:
                res_id = f"RES-{uuid.uuid4().hex[:8].upper()}"
                res_date = datetime.now() + timedelta(days=offset_days)
                res_hour = random.choice([12, 13, 18, 19, 20])
                res_time = res_date.replace(hour=res_hour, minute=0, second=0).strftime("%Y-%m-%d %H:%M:%S")
                
                party_size = random.choice([2, 4, 6, 8])
                table_id = f"T{random.randint(1, 6):02d}"
                cust_name = random.choice(names)
                phone = random.choice(phones)
                
                cur.execute("""
                    INSERT INTO table_reservations (reservation_id, store_id, customer_name, phone_number, party_size, reserved_time, table_id, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'requested')
                """, (res_id, store_id, cust_name, phone, party_size, res_time, table_id))
                total_res += 1
                
    today_str = datetime.now().strftime("%Y-%m-%d")
    total_wait = 0
    for store_id in stores:
        for seq in range(1, 6):
            wait_id = f"WT-{uuid.uuid4().hex[:8].upper()}"
            phone = random.choice(phones)
            party_size = random.choice([2, 3, 4, 5])
            
            if seq <= 3:
                status = "seated"
                t_offset = f"12:{seq*15:02d}:00"
            elif seq == 4:
                status = "waiting"
                t_offset = datetime.now().strftime("%H:%M:%S")
            else:
                status = "cancelled"
                t_offset = f"13:10:00"
                
            timestamp = f"{today_str} {t_offset}"
            
            cur.execute("""
                INSERT INTO table_waitings (waiting_id, store_id, phone_number, party_size, status, timestamp)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (wait_id, store_id, phone, party_size, status, timestamp))
            total_wait += 1
            
    conn.commit()
    cur.close()
    print(f"  ✅ {total_res}개 사전 예약 & {total_wait}개 스마트 대기열 시딩 완료")


# ─────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────
def main():
    print("\n=== DB 초기화 시작 ===")
    conn = get_db_conn()

    print("\n[1/5] 기존 테이블 삭제")
    drop_tables(conn)

    # knowledge_pool.json을 먼저 교체해야 init_db_v2가 구 메뉴를 읽어들이지 않음
    print("\n[2/5] 메뉴 작성 (knowledge_pool.json) — 스키마 초기화 전 교체")
    seed_menus()

    print("\n[3/5] 스키마 재생성 (init_db_v2)")
    init_db_v2()
    print("✅ 스키마 초기화 완료")

    conn = get_db_conn()  # 새 커넥션

    # init_db_v2 내부에서 hardcoded 5개 매장이 재삽입되므로 전부 초기화
    print("\n  기존 자동 시딩 매장 제거...")
    cur = conn.cursor()
    cur.execute("DELETE FROM stores")
    conn.commit()
    cur.close()

    print("\n[4/5] 매장 시딩")
    seed_stores(conn)

    print("\n[5/5] 스태프 시딩")
    staff_ids = seed_staff(conn)

    # 사용자 계정 동시 생성 및 해싱
    print("\n[5-2/5] 사용자 마스터(users) 시딩")
    seed_users(conn)

    print("\n[6/6] 테스트 세션 + 주문 시딩")
    seed_sessions(conn)

    # 역사적 매출 데이터 시딩
    seed_archive_data(conn)

    # 30일 근태 및 정산 시딩
    seed_attendance_logs(conn, staff_ids)

    # 단골 고객 포인트 시딩
    seed_customer_points(conn)

    # 사전 예약 및 스마트 대기열 시딩
    seed_reservations_and_waitings(conn)

    conn.close()
    print("\n=== 시딩 완료 ===")
    print(f"  매장: {len(STORES)}개")
    print(f"  스태프: {sum(len(v) for v in STAFF.values())}명")
    print(f"  메뉴: {sum(len(m['items']) for m in MENUS)}개 항목")
    print(f"  테스트 세션: {len(STORES) * 2}개")


if __name__ == "__main__":
    main()

