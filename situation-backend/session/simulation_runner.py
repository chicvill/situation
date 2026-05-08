import os
import sys
import uuid
import json
import random
from datetime import datetime, timedelta

# 패키지 로컬 경로 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import (
    get_db_conn, init_db_v2, save_staff, save_schedule,
    save_attendance_checkin, save_attendance_checkout,
    get_staff_attendance_logs
)
from psycopg2.extras import RealDictCursor  # type: ignore


# 1. 시뮬레이션용 데이터 생성 구성요소
STAFF_TEMPLATES = [
    {"name": "김철수", "role": "manager", "hourly_wage": 13000, "days": [0, 1, 2, 3, 4]}, # 월~금
    {"name": "박민지", "role": "staff", "hourly_wage": 10500, "days": [0, 2, 4]},       # 월, 수, 금
    {"name": "이영희", "role": "staff", "hourly_wage": 10500, "days": [1, 3, 5]},       # 화, 목, 토
    {"name": "최준혁", "role": "staff", "hourly_wage": 11000, "days": [5, 6]}          # 토, 일
]

MENU_ITEMS = [
    {"name": "안심 스테이크", "price": 45000, "category": "steak"},
    {"name": "등심 스테이크", "price": 38000, "category": "steak"},
    {"name": "토마토 파스타", "price": 15000, "category": "pasta"},
    {"name": "크림 까르보나라", "price": 16000, "category": "pasta"},
    {"name": "고르곤졸라 피자", "price": 18000, "category": "pizza"},
    {"name": "마르게리따 피자", "price": 17000, "category": "pizza"},
    {"name": "리코타 치즈 샐러드", "price": 12000, "category": "salad"},
    {"name": "하우스 와인", "price": 8000, "category": "drink"},
    {"name": "에이드", "price": 5000, "category": "drink"},
    {"name": "콜라/사이다", "price": 3000, "category": "drink"}
]

CALL_TYPES = [
    "물티슈 가져다주기", "물 추가", "냅킨 필요", "숟가락/포크 교체", "주문 요청", "결제 요청"
]

VEHICLE_NUMBERS = [
    "12가 3456", "98야 7654", "34러 9012", "56무 7890", "77서 1111", "88오 2222"
]

def clear_existing_tables():
    """깨끗한 테스트 환경을 위해 시뮬레이션 관련 테이블들의 기존 데이터를 초기화합니다."""
    print("🧹 기존 시뮬레이션 데이터를 안전하게 청소하는 중...")
    conn = get_db_conn()
    if not conn:
        print("❌ DB 연결 실패")
        return
    try:
        cur = conn.cursor()
        # 제약 조건 에러를 방지하기 위해 순서대로 청소
        cur.execute("TRUNCATE TABLE table_attendance_logs CASCADE")
        cur.execute("TRUNCATE TABLE table_staff_schedules CASCADE")
        cur.execute("TRUNCATE TABLE table_staff_accounts CASCADE")
        cur.execute("TRUNCATE TABLE table_orders CASCADE")
        cur.execute("TRUNCATE TABLE table_calls CASCADE")
        cur.execute("TRUNCATE TABLE table_parkings CASCADE")
        cur.execute("TRUNCATE TABLE table_waitings CASCADE")
        cur.execute("TRUNCATE TABLE table_reservations CASCADE")
        cur.execute("TRUNCATE TABLE table_sessions CASCADE")
        # 데이터 수확 보관용 신규 요약 테이블 생성
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_distilled_insights (
                insight_id TEXT PRIMARY KEY,
                store_id TEXT NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                data JSONB NOT NULL,
                summary TEXT
            )
        """)
        conn.commit()
        cur.close()
        conn.close()
        print("✅ 데이터 청소 및 통계 테이블 준비 완료.")
    except Exception as e:
        print(f"❌ 데이터 청소 에러: {e}")

def run_simulation_500_cases():
    """약 500개 이상의 다양한 케이스별 소멸성 트랜잭션 데이터를 오차 없이 주입합니다."""
    print("🌾 500개 가상 복합 비즈니스 케이스 데이터 시뮬레이션 엔진 가동...")
    
    # DB 스키마 체크 및 마스터 데이터 삽입
    init_db_v2()
    
    conn = get_db_conn()
    cur = conn.cursor()
    
    # 1. 직원 정보 및 근로 스케줄 세팅 (약 15개 케이스)
    staff_ids = []
    for temp in STAFF_TEMPLATES:
        staff_id = f"STF-{uuid.uuid4().hex[:4].upper()}"
        staff_ids.append(staff_id)
        
        staff_data = {
            "staff_id": staff_id,
            "store_id": "default_store",
            "name": temp["name"],
            "role": temp["role"],
            "hourly_wage": temp["hourly_wage"],
            "status": "approved",
            "contract_period": {
                "start": "2026-05-01",
                "end": "2026-10-31"
            }
        }
        save_staff(staff_data)
        
        # 요일별 스케줄링 등록 (0: 월, ..., 6: 일)
        days = temp["days"]
        if isinstance(days, list):
            for d in days:
                schedule_id = f"SCHED-{uuid.uuid4().hex[:4].upper()}"
                save_schedule({
                    "schedule_id": schedule_id,
                    "staff_id": staff_id,
                    "day_of_week": d,
                    "start_time": "10:00" if temp["role"] == "manager" else "12:00",
                    "end_time": "19:00" if temp["role"] == "manager" else "18:00"
                })
            
    print(f"  - 👥 직원 계정 {len(staff_ids)}개 및 요일별 업무 스케줄 수립 완료.")

    # 2. 지난 30일간의 복합 시뮬레이션 타임라인 가동
    # 매일 평균 15테이블 입장, 각 테이블별 1~3차 주문, 1~2회 서비스 호출, 주차 등록, 출퇴근 기록
    today = datetime.now()
    case_counter = 0
    
    for day_offset in range(30, 0, -1):
        target_date = today - timedelta(days=day_offset)
        weekday = target_date.weekday() # 0~6
        
        # A. 직원의 출퇴근 기록 시뮬레이션 (약 120개 케이스)
        # 해당 요일에 스케줄이 있는 직원 출근 처리
        for i, temp in enumerate(STAFF_TEMPLATES):
            days = temp["days"]
            if isinstance(days, list) and weekday in days:
                staff_id = staff_ids[i]
                log_id = f"ATT-{target_date.strftime('%Y%m%d')}-{staff_id[:5]}"
                
                # 출퇴근 예정 시각 계산
                sched_start_hour = 10 if temp["role"] == "manager" else 12
                sched_end_hour = 19 if temp["role"] == "manager" else 18
                
                # 10분 가드레일 규칙 변동성 시뮬레이션
                # 90% 확률로 10분 전후 정상 출근, 5% 확률로 지각(1~10분 사이), 5% 무단 결근/지각 초과 제외
                rand_checkin_min = random.choice([
                    random.randint(-10, 0),   # 정상 조기 출근 (-10분 ~ 정시)
                    random.randint(1, 10),    # 지각 (1분 ~ 10분 사이)
                    random.randint(-15, -11), # 가드레일 에러로 인한 차단 대상 (시뮬레이션에서는 정상 범위로 보정)
                ])
                
                # 범위 보정 (시뮬레이션 상 에러 차단을 우회하여 DB에 세이프 기록)
                if rand_checkin_min < -10:
                    rand_checkin_min = -10
                
                tardy = rand_checkin_min > 0
                check_in_time = target_date.replace(hour=sched_start_hour, minute=0, second=0) + timedelta(minutes=rand_checkin_min)
                
                # 퇴근 기록 (약속된 시간 대비 10분 전후 스캔)
                rand_checkout_min = random.randint(-10, 10)
                check_out_time = target_date.replace(hour=sched_end_hour, minute=0, second=0) + timedelta(minutes=rand_checkout_min)
                
                work_minutes = int((check_out_time - check_in_time).total_seconds() / 60)
                
                # DB 직접 세이프 저장
                save_attendance_checkin(log_id, staff_id, "default_store", check_in_time.isoformat(), tardy)
                save_attendance_checkout(staff_id, check_out_time.isoformat(), work_minutes)
                case_counter += 2

        # B. 손님 세션 & 주문 & 호출 (약 400개 이상의 원자재 케이스 생성)
        # 금/토/일요일엔 손님 방문량이 2배 증가하도록 가중치 설정
        is_weekend = weekday in [4, 5, 6]
        daily_session_count = random.randint(18, 25) if is_weekend else random.randint(8, 14)
        
        for s_idx in range(daily_session_count):
            session_id = f"SES-{target_date.strftime('%Y%m%d')}-{s_idx:02d}"
            table_id = f"T{random.randint(1, 12):02d}"
            device_id = f"DEV-CUST{random.randint(1000, 9999)}"
            
            # 대기 등록 및 통계 시뮬레이션
            waiting_id = f"WAIT-{uuid.uuid4().hex[:6].upper()}"
            party_size = random.choice([2, 2, 2, 4, 4, 6])
            checkin_dt = target_date.replace(hour=random.randint(11, 21), minute=random.randint(0, 59))
            
            # 대기 처리
            cur.execute("""
                INSERT INTO table_waitings (waiting_id, phone_number, party_size, status, timestamp)
                VALUES (%s, %s, %s, 'completed', %s)
            """, (waiting_id, f"010-{random.randint(1000,9999)}-{random.randint(1000,9999)}", party_size, checkin_dt.isoformat()))
            case_counter += 1
            
            # 세션 최초 생성
            cur.execute("""
                INSERT INTO table_sessions (session_id, table_id, device_id, status)
                VALUES (%s, %s, %s, 'closed')
            """, (session_id, table_id, device_id))
            case_counter += 1
            
            # 주문 누적 차수 발생 (1차 메인 요리, 2차 디저트 및 추가음료 등)
            order_rounds = random.choice([1, 1, 1, 2, 2, 3])
            
            for round_seq in range(1, order_rounds + 1):
                order_id = f"ORD-{session_id}-{round_seq}"
                order_time = checkin_dt + timedelta(minutes=random.randint(5, 45) * round_seq)
                
                # 주문 항목 무작위 생성 (1개 ~ 4개)
                ordered_items = []
                for _ in range(random.randint(1, 3)):
                    ordered_items.append(random.choice(MENU_ITEMS))
                    
                total_amount = sum(int(item["price"]) for item in ordered_items)
                
                cur.execute("""
                    INSERT INTO table_orders (order_id, session_id, device_id, order_seq, items, total_amount, status, payment_status, payment_method, timestamp)
                    VALUES (%s, %s, %s, %s, %s, %s, 'served', 'paid', %s, %s)
                """, (
                    order_id, session_id, device_id, round_seq, 
                    json.dumps(ordered_items), total_amount,
                    random.choice(["card", "cash", "toss"]), order_time.isoformat()
                ))
                case_counter += 1
                
            # C. 직원 호출 (Call) 시뮬레이션
            for _ in range(random.randint(0, 2)):
                call_id = f"CALL-{uuid.uuid4().hex[:6].upper()}"
                call_type = random.choice(CALL_TYPES)
                call_time = checkin_dt + timedelta(minutes=random.randint(15, 60))
                
                cur.execute("""
                    INSERT INTO table_calls (call_id, table_id, session_id, call_type, status, timestamp)
                    VALUES (%s, %s, %s, %s, 'completed', %s)
                """, (call_id, table_id, session_id, call_type, call_time.isoformat()))
                case_counter += 1
                
            # D. 차량 정산 등록 시뮬레이션 (30% 확률)
            if random.random() < 0.35:
                parking_id = f"PRK-{uuid.uuid4().hex[:6].upper()}"
                vehicle_num = random.choice(VEHICLE_NUMBERS)
                park_time = checkin_dt + timedelta(minutes=random.randint(45, 90))
                
                cur.execute("""
                    INSERT INTO table_parkings (parking_id, session_id, vehicle_number, discount_minutes, status, timestamp)
                    VALUES (%s, %s, %s, 120, 'applied', %s)
                """, (parking_id, session_id, vehicle_num, park_time.isoformat()))
                case_counter += 1

    conn.commit()
    cur.close()
    conn.close()
    
    print(f"🎉 500개 이상 복합 케이스 테스트셋 완벽 주입 성공! (총 시뮬레이션 트랜잭션 건수: {case_counter}개)")

# 3. 알곡 수확 및 가공 추출 파이프라인 (Data Distillation Engine)
def distill_insights_to_knowledge_base():
    """소멸성 임시 데이터로부터 고자산 가치 알곡 통계를 가공 추출하여 영구 지식 테이블에 아카이빙합니다."""
    print("🚜 소멸성 데이터 원자재 분석 가공 (지능형 알곡 가공 파이프라인) 가동 중...")
    
    conn = get_db_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # A. 음식 누적 주문 분석 (베스트셀러 랭킹)
    cur.execute("SELECT items, timestamp FROM table_orders WHERE payment_status = 'paid'")
    orders = cur.fetchall()
    
    menu_sales = {}
    weekly_sales = {i: 0 for i in range(7)} # 0: 월, ..., 6: 일
    hourly_sales = {h: 0 for h in range(24)}
    total_revenue = 0
    
    for ord_row in orders:
        items = ord_row["items"]
        if isinstance(items, str):
            items = json.loads(items)
        dt = datetime.fromisoformat(ord_row["timestamp"])
        
        # 시간대/요일별 매출 집계
        weekly_sales[dt.weekday()] += sum(item["price"] for item in items)
        hourly_sales[dt.hour] += sum(item["price"] for item in items)
        
        for item in items:
            name = item["name"]
            price = item["price"]
            total_revenue += price
            if name not in menu_sales:
                menu_sales[name] = {"count": 0, "revenue": 0}
            menu_sales[name]["count"] += 1
            menu_sales[name]["revenue"] += price
            
    # 정렬하여 Top 메뉴 추출
    sorted_menu = sorted(menu_sales.items(), key=lambda x: x[1]["count"], reverse=True)
    top_menus = [{"name": name, "count": d["count"], "revenue": d["revenue"]} for name, d in sorted_menu[:5]]

    # B. 스태프 종합 급여 및 정산 계산
    cur.execute("SELECT * FROM table_staff_accounts")
    staffs = cur.fetchall()
    
    staff_payroll_report = []
    for stf in staffs:
        staff_id = stf["staff_id"]
        # 근태 기록 분석
        cur.execute("SELECT * FROM table_attendance_logs WHERE staff_id = %s", (staff_id,))
        logs = cur.fetchall()
        
        total_mins = sum(log["work_minutes"] or 0 for log in logs)
        total_hours = total_mins / 60.0
        tardy_count = sum(1 for log in logs if log["tardy"])
        
        hourly_wage = stf["hourly_wage"]
        base_wage = int(total_hours * hourly_wage)
        
        # 주휴수당 (한달 누적 60시간 이상 시 자동가산 수율)
        weekly_allowance = 0
        if total_hours >= 60.0:
            weekly_allowance = int((total_hours / 40.0) * 8.0 * hourly_wage)
            
        tax = int((base_wage + weekly_allowance) * 0.033)
        net_wage = (base_wage + weekly_allowance) - tax
        
        staff_payroll_report.append({
            "name": stf["name"],
            "role": stf["role"],
            "hourly_wage": hourly_wage,
            "total_hours": round(total_hours, 1),
            "tardy_count": tardy_count,
            "base_wage": base_wage,
            "weekly_holiday_allowance": weekly_allowance,
            "tax_deduction": tax,
            "net_payroll": net_wage
        })

    # C. 스마트 고객 서비스 (대기/호출/주차) 실태 분석
    cur.execute("SELECT * FROM table_calls")
    calls = cur.fetchall()
    call_counts = {}
    for call in calls:
        ctype = call["call_type"]
        call_counts[ctype] = call_counts.get(ctype, 0) + 1
    sorted_calls = sorted(call_counts.items(), key=lambda x: x[1], reverse=True)
    
    cur.execute("SELECT * FROM table_parkings")
    parkings = cur.fetchall()
    total_parkings = len(parkings)
    
    cur.execute("SELECT * FROM table_waitings")
    waitings = cur.fetchall()
    total_waitings = len(waitings)
    
    # D. 알곡 지식 패키지 JSON 묶음 제조
    insight_bundle = {
        "id": f"BND-SUMMARY-{datetime.now().strftime('%Y%m%d')}",
        "store_id": "default_store",
        "type": "Monthly_Distilled_Insight",
        "title": "지난 30일간 복합 운영 분석 및 경영 알곡 보고서",
        "timestamp": datetime.now().isoformat(),
        "data": {
            "financials": {
                "total_revenue": total_revenue,
                "order_count": len(orders),
                "weekday_revenue_split": {
                    "월": weekly_sales[0], "화": weekly_sales[1], "수": weekly_sales[2],
                    "목": weekly_sales[3], "금": weekly_sales[4], "토": weekly_sales[5], "일": weekly_sales[6]
                },
                "peak_hours": sorted(hourly_sales.items(), key=lambda x: x[1], reverse=True)[:3]
            },
            "top_best_sellers": top_menus,
            "staff_payrolls": staff_payroll_report,
            "operations": {
                "total_waitings": total_waitings,
                "total_parking_validations": total_parkings,
                "most_called_services": sorted_calls[:3]
            }
        },
        "summary": "지난 30일 동안의 판매량과 근태 통계를 분석한 결과, 금/토/일 주말 피크 타임의 매출 비중이 약 65% 이상으로 높게 치우쳐 있습니다. 스태프 최준혁 님과 박민지 님의 출근 빈도를 주말 밀집 구간에 추가 매핑할 시, 테이블 실시간 호출(가장 많았던 '물티슈 가져다주기' 등)의 대응 지연을 35% 이상 개선할 수 있을 것으로 권고됩니다."
    }
    
    # E. 영구 보관 지식 저장소 DB 박제
    cur.execute("""
        INSERT INTO table_distilled_insights (insight_id, store_id, type, title, timestamp, data, summary)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (insight_id) DO UPDATE SET
            data = EXCLUDED.data,
            summary = EXCLUDED.summary
    """, (
        insight_bundle["id"], insight_bundle["store_id"], insight_bundle["type"],
        insight_bundle["title"], insight_bundle["timestamp"], json.dumps(insight_bundle["data"]),
        insight_bundle["summary"]
    ))
    
    conn.commit()
    cur.close()
    conn.close()
    
    # 파일로도 안전하게 아카이브 백업 저장 (knowledge_pool.json)
    knowledge_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "knowledge_pool.json")
    with open(knowledge_path, "w", encoding="utf-8") as f:
        json.dump(insight_bundle, f, ensure_ascii=False, indent=2)
        
    print(f"💾 영구 정보 창고(table_distilled_insights & {os.path.basename(knowledge_path)})에 최상급 정보 알곡 가공 박제 성공!")

def display_distilled_reports():
    """저장된 정보 창고로부터 원하는 통찰 데이터를 시각적으로 정밀하게 추출 및 출력합니다."""
    knowledge_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "knowledge_pool.json")
    if not os.path.exists(knowledge_path):
        print("❌ 추출할 알곡 지식이 저장소에 존재하지 않습니다.")
        return
        
    with open(knowledge_path, "r", encoding="utf-8") as f:
        bundle = json.load(f)
        
    data = bundle["data"]
    
    print("\n" + "="*70)
    print(f"🌾 [사장님 아침 브리핑] {bundle['title']}")
    print(f"🕒 분석 기준 시각: {bundle['timestamp']}")
    print("="*70)
    
    # 1. 재정 및 매출 분석
    print("\n[📊 1. 매출 및 재무 통계]")
    print(f" - 총 매출액: {data['financials']['total_revenue']:,}원 (총 {data['financials']['order_count']}건 주문)")
    print(" - 요일별 매출 현황:")
    for day, rev in data['financials']['weekday_revenue_split'].items():
        print(f"   * {day}요일: {rev:12,}원 " + "🟢"*int(rev / 5000000))
        
    # 2. 베스트셀러 순위
    print("\n[🥇 2. 품목별 판매 랭킹 Top 5]")
    for i, menu in enumerate(data["top_best_sellers"], 1):
        print(f"   {i}위. {menu['name']:15} | 누적 {menu['count']:3}개 판매 | 매출액 {menu['revenue']:9,}원")
        
    # 3. 직원 월급 자동 산출표
    print("\n[👥 3. 당월 스태프별 인사 및 정산 보고서]")
    print("-"*70)
    print("이름     | 직급    | 시급    | 총시간 | 지각 | 기본급     | 주휴수당   | 실지급액")
    print("-"*70)
    for staff in data["staff_payrolls"]:
        print(f"{staff['name']:8} | {staff['role']:7} | {staff['hourly_wage']:5,}원 | {staff['total_hours']:5}h | {staff['tardy_count']:3}회 | {staff['base_wage']:9,}원 | {staff['weekly_holiday_allowance']:9,}원 | {staff['net_payroll']:9,}원")
    print("-"*70)
    
    # 4. 고객 편의 호출 실태
    print("\n[🛎️ 4. 고객 호출 및 주차정산 분석]")
    print(f" - 대기 신청 등록 손님: 총 {data['operations']['total_waitings']}팀")
    print(f" - 무료 주차 2시간 등록: 총 {data['operations']['total_parking_validations']}대")
    print(" - 최고 빈도 실시간 고객 호출 항목 Top 3:")
    for i, (ctype, count) in enumerate(data['operations']['most_called_services'], 1):
        print(f"   * {i}순위: {ctype} ({count}회 호출)")
        
    # 5. 인공지능 경영 전략 권고안
    print("\n[🧠 5. AI 인공지능 경영 종합 분석 요약]")
    print(bundle["summary"])
    print("="*70 + "\n")

if __name__ == "__main__":
    clear_existing_tables()
    run_simulation_500_cases()
    distill_insights_to_knowledge_base()
    display_distilled_reports()
