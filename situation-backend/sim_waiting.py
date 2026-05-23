"""
sim_waiting.py - 대기 접수 ~ 호출 전체 흐름 시뮬레이션

STEP 1: 고객이 대기 등록 (/api/waiting/register)
         -> DB 저장 + MQTT broadcast WAITING_REGISTERED
         -> 매니저 화면: 딩동 + 목록 추가
         -> 고객 화면: 대기번호 화면 표시

STEP 2: 매니저가 호출 버튼 (/api/waiting/status, status=called)
         -> DB 업데이트 + MQTT broadcast WAITING_UPDATED
         -> 고객 화면: 입장하세요 화면 + 딩동

STEP 3: 입장 처리 (/api/waiting/status, status=finished)
         -> DB에서 삭제 + MQTT broadcast WAITING_UPDATED
         -> 매니저 화면: 목록에서 제거
"""
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DEBUG_MONITOR", "1")

import uuid
import asyncio
from datetime import datetime
from session.db.connection import get_db_conn
from session.db.operations_db import (
    save_waiting, get_active_waitings, update_waiting_status
)
from session.debug_writer import record_event

STORE_ID = "store-1"
PHONE    = "010-9999-0001"
PARTY    = 3

SEP = "-" * 55


def step(n, title):
    print(f"\n{SEP}")
    print(f"  STEP {n}: {title}")
    print(SEP)


def show_waitings(label="현재 대기"):
    rows = get_active_waitings()
    print(f"\n  [{label}] {len(rows)}팀")
    for r in rows:
        print(f"    - {r['waiting_id']}  {r['phone_number']}  {r['party_size']}명  [{r['status']}]")


# ── STEP 1: 대기 등록 ────────────────────────────────────────────────────────
step(1, "고객 대기 등록")
waiting_id = f"WAIT-SIM-{uuid.uuid4().hex[:6].upper()}"
waiting_data = {
    "waiting_id": waiting_id,
    "store_id":   STORE_ID,
    "phone_number": PHONE,
    "party_size": PARTY,
    "status":     "waiting",
    "timestamp":  datetime.now().isoformat(),
}
ok = save_waiting(waiting_data)
print(f"\n  DB 저장: {'OK' if ok else 'FAIL'}")
print(f"  waiting_id : {waiting_id}")
print(f"  phone      : {PHONE}")
print(f"  party_size : {PARTY}명")

# MQTT 브로드캐스트 시뮬레이션 (실제 서버 없이 로그로 표현)
mqtt_reg = {
    "type":       "WAITING_REGISTERED",
    "waiting_id": waiting_id,
    "store_id":   STORE_ID,
    "phone_number": PHONE,
    "party_size": PARTY,
}
print(f"\n  [MQTT broadcast] -> 매니저/주방 수신:")
print(f"    {mqtt_reg}")
print(f"\n  [매니저 화면] 딩동! + 대기 목록에 추가")
print(f"  [고객 화면]  '대기 접수 완료! 잠시만 기다려주세요.'")

show_waitings("등록 후")
record_event("SIM_WAITING_REGISTERED", {"waiting_id": waiting_id}, seat_requests=[])

time.sleep(0.5)

# ── STEP 2: 매니저 호출 ──────────────────────────────────────────────────────
step(2, "매니저가 호출 버튼 클릭")
ok2 = update_waiting_status(waiting_id, "called")
print(f"\n  DB 업데이트 (status=called): {'OK' if ok2 else 'FAIL'}")

mqtt_called = {
    "type":       "WAITING_UPDATED",
    "waiting_id": waiting_id,
    "status":     "called",
}
print(f"\n  [MQTT broadcast] -> 고객 브라우저 수신:")
print(f"    {mqtt_called}")
print(f"\n  [고객 화면] 딩동! + '지금 입장하세요!' 빨간 화면 전환")
print(f"  [고객 알림] 브라우저 WebSocket/MQTT로 전달 (SMS/카카오 미구현)")

show_waitings("호출 후 (status=called 는 active로 남음)")
record_event("SIM_WAITING_CALLED", {"waiting_id": waiting_id}, seat_requests=[])

time.sleep(0.5)

# ── STEP 3: 입장 완료 ────────────────────────────────────────────────────────
step(3, "매니저가 입장 처리")
ok3 = update_waiting_status(waiting_id, "finished")
print(f"\n  DB 삭제 (status=finished -> DELETE): {'OK' if ok3 else 'FAIL'}")

mqtt_finished = {
    "type":       "WAITING_UPDATED",
    "waiting_id": waiting_id,
    "status":     "finished",
}
print(f"\n  [MQTT broadcast] -> 매니저/고객 수신:")
print(f"    {mqtt_finished}")
print(f"  [매니저 화면] 목록에서 제거")
print(f"  [고객 화면]  '확인했습니다' 버튼 표시")

show_waitings("입장 후")
record_event("SIM_WAITING_FINISHED", {"waiting_id": waiting_id}, seat_requests=[])

# ── 요약 ─────────────────────────────────────────────────────────────────────
print(f"\n{SEP}")
print("  시뮬레이션 결과 요약")
print(SEP)
print(f"""
  흐름:  등록 -> 호출 -> 입장 완료
  DB:    {'정상' if ok and ok2 and ok3 else '일부 실패'}

  고객 메시지 전달 방식:
    - MQTT WebSocket 구독 (브라우저가 열려있어야 함)
    - SMS / 카카오 알림 미구현 (실제 핸드폰 푸시 없음)

  딩동 추가 (이번 수정):
    - [매니저 화면] WAITING_REGISTERED 수신 시 딩동 추가 (완료)
    - [고객 화면]  WAITING_UPDATED(called) 수신 시 딩동 기존 동작

  state.json 갱신 완료
""")
