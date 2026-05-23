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
            {"name": "비빔밥",      "value": 10000, "icon": "🍚", "category": "밥류",    "description": "계절 나물과 고추장을 넣어 비벼 먹는 건강 비빔밥"},
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
            {"name": "카페라떼",      "value": 5500, "icon": "🥛",  "category": "커피",   "description": "부드러운 우유 거품과 에스프레소의 조화"},
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
            {"name": "봉골레",        "value": "15000","icon": "🍝", "category": "파스타", "description": "신선한 바지락과 마늘·화이트와인의 바다 향 파스타"},
            {"name": "아라비아타",    "value": 13000, "icon": "🍝", "category": "파스타", "description": "매콤한 고추와 토마토소스의 단순하지만 강렬한 파스타"},
            {"name": "티라미수",      "value": 8000,  "icon": "🍮", "category": "디저트", "description": "에스프레소에 적신 사보이아르디와 마스카르포네 크림"},
            {"name": "하우스 와인",   "value": 9000,  "icon": "🍷", "category": "주류/음료", "description": "이탈리아산 하우스 레드·화이트 와인 (잔)"},
            {"name": "아란치니",      "value": 7000,  "icon": "🍙", "category": "사이드", "description": "치즈를 넣어 튀긴 이탈리아 쌀 튀김 3개"},
        ],
    },
]

# ─────────────────────────────────────────────────────────────────
# 스태프 정의 (매장당 3명)
# ─────────────────────────────────────────────────────────────────
STAFF = {
    "store-1": [
        {"name": "박정호", "role": "매니저",  "hourly_wage": 15000},
        {"name": "최유진", "role": "홀서빙",  "hourly_wage": 11000},
        {"name": "이민준", "role": "주방보조", "hourly_wage": 11000},
    ],
    "store-2": [
        {"name": "한소희", "role": "바리스타", "hourly_wage": 12000},
        {"name": "정우성", "role": "매니저",   "hourly_wage": 14000},
        {"name": "강지원", "role": "홀서빙",   "hourly_wage": 11000},
    ],
    "store-3": [
        {"name": "윤세준", "role": "셰프",    "hourly_wage": 18000},
        {"name": "임지현", "role": "홀서빙",  "hourly_wage": 11000},
        {"name": "송민재", "role": "주방보조","hourly_wage": 11000},
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
        cur.execute("""
            INSERT INTO stores
                (id, name, ceo_name, signature_owner, monthly_fee, payment_status,
                 payment_history, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (id) DO NOTHING
        """, (
            s["id"], s["name"], s["ceo_name"], s["signature_owner"],
            s["monthly_fee"], s["payment_status"], json.dumps([]),
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
            sid = _uid("STAFF-")
            cur.execute("""
                INSERT INTO table_staff_accounts
                    (staff_id, store_id, name, role, hourly_wage, status, contract_period)
                VALUES (%s, %s, %s, %s, %s, 'active', %s)
            """, (sid, store_id, m["name"], m["role"], m["hourly_wage"],
                  json.dumps({"start": "2026-01-01", "end": "2026-12-31"})))

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


# ─────────────────────────────────────────────────────────────────
# STEP 4 — 메뉴 (knowledge_pool.json 교체)
# ─────────────────────────────────────────────────────────────────
def seed_menus():
    with open(POOL_FILE, "w", encoding="utf-8") as f:
        json.dump(MENUS, f, ensure_ascii=False, indent=2)
    for m in MENUS:
        print(f"  메뉴 작성: {m['store']} ({len(m['items'])}개 항목)")
    print(f"✅ knowledge_pool.json 저장 완료")


# ─────────────────────────────────────────────────────────────────
# STEP 5 — 테스트 세션 (매장당 2테이블, 주문 포함)
# ─────────────────────────────────────────────────────────────────
def seed_sessions(conn):
    cur = conn.cursor()

    # 매장별 대표 메뉴 2개씩 미리 추출
    store_items = {m["store_id"]: m["items"][:2] for m in MENUS}

    for s in STORES:
        for t_num in range(1, 3):  # T01, T02
            table_id = f"T{t_num:02d}"
            sess_id = _uid("SESS-")
            checkin = datetime.now().isoformat()

            # 주문 객체 2건
            orders = []
            for seq, item in enumerate(store_items[s["id"]], start=1):
                qty = seq  # 1개, 2개
                orders.append({
                    "order_id":       _uid("ORD-"),
                    "seq":            seq,
                    "items":          [{"name": item["name"], "price": item["value"], "quantity": qty}],
                    "total":          item["value"] * qty,
                    "status":         "cooking",
                    "payment_status": "unpaid",
                    "payment_method": None,
                    "created_at":     checkin,
                })

            cur.execute("""
                INSERT INTO table_sessions
                    (session_id, store_id, table_id, device_id, status,
                     checkin_time, orders, splits, calls, version)
                VALUES (%s, %s, %s, %s, 'active', %s,
                        %s::jsonb, '[]', '[]', 1)
            """, (
                sess_id, s["id"], table_id, "DEVICE-TEST",
                checkin, json.dumps(orders, ensure_ascii=False),
            ))
            print(f"  세션 생성: {s['name']} / {table_id} → {sess_id} (주문 {len(orders)}건)")

    conn.commit()
    cur.close()


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
    seed_staff(conn)

    print("\n[6/6] 테스트 세션 + 주문 시딩")
    seed_sessions(conn)

    conn.close()
    print("\n=== 시딩 완료 ===")
    print(f"  매장: {len(STORES)}개")
    print(f"  스태프: {sum(len(v) for v in STAFF.values())}명")
    print(f"  메뉴: {sum(len(m['items']) for m in MENUS)}개 항목")
    print(f"  테스트 세션: {len(STORES) * 2}개")


if __name__ == "__main__":
    main()
