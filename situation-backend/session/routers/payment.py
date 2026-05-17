import os
import base64
from typing import Dict, Optional
from fastapi import APIRouter, HTTPException
import httpx  # type: ignore
from ..state import manager
from ..database import (
    update_order_status, update_order_payment_status,
    update_order_payment_key, get_order_by_id,
)

router = APIRouter()


@router.post("/api/payment/confirm")
async def confirm_payment(data: Dict):
    """토스 페이먼츠 결제 승인 후 처리"""
    order_id = data.get("orderId")
    amount = data.get("amount")
    payment_key = data.get("paymentKey")

    print(f"💰 [Payment Confirm] Order: {order_id}, Amount: {amount}, Key: {payment_key[:8] + '...' if payment_key else 'None'}")

    if not order_id or not isinstance(order_id, str):
        raise HTTPException(status_code=400, detail="orderId is required and must be a string")
    if not payment_key:
        raise HTTPException(status_code=400, detail="paymentKey is required")
    if amount is None:
        raise HTTPException(status_code=400, detail="amount is required")

    # 1. DB의 실제 주문 금액과 클라이언트가 보낸 금액 비교 (금액 위조 방지)
    order = get_order_by_id(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다")
    expected_amount = order.get("total_price", 0)
    if int(amount) != int(expected_amount):
        print(f"🚨 [Payment Tamper] Order: {order_id}, Expected: {expected_amount}, Got: {amount}")
        raise HTTPException(status_code=400, detail=f"결제 금액 불일치 (예상: {expected_amount}원)")

    # 2. Toss Payments 서버 측 결제 승인 API 호출 (실제 결제 확정)
    toss_secret_key = os.getenv("TOSS_SECRET_KEY") or os.getenv("VITE_TOSS_SECRET_KEY", "")
    if toss_secret_key:
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
                print(f"❌ [Toss Confirm Failed] {error_data}")
                raise HTTPException(status_code=400, detail=f"Toss 결제 승인 실패: {error_data.get('message', '알 수 없는 오류')}")
            print(f"✅ [Toss Confirm OK] Order: {order_id}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Toss API 연결 실패: {e}")
    else:
        # 시크릿 키 미설정 시 (개발/테스트 환경) 경고만 출력
        print(f"⚠️ [Payment Confirm] TOSS_SECRET_KEY 미설정 — Toss 서버 승인 생략 (개발 모드)")

    # 3. DB 상태 업데이트
    update_order_payment_status(order_id, "paid")
    update_order_status(order_id, "cooking")

    if update_order_payment_key(order_id, payment_key):
        print(f"🔑 [Payment Key Saved] {order_id}")
    else:
        print(f"⚠️ Failed to save payment_key: {order_id}")

    # 주방 및 테이블에 결제 완료 알림 전송
    msg_confirmed = {"type": "PAYMENT_CONFIRMED", "order_id": order_id, "status": "paid"}
    await manager.broadcast_to_kitchen(msg_confirmed)

    msg_update = {"type": "STATUS_UPDATE", "order_id": order_id, "status": "cooking", "payment_status": "paid"}
    await manager.broadcast_to_kitchen(msg_update)

    return {"status": "success", "order_id": order_id}


@router.post("/api/payment/cancel")
async def cancel_payment(data: Dict):
    """선불 결제 취소 / 환불 처리 (Toss Payments Cancel API)"""
    order_id = data.get("order_id")
    cancel_reason = data.get("cancel_reason", "고객 요청 취소")

    if not order_id:
        raise HTTPException(status_code=400, detail="order_id required")

    order = get_order_by_id(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다")

    payment_key  = order.get("payment_key")
    total_price  = order.get("total_price", 0)
    payment_status = order.get("payment_status", "unpaid")
    order_status = order.get("status", "")

    # 1. 중복 취소 차단 (Idempotency 보장)
    if order_status == 'cancelled' or payment_status == 'refunded':
        return {"status": "success", "refund": False, "message": "이미 취소 및 환불 처리가 완료된 주문입니다."}

    if not payment_key:
        # paymentKey가 없으면 (현금/후불 등) 상태만 취소로 변경
        update_order_status(order_id, 'cancelled')
        return {"status": "cancelled", "refund": False, "message": "결제 키 없음 - 상태만 취소 완료"}

    # Toss Payments 취소 API 호출
    toss_secret_key = os.getenv("TOSS_SECRET_KEY") or os.getenv("VITE_TOSS_SECRET_KEY", "")
    if not toss_secret_key:
        update_order_status(order_id, 'cancelled')
        return {
            "status": "manual_required",
            "refund": False,
            "payment_key": payment_key,
            "message": "토스 시크릿 키 미설정 - 상태만 취소되었습니다. 대시보드에서 직접 수동 환불 필요",
            "dashboard_url": f"https://dashboard.tosspayments.com/payments/{payment_key}"
        }

    auth = base64.b64encode(f"{toss_secret_key}:".encode()).decode()

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"https://api.tosspayments.com/v1/payments/{payment_key}/cancel",
                headers={"Authorization": f"Basic {auth}", "Content-Type": "application/json"},
                json={"cancelReason": cancel_reason}
            )

        if res.status_code == 200:
            update_order_status(order_id, 'cancelled')
            update_order_payment_status(order_id, 'refunded')
            await manager.broadcast_to_kitchen({"type": "STATUS_UPDATE", "order_id": order_id, "status": "cancelled", "payment_status": "refunded"})
            print(f"✅ [Refund Success] Order: {order_id}, Amount: {total_price}")
            return {"status": "success", "refund": True, "amount": total_price, "message": f"{total_price:,}원 환불 완료"}
        else:
            error_data = res.json()
            # 이미 취소 처리되었으나 로컬 DB 상태만 미동기화된 경우 구제 조항
            if error_data.get("code") == "ALREADY_REFUNDED_PAYMENT":
                update_order_status(order_id, 'cancelled')
                update_order_payment_status(order_id, 'refunded')
                await manager.broadcast_to_kitchen({"type": "STATUS_UPDATE", "order_id": order_id, "status": "cancelled", "payment_status": "refunded"})
                return {"status": "success", "refund": True, "amount": total_price, "message": "이미 전산 환불된 내역 동기화 완료"}

            print(f"❌ [Refund Failed] {error_data}")
            raise HTTPException(status_code=res.status_code, detail=f"토스 환불 실패: {error_data.get('message', '알 수 없는 오류')}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"토스 API 연결 실패: {e}")


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
    print(f"🔑 [Config] Serving Toss Client Key: {masked_key}")
    return {"clientKey": key}
