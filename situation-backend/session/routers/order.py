import uuid
from datetime import datetime
from typing import Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..state import manager
from ..models import OrderRequest, StatusUpdate
from ..database import (
    save_order, get_active_session, update_order_status,
    get_max_order_seq, get_store_use_kitchen, get_next_display_number
)

router = APIRouter()


@router.post("/api/order/direct")
async def process_order(order_req: OrderRequest):
    print(f"[Order Request] Table: {order_req.table_id}, Store: {order_req.store_id}, Price: {order_req.total_price}")

    # 0. 매장 ID 보정 (Total이거나 비어있으면 default_store 사용)
    effective_store_id = order_req.store_id
    if not effective_store_id or effective_store_id == "Total":
        effective_store_id = "default_store"

    # 1. 활성 세션 확인 (유연한 매칭)
    session = get_active_session(effective_store_id, order_req.table_id)

    # 만약 못 찾았다면, 혹시 다른 store_id(default_store 등)로 열려있는지 한 번 더 확인
    if not session:
        alt_store_id = "default_store" if effective_store_id != "default_store" else "Total"
        session = get_active_session(alt_store_id, order_req.table_id)
        if session:
            print(f"[Session Linked] Found active session in alternative store: {alt_store_id}")

    if not session:
        print(f"[Warning] No active session found for Table {order_req.table_id}. Creating new one...")
        from ..routers.session_routes import open_session_manually
        try:
            session = await open_session_manually({
                "store_id": effective_store_id,
                "table_id": order_req.table_id
            })
        except Exception as e:
            print(f"[Failed] Failed to create automatic session: {e}")
            session = {}

    session_dict = session if isinstance(session, dict) else {}
    session_id = str(session_dict.get('session_id') or 'SESS-NONE')
    table_id_val = str(session_dict.get('table_id') or order_req.table_id)
    store_id_val = str(session_dict.get('store_id') or effective_store_id)

    print(f"[Target Session] ID: {session_id} | Table: {table_id_val} | Store: {store_id_val}")

    # 2. 다음 차수 결정
    current_max_seq = get_max_order_seq(session_id)
    next_seq = current_max_seq + 1

    # 모바일 기기로부터 주문이 들어온 경우 중, 세션이 아직 PIN 미인증 상태인 경우
    is_mobile_order = order_req.device_id and order_req.device_id != "counter"
    
    # 세션의 pin_verified 상태 파싱
    import json
    raw_meta = session_dict.get('metadata') or {}
    try:
        metadata = json.loads(raw_meta) if isinstance(raw_meta, str) else dict(raw_meta)
    except Exception:
        metadata = {}
    pin_verified = metadata.get('pin_verified', False)

    # QR 선불 결제인 경우 (결제 상태가 paid인 경우) 승인번호 없이 자동 승인 처리
    if is_mobile_order and order_req.payment_status == "paid":
        pin_verified = True
        metadata["pin_verified"] = True
        session_dict["metadata"] = metadata
        from ..database import save_session
        save_session(session_dict)
        # 즉각 테이블 및 주방에 승인 신호 발송
        await manager.send_to_table(table_id_val, {"type": "SESSION_OPENED", "session": session_dict})
        await manager.broadcast_to_kitchen({"type": "SESSION_OPENED", "session": session_dict})

    # 3. 주문 객체 생성
    order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
    if order_req.payment_status == "pending":
        initial_status = "pending_payment"
    elif get_store_use_kitchen(store_id_val):
        initial_status = "cooking"
    else:
        initial_status = "ready"
        
    display_number = get_next_display_number(store_id_val)
    new_order = {
        "order_id": order_id,
        "session_id": session_id,
        "store_id": store_id_val,
        "table_id": table_id_val,
        "device_id": order_req.device_id,
        "items": [item.model_dump() for item in order_req.items],
        "total_price": order_req.total_price,
        "status": initial_status,
        "payment_status": order_req.payment_status,
        "payment_method": order_req.payment_method,
        "join_order": order_req.join_order,
        "order_seq": next_seq,
        "display_number": display_number,
        "timestamp": datetime.utcnow().isoformat() + 'Z',
        "metadata": order_req.metadata
    }

    # 4. DB 저장
    print(f"[Checkpoint 3] Saving Order {order_id} to Session {session_id}...")
    save_success = save_order(new_order)
    
    if not save_success:
        print(f"[Checkpoint 3 Failed] Could not save order to database. Aborting.")
        raise HTTPException(status_code=500, detail="Database save failed for order.")

    # 4-1. 포인트 처리 (metadata에 phone이 있는 경우 - 다중 매장 격리 연동)
    metadata = order_req.metadata or {}
    phone = metadata.get("phone")
    if phone:
        from ..database import update_customer_points, use_customer_points
        # 기본 0.1% 적립
        pts = int(order_req.total_price * 0.001)
        update_customer_points(phone, pts, effective_store_id)
        print(f"[Checkpoint 4] Accumulated {pts}P for {phone} under Store {effective_store_id}")

        # 사용한 포인트 차감 처리
        use_pts = int(metadata.get("usePoints") or metadata.get("use_points") or 0)
        if use_pts > 0:
            use_customer_points(phone, use_pts, effective_store_id)
            print(f"[Checkpoint 4] Deducted {use_pts}P used points for {phone} under Store {effective_store_id}")

        # 주방/카운터에 실시간 포인트 적립 브로드캐스트 전송
        await manager.broadcast_to_kitchen({
            "type": "POINTS_UPDATED",
            "phone": phone,
            "points": pts,
            "store_id": effective_store_id
        })

    print(f"[Checkpoint 5] Order Saved Successfully: {order_id}")

    # 5. 주방에 알림 전송 (PIN 인증 완료 상태 또는 카운터 주문일 때만 즉각 전송)
    if initial_status != "waiting_pin":
        await manager.broadcast_to_kitchen({
            "type": "NEW_ORDER",
            "order": new_order
        })
        print(f"[Checkpoint 6] Broadcast NEW_ORDER sent to kitchen monitors.")
    else:
        print(f"[Checkpoint 6 Bypassed] Waiting for PIN verification. NEW_ORDER broadcast postponed.")

    return {"status": "success", "order_id": order_id, "order_seq": next_seq}


@router.post("/api/order/update-items")
async def update_items(data: Dict):
    order_id = data.get("order_id")
    items = data.get("items")
    if not order_id or items is None:
        raise HTTPException(status_code=400, detail="order_id and items required")

    total_price = sum(item.get("price", 0) * (item.get("quantity") or item.get("qty", 0)) for item in items)

    from ..database import update_order_items
    success = update_order_items(order_id, items, total_price)
    if success:
        # 주방/카운터에 업데이트 알림 전송 (필요시)
        await manager.broadcast_to_kitchen({"type": "ORDER_UPDATED", "order_id": order_id, "items": items, "total_price": total_price})
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Update failed")


@router.post("/api/order/status")
async def update_status(update: StatusUpdate):
    from ..database import get_order_by_id
    success = update_order_status(update.order_id, update.status)
    if success:
        order = get_order_by_id(update.order_id)
        store_id = order.get("store_id", "") if order else ""
        table_id = order.get("table_id", "") if order else ""
        msg = {
            "type": "STATUS_UPDATE",
            "order_id": update.order_id,
            "status": update.status,
            "store_id": store_id,
            "table_id": table_id,
        }
        await manager.broadcast_to_kitchen(msg)
        return {"status": "success"}
    return {"status": "failed"}


class PaymentStatusUpdate(BaseModel):
    order_id: str
    payment_status: str

@router.post("/api/order/payment-status")
async def update_payment_status(update: PaymentStatusUpdate):
    from ..database import update_order_payment_status, get_order_by_id
    order = get_order_by_id(update.order_id)
    success = update_order_payment_status(update.order_id, update.payment_status)
    if success:
        if update.payment_status == "paid" and order:
            from .payment import trigger_cash_receipt_if_requested
            await trigger_cash_receipt_if_requested(order)
            
        store_id = order.get("store_id", "") if order else ""
        table_id = order.get("table_id", "") if order else ""
        # You can also broadcast a PAYMENT_CONFIRMED message here so counter/kitchen updates
        msg = {
            "type": "PAYMENT_CONFIRMED",
            "order_id": update.order_id,
            "payment_status": update.payment_status,
            "store_id": store_id,
            "table_id": table_id,
        }
        await manager.broadcast_to_kitchen(msg)
        return {"status": "success"}
    return {"status": "failed"}
