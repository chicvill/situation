from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import uuid
import json
import os
from datetime import datetime
import asyncio
from .database import (
    save_session, save_order, get_active_session, 
    get_orders_by_session, update_order_status, get_max_order_seq, init_db_v2,
    get_db_conn
)

app = FastAPI()

# DB 초기화
init_db_v2()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Render Keep-Alive ---
async def keep_alive_task():
    """Render 서버가 잠들지 않도록 10분마다 Supabase에 더미 데이터를 쓰고 지웁니다."""
    while True:
        try:
            conn = get_db_conn()
            if conn:
                cur = conn.cursor()
                # 테이블 확인 및 더미 데이터 작업
                cur.execute("CREATE TABLE IF NOT EXISTS render_keep_alive (id INTEGER PRIMARY KEY, val TEXT)")
                cur.execute("INSERT INTO render_keep_alive (id, val) VALUES (1, 'keep_alive') ON CONFLICT (id) DO UPDATE SET val = 'keep_alive'")
                cur.execute("DELETE FROM render_keep_alive WHERE id = 1")
                conn.commit()
                cur.close()
                conn.close()
                print(f"💓 [{datetime.now().strftime('%H:%M:%S')}] Render Keep-alive pulse sent.")
        except Exception as e:
            print(f"⚠️ Keep-alive pulse failed: {e}")
        
        await asyncio.sleep(600) # 10분 간격

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(keep_alive_task())

# --- Frontend Serving ---
# Render 환경과 로컬 환경 모두 지원하는 경로 설정
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # situation-backend/
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "situation-room", "dist")

if os.path.exists(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

@app.get("/")
async def serve_index():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Frontend not built yet. Please run 'npm run build' in situation-room directory."}


# --- Models ---
class OrderItem(BaseModel):
    name: str
    price: int
    quantity: int

class OrderRequest(BaseModel):
    store_id: str
    table_id: str
    device_id: str
    items: List[OrderItem]
    total_price: int
    payment_status: Optional[str] = "unpaid"
    payment_method: Optional[str] = None

class StatusUpdate(BaseModel):
    order_id: str
    status: str

# --- WebSocket Manager ---
class ConnectionManager:
    def __init__(self):
        # table_id: [websockets]
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.kitchen_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket, client_id: str = "mobile"):
        await websocket.accept()
        if client_id == "kitchen":
            self.kitchen_connections.append(websocket)
        else:
            if client_id not in self.active_connections:
                self.active_connections[client_id] = []
            self.active_connections[client_id].append(websocket)

    def disconnect(self, websocket: WebSocket, client_id: str = "mobile"):
        if client_id == "kitchen":
            if websocket in self.kitchen_connections:
                self.kitchen_connections.remove(websocket)
        else:
            if client_id in self.active_connections:
                if websocket in self.active_connections[client_id]:
                    self.active_connections[client_id].remove(websocket)

    async def broadcast_to_kitchen(self, message: dict):
        for connection in self.kitchen_connections:
            try:
                await connection.send_json(message)
            except:
                pass

    async def send_to_table(self, table_id: str, message: dict):
        if table_id in self.active_connections:
            for connection in self.active_connections[table_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass

manager = ConnectionManager()

# --- Endpoints ---

@app.get("/api/pool")
async def get_pool():
    pool_path = os.path.join(os.path.dirname(__file__), "..", "knowledge_pool.json")
    if os.path.exists(pool_path):
        with open(pool_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"items": []}

@app.post("/api/session/check-in")
async def check_in(data: Dict):
    store_id = data.get("store_id", "default_store")
    table_id = data.get("table_id")
    device_id = data.get("device_id") or ""
    
    if not table_id: raise HTTPException(status_code=400, detail="table_id required")
    
    active = get_active_session(store_id, table_id)
    if active:
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

@app.post("/api/session/open")
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
            from .database import update_session_status
            update_session_status(active['session_id'], 'active')
            active['status'] = 'active'
            # 테이블에 승인 알림 전송
            await manager.send_to_table(table_id, {"type": "SESSION_OPENED", "session": active})
        return active
        
    # 세션이 아예 없으면 새로 생성 (상태는 바로 active)
    data["status"] = "active"
    return await check_in(data)

@app.post("/api/checkin/request")
async def checkin_request(data: Dict):
    """프론트엔드 호환성을 위한 체크인 요청 엔드포인트"""
    # CustomerOrder.tsx에서 보내는 형식에 맞춰 tableId 보정
    if "tableNo" in data and "table_id" not in data:
        data["table_id"] = f"T{data['tableNo'].zfill(2)}"
    return await check_in(data)

@app.get("/api/kitchen/orders")
async def get_kitchen_orders(store_id: str = "Total"):
    from .database import get_kitchen_orders
    return get_kitchen_orders(store_id)

@app.get("/api/counter/sessions")
async def get_counter_sessions(store_id: str = "Total"):
    from .database import get_all_active_sessions
    return get_all_active_sessions(store_id)

@app.post("/api/session/reset")
async def reset_session(data: Dict):
    """세션 강제 종료 및 모든 주문 취소 (장난 주문/중도 퇴장 대응)"""
    session_id = data.get("session_id")
    if not session_id: raise HTTPException(status_code=400, detail="session_id required")
    
    from .database import update_session_status, get_orders_by_session, update_order_status
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

@app.post("/api/session/close")
async def close_session(data: Dict):
    session_id = data.get("session_id")
    if not session_id: raise HTTPException(status_code=400, detail="session_id required")
    
    from .database import update_session_status, get_orders_by_session, update_order_status
    
    # 1. 해당 세션의 모든 주문 확인
    orders = get_orders_by_session(session_id)
    
    # 2. 아직 조리 중인 주문이 있는지 확인 (pending, cooking)
    has_pending = any(o['status'] in ['pending', 'cooking'] for o in orders)
    
    if has_pending:
        # 조리 중인 주문이 있다면: 나온 음식들만 'paid'로 바꾸고 세션은 유지
        for order in orders:
            if order['status'] in ['ready', 'served']:
                update_order_status(order['order_id'], "paid")
        
        # 주방 및 카운터에 알림 (부분 정산 발생)
        await manager.broadcast_to_kitchen({"type": "PARTIAL_SETTLEMENT", "session_id": session_id})
        return {"status": "partial", "message": "조리 중인 주문이 있어 세션을 유지합니다. 나온 음식만 정산되었습니다."}
    else:
        # 모든 음식이 조리/서빙 완료되었다면: 전체 정산 및 세션 종료
        success = update_session_status(session_id, "closed")
        if success:
            for order in orders:
                if order['status'] != 'canceled':
                    update_order_status(order['order_id'], "paid")
            
            # 모든 클라이언트에 알림
            await manager.broadcast_to_kitchen({"type": "SESSION_CLOSED", "session_id": session_id})
            return {"status": "success", "message": "모든 주문이 정산되어 세션이 종료되었습니다."}
    
    return {"status": "failed"}

@app.post("/api/message/send")
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

@app.post("/api/message/clear")
async def clear_message_to_table(data: Dict):
    """카운터에서 특정 테이블의 경고 해제"""
    table_id = data.get("table_id")
    if not table_id:
        raise HTTPException(status_code=400, detail="table_id required")
    
    await manager.send_to_table(table_id, {
        "type": "CLEAR_ALERT"
    })
    return {"status": "success"}

@app.get("/api/session/{table_id}")
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

@app.post("/api/payment/confirm")
async def confirm_payment(data: Dict):
    """토스 페이먼츠 결제 승인 후 처리"""
    order_id = data.get("orderId")
    amount = data.get("amount")
    payment_key = data.get("paymentKey")
    
    print(f"💰 [Payment Confirm] Order: {order_id}, Amount: {amount}")
    
    # 실제 운영 환경에서는 여기서 토스 API 호출하여 승인 확인 필요
    # 현재는 목업(Mock)으로 성공 처리
    return {"status": "success", "order_id": order_id}

@app.post("/api/order/direct")
async def process_order(order_req: OrderRequest):
    print(f"🔥 [Order Request] Table: {order_req.table_id}, Store: {order_req.store_id}, Price: {order_req.total_price}")
    
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
            print(f"🔗 [Session Linked] Found active session in alternative store: {alt_store_id}")
    
    if not session:
        print(f"⚠️ [Warning] No active session found for Table {order_req.table_id}. Creating new one...")
        session = await check_in({
            "store_id": effective_store_id,
            "table_id": order_req.table_id,
            "device_id": order_req.device_id
        })
    
    print(f"✅ [Target Session] ID: {session['session_id']} | Table: {session['table_id']} | Store: {session['store_id']}")

    # 2. 다음 차수 결정
    current_max_seq = get_max_order_seq(session['session_id'])
    next_seq = current_max_seq + 1
    
    # 3. 주문 객체 생성
    order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
    new_order = {
        "order_id": order_id,
        "session_id": session['session_id'],
        "store_id": effective_store_id,
        "table_id": order_req.table_id,
        "device_id": order_req.device_id,
        "items": [item.dict() for item in order_req.items],
        "total_price": order_req.total_price,
        "status": "cooking",
        "payment_status": order_req.payment_status,
        "payment_method": order_req.payment_method,
        "order_seq": next_seq,
        "timestamp": datetime.now().isoformat()
    }
    
    # 4. DB 저장
    print(f"💾 [Saving Order] {order_id} to Session {session['session_id']}...")
    save_order(new_order)
    print(f"✨ [Order Saved Successfully] {order_id}")
    
    # 5. 주방에 알림 전송
    await manager.broadcast_to_kitchen({
        "type": "NEW_ORDER",
        "order": new_order
    })
    
    return {"status": "success", "order_id": order_id, "order_seq": next_seq}

@app.post("/api/order/update-items")
async def update_items(data: Dict):
    order_id = data.get("order_id")
    items = data.get("items")
    if not order_id or items is None:
        raise HTTPException(status_code=400, detail="order_id and items required")
    
    total_price = sum(item.get("price", 0) * (item.get("quantity") or item.get("qty", 0)) for item in items)
    
    from .database import update_order_items
    success = update_order_items(order_id, items, total_price)
    if success:
        # 주방/카운터에 업데이트 알림 전송 (필요시)
        await manager.broadcast({"type": "ORDER_UPDATED", "order_id": order_id, "items": items, "total_price": total_price})
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Update failed")

@app.post("/api/order/status")
async def update_status(update: StatusUpdate):
    success = update_order_status(update.order_id, update.status)
    if success:
        # 상태 변경 알림 (관련 테이블 및 주방 전체)
        # 어떤 테이블의 주문인지 확인하기 위해 전체 주문 정보를 가져오면 좋겠지만, 
        # 일단은 브로드캐스트로 처리 (프론트엔드에서 필터링 가능)
        msg = {"type": "STATUS_UPDATE", "order_id": update.order_id, "status": update.status}
        await manager.broadcast_to_kitchen(msg)
        # 모든 테이블에도 전송 (모바일 화면 갱신용)
        for table_id in manager.active_connections:
            await manager.send_to_table(table_id, msg)
        return {"status": "success"}
    return {"status": "failed"}

@app.post("/api/chat")
async def chat(data: Dict):
    query = data.get("query")
    history = data.get("history", [])
    store = data.get("store", "Total")
    
    from ai_engine import analyze_history
    answer = analyze_history(query, history, store)
    return {"answer": answer}

@app.post("/api/situation")
async def process_situation(data: Dict):
    """상황 지능형 엔진: 입력된 텍스트를 분석하여 지식 풀에 저장"""
    text = data.get("text")
    store = data.get("store", "Total")
    context = data.get("context", "")
    
    from ai_engine import parse_situation_text
    # 1. AI 분석 수행
    analysis_result = parse_situation_text(text, store, context)
    
    # 2. 지식 풀(knowledge_pool.json)에 저장
    pool_path = os.path.join(os.path.dirname(__file__), "..", "knowledge_pool.json")
    try:
        pool_data = {"items": []}
        if os.path.exists(pool_path):
            with open(pool_path, "r", encoding="utf-8") as f:
                pool_data = json.load(f)
        
        # 새 분석 결과 추가
        new_entry = {
            "id": f"SIT-{uuid.uuid4().hex[:6].upper()}",
            "store_id": store,
            "type": analysis_result.get("type", "Log"),
            "title": analysis_result.get("title", "분석된 상황"),
            "timestamp": datetime.now().isoformat(),
            "items": analysis_result.get("items", [])
        }
        pool_data["items"].insert(0, new_entry) # 최신 정보 상단
        
        with open(pool_path, "w", encoding="utf-8") as f:
            json.dump(pool_data, f, ensure_ascii=False, indent=2)
            
        print(f"✨ [Situation Saved] Type: {new_entry['type']} | Title: {new_entry['title']}")
        return {"status": "success", "result": new_entry}
    except Exception as e:
        print(f"🚨 [Situation Save Error] {e}")
        return {"status": "error", "message": str(e)}

@app.websocket("/ws/kitchen")
async def ws_kitchen(websocket: WebSocket):
    await manager.connect(websocket, "kitchen")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, "kitchen")

@app.websocket("/ws/table/{table_id}")
async def ws_table(websocket: WebSocket, table_id: str):
    await manager.connect(websocket, table_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, table_id)
# Last Updated: 2026-05-03 02:57:00
