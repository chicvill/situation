"""
공통 알림 라우터 — POST /api/notify
호출·주차·대기·포인트 등 모든 실시간 이벤트를 단일 엔드포인트로 처리.
DB 저장 후 MQTT broadcast_to_kitchen 으로 카운터/주방에 전달한다.
"""

import uuid
from datetime import datetime
from typing import Dict
from fastapi import APIRouter
from ..state import manager

router = APIRouter()

# 테이블 번호가 없는 이벤트에 할당하는 임시(가상) 테이블 번호.
# MERGE(더치페이)는 QR에 테이블 번호가 이미 포함되므로 여기에 없음.
VIRTUAL_TABLE = {
    "STAFF_CALL":         "T101",   # 직원 호출 (입구 등 테이블 미지정)
    "PARKING_APPLIED":    "T102",   # 주차 할인 신청
    "WAITING_REGISTERED": "T103",   # 대기 등록 (착석 전)
    "POINT_EVENT":        "T104",   # 포인트 적립
    "JOIN_REQUEST":       "T105",   # 합류 요청 (table_id 없을 때 안전망)
}


@router.post("/api/notify")
async def send_notification(data: Dict):
    event_type = data.get("type") or "UNKNOWN"
    store_id = data.get("store_id") or "Total"
    # MERGE는 QR의 실제 테이블 번호를 그대로 사용; 나머지는 가상 번호 fallback
    table_id = data.get("table_id") or VIRTUAL_TABLE.get(event_type, "")
    ts = datetime.now().isoformat()

    # 전송할 기본 메시지 (항상 store_id 포함)
    msg: Dict = {**data, "store_id": store_id, "timestamp": ts}

    # ── 직원 호출 ──────────────────────────────────────────────
    if event_type == "STAFF_CALL":
        try:
            from ..database import save_call, get_active_session
            active = get_active_session(store_id, table_id)
            # 세션의 실제 store_id 로 브로드캐스트 (요청 store_id 와 다를 수 있음)
            if active and active.get('store_id'):
                store_id = active['store_id']
                msg['store_id'] = store_id
            call_id = f"CALL-{uuid.uuid4().hex[:4].upper()}"
            save_call({
                "call_id": call_id,
                "table_id": table_id,
                "session_id": active["session_id"] if active else "SESS-NONE",
                "call_type": data.get("call_type") or "직원호출",
                "status": "pending",
                "timestamp": ts,
            })
            msg["call_id"] = call_id
            print(f"[notify] STAFF_CALL saved: {call_id} table={table_id} store={store_id}")
        except Exception as e:
            print(f"[notify] STAFF_CALL DB 저장 오류: {e}")

    # ── 주차 할인 신청 ─────────────────────────────────────────
    elif event_type == "PARKING_APPLIED":
        try:
            from ..database import save_parking, get_session_by_id
            session_id = data.get("session_id") or ""
            if session_id:
                session_info = get_session_by_id(session_id)
                if session_info:
                    store_id = session_info.get("store_id") or store_id
                    table_id = session_info.get("table_id") or table_id
                    msg["store_id"] = store_id
                    msg["table_id"] = table_id
            parking_id = f"PARK-{uuid.uuid4().hex[:4].upper()}"
            save_parking({
                "parking_id": parking_id,
                "session_id": session_id,
                "vehicle_number": data.get("vehicle_number") or "",
                "discount_minutes": int(data.get("discount_minutes") or 120),
                "status": "applied",
                "timestamp": ts,
            })
            msg["parking_id"] = parking_id
            print(f"[notify] PARKING_APPLIED saved: {parking_id}")
        except Exception as e:
            print(f"[notify] PARKING_APPLIED DB 저장 오류: {e}")

    # ── 대기 등록 ──────────────────────────────────────────────
    elif event_type == "WAITING_REGISTERED":
        try:
            from ..database import save_waiting
            waiting_id = f"WAIT-{uuid.uuid4().hex[:4].upper()}"
            save_waiting({
                "waiting_id": waiting_id,
                "store_id": store_id,
                "phone_number": data.get("phone_number") or "",
                "party_size": int(data.get("party_size") or 1),
                "status": "waiting",
                "timestamp": ts,
            })
            msg["waiting_id"] = waiting_id
            print(f"[notify] WAITING_REGISTERED saved: {waiting_id}")
        except Exception as e:
            print(f"[notify] WAITING_REGISTERED DB 저장 오류: {e}")

    # ── 포인트 적립 ────────────────────────────────────────────
    elif event_type == "POINTS_UPDATED":
        try:
            from ..database import update_customer_points
            phone = data.get("phone") or ""
            points = int(data.get("points") or 0)
            if phone and points > 0:
                update_customer_points(phone, points, store_id)
                print(f"[notify] POINTS_UPDATED: {phone} +{points}P store={store_id}")
        except Exception as e:
            print(f"[notify] POINTS_UPDATED DB 저장 오류: {e}")

    # ── 더치페이 / 세션 병합 ───────────────────────────────────
    elif event_type == "MERGE":
        try:
            from ..database import save_call, get_active_session
            active = get_active_session(store_id, table_id)
            call_id = f"CALL-{uuid.uuid4().hex[:4].upper()}"
            save_call({
                "call_id": call_id,
                "table_id": table_id,
                "session_id": data.get("session_id") or (active["session_id"] if active else "SESS-NONE"),
                "call_type": "더치페이 요청",
                "status": "pending",
                "timestamp": ts,
            })
            msg["call_id"] = call_id
            msg["call_type"] = "더치페이 요청"
            msg["type"] = "STAFF_CALL"   # CallManager 가 기존 로직으로 처리
            print(f"[notify] MERGE saved as STAFF_CALL: {call_id} table={table_id}")
        except Exception as e:
            print(f"[notify] MERGE DB 저장 오류: {e}")

    # ── 그 외 (JOIN_REQUEST, RESERVATION 등) ──────────────────
    else:
        print(f"[notify] pass-through: type={event_type} store={store_id}")

    # 항상 브로드캐스트
    await manager.broadcast_to_kitchen(msg)
    return {"status": "ok", "type": event_type, "store_id": store_id}
