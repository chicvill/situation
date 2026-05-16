import uuid
from datetime import datetime
from typing import Dict, Optional
from fastapi import APIRouter, HTTPException
from ..state import manager
from ..database import get_active_session

router = APIRouter()


# --- 🚶 5-1. 스마트 대기 관리 (Waiting) Endpoints ---
@router.post("/api/waiting/register")
async def register_waiting(data: Dict):
    phone_number = data.get("phone_number") or data.get("phone")
    party_size_raw = data.get("party_size") or data.get("partySize") or 1
    store_id = data.get("store_id") or data.get("storeId") or "store-1"
    try:
        party_size = int(party_size_raw)
    except:
        party_size = 1

    if not phone_number:
        raise HTTPException(status_code=400, detail="phone_number is required")

    waiting_id = f"WAIT-{uuid.uuid4().hex[:4].upper()}"
    waiting_data = {
        "waiting_id": waiting_id,
        "store_id": store_id,
        "phone_number": phone_number,
        "party_size": party_size,
        "status": "waiting",
        "timestamp": datetime.now().isoformat()
    }

    from ..database import save_waiting
    if save_waiting(waiting_data):
        # 주방/카운터에 실시간 알림 전송
        await manager.broadcast_to_kitchen({
            "type": "WAITING_REGISTERED",
            "waiting_id": waiting_id,
            "store_id": store_id,
            "phone_number": phone_number,
            "party_size": party_size
        })
        return waiting_data
    raise HTTPException(status_code=500, detail="Failed to register waiting")


@router.get("/api/waiting/active")
async def get_active_waitings_endpoint(store_id: Optional[str] = None):
    from ..database import get_active_waitings
    return get_active_waitings(store_id)


@router.post("/api/waiting/status")
async def update_waiting_status_endpoint(data: Dict):
    waiting_id = data.get("waiting_id") or data.get("waitingId")
    status = data.get("status")

    if not waiting_id or not status:
        raise HTTPException(status_code=400, detail="waiting_id and status required")

    from ..database import update_waiting_status
    if update_waiting_status(waiting_id, status):
        # 대기 상태 변경 알림 전파
        await manager.broadcast_to_kitchen({
            "type": "WAITING_UPDATED",
            "waiting_id": waiting_id,
            "status": status
        })
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to update waiting status")


# --- 🛎️ 5-2. 스마트 직원 호출 (Staff Call) Endpoints ---
@router.post("/api/call")
async def staff_call(data: Dict):
    table_id = data.get("table_id") or data.get("tableId")
    call_type = data.get("call_type") or data.get("callType") or "직원호출"

    if not table_id:
        raise HTTPException(status_code=400, detail="table_id required")

    # 현재 활성 세션 가져와서 호출 기록을 세션에 종속시키기
    from ..database import get_active_session, save_call
    req_store_id = data.get("store_id") or data.get("storeId") or "Total"
    active = get_active_session(req_store_id, table_id)
    # 세션이 있으면 세션의 실제 store_id 사용 (요청의 store_id 가 다를 수 있음)
    store_id = (active.get('store_id') if active else None) or req_store_id
    session_id = active['session_id'] if active else "SESS-NONE"

    call_id = f"CALL-{uuid.uuid4().hex[:4].upper()}"
    call_data = {
        "call_id": call_id,
        "table_id": table_id,
        "session_id": session_id,
        "call_type": call_type,
        "status": "pending",
        "timestamp": datetime.now().isoformat()
    }

    if save_call(call_data):
        print(f"[DB 저장 상태] 성공 - call_id={call_id}, table={table_id}, store={store_id}")
        msg = {
            "type": "STAFF_CALL",
            "call_id": call_id,
            "table_id": table_id,
            "call_type": call_type,
            "status": "pending",
            "store_id": store_id
        }
        # 기존 WebSocket 브로드캐스트 (하위 호환 유지)
        await manager.broadcast_to_kitchen(msg)
        await manager.send_to_table(table_id, msg)
        return call_data

    print(f"[DB 저장 상태] 실패 - call_id={call_id}, table={table_id}")
    raise HTTPException(status_code=500, detail="Failed to process staff call")


@router.get("/api/call/active")
async def get_active_calls_endpoint(table_id: Optional[str] = None, store_id: Optional[str] = None):
    from ..database import get_active_calls
    return get_active_calls(table_id, store_id)


@router.post("/api/call/status")
async def update_call_status_endpoint(data: Dict):
    call_id = data.get("call_id") or data.get("callId")
    status = data.get("status")

    if not call_id or not status:
        raise HTTPException(status_code=400, detail="call_id and status required")

    from ..database import update_call_status
    if update_call_status(call_id, status):
        msg = {
            "type": "CALL_STATUS_UPDATED",
            "call_id": call_id,
            "status": status
        }
        await manager.broadcast_to_kitchen(msg)
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to update call status")


# --- 📆 5-3. 실시간 사전 예약 (Reservation) Endpoints ---
@router.post("/api/reservation/request")
async def request_reservation(data: Dict):
    customer_name = data.get("customer_name") or data.get("customerName")
    phone_number = data.get("phone_number") or data.get("phone")
    party_size_raw = data.get("party_size") or data.get("partySize") or 1
    reserved_time = data.get("reserved_time") or data.get("reservedTime")
    table_id = data.get("table_id") or data.get("tableId") or "T01"

    try:
        party_size = int(party_size_raw)
    except:
        party_size = 1

    if not customer_name or not phone_number or not reserved_time:
        raise HTTPException(status_code=400, detail="customer_name, phone_number, and reserved_time are required")

    reservation_id = f"RESV-{uuid.uuid4().hex[:4].upper()}"
    res_data = {
        "reservation_id": reservation_id,
        "customer_name": customer_name,
        "phone_number": phone_number,
        "party_size": party_size,
        "reserved_time": reserved_time,
        "table_id": table_id,
        "status": "requested"
    }

    from ..database import save_reservation
    if save_reservation(res_data):
        await manager.broadcast_to_kitchen({
            "type": "RESERVATION_UPDATED",
            "reservation_id": reservation_id,
            "status": "requested"
        })
        return res_data
    raise HTTPException(status_code=500, detail="Failed to save reservation")


@router.get("/api/reservation/active")
async def get_active_reservations_endpoint():
    from ..database import get_active_reservations
    return get_active_reservations()


@router.post("/api/reservation/status")
async def update_reservation_status_endpoint(data: Dict):
    reservation_id = data.get("reservation_id") or data.get("reservationId")
    status = data.get("status")

    if not reservation_id or not status:
        raise HTTPException(status_code=400, detail="reservation_id and status required")

    from ..database import update_reservation_status
    if update_reservation_status(reservation_id, status):
        await manager.broadcast_to_kitchen({
            "type": "RESERVATION_UPDATED",
            "reservation_id": reservation_id,
            "status": status
        })
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to update reservation status")


# --- 🚗 5-4. 원클릭 셀프 주차 할인 (Parking) Endpoints ---
@router.post("/api/parking/validate")
async def validate_parking(data: Dict):
    session_id = data.get("session_id") or data.get("sessionId")
    vehicle_number = data.get("vehicle_number") or data.get("vehicleNumber")
    discount_minutes = data.get("discount_minutes") or data.get("discountMinutes") or 120

    if not session_id or not vehicle_number:
        raise HTTPException(status_code=400, detail="session_id and vehicle_number are required")

    parking_id = f"PARK-{uuid.uuid4().hex[:4].upper()}"
    park_data = {
        "parking_id": parking_id,
        "session_id": session_id,
        "vehicle_number": vehicle_number,
        "discount_minutes": int(discount_minutes),
        "status": "applied",
        "timestamp": datetime.now().isoformat()
    }

    from ..database import save_parking, get_session_by_id
    session_info = get_session_by_id(session_id)
    store_id = (session_info.get("store_id") if session_info else None) or data.get("store_id") or data.get("storeId") or "Total"
    table_id_from_session = session_info.get("table_id") if session_info else None

    if save_parking(park_data):
        await manager.broadcast_to_kitchen({
            "type": "PARKING_APPLIED",
            "parking_id": parking_id,
            "session_id": session_id,
            "vehicle_number": vehicle_number,
            "status": "applied",
            "store_id": store_id,
            "table_id": table_id_from_session
        })
        return park_data
    raise HTTPException(status_code=500, detail="Failed to save parking registration")


@router.post("/api/parking/complete")
async def complete_parking_endpoint(data: Dict):
    parking_id = data.get("parking_id")
    if not parking_id:
        raise HTTPException(status_code=400, detail="parking_id required")
    from ..database import complete_parking
    if complete_parking(parking_id):
        await manager.broadcast_to_kitchen({
            "type": "PARKING_COMPLETED",
            "parking_id": parking_id,
        })
        return {"status": "ok", "parking_id": parking_id}
    raise HTTPException(status_code=500, detail="Failed to complete parking")

@router.get("/api/parking/session/{session_id}")
async def get_parking_by_session_endpoint(session_id: str):
    from ..database import get_parking_by_session
    parking = get_parking_by_session(session_id)
    return {"parking": parking}


@router.get("/api/parking/active")
async def get_active_parkings_endpoint(store_id: Optional[str] = None):
    from ..database import get_active_parkings_db
    return get_active_parkings_db(store_id)
