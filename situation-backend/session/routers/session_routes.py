import uuid
import json
import re
from datetime import datetime
from typing import Dict, Optional
from fastapi import APIRouter, HTTPException
from psycopg2.extras import RealDictCursor  # type: ignore
from ..state import manager, load_pool, save_pool
from ..database import (
    save_session, get_active_session,
    get_orders_by_session, update_order_status, get_db_conn
)

router = APIRouter()


async def check_in(data: Dict):
    store_id = data.get("store_id", "default_store")
    table_id = data.get("table_id")
    device_id = data.get("device_id") or data.get("deviceId") or ""

    if not table_id:
        raise HTTPException(status_code=400, detail="table_id required")

    active = get_active_session(store_id, table_id)
    if active:
        # 이미 활성화된 세션이 있는 경우, 기기ID 확인
        if active['device_id'] and active['device_id'] != device_id:
            # 다른 기기에서 접속 시도 -> 기존 일행 및 카운터에 승인 요청 전송
            msg = {
                "type": "JOIN_REQUEST",
                "device_id": device_id,
                "session_id": active['session_id'],
                "table_id": table_id
            }
            await manager.send_to_table(table_id, msg)
            await manager.broadcast_to_kitchen(msg)  # 카운터(주방)에서도 확인 가능하도록
            return {"status": "waiting_party_approval", "session_id": active['session_id']}
        return active

    new_session = {
        "session_id": f"SESS-{uuid.uuid4().hex[:8].upper()}",
        "store_id": store_id,
        "table_id": table_id,
        "device_id": device_id,
        "status": data.get("status", "pending"),
        "checkin_time": datetime.now().isoformat(),
        "metadata": {}
    }

    try:
        save_session(new_session)
    except Exception as e:
        print(f"Save Session DB Error: {e}")
        raise HTTPException(status_code=500, detail=f"DB 저장 실패: {str(e)}")

    # 세션 개시 알림 브로드캐스트
    await manager.send_to_table(table_id, {"type": "SESSION_OPENED", "session": new_session})
    return new_session


@router.post("/api/session/check-in")
async def check_in_endpoint(data: Dict):
    return await check_in(data)


@router.post("/api/session/open")
async def open_session_manually(data: Dict):
    """점장이 카운터에서 직접 세션 개시"""
    store_id = data.get("store_id", "default_store")
    table_id = data.get("table_id")
    if not table_id:
        raise HTTPException(status_code=400, detail="table_id required")

    # 이미 활성 또는 대기 세션이 있는지 확인
    active = get_active_session(store_id, table_id)
    if active:
        if active['status'] == 'pending':
            # 대기 중인 세션을 활성화로 업데이트 (승인 처리)
            from ..database import update_session_status
            update_session_status(active['session_id'], 'active')
            active['status'] = 'active'
            # 테이블에 승인 알림 전송
            await manager.send_to_table(table_id, {"type": "SESSION_OPENED", "session": active})
        return active

    # 세션이 아예 없으면 새로 생성 (상태는 바로 active)
    data["status"] = "active"
    return await check_in(data)


@router.post("/api/checkin/request")
async def checkin_request(data: Dict):
    """프론트엔드 호환성을 위한 체크인 요청 엔드포인트"""
    # CustomerOrder.tsx에서 보내는 형식에 맞춰 tableId 보정
    if "tableNo" in data and "table_id" not in data:
        data["table_id"] = f"T{data['tableNo'].zfill(2)}"
    if "deviceId" in data and "device_id" not in data:
        data["device_id"] = data["deviceId"]
    return await check_in(data)


@router.get("/api/kitchen/orders")
async def get_kitchen_orders(store_id: str = "Total"):
    from ..database import get_kitchen_orders
    return get_kitchen_orders(store_id)


@router.get("/api/counter/sessions")
async def get_counter_sessions(store_id: str = "Total"):
    from ..database import get_all_active_sessions
    return get_all_active_sessions(store_id)


@router.post("/api/session/reset")
async def reset_session(data: Dict):
    """세션 강제 종료 및 모든 주문 취소 (장난 주문/중도 퇴장 대응)"""
    session_id = data.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    from ..database import update_session_status, get_orders_by_session, update_order_status
    # 1. 세션 종료
    success = update_session_status(session_id, "closed")
    if success:
        # 2. 해당 세션의 모든 주문 'cancelled' 상태로 변경
        orders = get_orders_by_session(session_id)
        for order in orders:
            update_order_status(order['order_id'], "cancelled")

        # 3. 모든 클라이언트에 알림
        await manager.broadcast_to_kitchen({"type": "SESSION_CLOSED", "session_id": session_id})
        return {"status": "success"}
    return {"status": "failed"}


@router.post("/api/session/close")
async def close_session(data: Dict):
    session_id = data.get("session_id")
    force = data.get("force", False)
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    from ..database import update_session_status, get_orders_by_session, update_order_status

    # 1. 해당 세션의 모든 주문 확인
    orders = get_orders_by_session(session_id)

    # 2. 아직 조리 중인 주문이 있는지 확인 (pending, cooking)
    has_pending = any(o['status'] in ['pending', 'cooking'] for o in orders)

    if has_pending and not force:
        # 조리 중인 주문이 있다면: 나온 음식들만 'paid'로 바꾸고 세션은 유지
        for order in orders:
            if order['status'] in ['ready', 'served']:
                update_order_status(order['order_id'], "paid")

        # 주방 및 카운터에 알림 (부분 정산 발생)
        await manager.broadcast_to_kitchen({"type": "PARTIAL_SETTLEMENT", "session_id": session_id})
        return {"status": "partial", "message": "조리 중인 주문이 있어 세션을 유지합니다. 나온 음식만 정산되었습니다."}
    else:
        # 모든 음식이 조리/서빙 완료되었거나 강제 종료인 경우: 전체 정산 및 세션 종료
        success = update_session_status(session_id, "closed")
        if success:
            for order in orders:
                if order['status'] != 'canceled':
                    update_order_status(order['order_id'], "paid")

            # 모든 클라이언트에 알림
            await manager.broadcast_to_kitchen({"type": "SESSION_CLOSED", "session_id": session_id})
            return {"status": "success", "message": "모든 주문이 정산되어 세션이 종료되었습니다."}

    return {"status": "failed"}


@router.post("/api/session/approve-join")
async def approve_join(data: Dict):
    """일행 합류 승인/거절 처리"""
    session_id = data.get("session_id")
    target_device_id = data.get("device_id") or data.get("deviceId")
    approved = data.get("approved", True)
    table_id = data.get("table_id")

    if not session_id or not target_device_id or not table_id:
        raise HTTPException(status_code=400, detail="Missing required fields")

    msg = {
        "type": "JOIN_RESPONSE",
        "device_id": target_device_id,
        "approved": approved,
        "session_id": session_id,
        "table_id": table_id
    }
    # 해당 테이블의 모든 기기에 결과 전송
    await manager.send_to_table(table_id, msg)
    # 주방/카운터에도 알림 전송하여 대기 목록에서 제거되도록 함
    await manager.broadcast_to_kitchen(msg)
    return {"status": "success"}


@router.post("/api/message/send")
async def send_message_to_table(data: Dict):
    """카운터에서 특정 테이블로 경고/공지 메시지 전송"""
    table_id = data.get("table_id")
    message = data.get("message")
    if not table_id or not message:
        raise HTTPException(status_code=400, detail="table_id and message required")

    await manager.send_to_table(table_id, {
        "type": "ALERT_MESSAGE",
        "message": message
    })
    return {"status": "success"}


@router.post("/api/message/clear")
async def clear_message_to_table(data: Dict):
    """카운터에서 특정 테이블의 경고 해제"""
    table_id = data.get("table_id")
    if not table_id:
        raise HTTPException(status_code=400, detail="table_id required")

    await manager.send_to_table(table_id, {
        "type": "CLEAR_ALERT"
    })
    return {"status": "success"}


@router.get("/api/session/{table_id}")
async def get_session_info(table_id: str, store_id: str = "default_store"):
    # 1. 일차적으로 요청된 store_id로 검색
    session = get_active_session(store_id, table_id)

    # 2. 검색 실패 시, store_id가 Total이거나 default_store인 경우 등 교차 검색 시도
    if not session:
        alt_store_id = "default_store" if store_id != "default_store" else "Total"
        session = get_active_session(alt_store_id, table_id)
        if session:
            print(f"🔗 [Session Linked] Found active session via fallback: {alt_store_id}")

    if not session:
        return {"session": None, "orders": []}

    orders = get_orders_by_session(session['session_id'])
    return {"session": session, "orders": orders}


@router.post("/api/situation")
async def process_situation(data: Dict):
    text = data.get("text")
    if not isinstance(text, str):
        raise HTTPException(status_code=400, detail="text must be a string")
    store = data.get("store", "Total")
    store_id = data.get("store_id")
    context = data.get("context", "")

    # 0. 음성 명령어 가로채기 (조리 완료 및 서빙 완료 처리)
    text_clean = text.replace(" ", "")

    # 조리 완료 처리 ("조리완료")
    if "조리완료" in text_clean:
        table_match = re.search(r'\d+', text)
        if table_match:
            table_num = int(table_match.group())
            normalized_table = f"T{table_num:02d}"

            # DB에서 해당 테이블의 'cooking' 상태인 주문 조회
            conn = get_db_conn()
            if conn:
                cur = conn.cursor(cursor_factory=RealDictCursor)
                cur.execute("""
                    SELECT * FROM table_orders
                    WHERE table_id = %s AND status = 'cooking'
                    ORDER BY timestamp DESC
                """, (normalized_table,))
                orders = cur.fetchall()

                # 특정 메뉴가 언급되었는지 확인
                target_order = None
                if orders:
                    # 언급된 메뉴 추출 (예: 짜장면, 짬뽕 등)
                    for order in orders:
                        items_list = []
                        items_raw = order.get('items')
                        if isinstance(items_raw, str):
                            try:
                                items_list = json.loads(items_raw)
                            except:
                                pass
                        elif isinstance(items_raw, list):
                            items_list = items_raw

                        # 아이템 이름과 비교
                        for item in items_list:
                            item_name = item.get('name', '')
                            if item_name in text:
                                target_order = order
                                break
                        if target_order:
                            break

                    # 매칭된 메뉴가 없으면 가장 최근 cooking 주문 선택
                    if not target_order:
                        target_order = orders[0]

                if target_order:
                    # 상태를 'ready'로 변경
                    cur.execute("""
                        UPDATE table_orders SET status = 'ready'
                        WHERE order_id = %s
                    """, (target_order['order_id'],))
                    conn.commit()

                    # 브로드캐스트 전송
                    msg = {
                        "type": "STATUS_UPDATE",
                        "order_id": target_order['order_id'],
                        "status": "ready"
                    }
                    await manager.broadcast_to_kitchen(msg)

                    cur.close()
                    conn.close()

                    # 상황 보고 로그용 새 번들 생성하여 풀에 기록
                    new_bnd = {
                        "id": f"BND-{uuid.uuid4().hex[:8].upper()}",
                        "type": "Analysis",
                        "title": "음성 조리 완료 보고",
                        "answer": f"📢 {table_num}번 테이블의 음식이 조리 완료되었습니다. 전광판과 카운터에 서빙 안내가 전송되었습니다.",
                        "store": store,
                        "store_id": store_id,
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }
                    pool = load_pool()
                    pool.insert(0, new_bnd)
                    save_pool(pool)
                    await manager.broadcast_to_kitchen({"type": "POOL_UPDATED", "id": new_bnd["id"], "type": "Analysis"})

                    return new_bnd
                cur.close()
                conn.close()

    # 서빙 완료 처리 ("서빙완료")
    elif "서빙완료" in text_clean:
        table_match = re.search(r'\d+', text)
        if table_match:
            table_num = int(table_match.group())
            normalized_table = f"T{table_num:02d}"

            # DB에서 해당 테이블의 'ready' 상태인 주문들을 'served'로 변경
            conn = get_db_conn()
            if conn:
                cur = conn.cursor(cursor_factory=RealDictCursor)
                cur.execute("""
                    SELECT * FROM table_orders
                    WHERE table_id = %s AND status = 'ready'
                """, (normalized_table,))
                orders = cur.fetchall()

                if orders:
                    for order in orders:
                        cur.execute("""
                            UPDATE table_orders SET status = 'served'
                            WHERE order_id = %s
                        """, (order['order_id'],))
                    conn.commit()

                    # 브로드캐스트 전송
                    for order in orders:
                        msg = {
                            "type": "STATUS_UPDATE",
                            "order_id": order['order_id'],
                            "status": "served"
                        }
                        await manager.broadcast_to_kitchen(msg)

                    cur.close()
                    conn.close()

                    # 상황 보고 로그용 새 번들 생성하여 풀에 기록
                    new_bnd = {
                        "id": f"BND-{uuid.uuid4().hex[:8].upper()}",
                        "type": "Analysis",
                        "title": "음성 서빙 완료 보고",
                        "answer": f"✅ {table_num}번 테이블 서빙이 완료되었습니다. 전광판 안내가 해제되고 카운터가 대기 상태로 전환되었습니다.",
                        "store": store,
                        "store_id": store_id,
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }
                    pool = load_pool()
                    pool.insert(0, new_bnd)
                    save_pool(pool)
                    await manager.broadcast_to_kitchen({"type": "POOL_UPDATED", "id": new_bnd["id"], "type": "Analysis"})

                    return new_bnd
                cur.close()
                conn.close()

    # 1. AI 엔진을 통한 텍스트 분석 및 구조화
    from ai_engine import parse_situation_text
    result = parse_situation_text(text, store, context)

    # 2. 메타데이터 보강
    result["id"] = f"BND-{uuid.uuid4().hex[:8].upper()}"
    result["store"] = store
    result["store_id"] = store_id

    # 3. 지식 풀에 저장
    pool = load_pool()
    pool.insert(0, result)
    if save_pool(pool):
        # 실시간 알림
        await manager.broadcast_to_kitchen({"type": "POOL_UPDATED", "id": result["id"], "type": result["type"]})
        return result
    raise HTTPException(status_code=500, detail="Failed to save situation")
