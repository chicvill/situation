import os
import json
import uuid
import random
import hashlib
import psycopg2
from datetime import datetime, timedelta
from dotenv import load_dotenv, find_dotenv
from werkzeug.security import generate_password_hash

# 1. 환경 변수 로드
load_dotenv(find_dotenv())
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("[ERROR] DATABASE_URL을 .env 파일에서 찾을 수 없습니다!")
    exit(1)

print("🔌 데이터베이스에 연결하는 중...")
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

STORE_ID = "store-grace"
STORE_NAME = "그레이스 하이테크 커피"
OWNER_PHONE = "01000000006"

# 2. 기존 '그레이스 하이테크 커피' 관련 데이터 완전 삭제 (멱등성 확보)
print("🗑️ 기존 그레이스 하이테크 커피 매장 데이터 정리 중...")
cur.execute("DELETE FROM stores WHERE id = %s", (STORE_ID,))
cur.execute("DELETE FROM table_staff_accounts WHERE store_id = %s", (STORE_ID,))
cur.execute("DELETE FROM table_staff_schedules WHERE store_id = %s", (STORE_ID,))
cur.execute("DELETE FROM table_attendance_logs WHERE store_id = %s", (STORE_ID,))
cur.execute("DELETE FROM customer_points WHERE store_id = %s", (STORE_ID,))
cur.execute("DELETE FROM table_sessions WHERE store_id = %s", (STORE_ID,))
cur.execute("DELETE FROM session_archive WHERE store_id = %s", (STORE_ID,))
cur.execute("DELETE FROM knowledge_bundles WHERE store_id = %s", (STORE_ID,))
cur.execute("DELETE FROM users WHERE store_id = %s", (STORE_ID,))
conn.commit()

# 3. 매장 정보 삽입 (stores)
print("🌱 '그레이스 하이테크 커피' 매장 시딩 중...")
payment_history = [
    {"date": "2026-03-10", "amount": 50000, "status": "완료"},
    {"date": "2026-04-10", "amount": 50000, "status": "완료"},
    {"date": "2026-05-10", "amount": 50000, "status": "완료"}
]
cur.execute("""
    INSERT INTO stores
        (id, name, ceo_name, signature_owner, monthly_fee, payment_status, payment_history, created_at)
    VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
""", (
    STORE_ID,
    STORE_NAME,
    "한그레이스",
    "owner-grace",
    50000,
    "정상",
    json.dumps(payment_history, ensure_ascii=False)
))

# 4. 스태프 정보 및 스케줄 삽입 (table_staff_accounts, table_staff_schedules)
print("👥 스태프(점장 및 점원) 데이터 추가 중...")
staff_members = [
    {
        "id": "01011000006",
        "name": "이지원",
        "role": "manager",
        "hourly_wage": 13000,
        "contract": {"start": "2025-05-01", "end": "2027-04-30", "employment_type": "정규직", "gender": "여성", "birth_date": "1996-08-15"},
        "work_days": [1, 2, 3, 4, 5] # 월~금
    },
    {
        "id": "01022000006",
        "name": "최다솜",
        "role": "staff",
        "hourly_wage": 11500,
        "contract": {"start": "2026-01-01", "end": "2026-12-31", "employment_type": "알바", "gender": "여성", "birth_date": "2002-12-05"},
        "work_days": [4, 5, 6] # 금, 토, 일
    }
]

for s in staff_members:
    # 계정 등록
    cur.execute("""
        INSERT INTO table_staff_accounts (staff_id, store_id, name, role, hourly_wage, status, contract_period)
        VALUES (%s, %s, %s, %s, %s, 'active', %s)
    """, (s["id"], STORE_ID, s["name"], s["role"], s["hourly_wage"], json.dumps(s["contract"], ensure_ascii=False)))
    
    # 스케줄 등록
    for day in s["work_days"]:
        schedule_id = f"SCH-{uuid.uuid4().hex[:8].upper()}"
        start_time = "10:00" if day in (5, 6) else "09:00"
        end_time = "22:00"
        cur.execute("""
            INSERT INTO table_staff_schedules (schedule_id, staff_id, store_id, day_of_week, start_time, end_time)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (schedule_id, s["id"], STORE_ID, day, start_time, end_time))

# 5. 사용자 로그인 계정 시딩 (users)
print("🔑 사용자 로그인 계정(users) 등록 중...")
pw_raw = "1212"
pw_sha = hashlib.sha256(pw_raw.encode()).hexdigest()
pw_hash = generate_password_hash(pw_sha)

# 점주
cur.execute("""
    INSERT INTO users (username, password, role, store_id, full_name, is_approved, created_at)
    VALUES (%s, %s, %s, %s, %s, TRUE, NOW())
""", (OWNER_PHONE, pw_hash, "owner", STORE_ID, "한그레이스 사장"))

# 점장 및 점원
for s in staff_members:
    cur.execute("""
        INSERT INTO users (username, password, role, store_id, full_name, is_approved, created_at)
        VALUES (%s, %s, %s, %s, %s, TRUE, NOW())
    """, (s["id"], pw_hash, s["role"], STORE_ID, s["name"]))

# 6. 지식 번들 시딩 (knowledge_bundles) - 메뉴 및 계정 정보
print("📦 지식 번들(knowledge_bundles) 추가 중...")
# 6.1 메뉴 정보 번들
menus_items = [
    {"name": "아메리카노", "value": 4500, "icon": "☕", "category": "음료", "description": "원두(Arabica) 에스프레소에 뜨거운 물을 더해 깊고 풍부한 맛의 기본 커피"},
    {"name": "카페라떼", "value": 5000, "icon": "☕", "category": "음료", "description": "에스프레소에 고소하고 신선한 스팀 우유를 더해 부드러운 맛의 커피"},
    {"name": "크루아상", "value": 4000, "icon": "🥐", "category": "디저트", "description": "프랑스산 고메 버터향이 풍부한 겉바속촉 크루아상"}
]
cur.execute("""
    INSERT INTO knowledge_bundles (id, type, store_id, title, items, timestamp)
    VALUES (%s, %s, %s, %s, %s::jsonb, NOW())
""", (f"MENUS_{STORE_ID}", "Menus", STORE_ID, "메뉴 정보", json.dumps(menus_items, ensure_ascii=False)))

# 6.2 개인 정보 번들 (PersonalInfos)
for s in staff_members:
    pid = f"USER-{s['id']}"
    role_label = "점장" if s["role"] == "manager" else "점원"
    items = [
        {"name": "이름", "value": s["name"]},
        {"name": "아이디", "value": s["id"]},
        {"name": "비밀번호", "value": pw_sha},
        {"name": "권한", "value": s["role"]}
    ]
    cur.execute("""
        INSERT INTO knowledge_bundles (id, type, store_id, title, items, timestamp)
        VALUES (%s, %s, %s, %s, %s::jsonb, NOW())
    """, (pid, "PersonalInfos", STORE_ID, f"{s['name']}님 계정 ({role_label})", json.dumps(items, ensure_ascii=False)))

# 7. 30일 근태 기록 생성 (table_attendance_logs)
print("🕒 30일 근태 및 출퇴근 타임카드 시딩 중...")
start_date = datetime(2026, 5, 1)
end_date = datetime(2026, 6, 1) # 오늘

total_attendance = 0
curr = start_date
while curr <= end_date:
    dow = curr.weekday() # 0=월 ...
    for s in staff_members:
        if dow in s["work_days"]:
            # 97% 확률로 근무 (간혹 휴무 처리)
            if random.random() < 0.03:
                continue
                
            is_weekend = dow in (5, 6)
            sched_start_hour = 10 if is_weekend else 9
            sched_start_dt = datetime(curr.year, curr.month, curr.day, sched_start_hour, 0)
            
            # 지각 여부 (7% 확률로 지각)
            is_tardy = random.random() < 0.07
            arrival_offset = random.randint(10, 30) if is_tardy else random.randint(-15, 2)
            
            checkin_dt = sched_start_dt + timedelta(minutes=arrival_offset)
            checkout_dt = datetime(curr.year, curr.month, curr.day, 22, random.randint(0, 10))
            
            work_minutes = int((checkout_dt - checkin_dt).total_seconds() / 60)
            is_paid = (datetime.now() - checkout_dt).days > 7
            
            log_id = f"LOG-{uuid.uuid4().hex[:8].upper()}"
            cur.execute("""
                INSERT INTO table_attendance_logs
                    (log_id, staff_id, store_id, check_in_time, check_out_time, work_minutes, status, tardy, paid, device_id)
                VALUES (%s, %s, %s, %s, %s, %s, 'completed', %s, %s, %s)
            """, (
                log_id,
                s["id"],
                STORE_ID,
                checkin_dt.strftime("%Y-%m-%d %H:%M:%S"),
                checkout_dt.strftime("%Y-%m-%d %H:%M:%S"),
                work_minutes,
                is_tardy,
                is_paid,
                f"KIOSK-{STORE_ID[:6].upper()}"
            ))
            total_attendance += 1
            
    curr += timedelta(days=1)

# 8. 대량 역사적 매출 데이터 300건 이상 주입 (session_archive)
print("📈 2026.5.1 ~ 오늘 사이의 예제 매출 데이터 300건 이상 생성 중...")
total_sessions = 0
total_revenue = 0

curr = start_date
while curr <= end_date:
    date_str = curr.strftime("%Y-%m-%d")
    dow = curr.weekday()
    
    # 요일별 현실적인 고객 방문 세션 수 정의 (주말 및 금요일은 대폭 증가)
    if dow == 5: # 토요일
        sessions_count = random.randint(14, 20)
    elif dow in (4, 6): # 금, 일요일
        sessions_count = random.randint(12, 17)
    else: # 월~목 평일
        sessions_count = random.randint(7, 11)
        
    for s_idx in range(sessions_count):
        session_id = f"SESS-ARCH-GRACE-{uuid.uuid4().hex[:8].upper()}"
        table_id = f"T{random.randint(1, 4):02d}"
        
        # 영업 시간 내 체크아웃 시간 난수 선택 (오전 9시 반 ~ 밤 10시)
        checkout_hour = random.randint(9, 21)
        checkout_minute = random.randint(0, 59)
        checkout_dt = datetime(curr.year, curr.month, curr.day, checkout_hour, checkout_minute, 0)
        
        # 동반 인원수 (1인~4인)
        party_size = random.choice([1, 2, 2, 2, 3, 4])
        
        # 메뉴 선정 및 주문 내역 구축
        chosen_items = []
        items_map = {}
        
        # 인원수별로 음료/디저트 랜덤 결정
        for _ in range(party_size):
            drink = random.choice(["아메리카노", "카페라떼", None])
            if drink:
                chosen_items.append((drink, 1))
            # 35% 확률로 디저트 크루아상 추가
            if random.random() < 0.35:
                chosen_items.append(("크루아상", 1))
                
        # 아무것도 고르지 않은 경우 방지
        if not chosen_items:
            chosen_items.append(("아메리카노", 1))
            
        # 데이터 병합 및 단가 적용
        session_rev = 0
        order_count = 0
        
        for name, qty in chosen_items:
            price = 4500 if name == "아메리카노" else (5000 if name == "카페라떼" else 4000)
            if name in items_map:
                items_map[name]["qty"] += qty
            else:
                items_map[name] = {
                    "name": name,
                    "qty": qty,
                    "price": price
                }
            session_rev += price * qty
            order_count += 1
            
        # 이용 시간 설정 (20분 ~ 60분)
        duration = random.randint(20, 60)
        checkin_dt = checkout_dt - timedelta(minutes=duration)
        
        checkin_time = checkin_dt.strftime("%Y-%m-%d %H:%M:%S")
        checkout_time = checkout_dt.strftime("%Y-%m-%d %H:%M:%S")
        
        cur.execute("""
            INSERT INTO session_archive
                (session_id, store_id, table_id, checkin_time, checkout_time,
                 duration_minutes, order_count, total_revenue, cancelled_count,
                 items_summary, archived_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 0, %s::jsonb, %s)
        """, (
            session_id,
            STORE_ID,
            table_id,
            checkin_time,
            checkout_time,
            duration,
            order_count,
            session_rev,
            json.dumps(list(items_map.values()), ensure_ascii=False),
            checkout_time
        ))
        
        total_sessions += 1
        total_revenue += session_rev
        
    curr += timedelta(days=1)

# 9. 단골 고객 포인트 주입 (customer_points)
print("🎁 단골 고객 포인트 정보 적재 중...")
grace_customers = [
    ("010-1234-5678", 5000),
    ("010-9876-5432", 12000),
    ("010-5555-8888", 3500),
    ("010-1111-2222", 8500),
    ("010-3333-4444", 450)
]
now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
for phone, points in grace_customers:
    cur.execute("""
        INSERT INTO customer_points (phone, store_id, points, last_updated)
        VALUES (%s, %s, %s, %s)
    """, (phone, STORE_ID, points, now_str))

conn.commit()
cur.close()
conn.close()

print("\n=======================================================")
print(f"🎉 '그레이스 하이테크 커피' 가상 상점 개설 및 데이터 생성 완료!")
print(f"   - 등록 점주 ID: {OWNER_PHONE} (패스워드: {pw_raw})")
print(f"   - 등록 점장 ID: 01011000006 / 점원 ID: 01022000006")
print(f"   - 생성된 세션 아카이브(매출 로그): {total_sessions}건")
print(f"   - 총 누적 매출액: {total_revenue:,}원")
print(f"   - 생성된 스태프 근태 로그: {total_attendance}건")
print("=======================================================")
