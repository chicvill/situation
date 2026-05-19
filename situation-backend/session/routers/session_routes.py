import uuid
import json
import re
from datetime import datetime
from typing import Dict, Optional
from fastapi import APIRouter, HTTPException
from psycopg2.extras import RealDictCursor  # type: ignore
from ..state import manager, load_pool, save_pool
from ..database import (
    save_session, get_active_session, get_session_by_id,
    get_orders_by_session, update_order_status, update_session_device_id, get_db_conn,
)

router = APIRouter()


async def check_in(data: Dict):
    store_id = data.get("store_id") or "default_store"
    table_id = data.get("table_id")
    device_id = data.get("device_id") or data.get("deviceId") or ""

    if not table_id:
        raise HTTPException(status_code=400, detail="table_id required")

    # 활성 세션 조회 (store_id fallback 포함)
    active = get_active_session(store_id, table_id)
    if not active:
        alt = "default_store" if store_id != "default_store" else "Total"
        active = get_active_session(alt, table_id)

    # ① 세션 없음 → 카운터에 좌석 승인 요청 저장 + 브로드캐스트
    if not active:
        print(f"[check_in] {table_id} 세션 없음 → SEAT_REQUEST")
        ts = datetime.now().isoformat()
        manager.add_seat_request(table_id, store_id, ts)
        seat_req = {
            "type": "SEAT_REQUEST",
            "table_id": table_id,
            "store_id": store_id,
            "device_id": device_id,
            "timestamp": ts,
        }
        await manager.send_to_table(table_id, seat_req)
        await manager.broadcast_to_kitchen(seat_req)
        return {"status": "no_session"}

    orders = get_orders_by_session(active['session_id'])
    session_store_id = active.get('store_id') or store_id
    first_device = active.get('device_id') or ''

    print(f"[check_in] {table_id} 세션={active['session_id']} 주문수={len(orders)} first_device={first_device!r} 요청기기={device_id!r}")

    # ② 주문 없는 테이블 → 무조건 통과 (보호할 주문 없음)
    if not orders:
        if device_id and not first_device:
            update_session_device_id(active['session_id'], device_id)
        print(f"[check_in] 주문 없음 → active")
        return {"status": "active", "session": active, "orders": orders}

    # ③ 주문 있는 테이블, 같은 디바이스 → 2차/3차 주문
    if not first_device or first_device == device_id:
        print(f"[check_in] 동일 기기 → active")
        return {"status": "active", "session": active, "orders": orders}

    # 승인된 기기 확인 (합류 후 폴링 중인 2번째 폰)
    try:
        raw_meta = active.get('metadata') or {}
        metadata = json.loads(raw_meta) if isinstance(raw_meta, str) else dict(raw_meta)
    except Exception:
        metadata = {}
    if device_id in metadata.get('approved_devices', []):
        print(f"[check_in] 승인된 기기 → active")
        return {"status": "active", "session": active, "orders": orders}

    # ④ 주문 있는 테이블, 다른 디바이스 → 합류 승인 요청
    join_call_id = f"JOIN-{active['session_id']}-{device_id}"
    msg = {
        "type": "JOIN_REQUEST",
        "call_id": join_call_id,
        "device_id": device_id,
        "session_id": active['session_id'],
        "table_id": table_id,
        "store_id": session_store_id,
    }
    print(f"[check_in] 다른 기기 → JOIN_REQUEST store={session_store_id!r} table={table_id!r}")

    # DB에 저장: CallManager가 탭 전환 후 마운트되어도 fetchCalls로 복구 가능
    from ..database import save_call
    save_call({
        "call_id": join_call_id,
        "table_id": table_id,
        "session_id": active['session_id'],
        "call_type": "기기 합류 요청",
        "status": "pending",
        "timestamp": datetime.now().isoformat(),
    })

    await manager.send_to_table(table_id, msg)
    await manager.broadcast_to_kitchen(msg)
    return {"status": "waiting_approval", "session_id": active['session_id']}


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

    # 이미 활성 세션이 있으면 그대로 반환 (중복 개설 방지)
    active = get_active_session(store_id, table_id)
    if active:
        return active

    # 새 세션 생성 — device_id는 빈 문자열로 설정해 첫 고객 QR 스캔 시 소유권 이전
    new_session = {
        "session_id": f"SESS-{uuid.uuid4().hex[:8].upper()}",
        "store_id": store_id,
        "table_id": table_id,
        "device_id": "",
        "status": "active",
        "checkin_time": datetime.now().isoformat(),
        "metadata": {}
    }

    try:
        save_session(new_session)
    except Exception as e:
        print(f"Save Session DB Error: {e}")
        raise HTTPException(status_code=500, detail=f"DB 저장 실패: {str(e)}")

    manager.remove_seat_request(table_id)
    await manager.send_to_table(table_id, {"type": "SESSION_OPENED", "session": new_session})
    await manager.broadcast_to_kitchen({"type": "SESSION_OPENED", "session": new_session})
    return new_session


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


@router.get("/api/seat-requests")
async def get_seat_requests(store_id: str = "Total"):
    return manager.get_seat_requests(store_id)


@router.post("/api/session/status")
async def update_session_stage(data: Dict):
    """테이블 단계 수동 전환: serving | closing (카운터 더블탭용)"""
    session_id = data.get("session_id")
    status = data.get("status")
    allowed = {'serving', 'closing', 'active'}
    if not session_id or status not in allowed:
        raise HTTPException(status_code=400, detail=f"session_id and status ({allowed}) required")

    from ..database import update_session_status
    success = update_session_status(session_id, status)
    if not success:
        raise HTTPException(status_code=500, detail="DB update failed")

    session = get_session_by_id(session_id)
    table_id = session.get('table_id') if session else None
    payload = {"type": "STATUS_UPDATE", "session_id": session_id, "status": status, "table_id": table_id}
    await manager.broadcast_to_kitchen(payload)
    if table_id:
        await manager.send_to_table(table_id, payload)
    return {"status": "success"}


@router.post("/api/session/reset")
async def reset_session(data: Dict):
    """세션 강제 종료 및 모든 주문 취소 (장난 주문/중도 퇴장 대응)"""
    session_id = data.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    from ..database import update_session_status, get_orders_by_session, update_order_status
    session = get_session_by_id(session_id)
    table_id = session.get('table_id') if session else None

    # 1. 세션 종료
    success = update_session_status(session_id, "closed")
    if success:
        # 2. 해당 세션의 모든 주문 'cancelled' 상태로 변경
        orders = get_orders_by_session(session_id)
        for order in orders:
            update_order_status(order['order_id'], "cancelled")

        # 3. 주방 및 해당 테이블 기기에 알림
        await manager.broadcast_to_kitchen({"type": "SESSION_CLOSED", "session_id": session_id})
        if table_id:
            await manager.send_to_table(table_id, {"type": "SESSION_CLOSED", "session_id": session_id})
        return {"status": "success"}
    return {"status": "failed"}


@router.post("/api/session/close")
async def close_session(data: Dict):
    session_id = data.get("session_id")
    force = data.get("force", False)
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    from ..database import update_session_status, get_orders_by_session, update_order_status
    session = get_session_by_id(session_id)
    table_id = session.get('table_id') if session else None

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
                if order['status'] != 'cancelled':
                    update_order_status(order['order_id'], "paid")

            # 주방 및 해당 테이블 기기에 알림
            await manager.broadcast_to_kitchen({"type": "SESSION_CLOSED", "session_id": session_id})
            if table_id:
                await manager.send_to_table(table_id, {"type": "SESSION_CLOSED", "session_id": session_id})
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

    # 승인된 경우 DB에 기기 ID 저장 → 이후 check-in 폴링에서도 active 반환되도록 함
    if approved:
        session = get_session_by_id(session_id)
        if session:
            try:
                raw_meta = session.get('metadata') or {}
                metadata = json.loads(raw_meta) if isinstance(raw_meta, str) else dict(raw_meta)
            except Exception:
                metadata = {}
            approved_devices = metadata.get('approved_devices', [])
            if target_device_id not in approved_devices:
                approved_devices.append(target_device_id)
                metadata['approved_devices'] = approved_devices
                conn = get_db_conn()
                if conn:
                    try:
                        cur = conn.cursor()
                        cur.execute(
                            "UPDATE table_sessions SET metadata = %s WHERE session_id = %s",
                            (json.dumps(metadata), session_id)
                        )
                        conn.commit()
                        cur.close()
                        conn.close()
                    except Exception as e:
                        print(f"approve_join metadata update error: {e}")

    # DB에서 합류 요청 call 제거
    join_call_id = f"JOIN-{session_id}-{target_device_id}"
    from ..database import update_call_status
    update_call_status(join_call_id, 'completed')

    msg = {
        "type": "JOIN_RESPONSE",
        "device_id": target_device_id,
        "approved": approved,
        "session_id": session_id,
        "table_id": table_id
    }
    await manager.send_to_table(table_id, msg)
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

            # 세션에서 해당 테이블의 'cooking' 상태인 주문 조회
            _sess = get_active_session(store_id or 'Total', normalized_table) or \
                    get_active_session('default_store', normalized_table)
            target_order = None
            if _sess:
                _all_orders = get_orders_by_session(_sess['session_id'])
                cooking_orders = [o for o in _all_orders if o.get('status') == 'cooking']

                # 언급된 메뉴와 일치하는 주문 우선 선택
                for order in cooking_orders:
                    for item in (order.get('items') or []):
                        if item.get('name', '') in text:
                            target_order = order
                            break
                    if target_order:
                        break

                # 매칭 메뉴 없으면 가장 첫 cooking 주문 선택
                if not target_order and cooking_orders:
                    target_order = cooking_orders[0]

                if target_order:
                    update_order_status(target_order['order_id'], 'ready')

                if target_order:
                    # 브로드캐스트 전송
                    msg = {
                        "type": "STATUS_UPDATE",
                        "order_id": target_order['order_id'],
                        "status": "ready"
                    }
                    await manager.broadcast_to_kitchen(msg)

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

    # 서빙 완료 처리 ("서빙완료")
    elif "서빙완료" in text_clean:
        table_match = re.search(r'\d+', text)
        if table_match:
            table_num = int(table_match.group())
            normalized_table = f"T{table_num:02d}"

            # 세션에서 해당 테이블의 'ready' 상태인 주문들을 'served'로 변경
            _sess = get_active_session(store_id or 'Total', normalized_table) or \
                    get_active_session('default_store', normalized_table)
            orders = []
            if _sess:
                _all_orders = get_orders_by_session(_sess['session_id'])
                orders = [o for o in _all_orders if o.get('status') == 'ready']
                for order in orders:
                    update_order_status(order['order_id'], 'served')

                if orders:
                    # 브로드캐스트 전송
                    for order in orders:
                        msg = {
                            "type": "STATUS_UPDATE",
                            "order_id": order['order_id'],
                            "status": "served"
                        }
                        await manager.broadcast_to_kitchen(msg)

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
