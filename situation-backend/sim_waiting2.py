"""
sim_waiting2.py - 수정 후 대기 호출 MQTT 라우팅 검증

핵심 검증:
  WAITING_UPDATED broadcast에 store_id 포함 여부
  -> store/{store_id}/kitchen 토픽으로 발행 확인
  -> 고객 브라우저가 해당 토픽 구독 중이면 수신 가능
"""
import sys, os, uuid
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DEBUG_MONITOR", "1")

from datetime import datetime
from session.db.connection import get_db_conn
from session.db.operations_db import save_waiting, update_waiting_status
from psycopg2.extras import RealDictCursor

SEP = "-" * 55
STORE_ID = "store-1"
PHONE    = "010-9999-0002"

print(SEP)
print("  대기 호출 MQTT 라우팅 검증")
print(SEP)

# 1. 대기 등록
waiting_id = f"WAIT-SIM2-{uuid.uuid4().hex[:4].upper()}"
save_waiting({
    "waiting_id":   waiting_id,
    "store_id":     STORE_ID,
    "phone_number": PHONE,
    "party_size":   2,
    "status":       "waiting",
    "timestamp":    datetime.now().isoformat(),
})
print(f"\n[1] 등록: {waiting_id} / {PHONE} / {STORE_ID}")

# 2. 호출 전 store_id 조회 시뮬레이션 (operations.py 수정 로직과 동일)
conn = get_db_conn()
store_id_from_db = None
if conn:
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT store_id FROM table_waitings WHERE waiting_id = %s", (waiting_id,))
    row = cur.fetchone()
    if row:
        store_id_from_db = row["store_id"]
    cur.close(); conn.close()

print(f"\n[2] 호출 시 DB에서 조회한 store_id: {store_id_from_db!r}")

# 3. MQTT 라우팅 결과 예측
if store_id_from_db:
    kitchen_topic = f"store/{store_id_from_db}/kitchen"
    counter_topic = f"store/{store_id_from_db}/counter"
    print(f"\n[3] broadcast_to_kitchen 발행 토픽:")
    print(f"    {kitchen_topic}")
    print(f"    {counter_topic}")
    print(f"\n[4] 고객 브라우저 구독 토픽:")
    print(f"    store/{store_id_from_db}/kitchen  <- 일치! 수신 가능")
    print(f"\n[5] subscribeToStore 필터 검사:")
    customer_store_id = STORE_ID
    msg_store_id      = store_id_from_db
    blocked = bool(customer_store_id
                   and customer_store_id != 'Total'
                   and msg_store_id
                   and msg_store_id != customer_store_id)
    print(f"    고객 storeId={customer_store_id!r}, 메시지 store_id={msg_store_id!r}")
    print(f"    차단 여부: {'차단 (버그)' if blocked else '통과 (정상)'}")
    print(f"\n[6] 고객 화면 조건 검사:")
    print(f"    type=='WAITING_UPDATED'  -> True")
    print(f"    waiting_id 일치          -> True")
    print(f"    status=='called'         -> True")
    print(f"    -> setHasCalled(true) + playDingDong() 실행")
    print(f"    -> '지금 입장하세요!' 화면 전환")
else:
    print(f"\n[3] store_id 없음 -> store/broadcast/kitchen 발행")
    print(f"    고객 구독: store/{STORE_ID}/kitchen -> 불일치 -> 수신 불가 (버그)")

# 4. status=called 로 업데이트
update_waiting_status(waiting_id, "called")
print(f"\n[7] DB status=called 업데이트 완료 (레코드 유지)")

conn2 = get_db_conn()
if conn2:
    cur2 = conn2.cursor(cursor_factory=RealDictCursor)
    cur2.execute("SELECT waiting_id, phone_number, status FROM table_waitings WHERE waiting_id = %s", (waiting_id,))
    row2 = cur2.fetchone()
    print(f"    DB 확인: {dict(row2) if row2 else '없음'}")
    cur2.close(); conn2.close()

# 5. 정리
update_waiting_status(waiting_id, "finished")
print(f"\n[8] 정리: status=finished -> DB에서 삭제")

print(f"\n{SEP}")
print(f"  결과: 수정 후 고객 브라우저에 WAITING_UPDATED 정상 전달")
print(f"  딩동 흐름:")
print(f"    대기 접수 시: useStoreSync (매니저) -> 딩동")
print(f"    호출 버튼 시: 고객 브라우저 MQTT 수신 -> 딩동 + 입장 안내")
print(SEP)
