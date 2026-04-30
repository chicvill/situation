from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, File, UploadFile, Query, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from typing import List, Optional
import uuid
import json
import os
from datetime import datetime
# AI 엔진 모듈 임포트
from ai_engine import parse_situation_text, analyze_history, analyze_document_image
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# .env 파일 로드 (상위 디렉토리 확인)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
DATABASE_URL = os.getenv("DATABASE_URL")

app = FastAPI()

# ── 프론트엔드 정적 파일 서빙 설정 ──────────────────────
# Docker: /app/situation-room/dist  |  로컬: ../situation-room/dist
_base = os.path.dirname(os.path.abspath(__file__))
FRONT_DIST = os.path.join(_base, "..", "situation-room", "dist")
if not os.path.exists(FRONT_DIST):
    # Docker 환경에서 /app이 루트인 경우
    FRONT_DIST = os.path.join("/app", "situation-room", "dist")

@app.api_route("/", methods=["GET", "HEAD"], response_class=HTMLResponse)
async def root(request: Request):
    """React 앱의 index.html 서빙"""
    if request.method == "HEAD":
        return HTMLResponse(content="", status_code=200)
    index_path = os.path.join(FRONT_DIST, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Frontend not built yet.</h1><p>Run: npm run build in situation-room</p>", status_code=503)

@app.get("/health")
async def health():
    return {
        "status": "online",
        "message": "Knowledge Pool API is running successfully!",
        "database": "Connected to Supabase"
    }

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 파일 경로 설정
POOL_FILE = "knowledge_pool.json"

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, data: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except Exception as e:
                print(f"Error broadcasting: {e}")

manager = ConnectionManager()

@app.websocket("/ws/kitchen")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # 클라이언트로부터 메시지를 기다리거나 상태를 유지
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

class BundleItem(BaseModel):
    name: str
    value: str
    icon: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None

class BundleData(BaseModel):
    id: str
    type: str
    title: str
    timestamp: str
    items: List[BundleItem]
    status: Optional[str] = None
    order_code: Optional[str] = None
    store_id: Optional[str] = None # 고유 식별자 추가
    store: Optional[str] = None    # 표시용 매장명
    table: Optional[str] = None
    Package: Optional[str] = "매장"
    payment: Optional[str] = None
    device_id: Optional[str] = None

knowledge_pool: List[BundleData] = []

def get_db_conn():
    """Supabase PostgreSQL 연결"""
    if not DATABASE_URL:
        return None
    try:
        return psycopg2.connect(DATABASE_URL)
    except Exception as e:
        print(f"DB Connection Error: {e}")
        return None

def init_db():
    """데이터베이스 초기화 및 스키마 마이그레이션"""
    conn = get_db_conn()
    if conn:
        try:
            cur = conn.cursor()
            # 테이블 및 컬럼 보장
            cur.execute("""
                CREATE TABLE IF NOT EXISTS knowledge_bundles (
                    id TEXT PRIMARY KEY,
                    type TEXT,
                    title TEXT,
                    timestamp TEXT,
                    items JSONB,
                    status TEXT,
                    order_code TEXT,
                    store_id TEXT,
                    store TEXT,
                    "table" TEXT,
                    package TEXT,
                    payment TEXT,
                    device_id TEXT
                )
            """)
            
            # 기존 테이블에 누락된 컬럼 추가 (마이그레이션)
            cur.execute("ALTER TABLE knowledge_bundles ADD COLUMN IF NOT EXISTS store_id TEXT")
            cur.execute("ALTER TABLE knowledge_bundles ADD COLUMN IF NOT EXISTS device_id TEXT")
            cur.execute("ALTER TABLE knowledge_bundles ADD COLUMN IF NOT EXISTS payment TEXT")
            cur.execute("ALTER TABLE knowledge_bundles ADD COLUMN IF NOT EXISTS package TEXT")
            cur.execute("ALTER TABLE knowledge_bundles ADD COLUMN IF NOT EXISTS \"table\" TEXT")
            cur.execute("ALTER TABLE knowledge_bundles ADD COLUMN IF NOT EXISTS store TEXT")
            cur.execute("ALTER TABLE knowledge_bundles ADD COLUMN IF NOT EXISTS order_code TEXT")
            cur.execute("ALTER TABLE knowledge_bundles ADD COLUMN IF NOT EXISTS status TEXT")
            
            conn.commit()
            cur.close()
            conn.close()
            print("✅ Database schema check & migration complete.")
        except Exception as e:
            print(f"❌ DB Init Error: {e}")
    else:
        print("⚠️ No DATABASE_URL found. Skipping DB initialization.")

def save_pool():
    """지식 풀을 로컬 JSON 및 Supabase에 저장"""
    # 1. 로컬 저장 (백업용)
    try:
        with open(POOL_FILE, "w", encoding="utf-8") as f:
            json.dump([b.model_dump() for b in knowledge_pool], f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Local Save Error: {e}")

    # 2. Supabase 저장
    conn = get_db_conn()
    if conn:
        try:
            cur = conn.cursor()
            # 현재 지식 풀의 모든 번들 업서트 (Upsert)
            for b in knowledge_pool:
                data = b.model_dump()
                cur.execute("""
                    INSERT INTO knowledge_bundles (id, type, title, timestamp, items, status, order_code, store_id, store, "table", package, payment, device_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        type = EXCLUDED.type,
                        title = EXCLUDED.title,
                        timestamp = EXCLUDED.timestamp,
                        items = EXCLUDED.items,
                        status = EXCLUDED.status,
                        order_code = EXCLUDED.order_code,
                        store_id = EXCLUDED.store_id,
                        store = EXCLUDED.store,
                        "table" = EXCLUDED.table,
                        package = EXCLUDED.package,
                        payment = EXCLUDED.payment,
                        device_id = EXCLUDED.device_id
                """, (
                    data['id'], data['type'], data['title'], data['timestamp'], 
                    json.dumps(data['items']), data.get('status'), data.get('order_code'),
                    data.get('store_id'), data.get('store'), data.get('table'), data.get('Package'), data.get('payment'), data.get('device_id')
                ))
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            print(f"Supabase Save Error: {e}")

def load_pool():
    """지식 풀 로드: Supabase 우선, 없으면 로컬 파일 폴백"""
    global knowledge_pool
    loaded_from_db = False

    # 1. Supabase 시도
    conn = get_db_conn()
    if conn:
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("SELECT id, type, title, timestamp, items, status, order_code, store_id, store, \"table\", package, payment, device_id FROM knowledge_bundles")
            rows = cur.fetchall()
            if rows:
                knowledge_pool = []
                for row in rows:
                    # items 필드가 문자열인 경우 객체로 변환
                    items_data = row['items']
                    if isinstance(items_data, str):
                        items_data = json.loads(items_data)
                    
                    # Package 필드 대소문자 대응
                    pkg = row.get('package') or row.get('Package') or "매장"

                    knowledge_pool.append(BundleData(
                        id=row['id'],
                        type=row['type'],
                        title=row['title'],
                        timestamp=row['timestamp'],
                        items=[BundleItem(**i) for i in items_data],
                        status=row.get('status'),
                        order_code=row.get('order_code'),
                        store_id=row.get('store_id'),
                        store=row.get('store'),
                        table=row.get('table'),
                        Package=pkg,
                        payment=row.get('payment'),
                        device_id=row.get('device_id')
                    ))
                print(f"✅ Supabase에서 {len(knowledge_pool)}개의 번들을 로드했습니다.")
                loaded_from_db = True
            cur.close()
            conn.close()
        except Exception as e:
            print(f"Supabase Load Error: {e}")

    # 2. 로컬 파일 시도 (DB 데이터가 없거나 로드 실패한 경우)
    if not loaded_from_db and os.path.exists(POOL_FILE):
        try:
            with open(POOL_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                knowledge_pool = [BundleData(**d) for d in data]
                print(f"✅ 로컬 파일에서 {len(knowledge_pool)}개의 번들을 로드했습니다.")
        except Exception as e:
            print(f"Local Load Error: {e}")
            knowledge_pool = []
    
    # 데이터가 아예 없는 경우에만 빈 리스트 보장
    if not globals().get('knowledge_pool'):
        knowledge_pool = []

@app.on_event("startup")
async def startup_event():
    print("🚀 Application starting up...")
    init_db()
    load_pool()

@app.get("/api/pool")
async def get_pool(store_id: Optional[str] = Query(None)):
    """지식 풀 반환 (매장 ID별 필터링 지원)"""
    if store_id and store_id != "Total":
        return [b for b in knowledge_pool if b.store_id == store_id]
    return knowledge_pool

# --- 번들 업데이트 (StoreManager 및 메뉴 설정용) ---

@app.put("/api/bundle/{bundle_id}")
async def update_bundle(bundle_id: str, request: dict):
    """지식 풀 내의 특정 번들을 업데이트 또는 신규 생성 (매장별 분류 지원)."""
    items = [BundleItem(**i) for i in request.get("items", [])]
    b_type = request.get("type", "Log")
    title = request.get("title", "업데이트된 정보")
    store_id = request.get("store_id")
    store_name = request.get("store")
    device_id = request.get("deviceId")
    
    # 1. 매장별 고유 타입 업데이트 (StoreConfig, Menus 등은 매장당 하나만 존재)
    if b_type in ["StoreConfig", "Menus"] and store_id:
        for b in knowledge_pool:
            if b.type == b_type and b.store_id == store_id:
                b.items = items
                b.title = title
                b.timestamp = datetime.now().strftime("%Y.%m.%d.%H:%M:%S")
                b.device_id = device_id
                save_pool()
                await manager.broadcast({"type": "POOL_UPDATED", "store_id": store_id})
                return {"status": "success", "mode": "updated_by_store_type"}

    # 2. ID 기반 업데이트
    found = False
    for b in knowledge_pool:
        if b.id == bundle_id:
            b.items = items
            b.type = b_type
            b.title = title
            b.store_id = store_id or b.store_id
            b.store = store_name or b.store
            b.timestamp = datetime.now().strftime("%Y.%m.%d.%H:%M:%S")
            found = True
            break
            
    # 3. 신규 생성
    if not found:
        new_bundle = BundleData(
            id=bundle_id if bundle_id and bundle_id != "null" else str(uuid.uuid4()),
            type=b_type,
            title=title,
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            items=items,
            store_id=store_id,
            store=store_name,
            device_id=device_id
        )
        knowledge_pool.insert(0, new_bundle)
    
    save_pool()
    await manager.broadcast({"type": "POOL_UPDATED", "store_id": store_id})
    return {"status": "success"}

# --- 프론트엔드 규격에 맞춘 이미지 분석 엔드포인트 ---

@app.post("/api/analyze-image")
async def analyze_image(
    file: UploadFile = File(...), 
    doc_type: str = Query("reg")
):
    try:
        contents = await file.read()
        analysis_result = analyze_document_image(contents, doc_type)
        
        if "error" in analysis_result:
            return {"error": analysis_result["error"]}

        # UI가 기대하는 JSON 형식으로 즉시 반환 (StoreManager 호환)
        if doc_type == "reg":
            return {
                "brand": analysis_result.get("brand", ""),
                "regNo": analysis_result.get("regNo", ""),
                "address": analysis_result.get("address", ""),
                "owner": analysis_result.get("owner", "")
            }
        else:
            return analysis_result # 메뉴판의 경우 {"menus": [...]} 반환
            
    except Exception as e:
        print(f"Analysis Error: {e}")
        return {"error": str(e)}

@app.post("/api/situation")
async def process_situation(request: dict):
    text = request.get("text", "")
    context = request.get("context", "") # 현재 화면 정보
    store_id = request.get("store_id")
    store_name = request.get("store", "Total")
    try:
        analysis_result = parse_situation_text(text, store_name, context)
        new_bundle = BundleData(
            id=f"SIT_{uuid.uuid4().hex[:8].upper()}",
            type=analysis_result.get("type", "Log"),
            title=analysis_result.get("title", "AI 분석 리포트"),
            timestamp=datetime.now().strftime("%Y.%m.%d.%H:%M:%S"),
            items=[BundleItem(**i) for i in analysis_result.get("items", [])],
            status=analysis_result.get("status"),
            store_id=store_id,
            store=store_name
        )
        knowledge_pool.insert(0, new_bundle)
        save_pool()
        await manager.broadcast(new_bundle.model_dump())
        return new_bundle
    except Exception as e:
        return {"error": str(e)}

# --- AI 답변 및 정밀 분석 엔드포인트 ---

@app.post("/api/chat")
async def chat_analysis(request: Request):
    data = await request.json()
    query = data.get("query")
    history = data.get("history", []) # 프론트엔드에서 현재 지식 번들 전달
    store_id = data.get("store_id")
    store_name = data.get("store", "Total")
    
    # history 객체 리스트를 BundleData 모델로 변환 및 매장 필터링
    bundles = [BundleData(**b) for b in history if b.get("store_id") == store_id or store_id == "Total"]
    
    # AI 엔진을 통해 히스토리 분석
    response = analyze_history(query, bundles, store_name)
    return {"answer": response}

@app.post("/api/analyze")
async def analyze_situation_api(request: Request):
    data = await request.json()
    text = data.get("text")
    context = data.get("context", "")
    store_name = data.get("store", "Total")
    
    # AI 엔진을 통해 텍스트 분석
    result = parse_situation_text(text, store_name, context)
    return result

@app.post("/api/order/direct")
async def process_direct_order(request: dict):
    table_no = str(request.get("tableNo", "포장"))
    items = [BundleItem(**item) for item in request.get("items", [])]
    payment_method = request.get("payment", "현장결제")
    device_id = request.get("deviceId")
    store_id = request.get("store_id")
    store_name_req = request.get("store")
    
    order_code = str(uuid.uuid4().hex[:4]).upper()
    
    # 지식 풀에서 상호명 검색 (요청에 없을 경우 대비)
    store_name = store_name_req
    if not store_name:
        store_name = "미지정 매장"
        for b in knowledge_pool:
            if b.type == "StoreConfig" and (b.store_id == store_id or not store_id):
                for item in b.items:
                    if "상호" in item.name or "brand" in item.name:
                        store_name = item.value
                        break
                break

    new_bundle = BundleData(
        id=f"ORD_{uuid.uuid4().hex[:8].upper()}",
        order_code=order_code,
        store_id=store_id,
        store=store_name,
        table=table_no,
        Package="포장" if table_no == "포장" else "매장",
        type="Orders",
        title=f"Table {table_no} Order",
        timestamp=datetime.now().strftime("%Y.%m.%d.%H:%M:%S"),
        items=items,
        status="cooking",
        payment=payment_method,
        device_id=device_id
    )
    knowledge_pool.insert(0, new_bundle)
    save_pool()
    await manager.broadcast(new_bundle.model_dump())
    return new_bundle

@app.post("/api/order/update-status")
async def update_order_status(request: dict):
    target_ids = request.get("bundleIds", [])
    new_status = request.get("status")
    payment_method = request.get("payment", "카드")
    updated_ids = []
    for b in knowledge_pool:
        if b.id in target_ids:
            b.status = new_status
            if new_status == "archived":
                b.payment = payment_method
            updated_ids.append(b.id)
    if updated_ids:
        save_pool()
        await manager.broadcast({"type": "STATUS_UPDATED", "status": new_status, "ids": updated_ids})
    return {"status": "success", "updatedCount": len(updated_ids)}

@app.post("/api/payment/confirm")
async def confirm_payment(request: dict):
    """토스페이먼츠 결제 승인 샌드박스 (데모용)"""
    payment_key = request.get("paymentKey")
    order_id = request.get("orderId")
    amount = request.get("amount")
    
    # 실제 환경에서는 여기서 토스 API 호출 (Secret Key 필요)
    # 지금은 데모이므로 성공으로 간주하고 상태 업데이트
    
    target_bundle = None
    for b in knowledge_pool:
        if b.order_code == order_id or b.id == order_id:
            b.status = "paid"
            b.payment = "카드(토스)"
            target_bundle = b
            break
            
    if target_bundle:
        save_pool()
        await manager.broadcast({"type": "STATUS_UPDATED", "status": "paid", "ids": [target_bundle.id]})
        return {"status": "success", "orderId": order_id}
        
    return {"status": "error", "message": "Order not found"}


@app.post("/api/checkin/request")
async def request_checkin(request: dict):
    table_no = str(request.get("tableNo"))
    device_id = request.get("deviceId")
    store_id = request.get("store_id")
    store_name = request.get("store", "Unknown")
    
    # 이미 승인된 기기인지 확인
    for b in knowledge_pool:
        if b.type == "Checkins" and b.table == table_no and b.device_id == device_id and b.status == "approved" and b.store_id == store_id:
            return {"status": "approved", "message": "Already approved"}

    new_checkin = BundleData(
        id=f"CHK_{uuid.uuid4().hex[:8].upper()}",
        type="Checkins",
        title=f"Table {table_no} 체크인 요청",
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        items=[BundleItem(name="상태", value="대기중")],
        status="pending",
        table=table_no,
        device_id=device_id,
        store_id=store_id,
        store=store_name
    )
    knowledge_pool.insert(0, new_checkin)
    save_pool()
    await manager.broadcast({"type": "CHECKIN_REQUESTED", "table": table_no})
    return {"status": "pending"}

@app.post("/api/checkin/approve")
async def approve_checkin(request: dict):
    target_id = request.get("checkinId")
    for b in knowledge_pool:
        if b.id == target_id:
            b.status = "approved"
            b.items = [BundleItem(name="상태", value="승인됨")]
            save_pool()
            await manager.broadcast({"type": "CHECKIN_APPROVED", "checkinId": target_id, "table": b.table, "deviceId": b.device_id})
            return {"status": "success"}
    return {"status": "error", "message": "Checkin not found"}

@app.get("/api/paper")
async def get_paper():
    """논문 마크다운 파일 읽기 (경로 유연성 확보)"""
    # 1. 상위 디렉토리 확인 (프로젝트 루트)
    # 2. 현재 디렉토리 확인
    paths = ["../AI_지능형_운영_시스템_논문.md", "AI_지능형_운영_시스템_논문.md"]
    
    for paper_path in paths:
        if os.path.exists(paper_path):
            with open(paper_path, "r", encoding="utf-8") as f:
                return {"content": f.read()}
                
    return {"error": "Paper not found at " + os.getcwd()}

@app.get("/api/server-ip")
async def get_server_ip():
    """서버의 로컬 IP 주소 반환"""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return {"ip": ip}
    except Exception:
        return {"ip": "localhost"}

@app.delete("/api/pool")
async def clear_pool(store_id: str = Query(...)):
    """특정 매장의 지식 풀 초기화"""
    global knowledge_pool
    
    # Supabase 삭제
    conn = get_db_conn()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute("DELETE FROM knowledge_bundles WHERE store_id = %s", (store_id,))
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            print(f"Supabase Clear Error: {e}")
            
    knowledge_pool = [b for b in knowledge_pool if b.store_id != store_id]
    save_pool()
    await manager.broadcast({"type": "POOL_UPDATED", "store_id": store_id})
    return {"status": "success", "message": f"Knowledge pool for store ID '{store_id}' has been reset."}

@app.delete("/api/orders")
async def clear_orders(store_id: str = Query(...)):
    """특정 매장의 주문 내역만 초기화"""
    global knowledge_pool
    
    # Supabase 삭제
    conn = get_db_conn()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute("DELETE FROM knowledge_bundles WHERE type = 'Orders' AND store_id = %s", (store_id,))
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            print(f"Supabase Clear Orders Error: {e}")

    knowledge_pool = [b for b in knowledge_pool if not (b.type == "Orders" and b.store_id == store_id)]
    save_pool()
    await manager.broadcast({"type": "POOL_UPDATED", "store_id": store_id})
    return {"status": "success"}

# 포인트 관리 (데모용 메모리 DB)
points_db = {}

@app.get("/api/points/{phone}")
async def get_points(phone: str):
    return {"points": points_db.get(phone, 0)}

@app.post("/api/points/update")
async def update_points(request: dict):
    phone = request.get("phone")
    add_points = request.get("addPoints", 0)
    use_points = request.get("usePoints", 0)
    
    current = points_db.get(phone, 0)
    new_total = current + add_points - use_points
    points_db[phone] = max(0, new_total)
    
    return {"status": "success", "newPoints": points_db[phone]}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

# ── SPA 라우팅 지원: React Router 경로를 index.html로 폴백 ──
if os.path.exists(FRONT_DIST):
    app.mount("/", StaticFiles(directory=FRONT_DIST, html=True), name="static")
