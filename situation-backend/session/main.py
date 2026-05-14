from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uuid
import json
import os
from datetime import datetime
import asyncio
from .database import (
    save_session, save_order, get_active_session, 
    get_orders_by_session, update_order_status, get_max_order_seq, init_db_v2,
    get_db_conn, get_situation_history, update_order_payment_status,
    get_stores_db, add_store_db, update_store_db, delete_store_db
)
import ai_engine
from psycopg2.extras import RealDictCursor  # type: ignore



# --- Render Keep-Alive ---
async def keep_alive_task():
    """Render 서버가 잠들지 않도록 10분마다 DB 작업 및 셀프 핑을 수행합니다."""
    import httpx
    while True:
        try:
            # 1. DB 작업 (요청하신 대로 1을 저장하고 지움)
            conn = get_db_conn()
            if conn:
                cur = conn.cursor()
                cur.execute("CREATE TABLE IF NOT EXISTS render_keep_alive (id INTEGER PRIMARY KEY, val TEXT)")
                cur.execute("INSERT INTO render_keep_alive (id, val) VALUES (1, '1') ON CONFLICT (id) DO UPDATE SET val = '1'")
                cur.execute("DELETE FROM render_keep_alive WHERE id = 1")
                conn.commit()
                cur.close()
                conn.close()
                print(f"💓 [{datetime.now().strftime('%H:%M:%S')}] DB Keep-alive pulse sent.")

            # 2. 셀프 핑 (HTTP 요청이 있어야 Render가 잠들지 않음)
            render_url = os.getenv("RENDER_EXTERNAL_URL") or "http://localhost:8000"
            async with httpx.AsyncClient() as client:
                await client.get(render_url)
                print(f"🌐 [{datetime.now().strftime('%H:%M:%S')}] Self-ping sent to {render_url}")

        except Exception as e:
            print(f"⚠️ Keep-alive pulse failed: {e}")
        
        await asyncio.sleep(600) # 10분 간격

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start render keepalive task
    asyncio.create_task(keep_alive_task())
    
    # 사업자 번호 및 매장명 중복 충돌 방지를 위한 시크앤프레시, 시크빌 매장 사전 일괄 삭제 (테스트를 위해 비활성화)
    # try:
    #     conn = get_db_conn()
    #     if conn:
    #         cur = conn.cursor()
    #         cur.execute("DELETE FROM stores WHERE name IN ('시크앤프레시', '시크빌')")
    #         deleted_rows = cur.rowcount
    #         conn.commit()
    #         cur.close()
    #         conn.close()
    #         print(f"🧹 [Startup Cleanup] Deleted {deleted_rows} duplicate stores ('시크앤프레시', '시크빌') from PostgreSQL database.")
    # except Exception as e:
    #     print(f"⚠️ [Startup Cleanup] Failed to cleanup duplicate stores: {e}")
        
    yield

app = FastAPI(lifespan=lifespan)

# DB 초기화
init_db_v2()

# --- DB Debug / Sync Script ---
def force_seed_chicvill():
    import psycopg2 # type: ignore
    import json
    db_url = os.getenv("DATABASE_URL")
    log_content = []
    log_content.append(f"=== DB Debug/Sync Start: {datetime.now().isoformat()} ===")
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # 1. Check existing stores
        cur.execute("SELECT id, name FROM stores")
        stores = cur.fetchall()
        log_content.append(f"Current stores in DB: {stores}")
        
        # 2. Check if store-chicvill is in DB
        cur.execute("SELECT COUNT(*) FROM stores WHERE id = 'store-chicvill'")
        row = cur.fetchone()
        count_chicvill = row[0] if row else 0
        log_content.append(f"store-chicvill count: {count_chicvill}")
        
        if count_chicvill == 0:
            # Force insert store-chicvill
            cur.execute("""
                INSERT INTO stores (id, name, ceo_name, signature_owner, monthly_fee, payment_status, payment_history, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            """, ("store-chicvill", "시크빌", "미지정 점주", "owner-store-chicvill", 50000, "정상", json.dumps([])))
            conn.commit()
            log_content.append("Successfully force-seeded 'store-chicvill' into database!")
        
        # 3. Double-check again
        cur.execute("SELECT id, name FROM stores")
        stores_after = cur.fetchall()
        log_content.append(f"Stores in DB after sync: {stores_after}")
        
        cur.close()
        conn.close()
    except Exception as e:
        log_content.append(f"ERROR: {e}")
        
    # Write to output.txt in workspace root
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        out_file = os.path.join(base_dir, "output.txt")
        with open(out_file, "w", encoding="utf-8") as f:
            f.write("\n".join(log_content))
    except Exception as fe:
        print(f"Failed to write log file: {fe}")

force_seed_chicvill()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    metadata: Optional[Dict[str, Any]] = None

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

POOL_FILE = os.path.join(os.path.dirname(__file__), "..", "knowledge_pool.json")

def load_pool():
    if os.path.exists(POOL_FILE):
        try:
            with open(POOL_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            return []
    return []

def save_pool(pool):
    try:
        with open(POOL_FILE, "w", encoding="utf-8") as f:
            json.dump(pool, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Save Pool Error: {e}")
        return False

class StoreCreateRequest(BaseModel):
    store_id: str
    store_name: str
    owner_name: str
    owner_id: str
    monthly_fee: int
    payment_status: str
    payment_history: Optional[List[Dict[str, Any]]] = []

class StoreUpdateRequest(BaseModel):
    store_name: str
    owner_name: str
    owner_id: str
    monthly_fee: int
    payment_status: str
    payment_history: Optional[List[Dict[str, Any]]] = []

@app.get("/api/stores")
async def get_stores():
    return get_stores_db()

@app.get("/api/debug-db")
async def debug_db_endpoint():
    status: Dict[str, Any] = {}
    try:
        db_url = os.getenv("DATABASE_URL")
        status["database_url_configured"] = bool(db_url)
        if db_url:
            status["database_url_masked"] = db_url.split("@")[-1] if "@" in db_url else "configured"
        
        import psycopg2  # type: ignore
        conn = psycopg2.connect(db_url)
        status["connection_test"] = "SUCCESS"
        
        cur = conn.cursor()
        # 테이블 존재 여부 확인
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'stores'
            )
        """)
        row = cur.fetchone()
        stores_table_exists = row[0] if row else False
        status["stores_table_exists"] = stores_table_exists
        
        if stores_table_exists:
            # 컬럼 정보 조회
            cur.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'stores'
            """)
            status["stores_columns"] = [{"column_name": r[0], "data_type": r[1]} for r in cur.fetchall()]
            
            cur.execute("SELECT COUNT(*) FROM stores")
            count_row = cur.fetchone()
            status["stores_count"] = count_row[0] if count_row else 0
        else:
            status["stores_columns"] = []
            status["stores_count"] = 0
            
        cur.close()
        conn.close()
    except Exception as e:
        status["connection_test"] = "FAILED"
        status["error"] = str(e)
    return status

@app.post("/api/stores")
async def add_store(store: StoreCreateRequest):
    history_str = json.dumps(store.payment_history or [])
    success = add_store_db(
        store_id=store.store_id,
        store_name=store.store_name,
        owner_name=store.owner_name,
        owner_id=store.owner_id,
        monthly_fee=store.monthly_fee,
        payment_status=store.payment_status,
        payment_history=history_str
    )
    if success:
        return {"status": "success", "message": "Store registered successfully"}
    raise HTTPException(status_code=500, detail="Failed to add store to DB")

@app.put("/api/stores/{store_id}")
async def update_store(store_id: str, store: StoreUpdateRequest):
    history_str = json.dumps(store.payment_history or [])
    success = update_store_db(
        store_id=store_id,
        store_name=store.store_name,
        owner_name=store.owner_name,
        owner_id=store.owner_id,
        monthly_fee=store.monthly_fee,
        payment_status=store.payment_status,
        payment_history=history_str
    )
    if success:
        return {"status": "success", "message": "Store updated successfully"}
    raise HTTPException(status_code=500, detail="Failed to update store in DB")

@app.delete("/api/stores/{store_id}")
async def delete_store(store_id: str):
    success = delete_store_db(store_id)
    if success:
        return {"status": "success", "message": "Store deleted successfully"}
    raise HTTPException(status_code=500, detail="Failed to delete store from DB")

@app.get("/api/pool")
async def get_pool(store_id: Optional[str] = None):
    pool = load_pool()
    
    # DB의 활성 주문들을 실시간 번들로 조회하여 통합
    from .database import get_all_active_orders_as_bundles, get_all_staff_as_bundles, get_all_attendance_as_bundles
    active_order_bundles = get_all_active_orders_as_bundles(store_id)
    pool.extend(active_order_bundles)
    
    # DB의 직원 및 근태 기록을 가상 번들로 변환 후 통합
    staff_bundles = get_all_staff_as_bundles(store_id)
    attendance_bundles = get_all_attendance_as_bundles(store_id)
    pool.extend(staff_bundles)
    pool.extend(attendance_bundles)
    
    if store_id and store_id != "Total":
        # store_id가 일치하거나 매장 정보가 없는(공용) 번들, 또는 회원가입 신청서(PersonalInfos)만 반환
        return [
            b for b in pool 
            if b.get("store_id") == store_id or not b.get("store_id") or b.get("type") == "PersonalInfos"
        ]
    return pool

@app.put("/api/bundle/{bundle_id}")
async def update_bundle(bundle_id: str, bundle: Dict):
    pool = load_pool()
    found = False
    for i, b in enumerate(pool):
        if b.get("id") == bundle_id:
            pool[i] = bundle
            found = True
            break
    
    if not found:
        bundle["id"] = bundle_id
        pool.append(bundle)
        
    if save_pool(pool):
        # 변경 사항 브로드캐스트
        await manager.broadcast_to_kitchen({"type": "POOL_UPDATED", "bundle_id": bundle_id})
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to save bundle")

@app.delete("/api/bundle/{bundle_id}")
async def delete_bundle(bundle_id: str):
    pool = load_pool()
    original_pool_len = len(pool)
    pool = [b for b in pool if b.get("id") != bundle_id]
    
    # 근태 기록(Attendance) 삭제 로직 강화
    if "ATT-" in bundle_id:
        try:
            from .database import get_db_conn
            conn = get_db_conn()
            if conn:
                cur = conn.cursor()
                # ATT-ATT- 형태나 ATT- 형태 모두 대응하도록 숫자/문자 ID만 추출
                # 모든 "ATT-" 접두어를 제거하여 순수 log_id 확보
                real_log_id = bundle_id
                while real_log_id.startswith("ATT-"):
                    real_log_id = real_log_id[4:]
                
                # DB에서는 원래 ATT-가 붙은 상태로 저장되므로, ATT-를 하나만 붙여서 검색
                search_id = f"ATT-{real_log_id}"
                
                cur.execute("DELETE FROM table_attendance_logs WHERE log_id = %s OR log_id = %s", (search_id, real_log_id))
                conn.commit()
                cur.close()
                conn.close()
                print(f"🗑️ Attendance log {search_id} (original: {bundle_id}) deleted from DB.")
        except Exception as e:
            print(f"Error deleting attendance from DB: {e}")

    if len(pool) < original_pool_len or "ATT-" in bundle_id:
        if save_pool(pool):
            await manager.broadcast_to_kitchen({"type": "POOL_UPDATED", "bundle_id": bundle_id})
            return {"status": "success"}
    
    await manager.broadcast_to_kitchen({"type": "POOL_UPDATED", "bundle_id": bundle_id})
    return {"status": "success"}

@app.post("/api/situation")
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
        import re
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
                            try: items_list = json.loads(items_raw)
                            except: pass
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
        import re
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

@app.delete("/api/pool")
async def reset_pool(store_id: Optional[str] = None):
    if not store_id or store_id == "Total":
        save_pool([])
    else:
        pool = load_pool()
        pool = [b for b in pool if b.get("store_id") != store_id]
        save_pool(pool)
    return {"status": "success"}


@app.post("/api/session/check-in")
async def check_in(data: Dict):
    store_id = data.get("store_id", "default_store")
    table_id = data.get("table_id")
    device_id = data.get("device_id") or data.get("deviceId") or ""
    
    if not table_id: raise HTTPException(status_code=400, detail="table_id required")
    
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
            await manager.broadcast_to_kitchen(msg) # 카운터(주방)에서도 확인 가능하도록
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
    if "deviceId" in data and "device_id" not in data:
        data["device_id"] = data["deviceId"]
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
    force = data.get("force", False)
    if not session_id: raise HTTPException(status_code=400, detail="session_id required")
    
    from .database import update_session_status, get_orders_by_session, update_order_status
    
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

@app.post("/api/session/approve-join")
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
    
    print(f"💰 [Payment Confirm] Order: {order_id}, Amount: {amount}, Key: {payment_key[:8] + '...' if payment_key else 'None'}")
    
    if not order_id or not isinstance(order_id, str):
        raise HTTPException(status_code=400, detail="orderId is required and must be a string")
    
    update_order_payment_status(order_id, "paid")
    update_order_status(order_id, "cooking")
    
    # paymentKey를 DB에 저장 (환불 시 필요)
    if payment_key:
        try:
            conn = get_db_conn()
            cur = conn.cursor()
            cur.execute("UPDATE table_orders SET payment_key = %(pk)s WHERE order_id = %(oid)s",
                       {'pk': payment_key, 'oid': order_id})
            conn.commit()
            cur.close()
            conn.close()
            print(f"🔑 [Payment Key Saved] {order_id}")
        except Exception as e:
            print(f"⚠️ Failed to save payment_key: {e}")
    
    # 주방 및 테이블에 결제 완료 알림 전송
    msg_confirmed = {"type": "PAYMENT_CONFIRMED", "order_id": order_id, "status": "paid"}
    await manager.broadcast_to_kitchen(msg_confirmed)
    
    msg_update = {"type": "STATUS_UPDATE", "order_id": order_id, "status": "cooking", "payment_status": "paid"}
    await manager.broadcast_to_kitchen(msg_update)
    
    for table_id in manager.active_connections:
        await manager.send_to_table(table_id, msg_confirmed)
        await manager.send_to_table(table_id, msg_update)

    return {"status": "success", "order_id": order_id}

@app.post("/api/payment/cancel")
async def cancel_payment(data: Dict):
    """선불 결제 취소 / 환불 처리 (Toss Payments Cancel API)"""
    order_id = data.get("order_id")
    cancel_reason = data.get("cancel_reason", "고객 요청 취소")
    
    if not order_id:
        raise HTTPException(status_code=400, detail="order_id required")
    
    conn = None
    cur = None
    try:
        conn = get_db_conn()
        cur = conn.cursor()
        cur.execute("SELECT payment_key, total_price, payment_status, status FROM table_orders WHERE order_id = %s", (order_id,))
        row = cur.fetchone()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB 조회 실패: {e}")
    finally:
        if cur: cur.close()
        if conn: conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다")
    
    payment_key, total_price, payment_status, order_status = row
    
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
    
    import base64, httpx
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

@app.get("/api/points/{phone}")
async def get_points(phone: str, store_id: str = 'store-1'):
    from .database import get_customer_points
    points = get_customer_points(phone, store_id)
    return {"phone": phone, "points": points, "store_id": store_id}
    
@app.get("/api/config/toss-key")
async def get_toss_key():
    """프론트엔드에 토스 클라이언트 키 전달 (동적 로딩용)"""
    key = os.getenv("VITE_TOSS_CLIENT_KEY") or os.getenv("TOSS_CLIENT_KEY") or "test_ck_D5b4Zne68wxL1Pn6k0m8rlzYWBn1"
    masked_key = f"{key[:8]}...{key[-4:]}" if key else "None"
    print(f"🔑 [Config] Serving Toss Client Key: {masked_key}")
    return {"clientKey": key}

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
    
    session_dict = session if isinstance(session, dict) else {}
    session_id = str(session_dict.get('session_id', ''))
    table_id_val = str(session_dict.get('table_id', ''))
    store_id_val = str(session_dict.get('store_id', ''))

    print(f"✅ [Target Session] ID: {session_id} | Table: {table_id_val} | Store: {store_id_val}")

    # 2. 다음 차수 결정
    current_max_seq = get_max_order_seq(session_id)
    next_seq = current_max_seq + 1
    
    # 3. 주문 객체 생성
    order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
    new_order = {
        "order_id": order_id,
        "session_id": session_id,
        "store_id": effective_store_id,
        "table_id": order_req.table_id,
        "device_id": order_req.device_id,
        "items": [item.model_dump() for item in order_req.items],
        "total_price": order_req.total_price,
        "status": "cooking" if order_req.payment_status != "pending" else "pending_payment",
        "payment_status": order_req.payment_status,
        "payment_method": order_req.payment_method,
        "order_seq": next_seq,
        "timestamp": datetime.now().isoformat()
    }
    
    # 4. DB 저장
    print(f"💾 [Saving Order] {order_id} to Session {session_id}...")
    save_order(new_order)
    
    # 4-1. 포인트 처리 (metadata에 phone이 있는 경우 - 다중 매장 격리 연동)
    metadata = order_req.metadata or {}
    phone = metadata.get("phone")
    if phone:
        from .database import update_customer_points
        # 기본 0.1% 적립
        pts = int(order_req.total_price * 0.001)
        update_customer_points(phone, pts, effective_store_id)
        print(f"💰 [Points] Accumulated {pts}P for {phone} under Store {effective_store_id}")
        
        # 주방/카운터에 실시간 포인트 적립 브로드캐스트 전송
        await manager.broadcast_to_kitchen({
            "type": "POINTS_UPDATED",
            "phone": phone,
            "points": pts,
            "store_id": effective_store_id
        })

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
        await manager.broadcast_to_kitchen({"type": "ORDER_UPDATED", "order_id": order_id, "items": items, "total_price": total_price})
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

# --- Store Config Management ---
def init_config_db():
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS store_configs (
            store_id TEXT PRIMARY KEY,
            manual TEXT DEFAULT ''
        )
    """)
    conn.commit()
    cur.close()
    conn.close()

init_config_db()

@app.get("/api/store/manual")
async def get_manual(store_id: str = "store-1"):
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("SELECT manual FROM store_configs WHERE store_id = %s", (store_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return {"manual": row[0] if row else ""}

@app.post("/api/store/manual")
async def update_manual(data: dict):
    store_id = data.get("store_id", "store-1")
    manual = data.get("manual", "")
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO store_configs (store_id, manual) 
        VALUES (%s, %s) 
        ON CONFLICT (store_id) DO UPDATE SET manual = EXCLUDED.manual
    """, (store_id, manual))
    conn.commit()
    cur.close()
    conn.close()
    return {"status": "success"}

@app.post("/api/chat")
async def chat(data: Dict):
    query = data.get("query")
    if not isinstance(query, str):
        raise HTTPException(status_code=400, detail="query must be a string")
    history = data.get("history", [])
    store_id = data.get("store_id", "store-1")
    
    # 지식 인벤토리 데이터(최근 상황들) 가져오기
    pool_history = get_situation_history(store_id, limit=50)
    
    # 매장 고정 매뉴얼 가져오기
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("SELECT manual FROM store_configs WHERE store_id = %s", (store_id,))
    row = cur.fetchone()
    manual = row[0] if row else ""
    cur.close()
    conn.close()

    # AI 엔진 호출 (매뉴얼 포함)
    response = ai_engine.analyze_history(query, pool_history, store=store_id, manual=manual)
    return {"response": response}

# --- 🚶 5-1. 스마트 대기 관리 (Waiting) Endpoints ---
@app.post("/api/waiting/register")
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
    
    from .database import save_waiting
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

@app.get("/api/waiting/active")
async def get_active_waitings_endpoint(store_id: Optional[str] = None):
    from .database import get_active_waitings
    return get_active_waitings(store_id)

@app.post("/api/waiting/status")
async def update_waiting_status_endpoint(data: Dict):
    waiting_id = data.get("waiting_id") or data.get("waitingId")
    status = data.get("status")
    
    if not waiting_id or not status:
        raise HTTPException(status_code=400, detail="waiting_id and status required")
        
    from .database import update_waiting_status
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
@app.post("/api/call")
async def staff_call(data: Dict):
    table_id = data.get("table_id") or data.get("tableId")
    call_type = data.get("call_type") or data.get("callType") or "직원호출"
    
    if not table_id:
        raise HTTPException(status_code=400, detail="table_id required")
        
    # 현재 활성 세션 가져와서 호출 기록을 세션에 종속시키기
    from .database import get_active_session, save_call
    store_id = data.get("store_id") or data.get("storeId") or "Total"
    active = get_active_session(store_id, table_id)
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
        # 주방/카운터에 실시간 호출 브로드캐스트
        msg = {
            "type": "STAFF_CALL",
            "call_id": call_id,
            "table_id": table_id,
            "call_type": call_type,
            "status": "pending",
            "store_id": store_id
        }
        await manager.broadcast_to_kitchen(msg)
        await manager.send_to_table(table_id, msg)
        return call_data
    raise HTTPException(status_code=500, detail="Failed to process staff call")

@app.get("/api/call/active")
async def get_active_calls_endpoint(table_id: Optional[str] = None, store_id: Optional[str] = None):
    from .database import get_active_calls
    return get_active_calls(table_id, store_id)

@app.post("/api/call/status")
async def update_call_status_endpoint(data: Dict):
    call_id = data.get("call_id") or data.get("callId")
    status = data.get("status")
    
    if not call_id or not status:
        raise HTTPException(status_code=400, detail="call_id and status required")
        
    from .database import update_call_status
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
@app.post("/api/reservation/request")
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
    
    from .database import save_reservation
    if save_reservation(res_data):
        await manager.broadcast_to_kitchen({
            "type": "RESERVATION_UPDATED",
            "reservation_id": reservation_id,
            "status": "requested"
        })
        return res_data
    raise HTTPException(status_code=500, detail="Failed to save reservation")

@app.get("/api/reservation/active")
async def get_active_reservations_endpoint():
    from .database import get_active_reservations
    return get_active_reservations()

@app.post("/api/reservation/status")
async def update_reservation_status_endpoint(data: Dict):
    reservation_id = data.get("reservation_id") or data.get("reservationId")
    status = data.get("status")
    
    if not reservation_id or not status:
        raise HTTPException(status_code=400, detail="reservation_id and status required")
        
    from .database import update_reservation_status
    if update_reservation_status(reservation_id, status):
        await manager.broadcast_to_kitchen({
            "type": "RESERVATION_UPDATED",
            "reservation_id": reservation_id,
            "status": status
        })
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to update reservation status")

# --- 🚗 5-4. 원클릭 셀프 주차 할인 (Parking) Endpoints ---
@app.post("/api/parking/validate")
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
    
    from .database import save_parking, get_session_by_id
    session_info = get_session_by_id(session_id)
    store_id = session_info.get("store_id") if session_info else "store-1"

    if save_parking(park_data):
        await manager.broadcast_to_kitchen({
            "type": "PARKING_APPLIED",
            "parking_id": parking_id,
            "session_id": session_id,
            "vehicle_number": vehicle_number,
            "status": "applied",
            "store_id": store_id
        })
        return park_data
    raise HTTPException(status_code=500, detail="Failed to save parking registration")

@app.get("/api/parking/session/{session_id}")
async def get_parking_by_session_endpoint(session_id: str):
    from .database import get_parking_by_session
    parking = get_parking_by_session(session_id)
    return {"parking": parking}

@app.get("/api/parking/active")
async def get_active_parkings_endpoint(store_id: Optional[str] = None):
    from .database import get_active_parkings_db
    return get_active_parkings_db(store_id)

@app.get("/api/points/list")
async def get_points_list_endpoint(store_id: Optional[str] = None):
    from .database import get_points_list_db
    return get_points_list_db(store_id)

# --- 👥 9. 통합 매장 직원 및 근로 관리 (Staff & Labor Management) Endpoints ---
@app.post("/api/staff/direct-register")
async def direct_register_staff(data: Dict):
    store_id = data.get("store_id") or "default_store"
    store_name = data.get("store_name") or "미지정"
    name = data.get("name")
    phone = data.get("phone") # This is the staff_id / phone number
    role = data.get("role") or "staff"
    hourly_wage = int(data.get("hourly_wage") or 10500)
    temporary_password = data.get("temporary_password") or "1212"
    schedules = data.get("schedules") or [] # List of {day_of_week: int, start_time: str, end_time: str}
    
    if not name or not phone:
        raise HTTPException(status_code=400, detail="이름과 휴대폰 번호(ID)는 필수 항목입니다.")
        
    # 1. PersonalInfos 번들 생성/업데이트 (로그인 정보용)
    import hashlib
    hashed_pw = hashlib.sha256(temporary_password.encode()).hexdigest()
    
    signup_bundle = {
        "id": f"USER-{phone}",
        "type": "PersonalInfos",
        "title": f"{name}님 등록 완료 (직원)",
        "items": [
            { "name": "이름", "value": name },
            { "name": "아이디", "value": phone },
            { "name": "비밀번호", "value": hashed_pw },
            { "name": "권한", "value": role }
        ],
        "status": "approved", # Pre-approved by owner!
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "store": store_name,
        "store_id": store_id
    }
    
    # 지식 풀에 저장
    pool = load_pool()
    found_bundle = False
    for i, b in enumerate(pool):
        if b.get("type") == "PersonalInfos" and any(item.get("name") == "아이디" and item.get("value") == phone for item in b.get("items", [])):
            pool[i] = signup_bundle
            found_bundle = True
            break
    if not found_bundle:
        pool.append(signup_bundle)
        
    if not save_pool(pool):
        raise HTTPException(status_code=500, detail="로그인 지식 풀 업데이트 실패")
        
    # 2. table_staff_accounts에 직원 저장
    staff_data = {
        "staff_id": phone,
        "store_id": store_id,
        "name": name,
        "role": role,
        "hourly_wage": hourly_wage,
        "status": "approved", # Pre-approved!
        "contract_period": {
            "start": datetime.now().strftime("%Y-%m-%d"),
            "end": "2029-12-31"
        }
    }
    
    from .database import save_staff, save_schedule
    if not save_staff(staff_data):
        raise HTTPException(status_code=500, detail="PostgreSQL 직원 계정 저장 실패")
        
    # 3. 기존의 스케줄이 있다면 먼저 DB에서 삭제하기
    try:
        conn = get_db_conn()
        cur = conn.cursor()
        cur.execute("DELETE FROM table_staff_schedules WHERE staff_id = %s AND store_id = %s", (phone, store_id))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Failed to clear old schedules: {e}")
        
    # 4. 요일별 스케줄 개별 저장
    for s in schedules:
        sched_id = f"SCHED-{uuid.uuid4().hex[:6].upper()}"
        sched_data = {
            "schedule_id": sched_id,
            "staff_id": phone,
            "store_id": store_id,
            "day_of_week": int(s["day_of_week"]),
            "start_time": s["start_time"],
            "end_time": s["end_time"]
        }
        save_schedule(sched_data)
        
    # 실시간 알림 브로드캐스트
    await manager.broadcast_to_kitchen({
        "type": "POOL_UPDATED",
        "bundle_id": f"EMP-{phone}"
    })
    
    return {"status": "success", "staff_id": phone}

@app.post("/api/staff/register")
async def register_staff(data: Dict):
    staff_id = f"STF-{uuid.uuid4().hex[:4].upper()}"
    store_id = data.get("store_id") or "default_store"
    name = data.get("name")
    role = data.get("role") or "staff" # staff or manager
    hourly_wage = int(data.get("hourly_wage") or 10500)
    contract_start = data.get("contract_start") or datetime.now().strftime("%Y-%m-%d")
    contract_end = data.get("contract_end") or "2026-12-31"
    
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
        
    staff_data = {
        "staff_id": staff_id,
        "store_id": store_id,
        "name": name,
        "role": role,
        "hourly_wage": hourly_wage,
        "status": "pending",
        "contract_period": {
            "start": contract_start,
            "end": contract_end
        }
    }
    
    from .database import save_staff
    if save_staff(staff_data):
        await manager.broadcast_to_kitchen({
            "type": "STAFF_REGISTERED",
            "staff_id": staff_id,
            "name": name,
            "role": role
        })
        return staff_data
    raise HTTPException(status_code=500, detail="Failed to register staff account")

@app.get("/api/staff/list")
async def get_staff_list(store_id: str = "default_store"):
    from .database import get_active_staff_list
    return get_active_staff_list(store_id)

@app.post("/api/staff/approve")
async def approve_staff(data: Dict):
    staff_id = data.get("staff_id")
    status = data.get("status") or "approved" # approved, retired
    
    if not staff_id:
        raise HTTPException(status_code=400, detail="staff_id is required")
        
    from .database import update_staff_status
    if update_staff_status(staff_id, status):
        await manager.broadcast_to_kitchen({
            "type": "STAFF_STATUS_UPDATED",
            "staff_id": staff_id,
            "status": status
        })
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to update staff status")

@app.post("/api/staff/schedule")
async def register_staff_schedule(data: Dict):
    staff_id = data.get("staff_id")
    day_of_week = int(data.get("day_of_week", 0)) # 0: Monday, ..., 6: Sunday
    start_time = data.get("start_time") # format "HH:MM"
    end_time = data.get("end_time") # format "HH:MM"
    
    if not staff_id or start_time is None or end_time is None:
        raise HTTPException(status_code=400, detail="staff_id, start_time, and end_time are required")
        
    schedule_id = f"SCHED-{uuid.uuid4().hex[:4].upper()}"
    sched_data = {
        "schedule_id": schedule_id,
        "staff_id": staff_id,
        "day_of_week": day_of_week,
        "start_time": start_time,
        "end_time": end_time
    }
    
    from .database import save_schedule
    if save_schedule(sched_data):
        return sched_data
    raise HTTPException(status_code=500, detail="Failed to register schedule")

@app.get("/api/staff/schedule/{staff_id}")
async def get_staff_schedules_endpoint(staff_id: str):
    from .database import get_staff_schedules
    return get_staff_schedules(staff_id)

@app.post("/api/staff/check-in")
async def staff_check_in(data: Dict):
    staff_id = data.get("staff_id")
    store_id = data.get("store_id") or "default_store"
    device_id = data.get("device_id") or "unknown"

    if not staff_id:
        raise HTTPException(status_code=400, detail="staff_id required")

    from .database import get_staff, get_staff_schedules, save_attendance_checkin, get_active_attendance_log, get_today_checkin

    staff = get_staff(staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff account not found")

    if staff['status'] != 'approved':
        raise HTTPException(status_code=400, detail="승인된 직원만 출퇴근이 가능합니다. 점주의 승인을 받으세요.")

    # 계약 기간 확인
    today_str = datetime.now().strftime("%Y-%m-%d")
    contract = staff['contract_period']
    if not (contract.get("start") <= today_str <= contract.get("end")):
        raise HTTPException(status_code=400, detail="근로계약 기간 외 출퇴근은 불가합니다. 계약 기간을 확인하세요.")

    force = data.get("force", False)

    # 당일 중복 출근 방지 (디바이스 무관, 퇴근 후 재출근 포함 차단)
    if not force:
        today_log = get_today_checkin(staff_id)
        if today_log:
            reg_device = today_log.get('device_id') or '알 수 없음'
            reg_time = str(today_log.get('check_in_time', ''))[:19]
            tardy_flag = " (지각 기록됨)" if today_log.get('tardy') else ""
            raise HTTPException(
                status_code=400,
                detail=f"오늘 이미 출근이 등록되어 있습니다. 동일 시간대 중복 스캔은 허용되지 않습니다{tardy_flag}.\n최초 등록: {reg_time} / 단말기: {reg_device}"
            )

    # 이미 출근 중인지 확인
    active_log = get_active_attendance_log(staff_id)
    if active_log:
        raise HTTPException(status_code=400, detail="이미 출근 상태입니다.")

    # 요일별 스케줄 체크 (0: 월요일, ..., 6: 일요일)
    current_weekday = datetime.now().weekday()
    schedules = get_staff_schedules(staff_id)
    today_schedule = next((s for s in schedules if s['day_of_week'] == current_weekday), None)

    now = datetime.now()

    if not today_schedule:
        if not force:
            raise HTTPException(status_code=400, detail="오늘 배정된 근무 일정이 없습니다. 점주 수동 등록이 필요합니다.")
        tardy = False # 강제 출근 시 스케줄이 없으면 지각 아님
    else:
        # 10분 가드 계산
        sched_start_str = today_schedule['start_time'] # e.g., "10:00"
        try:
            shour, smin = map(int, sched_start_str.split(":"))
            sched_time = now.replace(hour=shour, minute=smin, second=0, microsecond=0)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"스케줄 형식 오류: {e}")

        diff_minutes = (now - sched_time).total_seconds() / 60.0

        # 가드 분배 (전후 5분 수립)
        if not force:
            if diff_minutes < -5.0:
                raise HTTPException(status_code=400, detail=f"출근 스케줄 시작 5분 전부터만 출근 등록이 가능합니다. (출근예정: {sched_start_str})")
            elif diff_minutes > 5.0:
                raise HTTPException(status_code=400, detail=f"출근 허용 시간(5분)을 초과했습니다. 점주 수동 승인을 받으세요. (출근예정: {sched_start_str})")

        tardy = diff_minutes >= 1.0 # 1분 넘게 늦었으면 지각 처리

    log_id = f"ATT-{uuid.uuid4().hex[:6].upper()}"
    check_in_time = now.isoformat()

    if save_attendance_checkin(log_id, staff_id, store_id, check_in_time, tardy, device_id):
        # UI 타임라인에 표시하기 위해 pool에 bundle 추가
        att_bundle = {
            "id": log_id,
            "type": "Attendance",
            "title": f"[{staff['name']}] 출근 완료",
            "items": [
                {"name": "사원명", "value": staff['name']},
                {"name": "지각여부", "value": "지각" if tardy else "정상"},
                {"name": "정산상태", "value": "미정산"}
            ],
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "store_id": store_id
        }
        msg = {
            "type": "STAFF_ATTENDANCE_UPDATE",
            "staff_id": staff_id,
            "name": staff['name'],
            "action": "check-in",
            "tardy": tardy,
            "timestamp": check_in_time
        }
        await manager.broadcast_to_kitchen(msg)
        await manager.broadcast_to_kitchen({"type": "POOL_UPDATED", "bundle_id": log_id, "bundle_type": "Attendance", "store_id": store_id})
        return {"status": "success", "tardy": tardy, "check_in_time": check_in_time}
    raise HTTPException(status_code=500, detail="출근 저장 실패")

@app.post("/api/staff/check-out")
async def staff_check_out(data: Dict):
    staff_id = data.get("staff_id")
    store_id = data.get("store_id", "default_store")
    if not staff_id:
        raise HTTPException(status_code=400, detail="staff_id required")

    device_id = data.get("device_id") or "unknown"
    force = data.get("force", False)

    from .database import get_staff, get_staff_schedules, save_attendance_checkout, get_active_attendance_log, get_today_checkout

    staff = get_staff(staff_id)
    if not staff: raise HTTPException(status_code=404, detail="Staff account not found")

    if not force:
        today_log = get_today_checkout(staff_id)
        if today_log:
            reg_device = today_log.get('device_id') or '알 수 없음'
            reg_time = str(today_log.get('check_out_time', ''))[:19]
            raise HTTPException(
                status_code=400,
                detail=f"오늘 이미 퇴근이 등록되어 있습니다. 동일 시간대 중복 스캔은 허용되지 않습니다.\n최초 등록: {reg_time} / 단말기: {reg_device}"
            )

    active_log = get_active_attendance_log(staff_id)
    if not active_log:
        raise HTTPException(status_code=400, detail="현재 출근 상태가 아닙니다. 먼저 출근 등록을 완료하세요.")
        
    # 요일별 스케줄 체크
    current_weekday = datetime.now().weekday()
    schedules = get_staff_schedules(staff_id)
    today_schedule = next((s for s in schedules if s['day_of_week'] == current_weekday), None)
    
    now = datetime.now()

    if today_schedule:
        sched_end_str = today_schedule['end_time'] # e.g., "18:00"
        try:
            ehour, emin = map(int, sched_end_str.split(":"))
            sched_time = now.replace(hour=ehour, minute=emin, second=0, microsecond=0)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"스케줄 형식 오류: {e}")
            
        diff_minutes = (now - sched_time).total_seconds() / 60.0
        
        # 전후 5분 수립
        if not force:
            if diff_minutes < -5.0:
                raise HTTPException(status_code=400, detail=f"퇴근 스케줄 종료 5분 전부터만 퇴근 등록이 가능합니다. (퇴근예정: {sched_end_str})")
            elif diff_minutes > 5.0:
                raise HTTPException(status_code=400, detail=f"퇴근 허용 시간(5분)을 초과했습니다. 점주 수동 연장 승인을 받으세요. (퇴근예정: {sched_end_str})")
    elif not force:
        raise HTTPException(status_code=400, detail="오늘 배정된 근무 일정이 없습니다. 점주 수동 등록/퇴근이 필요합니다.")
            
    # 근무시간 계산
    check_in_dt = datetime.fromisoformat(active_log['check_in_time'])
    work_minutes = int((now - check_in_dt).total_seconds() / 60)
    if work_minutes < 0: work_minutes = 0
    
    check_out_time = now.isoformat()
    if save_attendance_checkout(staff_id, check_out_time, work_minutes, device_id):
        # UI 타임라인에 표시하기 위해 pool에 bundle 추가
        att_bundle = {
            "id": f"ATT-OUT-{uuid.uuid4().hex[:4].upper()}",
            "type": "Attendance",
            "title": f"[{staff['name']}] 퇴근 완료 (근무 {work_minutes}분)",
            "items": [
                {"name": "사원명", "value": staff['name']},
                {"name": "근무시간", "value": f"{work_minutes}분"},
                {"name": "정산상태", "value": "미정산"}
            ],
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "store_id": store_id
        }
        msg = {
            "type": "STAFF_ATTENDANCE_UPDATE",
            "staff_id": staff_id,
            "name": staff['name'],
            "action": "check-out",
            "work_minutes": work_minutes,
            "timestamp": check_out_time
        }
        await manager.broadcast_to_kitchen(msg)
        await manager.broadcast_to_kitchen({"type": "POOL_UPDATED", "bundle_id": att_bundle['id'], "bundle_type": "Attendance", "store_id": store_id})
        return {"status": "success", "work_minutes": work_minutes, "check_out_time": check_out_time}
    raise HTTPException(status_code=500, detail="퇴근 저장 실패")

@app.get("/api/staff/payroll/{staff_id}")
async def get_staff_payroll(staff_id: str, month: Optional[str] = None):
    """지정 직원의 특정 월(Format YYYY-MM) 급여 산출 리포트"""
    from .database import get_staff, get_staff_attendance_logs
    staff = get_staff(staff_id)
    if not staff: raise HTTPException(status_code=404, detail="Staff not found")
        
    logs = get_staff_attendance_logs(staff_id, month)
    
    total_minutes = sum(log['work_minutes'] or 0 for log in logs)
    total_hours = total_minutes / 60.0
    hourly_wage = staff['hourly_wage']
    
    base_wage = int(total_hours * hourly_wage)
    
    # 주휴수당 간단 연산식 (주 15시간 이상 기준 보정)
    weekly_holiday_allowance = 0
    if total_hours >= 60.0: # 한 달 누계 60시간(주 15시간 이상) 기준
        weekly_holiday_allowance = int((total_hours / 40.0) * 8.0 * hourly_wage)
        
    net_payroll = int((base_wage + weekly_holiday_allowance) * 0.967) # 3.3% 사업소득세 원천징수 적용
    
    return {
        "staff_id": staff_id,
        "name": staff['name'],
        "month": month or "All",
        "hourly_wage": hourly_wage,
        "total_hours": round(total_hours, 1),
        "total_minutes": total_minutes,
        "base_wage": base_wage,
        "weekly_holiday_allowance": weekly_holiday_allowance,
        "tax_deduction": int((base_wage + weekly_holiday_allowance) * 0.033),
        "net_payroll": net_payroll,
        "attendance_logs": logs
    }

@app.post("/api/attendance/pay/{staff_id}")
async def pay_staff_endpoint(staff_id: str):
    from .database import get_db_conn
    conn = get_db_conn()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cur = conn.cursor()
        cur.execute("UPDATE table_attendance_logs SET paid = TRUE WHERE staff_id = %s", (staff_id,))
        conn.commit()
        cur.close()
        conn.close()
        # Broadcast refresh
        await manager.broadcast_to_kitchen({"type": "POOL_UPDATED", "bundle_id": f"EMP-{staff_id}"})
        return {"status": "success", "message": f"Successfully paid all logs for staff {staff_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
