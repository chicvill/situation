from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, File, UploadFile, Query, Form
from fastapi.middleware.cors import CORSMiddleware
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

@app.get("/")
async def root():
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

class BundleItem(BaseModel):
    name: str
    value: str

class BundleData(BaseModel):
    id: str
    type: str
    title: str
    timestamp: str
    items: List[BundleItem]
    status: Optional[str] = None
    order_code: Optional[str] = None
    store: Optional[str] = None
    table: Optional[str] = None
    Package: Optional[str] = "매장"
    payment: Optional[str] = None

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
                    store TEXT,
                    "table" TEXT,
                    package TEXT,
                    payment TEXT
                )
            """)
            
            # 현재 지식 풀의 모든 번들 업서트 (Upsert)
            for b in knowledge_pool:
                data = b.model_dump()
                cur.execute("""
                    INSERT INTO knowledge_bundles (id, type, title, timestamp, items, status, order_code, store, "table", package, payment)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        type = EXCLUDED.type,
                        title = EXCLUDED.title,
                        timestamp = EXCLUDED.timestamp,
                        items = EXCLUDED.items,
                        status = EXCLUDED.status,
                        order_code = EXCLUDED.order_code,
                        store = EXCLUDED.store,
                        "table" = EXCLUDED.table,
                        package = EXCLUDED.package,
                        payment = EXCLUDED.payment
                """, (
                    data['id'], data['type'], data['title'], data['timestamp'], 
                    json.dumps(data['items']), data.get('status'), data.get('order_code'),
                    data.get('store'), data.get('table'), data.get('Package'), data.get('payment')
                ))
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            print(f"Supabase Save Error: {e}")

def load_pool():
    """Supabase에서 지식 풀 로드 (실패 시 로컬 파일 사용)"""
    global knowledge_pool
    
    # 1. Supabase 시도
    conn = get_db_conn()
    if conn:
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("SELECT * FROM knowledge_bundles ORDER BY timestamp DESC")
            rows = cur.fetchall()
            if rows:
                new_pool = []
                allowed_keys = BundleData.model_fields.keys()
                for row in rows:
                    if 'package' in row:
                        row['Package'] = row.pop('package')
                    # BundleData 필드에 해당하는 것만 추출
                    filtered_row = {k: v for k, v in row.items() if k in allowed_keys}
                    new_pool.append(BundleData(**filtered_row))
                
                knowledge_pool = new_pool
                print(f"✅ Supabase에서 {len(knowledge_pool)}개의 번들을 로드했습니다.")
                cur.close()
                conn.close()
                return
            cur.close()
            conn.close()
        except Exception as e:
            print(f"Supabase Load Error: {e}")

    # 2. 로컬 파일 시도
    if os.path.exists(POOL_FILE):
        try:
            with open(POOL_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                knowledge_pool = [BundleData(**d) for d in data]
                print(f"✅ 로컬 파일에서 {len(knowledge_pool)}개의 번들을 로드했습니다.")
        except Exception as e:
            print(f"Local Load Error: {e}")
            knowledge_pool = []
    else:
        knowledge_pool = []

load_pool()

# --- 번들 업데이트 (StoreManager 및 메뉴 설정용) ---

@app.put("/api/bundle/{bundle_id}")
async def update_bundle(bundle_id: str, request: dict):
    """지식 풀 내의 특정 번들을 업데이트. StoreConfig/Menus 타입은 하나만 유지하도록 강제."""
    items = [BundleItem(**i) for i in request.get("items", [])]
    b_type = request.get("type", "Log")
    title = request.get("title", "업데이트된 정보")
    
    # StoreConfig나 Menus는 시스템에 하나만 존재해야 하는 데이터임
    if b_type in ["StoreConfig", "Menus"]:
        found_by_type = False
        for b in knowledge_pool:
            if b.type == b_type:
                b.items = items
                b.title = title
                b.timestamp = datetime.now().strftime("%Y.%m.%d.%H:%M:%S")
                found_by_type = True
                break
        if found_by_type:
            save_pool()
            await manager.broadcast({"type": "POOL_UPDATED"})
            return {"status": "success", "mode": "updated_by_type"}

    # ID로 찾아서 업데이트
    found = False
    for b in knowledge_pool:
        if b.id == bundle_id:
            b.items = items
            b.type = b_type
            b.title = title
            b.timestamp = datetime.now().strftime("%Y.%m.%d.%H:%M:%S")
            found = True
            break
            
    if not found:
        # 해당 ID가 없으면 새로 생성
        new_bundle = BundleData(
            id=bundle_id,
            type=b_type,
            title=title,
            timestamp=datetime.now().strftime("%Y.%m.%d.%H:%M:%S"),
            items=items
        )
        knowledge_pool.insert(0, new_bundle)
    
    save_pool()
    await manager.broadcast({"type": "POOL_UPDATED"})
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
    try:
        analysis_result = parse_situation_text(text)
        new_bundle = BundleData(
            id=f"SIT_{uuid.uuid4().hex[:8].upper()}",
            type=analysis_result.get("type", "Log"),
            title=analysis_result.get("title", "AI 분석 리포트"),
            timestamp=datetime.now().strftime("%Y.%m.%d.%H:%M:%S"),
            items=[BundleItem(**i) for i in analysis_result.get("items", [])],
            status=analysis_result.get("status")
        )
        knowledge_pool.insert(0, new_bundle)
        save_pool()
        await manager.broadcast(new_bundle.model_dump())
        return new_bundle
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/order/direct")
async def process_direct_order(request: dict):
    table_no = str(request.get("tableNo", "포장"))
    items = [BundleItem(**item) for item in request.get("items", [])]
    order_code = str(uuid.uuid4().hex[:4]).upper()
    
    # 지식 풀에서 현재 상호명 검색
    store_name = "미지정 매장"
    for b in knowledge_pool:
        if b.type == "StoreConfig":
            for item in b.items:
                if "상호" in item.name or "brand" in item.name:
                    store_name = item.value
                    break
            break

    new_bundle = BundleData(
        id=f"ORD_{uuid.uuid4().hex[:8].upper()}",
        order_code=order_code,
        store=store_name,
        table=table_no,
        Package="포장" if table_no == "포장" else "매장",
        type="Orders",
        title=f"Table {table_no} Order",
        timestamp=datetime.now().strftime("%Y.%m.%d.%H:%M:%S"),
        items=items,
        status="cooking"
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

@app.get("/api/pool")
async def get_pool():
    return [b.model_dump() for b in knowledge_pool]

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
async def clear_pool():
    """지식 풀 전체 초기화 (메모리, 파일, DB 모두 삭제)"""
    global knowledge_pool
    knowledge_pool = []
    
    # Supabase 삭제
    conn = get_db_conn()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute("DELETE FROM knowledge_bundles")
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            print(f"Supabase Clear Error: {e}")
            
    save_pool()
    await manager.broadcast({"type": "POOL_UPDATED"})
    return {"status": "success", "message": "Knowledge pool has been reset."}

@app.delete("/api/orders")
async def clear_orders():
    """주문 내역만 초기화"""
    global knowledge_pool
    knowledge_pool = [b for b in knowledge_pool if b.type != "Orders"]
    
    # Supabase 삭제
    conn = get_db_conn()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute("DELETE FROM knowledge_bundles WHERE type = 'Orders'")
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            print(f"Supabase Clear Orders Error: {e}")
            
    save_pool()
    await manager.broadcast({"type": "POOL_UPDATED"})
    return {"status": "success", "message": "Order history has been cleared."}

@app.websocket("/ws/kitchen")
async def websocket_kitchen(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(data)
    except Exception:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
