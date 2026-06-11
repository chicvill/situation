import os
import base64
from typing import Dict, Optional
from fastapi import APIRouter, HTTPException, Request
import httpx  # type: ignore
from ..state import manager
from ..database import (
    update_order_status, update_order_payment_status,
    update_order_payment_key, get_order_by_id, get_store_use_kitchen,
)

router = APIRouter()


@router.post("/api/payment/confirm")
async def confirm_payment(data: Dict):
    """토스 페이먼츠 결제 승인 후 처리"""
    order_id = data.get("orderId")
    amount = data.get("amount")
    payment_key = data.get("paymentKey")

    print(f"[Payment Confirm] Order: {order_id}, Amount: {amount}, Key: {payment_key[:8] + '...' if payment_key else 'None'}")

    if not order_id or not isinstance(order_id, str):
        raise HTTPException(status_code=400, detail="orderId is required and must be a string")
    if not payment_key:
        raise HTTPException(status_code=400, detail="paymentKey is required")
    if amount is None:
        raise HTTPException(status_code=400, detail="amount is required")

    # Dutch Pay Split Payment 처리
    if order_id.startswith("dutch_"):
        parts = order_id.split("_")
        if len(parts) < 2:
            raise HTTPException(status_code=400, detail="Invalid dutch payment order ID format")
        session_id = parts[1]
        
        from ..database import get_session_by_id, add_dutch_payment, get_orders_by_session
        session = get_session_by_id(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
            
        splits = session.get("splits")
        if isinstance(splits, str):
            import json
            splits = json.loads(splits)
            
        if not isinstance(splits, dict):
            raise HTTPException(status_code=400, detail="더치페이가 초기화되지 않은 세션입니다")
            
        total_price = splits.get("total_price", 0)
        paid_items = splits.get("paid_items", [])
        total_paid = sum(x.get("amount", 0) for x in paid_items)
        remaining = total_price - total_paid
        
        if int(amount) > remaining:
            raise HTTPException(status_code=400, detail=f"결제 금액이 잔액({remaining}원)을 초과합니다")
            
        # Toss Payments 서버 승인
        toss_secret_key = os.getenv("TOSS_SECRET_KEY") or os.getenv("VITE_TOSS_SECRET_KEY", "")
        if toss_secret_key and not payment_key.startswith("test-"):
            import base64
            auth = base64.b64encode(f"{toss_secret_key}:".encode()).decode()
            try:
                async with httpx.AsyncClient() as client:
                    res = await client.post(
                        "https://api.tosspayments.com/v1/payments/confirm",
                        headers={"Authorization": f"Basic {auth}", "Content-Type": "application/json"},
                        json={"paymentKey": payment_key, "orderId": order_id, "amount": int(amount)},
                    )
                if res.status_code != 200:
                    error_data = res.json()
                    print(f"[Toss Confirm Failed] {error_data}")
                    raise HTTPException(status_code=400, detail=f"Toss 결제 승인 실패: {error_data.get('message', '알 수 없는 오류')}")
                print(f"[Toss Confirm OK] Dutch Order: {order_id}")
            except httpx.RequestError as e:
                raise HTTPException(status_code=503, detail=f"Toss API 연결 실패: {e}")
        else:
            print(f"[Payment Confirm] TOSS_SECRET_KEY 미설정 — Toss 서버 승인 생략 (개발 모드)")

        # splits 테이블 결제 내역 추가
        is_completed, updated_splits = add_dutch_payment(session_id, int(amount), "web", payment_key)
        
        store_id = session.get("store_id", "default_store")
        table_id = session.get("table_id")
        
        # MQTT 브로드캐스트
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
        
        if is_completed:
            print(f"[Dutch Completed via Confirm] Session: {session_id} - Elevating unpaid orders to paid")
            orders = get_orders_by_session(session_id)
            use_kitchen = get_store_use_kitchen(store_id)
            post_payment_status = "cooking" if use_kitchen else "ready"
            
            for order in orders:
                oid = order.get("order_id")
                if order.get("payment_status") != "paid" and order.get("status") != "cancelled":
                    update_order_payment_status(oid, "paid")
                    update_order_status(oid, post_payment_status)
                    update_order_payment_key(oid, payment_key)
                    
                    msg_confirmed = {"type": "PAYMENT_CONFIRMED", "order_id": oid, "status": "paid", "store_id": store_id}
                    await manager.broadcast_to_kitchen(msg_confirmed)
                    
                    msg_update = {
                        "type": "STATUS_UPDATE",
                        "order_id": oid,
                        "status": post_payment_status,
                        "payment_status": "paid",
                        "store_id": store_id
                    }
                    await manager.broadcast_to_kitchen(msg_update)
                    
                    updated_order = get_order_by_id(oid)
                    if updated_order:
                        await manager.broadcast_to_kitchen({
                            "type": "NEW_ORDER",
                            "order": updated_order,
                            "store_id": store_id
                        })
            
            completion_payload = {
                "type": "DUTCH_COMPLETED",
                "session_id": session_id,
                "store_id": store_id,
                "table_id": table_id
            }
            if table_id:
                await manager.send_to_table(table_id, completion_payload)
            await manager.broadcast_to_kitchen(completion_payload)
            
        return {"status": "success", "order_id": order_id, "dutch": True}

    # 1. DB의 실제 주문 금액과 클라이언트가 보낸 금액 비교 (금액 위조 방지)
    order = get_order_by_id(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다")
    expected_amount = order.get("total_price", 0)
    if int(amount) != int(expected_amount):
        print(f"[Payment Tamper] Order: {order_id}, Expected: {expected_amount}, Got: {amount}")
        raise HTTPException(status_code=400, detail=f"결제 금액 불일치 (예상: {expected_amount}원)")

    # 2. Toss Payments 서버 측 결제 승인 API 호출 (실제 결제 확정)
    toss_secret_key = os.getenv("TOSS_SECRET_KEY") or os.getenv("VITE_TOSS_SECRET_KEY", "")
    if toss_secret_key and not payment_key.startswith("test-"):
        auth = base64.b64encode(f"{toss_secret_key}:".encode()).decode()
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    "https://api.tosspayments.com/v1/payments/confirm",
                    headers={"Authorization": f"Basic {auth}", "Content-Type": "application/json"},
                    json={"paymentKey": payment_key, "orderId": order_id, "amount": int(expected_amount)},
                )
            if res.status_code != 200:
                error_data = res.json()
                print(f"[Toss Confirm Failed] {error_data}")
                raise HTTPException(status_code=400, detail=f"Toss 결제 승인 실패: {error_data.get('message', '알 수 없는 오류')}")
            print(f"[Toss Confirm OK] Order: {order_id}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Toss API 연결 실패: {e}")
    else:
        # 시크릿 키 미설정 시 (개발/테스트 환경) 경고만 출력
        print(f"[Payment Confirm] TOSS_SECRET_KEY 미설정 — Toss 서버 승인 생략 (개발 모드)")

    # 3. DB 상태 업데이트
    store_id = order.get("store_id", "")
    use_kitchen = get_store_use_kitchen(store_id)
    post_payment_status = "cooking" if use_kitchen else "ready"

    update_order_payment_status(order_id, "paid")
    update_order_status(order_id, post_payment_status)

    if update_order_payment_key(order_id, payment_key):
        print(f"[Payment Key Saved] {order_id}")
    else:
        print(f"Failed to save payment_key: {order_id}")

    # 선불 결제 승인 성공 시, 세션의 pin_verified 상태를 True로 즉각 활성화 (추가 주문 시 인증번호 생략을 위함)
    session_id = order.get("session_id")
    if session_id:
        import json
        from ..database import get_session_by_id, save_session
        session_dict = get_session_by_id(session_id)
        if session_dict:
            raw_meta = session_dict.get("metadata") or {}
            try:
                metadata = json.loads(raw_meta) if isinstance(raw_meta, str) else dict(raw_meta)
            except Exception:
                metadata = {}
            metadata["pin_verified"] = True
            session_dict["metadata"] = metadata
            save_session(session_dict)
            # 즉각 테이블 및 주방에 승인 신호 발송해 모바일 안전인증 락 해제
            await manager.send_to_table(session_dict.get("table_id"), {"type": "SESSION_OPENED", "session": session_dict})
            await manager.broadcast_to_kitchen({"type": "SESSION_OPENED", "session": session_dict})

    # 주방 및 테이블에 결제 완료 알림 전송
    msg_confirmed = {"type": "PAYMENT_CONFIRMED", "order_id": order_id, "status": "paid"}
    await manager.broadcast_to_kitchen(msg_confirmed)

    msg_update = {"type": "STATUS_UPDATE", "order_id": order_id, "status": post_payment_status, "payment_status": "paid"}
    await manager.broadcast_to_kitchen(msg_update)

    return {"status": "success", "order_id": order_id}


@router.post("/api/payment/cancel")
async def cancel_payment(data: Dict):
    """선불 결제 취소 / 환불 처리 (PayApp API)"""
    order_id = data.get("order_id")
    cancel_reason = data.get("cancel_reason", "고객 요청 취소")

    if not order_id:
        raise HTTPException(status_code=400, detail="order_id required")

    order = get_order_by_id(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다")

    payment_key = order.get("payment_key")
    total_price = order.get("total_price", 0)
    payment_status = order.get("payment_status", "unpaid")
    order_status = order.get("status", "")

    # 1. 중복 취소 차단 (Idempotency 보장)
    if order_status == 'cancelled' or payment_status == 'refunded':
        return {"status": "success", "refund": False, "message": "이미 취소 및 환불 처리가 완료된 주문입니다."}

    if not payment_key:
        # paymentKey가 없으면 (현금/후불 등) 상태만 취소로 변경
        update_order_status(order_id, 'cancelled')
        return {"status": "cancelled", "refund": False, "message": "결제 키 없음 - 상태만 취소 완료"}

    # PayApp 취소 API 호출
    payapp_userid = os.getenv("PAYAPP_USERID") or "payapp_test_id"
    payapp_linkkey = os.getenv("PAYAPP_LINKKEY") or "test_linkkey"

    # 테스트 아이디이거나 테스트 키로 시작하는 결제건은 API 호출 생략 (개발/시뮬레이션 우회)
    if payapp_userid == "payapp_test_id" or payment_key.startswith("test-") or payment_key == "payapp_completed":
        store_id = order.get("store_id", "")
        update_order_status(order_id, 'cancelled')
        update_order_payment_status(order_id, 'refunded')
        await manager.broadcast_to_kitchen({
            "type": "STATUS_UPDATE",
            "order_id": order_id,
            "status": "cancelled",
            "payment_status": "refunded",
            "store_id": store_id
        })
        print(f"[PayApp Refund Bypass] 테스트 환경 -- 페이앱 API 호출 생략 (상태만 취소 완료)")
        return {"status": "success", "refund": True, "amount": total_price, "message": f"{total_price:,}원 환불 완료 (테스트)"}

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                "https://api.payapp.kr/oapi/apiLoad.html",
                data={
                    "cmd": "paycancel",
                    "userid": payapp_userid,
                    "linkkey": payapp_linkkey,
                    "mul_no": payment_key,
                    "cancelmemo": cancel_reason
                }
            )

        if res.status_code == 200:
            import urllib.parse
            parsed_res = dict(urllib.parse.parse_qsl(res.text))
            
            if parsed_res.get("state") == "1":
                store_id = order.get("store_id", "")
                update_order_status(order_id, 'cancelled')
                update_order_payment_status(order_id, 'refunded')
                await manager.broadcast_to_kitchen({
                    "type": "STATUS_UPDATE",
                    "order_id": order_id,
                    "status": "cancelled",
                    "payment_status": "refunded",
                    "store_id": store_id
                })
                print(f"[Refund Success] Order: {order_id}, Amount: {total_price}")
                return {"status": "success", "refund": True, "amount": total_price, "message": f"{total_price:,}원 환불 완료"}
            else:
                error_msg = parsed_res.get("errorMessage", "알 수 없는 오류")
                print(f"[Refund Failed] {error_msg}")
                raise HTTPException(status_code=400, detail=f"페이앱 환불 실패: {error_msg}")
        else:
            raise HTTPException(status_code=res.status_code, detail="페이앱 API 연결 실패")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"페이앱 API 연결 실패: {e}")


@router.get("/api/points/list")
async def get_points_list_endpoint(store_id: Optional[str] = None):
    from ..database import get_points_list_db
    return get_points_list_db(store_id)


@router.get("/api/points/{phone}")
async def get_points(phone: str, store_id: str = 'store-1'):
    from ..database import get_customer_points
    data = get_customer_points(phone, store_id)
    return {"phone": phone, "store_id": store_id, **data}


@router.post("/api/points/use")
async def use_points(data: Dict):
    from ..database import use_customer_points
    phone = data.get("phone", "")
    points = data.get("points", 0)
    store_id = data.get("store_id", "store-1")
    if not phone or points <= 0:
        raise HTTPException(status_code=400, detail="phone and positive points required")
    ok = use_customer_points(phone, int(points), store_id)
    if not ok:
        raise HTTPException(status_code=400, detail="포인트가 부족하거나 사용 처리에 실패했습니다.")
    return {"status": "ok", "used": points}


@router.get("/api/config/toss-key")
async def get_toss_key():
    """프론트엔드에 토스 클라이언트 키 전달 (동적 로딩용)"""
    key = os.getenv("VITE_TOSS_CLIENT_KEY") or os.getenv("TOSS_CLIENT_KEY") or "test_ck_D5b4Zne68wxL1Pn6k0m8rlzYWBn1"
    masked_key = f"{key[:8]}...{key[-4:]}" if key else "None"
    print(f"[Config] Serving Toss Client Key: {masked_key}")
    return {"clientKey": key}


@router.post("/api/payment/request-phone-to-phone")
async def request_phone_to_phone(data: Dict):
    """점장이 카운터폰/패드에서 손님 폰으로 원격 결제 요청 전송 (폰 to 폰)"""
    session_id = data.get("session_id")
    order_id = data.get("order_id")
    amount = data.get("amount")
    
    if not session_id or not amount:
        raise HTTPException(status_code=400, detail="session_id and amount required")
        
    from ..database import get_session_by_id
    session = get_session_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
        
    table_id = session.get("table_id")
    store_id = session.get("store_id") or "default_store"
    
    payload = {
        "type": "PHONE_TO_PHONE_PAY_REQUEST",
        "session_id": session_id,
        "order_id": order_id,
        "amount": amount,
        "store_id": store_id,
        "table_id": table_id
    }
    
    # 해당 테이블 기기로 실시간 결제 요청 전송
    await manager.send_to_table(table_id, payload)
    
    return {"status": "success", "message": "결제 요청이 손님 휴대폰으로 전송되었습니다."}


@router.get("/api/payment/config/payapp")
async def get_payapp_config():
    """프론트엔드에 페이앱 판매자 아이디 전달"""
    userid = os.getenv("PAYAPP_USERID") or "payapp_test_id"
    return {"userid": userid}


@router.get("/api/payment/status/{order_id}")
async def get_payment_status(order_id: str):
    """주문의 현재 결제 상태 조회 (폴링 검증용)"""
    order = get_order_by_id(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다")
    return {"order_id": order_id, "payment_status": order.get("payment_status")}


@router.post("/api/payment/payapp/feedback")
async def payapp_feedback(request: Request):
    """페이앱 결제 결과 피드백(웹노티) 수신 및 검증 처리"""
    form_data = await request.form()
    userid = form_data.get("userid")
    linkkey = form_data.get("linkkey")
    linkval = form_data.get("linkval")
    price = form_data.get("price")
    pay_state = form_data.get("pay_state")
    order_id = form_data.get("var1")
    mul_no = form_data.get("mul_no")

    print(f"[PayApp Webhook Received] Order: {order_id}, Price: {price}, State: {pay_state}, Transaction: {mul_no}")

    # 1. 보안 검증 (linkval 검증)
    payapp_linkval = os.getenv("PAYAPP_LINKVAL") or "test_linkval"
    # 테스트 ID인 경우 검증을 우회하여 테스트를 용이하게 합니다.
    if userid != "payapp_test_id" and linkval != payapp_linkval:
        print(f"[PayApp Validation Failed] linkval mismatch. Expected: {payapp_linkval}, Got: {linkval}")
        raise HTTPException(status_code=400, detail="Invalid linkval verification")

    if not order_id:
        raise HTTPException(status_code=400, detail="Missing order_id (var1)")

    # 2. 결제 완료 상태(pay_state == 4) 처리
    if str(pay_state) == "4":
        # Dutch Pay Split Payment 처리
        if order_id.startswith("dutch_"):
            parts = order_id.split("_")
            if len(parts) >= 2:
                session_id = parts[1]
                
                from ..database import get_session_by_id, add_dutch_payment, get_orders_by_session
                session = get_session_by_id(session_id)
                if session:
                    splits = session.get("splits")
                    if isinstance(splits, str):
                        import json
                        splits = json.loads(splits)
                        
                    if isinstance(splits, dict):
                        total_price = splits.get("total_price", 0)
                        paid_items = splits.get("paid_items", [])
                        total_paid = sum(x.get("amount", 0) for x in paid_items)
                        remaining = total_price - total_paid
                        
                        # splits 테이블 결제 내역 추가
                        is_completed, updated_splits = add_dutch_payment(session_id, int(price), "web", str(mul_no))
                        
                        store_id = session.get("store_id", "default_store")
                        table_id = session.get("table_id")
                        
                        # MQTT 브로드캐스트
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
                        
                        if is_completed:
                            print(f"[Dutch Completed via PayApp Callback] Session: {session_id}")
                            orders = get_orders_by_session(session_id)
                            use_kitchen = get_store_use_kitchen(store_id)
                            post_payment_status = "cooking" if use_kitchen else "ready"
                            
                            for order in orders:
                                oid = order.get("order_id")
                                if order.get("payment_status") != "paid" and order.get("status") != "cancelled":
                                    update_order_payment_status(oid, "paid")
                                    update_order_status(oid, post_payment_status)
                                    update_order_payment_key(oid, str(mul_no))
                                    
                                    msg_confirmed = {"type": "PAYMENT_CONFIRMED", "order_id": oid, "status": "paid", "store_id": store_id}
                                    await manager.broadcast_to_kitchen(msg_confirmed)
                                    
                                    msg_update = {
                                        "type": "STATUS_UPDATE",
                                        "order_id": oid,
                                        "status": post_payment_status,
                                        "payment_status": "paid",
                                        "store_id": store_id
                                    }
                                    await manager.broadcast_to_kitchen(msg_update)
                                    
                                    updated_order = get_order_by_id(oid)
                                    if updated_order:
                                        await manager.broadcast_to_kitchen({
                                            "type": "NEW_ORDER",
                                            "order": updated_order,
                                            "store_id": store_id
                                        })
                            
                            completion_payload = {
                                "type": "DUTCH_COMPLETED",
                                "session_id": session_id,
                                "store_id": store_id,
                                "table_id": table_id
                            }
                            if table_id:
                                await manager.send_to_table(table_id, completion_payload)
                            await manager.broadcast_to_kitchen(completion_payload)

        else:
            # 일반 주문 처리
            order = get_order_by_id(order_id)
            if not order:
                print(f"[PayApp Callback Error] Order {order_id} not found in DB")
                from fastapi.responses import PlainTextResponse
                return PlainTextResponse("SUCCESS")

            # 금액 검증 (테스트 가맹점 ID인 경우 우회)
            expected_amount = order.get("total_price", 0)
            if userid != "payapp_test_id" and int(price) != int(expected_amount):
                print(f"[PayApp Callback Error] Price mismatch: Expected {expected_amount}, Got {price}")
                raise HTTPException(status_code=400, detail="Price mismatch")

            store_id = order.get("store_id", "")
            use_kitchen = get_store_use_kitchen(store_id)
            post_payment_status = "cooking" if use_kitchen else "ready"

            update_order_payment_status(order_id, "paid")
            update_order_status(order_id, post_payment_status)
            update_order_payment_key(order_id, str(mul_no))

            # 선불 결제 승인 성공 시, 세션의 pin_verified 상태를 True로 즉각 활성화
            session_id = order.get("session_id")
            if session_id:
                import json
                from ..database import get_session_by_id, save_session
                session_dict = get_session_by_id(session_id)
                if session_dict:
                    raw_meta = session_dict.get("metadata") or {}
                    try:
                        metadata = json.loads(raw_meta) if isinstance(raw_meta, str) else dict(raw_meta)
                    except Exception:
                        metadata = {}
                    metadata["pin_verified"] = True
                    session_dict["metadata"] = metadata
                    save_session(session_dict)
                    await manager.send_to_table(session_dict.get("table_id"), {"type": "SESSION_OPENED", "session": session_dict})
                    await manager.broadcast_to_kitchen({"type": "SESSION_OPENED", "session": session_dict})

            # 주방 및 테이블에 알림 전송
            msg_confirmed = {"type": "PAYMENT_CONFIRMED", "order_id": order_id, "status": "paid", "store_id": store_id}
            await manager.broadcast_to_kitchen(msg_confirmed)

            msg_update = {"type": "STATUS_UPDATE", "order_id": order_id, "status": post_payment_status, "payment_status": "paid", "store_id": store_id}
            await manager.broadcast_to_kitchen(msg_update)

            # 새 주문 알림을 주방에 전달
            updated_order = get_order_by_id(order_id)
            if updated_order:
                await manager.broadcast_to_kitchen({
                    "type": "NEW_ORDER",
                    "order": updated_order,
                    "store_id": store_id
                })

    elif str(pay_state) in ("9", "64"):
        # 승인 취소 처리
        if not order_id.startswith("dutch_"):
            order = get_order_by_id(order_id)
            store_id = order.get("store_id", "") if order else ""
            update_order_status(order_id, 'cancelled')
            update_order_payment_status(order_id, 'refunded')
            await manager.broadcast_to_kitchen({"type": "STATUS_UPDATE", "order_id": order_id, "status": "cancelled", "payment_status": "refunded", "store_id": store_id})

    # 페이앱 웹노티는 반드시 SUCCESS라는 문자열(PlainText)을 반환해야 처리가 완료됩니다.
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse("SUCCESS")


async def register_payapp_cash_receipt(phone: str, total_price: int, order_id: str, good_name: str):
    """페이앱 API를 호출하여 현금영수증을 자동 발행합니다."""
    userid = os.getenv("PAYAPP_USERID") or "payapp_test_id"
    linkkey = os.getenv("PAYAPP_LINKKEY") or "test_linkkey"

    print(f"[PayApp Cash Receipt Request] Phone: {phone}, Price: {total_price}, Order: {order_id}, Good: {good_name}")

    if userid == "payapp_test_id":
        print(f"[PayApp Cash Receipt Bypass] 테스트 환경 -- 현금영수증 등록 생략 (가상 완료)")
        return {"status": "success", "message": "현금영수증 발행 완료 (테스트)"}

    # 세부 세금 계산 (VAT 10% 가정)
    amt_tax = int(round(total_price / 11.0))
    amt_sup = total_price - amt_tax
    amt_svc = 0

    payload = {
        "cmd": "cashStRegist",
        "userid": userid,
        "linkkey": linkkey,
        "good_name": good_name,
        "buyr_name": "고객",
        "id_info": phone.replace("-", "").strip(),  # 하이픈 제거한 숫자만
        "buyr_tel1": phone.strip(),
        "amt_tot": total_price,
        "amt_sup": amt_sup,
        "amt_svc": amt_svc,
        "amt_tax": amt_tax,
    }

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                "https://api.payapp.kr/oapi/apiLoad.html",
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
        
        if res.status_code == 200:
            from urllib.parse import parse_qs
            res_data = parse_qs(res.text)
            state = res_data.get("state", ["0"])[0]
            error_message = res_data.get("errorMessage", [""])[0]
            errno = res_data.get("errno", [""])[0]
            
            if state == "1":
                print(f"[PayApp Cash Receipt Success] Order: {order_id}, Receipt No: {res_data.get('cash_no', ['None'])[0]}")
                return {"status": "success", "cash_no": res_data.get("cash_no", [""])[0]}
            else:
                print(f"[PayApp Cash Receipt Failed] Order: {order_id}, Error: {error_message} (code: {errno})")
                return {"status": "failed", "message": error_message, "code": errno}
        else:
            print(f"[PayApp Cash Receipt Failed] HTTP error status: {res.status_code}")
            return {"status": "failed", "message": f"HTTP status {res.status_code}"}
    except Exception as e:
        print(f"[PayApp Cash Receipt Error] Request failed: {e}")
        return {"status": "error", "message": str(e)}


async def trigger_cash_receipt_if_requested(order: dict):
    """주문에 현금영수증 발행이 요청된 경우 페이앱 API를 호출하여 등록합니다."""
    if not order:
        return

    raw_meta = order.get("metadata") or {}
    try:
        import json
        metadata = json.loads(raw_meta) if isinstance(raw_meta, str) else dict(raw_meta)
    except Exception:
        metadata = {}

    if metadata.get("requestCashReceipt") is True:
        phone = metadata.get("phone")
        total_price = order.get("total_price", 0)
        
        # 현금성 결제 방식 체크
        method = order.get("payment_method", "") or ""
        is_cash_like = any(keyword in method for keyword in ["현금", "계좌이체", "transfer", "cash", "직원방문"])
        
        if phone and total_price > 0 and is_cash_like:
            items = order.get("items", [])
            if isinstance(items, str):
                try:
                    items = json.loads(items)
                except Exception:
                    items = []
            
            good_name = "식음료"
            if items and isinstance(items, list):
                first_item = items[0].get("name", "상품")
                count = len(items)
                good_name = f"{first_item} 외 {count-1}건" if count > 1 else first_item

            # 비동기로 현금영수증 발행 API 호출
            import asyncio
            asyncio.create_task(register_payapp_cash_receipt(phone, total_price, order["order_id"], good_name))
