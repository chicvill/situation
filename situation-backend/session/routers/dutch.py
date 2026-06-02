import json
from datetime import datetime
from typing import Dict
from fastapi import APIRouter, HTTPException
from ..state import manager
from ..database import (
    get_session_by_id,
    get_order_by_id,
    init_dutch_splits,
    add_dutch_payment,
    update_order_payment_status,
    update_order_status,
    update_order_payment_key,
    get_store_use_kitchen,
)

router = APIRouter()


@router.post("/api/dutch/create")
async def create_dutch_pay(data: Dict):
    """더치페이 정산 세션 초기화"""
    session_id = data.get("session_id")
    total_price = data.get("total_price")
    split_count = data.get("split_count")

    print(f"[Dutch Create] Session: {session_id}, Total: {total_price}, Splits: {split_count}")

    if not session_id or total_price is None or split_count is None:
        raise HTTPException(status_code=400, detail="session_id, total_price, and split_count are required")

    success = init_dutch_splits(session_id, int(total_price), int(split_count))
    if not success:
        raise HTTPException(status_code=500, detail="더치페이 설정 저장에 실패했습니다")

    session = get_session_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

    # 실시간 브로드캐스트 전송
    store_id = session.get("store_id") or "default_store"
    table_id = session.get("table_id")
    
    payload = {
        "type": "DUTCH_CREATED",
        "session_id": session_id,
        "splits": session.get("splits"),
        "store_id": store_id,
        "table_id": table_id
    }
    
    if table_id:
        await manager.send_to_table(table_id, payload)
    await manager.broadcast_to_kitchen(payload)

    return {"status": "success", "splits": session.get("splits")}


@router.get("/api/dutch/{session_id}")
async def get_dutch_pay(session_id: str):
    """더치페이 진행현황 조회"""
    session = get_session_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    
    splits = session.get("splits")
    if not splits or not isinstance(splits, dict):
        splits = {
            "total_price": 0,
            "split_count": 1,
            "split_amount": 0,
            "paid_items": []
        }
        
    return {
        "session_id": session_id,
        "table_id": session.get("table_id"),
        "store_id": session.get("store_id"),
        "splits": splits
    }


@router.post("/api/dutch/pay")
async def pay_dutch_slice(data: Dict):
    """동행자 개별 몫 분할 결제 처리"""
    session_id = data.get("session_id")
    amount = data.get("amount")
    device_id = data.get("device_id") or ""
    payment_key = data.get("payment_key")
    
    print(f"[Dutch Pay Slice] Session: {session_id}, Amount: {amount}, Key: {payment_key[:8] if payment_key else 'None'}")
    
    if not session_id or amount is None or not payment_key:
        raise HTTPException(status_code=400, detail="session_id, amount, and payment_key are required")
        
    session = get_session_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
        
    # splits JSONB 필드에 결제 정보 추가
    is_completed, updated_splits = add_dutch_payment(session_id, int(amount), device_id, payment_key)
    
    store_id = session.get("store_id", "default_store")
    table_id = session.get("table_id")
    
    payload = {
        "type": "DUTCH_PAYMENT_UPDATE",
        "session_id": session_id,
        "store_id": store_id,
        "table_id": table_id,
        "splits": updated_splits,
        "is_completed": is_completed
    }
    
    if table_id:
        await manager.send_to_table(table_id, payload)
    await manager.broadcast_to_kitchen(payload)
    
    # 전액 정산 완결 시 주문 승격 (unpaid -> paid)
    if is_completed:
        print(f"🎉 [Dutch Completed] Session: {session_id} - Elevating unpaid orders to paid")
        from ..database import get_orders_by_session
        orders = get_orders_by_session(session_id)
        
        use_kitchen = get_store_use_kitchen(store_id)
        post_payment_status = "cooking" if use_kitchen else "ready"
        
        elevated_count = 0
        for order in orders:
            order_id = order.get("order_id")
            if order.get("payment_status") != "paid" and order.get("status") != "cancelled":
                update_order_payment_status(order_id, "paid")
                update_order_status(order_id, post_payment_status)
                update_order_payment_key(order_id, payment_key)
                
                # 주방/카운터에 결제 확인 알림 발행
                msg_confirmed = {"type": "PAYMENT_CONFIRMED", "order_id": order_id, "status": "paid", "store_id": store_id}
                await manager.broadcast_to_kitchen(msg_confirmed)
                
                msg_update = {
                    "type": "STATUS_UPDATE",
                    "order_id": order_id,
                    "status": post_payment_status,
                    "payment_status": "paid",
                    "store_id": store_id
                }
                await manager.broadcast_to_kitchen(msg_update)
                
                # 신규 주문 알림 발행 (New Order sound, display 등 연동)
                updated_order = get_order_by_id(order_id)
                if updated_order:
                    await manager.broadcast_to_kitchen({
                        "type": "NEW_ORDER",
                        "order": updated_order,
                        "store_id": store_id
                    })
                elevated_count += 1
                
        print(f"✅ [Dutch Completed] Elevated {elevated_count} orders to paid.")
        
        # 최종 정산 완료 신호 브로드캐스트
        completion_payload = {
            "type": "DUTCH_COMPLETED",
            "session_id": session_id,
            "store_id": store_id,
            "table_id": table_id
        }
        if table_id:
            await manager.send_to_table(table_id, completion_payload)
        await manager.broadcast_to_kitchen(completion_payload)

    return {"status": "success", "is_completed": is_completed, "splits": updated_splits}
