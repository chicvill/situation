"""
sim_state.py - state.json 시뮬레이션 데이터 삽입 스크립트
호출 / 대기 / 주차 / 포인트 / 예약 각 항목 테스트 데이터를 DB에 저장하고
debug_writer.record_event 를 호출해 state.json 을 갱신합니다.
"""
import sys
import os
import uuid
from datetime import datetime, timedelta

# situation-backend 를 패키지 루트로 설정
BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)

os.environ.setdefault("DEBUG_MONITOR", "1")

from session.db.connection import get_db_conn
from session.db.operations_db import (
    save_call, save_waiting, save_parking, save_reservation,
    get_active_calls, get_active_waitings, get_active_parkings_db, get_active_reservations,
)
from session.db.points_db import update_customer_points, get_points_list_db
from session.debug_writer import record_event


def _ok(label, result):
    icon = "OK" if result else "FAIL"
    print(f"  [{icon}] {label}")
    return result


def _get_any_session_id():
    """주차 시뮬레이션용 활성 세션 ID 조회"""
    conn = get_db_conn()
    if not conn:
        return "SESS-SIM-001"
    try:
        from psycopg2.extras import RealDictCursor
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT session_id, table_id FROM table_sessions WHERE status != 'closed' LIMIT 1")
        row = cur.fetchone()
        cur.close(); conn.close()
        if row:
            print(f"  [INFO] 주차 연결 세션: {row['session_id']} (table={row['table_id']})")
            return row["session_id"]
        return "SESS-SIM-001"
    except Exception as e:
        print(f"  [WARN] 세션 조회 실패: {e}")
        return "SESS-SIM-001"


# ─────────────────────────────────────────────────────────────
# 1. 호출 (Calls)
# ─────────────────────────────────────────────────────────────
def sim_calls():
    print("\n[1] 호출 시뮬레이션")
    calls = [
        {"call_id": f"CALL-SIM-{uuid.uuid4().hex[:4].upper()}", "table_id": "T03", "session_id": "SESS-SIM-T03", "call_type": "직원호출"},
        {"call_id": f"CALL-SIM-{uuid.uuid4().hex[:4].upper()}", "table_id": "T07", "session_id": "SESS-SIM-T07", "call_type": "계산요청"},
    ]
    for c in calls:
        c["status"] = "pending"
        c["timestamp"] = datetime.now().isoformat()
        _ok(f"호출 저장 - {c['table_id']} ({c['call_type']})", save_call(c))
    print(f"  현재 pending 호출: {len(get_active_calls())}건")


# ─────────────────────────────────────────────────────────────
# 2. 대기 (Waiting)
# ─────────────────────────────────────────────────────────────
def sim_waiting():
    print("\n[2] 대기 시뮬레이션")
    waitings = [
        {"waiting_id": f"WAIT-SIM-{uuid.uuid4().hex[:6].upper()}", "phone_number": "010-1111-2222", "party_size": 3, "store_id": "store-1"},
        {"waiting_id": f"WAIT-SIM-{uuid.uuid4().hex[:6].upper()}", "phone_number": "010-3333-4444", "party_size": 2, "store_id": "store-1", "status": "called"},
    ]
    for w in waitings:
        w.setdefault("status", "waiting")
        w["timestamp"] = datetime.now().isoformat()
        _ok(f"대기 저장 - {w['phone_number']} ({w['status']})", save_waiting(w))
    print(f"  현재 대기 인원: {len(get_active_waitings())}팀")


# ─────────────────────────────────────────────────────────────
# 3. 주차 (Parking)
# ─────────────────────────────────────────────────────────────
def sim_parking():
    print("\n[3] 주차 시뮬레이션")
    session_id = _get_any_session_id()
    parkings = [
        {"parking_id": f"PARK-SIM-{uuid.uuid4().hex[:6].upper()}", "session_id": session_id,
         "vehicle_number": "12가 3456", "discount_minutes": 60},
        {"parking_id": f"PARK-SIM-{uuid.uuid4().hex[:6].upper()}", "session_id": "SESS-SIM-T05",
         "vehicle_number": "98나 7654", "discount_minutes": 30},
    ]
    for p in parkings:
        p.setdefault("status", "applied")
        p["timestamp"] = datetime.now().isoformat()
        _ok(f"주차 저장 - {p['vehicle_number']} ({p['discount_minutes']}분 할인)", save_parking(p))
    print(f"  현재 주차 건수: {len(get_active_parkings_db())}건")


# ─────────────────────────────────────────────────────────────
# 4. 포인트 (Points)
# ─────────────────────────────────────────────────────────────
def sim_points():
    print("\n[4] 포인트 시뮬레이션")
    data = [
        ("010-1111-2222", 1200, "store-1"),
        ("010-5555-6666", 3500, "store-1"),
        ("010-7777-8888", 800,  "store-1"),
    ]
    for phone, pts, store in data:
        _ok(f"포인트 적립 - {phone}: +{pts}점", update_customer_points(phone, pts, store))
    total = get_points_list_db()
    print(f"  전체 포인트 회원: {len(total)}명")


# ─────────────────────────────────────────────────────────────
# 5. 예약 (Reservations)
# ─────────────────────────────────────────────────────────────
def sim_reservations():
    print("\n[5] 예약 시뮬레이션")
    now = datetime.now()
    reservations = [
        {
            "reservation_id": f"RES-SIM-{uuid.uuid4().hex[:6].upper()}",
            "customer_name": "김민준",
            "phone_number": "010-2222-3333",
            "party_size": 4,
            "reserved_time": (now + timedelta(hours=2)).isoformat(),
            "table_id": "T05",
            "status": "confirmed",
        },
        {
            "reservation_id": f"RES-SIM-{uuid.uuid4().hex[:6].upper()}",
            "customer_name": "이서연",
            "phone_number": "010-4444-5555",
            "party_size": 2,
            "reserved_time": (now + timedelta(hours=5)).isoformat(),
            "table_id": "T02",
            "status": "requested",
        },
    ]
    for r in reservations:
        _ok(f"예약 저장 - {r['customer_name']} {r['party_size']}명 ({r['status']})", save_reservation(r))
    print(f"  현재 예약: {len(get_active_reservations())}건")


# ─────────────────────────────────────────────────────────────
# 메인
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 50)
    print("state.json 시뮬레이션 시작")
    print("=" * 50)

    sim_calls()
    sim_waiting()
    sim_parking()
    sim_points()
    sim_reservations()

    print("\n[6] state.json / session.json 갱신")
    record_event("SIMULATION_COMPLETE", {"source": "sim_state.py"}, seat_requests=[])
    print("  [OK] debug/state.json + debug/session.json 갱신 완료")

    print("\n" + "=" * 50)
    print("시뮬레이션 완료 - 브라우저에서 확인:")
    print("  http://localhost:8000/api/debug/state-data")
    print("=" * 50)
