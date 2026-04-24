from fastapi import FastAPI, WebSocket, WebSocketDisconnect, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uuid
import json
import os
from datetime import datetime
from ai_engine import parse_situation_text, analyze_history, analyze_document_image
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    # 확장 필드 (사장님 요청 반영)
    order_code: Optional[str] = None
    store: Optional[str] = None
    table: Optional[str] = None
    Package: Optional[str] = "매장"
    payment: Optional[str] = None

def init_db():
    if not DATABASE_URL: return
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_bundles (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                items JSONB NOT NULL,
                status TEXT,
                order_code TEXT,
                store TEXT,
                "table" TEXT,
                "Package" TEXT,
                payment TEXT
            );
        """)
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"DB Init Error: {e}")

def save_bundle_to_db(bundle: BundleData):
    if not DATABASE_URL: return
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO knowledge_bundles (id, type, title, timestamp, items, status, order_code, store, "table", "Package", payment)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                payment = EXCLUDED.payment,
                order_code = EXCLUDED.order_code,
                "Package" = EXCLUDED."Package";
        """, (
            bundle.id, bundle.type, bundle.title, bundle.timestamp, 
            json.dumps([i.model_dump() for i in bundle.items]), 
            bundle.status, bundle.order_code, bundle.store, bundle.table, bundle.Package, bundle.payment
        ))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Sync Error: {e}")

knowledge_pool: List[BundleData] = []

def load_pool():
    global knowledge_pool
    if not DATABASE_URL: return
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM knowledge_bundles ORDER BY timestamp DESC;")
        rows = cur.fetchall()
        knowledge_pool = [BundleData(**row) for row in rows]
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Load Error: {e}")

init_db()
load_pool()

@app.post("/api/situation")
async def process_situation(request: dict):
    # (기존 AI 처리 로직은 유지하되, 정산 시 payment 필드 업데이트 추가)
    pass

@app.post("/api/order/direct")
async def process_direct_order(request: dict):
    table_no = str(request.get("tableNo", "포장"))
    items = [BundleItem(**item) for item in request.get("items", [])]
    
    # 무한 확장형 ID 생성 (매장명 + 객체유형 + 고유해시)
    store_name = "우리식당"
    unique_id = f"{store_name.replace(' ', '_')}_ORD_{uuid.uuid4().hex[:8].upper()}"
    
    new_bundle = BundleData(
        id=unique_id,
        order_code=str(uuid.uuid4())[:4].upper(),
        store=store_name,
        table=table_no,
        Package="포장" if table_no == "포장" else "매장",
        type="Orders",
        title=f"{store_name}-Table : {table_no}",
        timestamp=datetime.now().strftime("%Y.%m.%d.%H:%M:%S"),
        items=items,
        status="cooking"
    )
    
    knowledge_pool.insert(0, new_bundle)
    save_bundle_to_db(new_bundle)
    await manager.broadcast(new_bundle.model_dump())
    return new_bundle

@app.post("/api/order/update-status")
async def update_order_status(request: dict):
    target_ids = request.get("bundleIds", [])
    new_status = request.get("status") # 'ready', 'serving', 'archived'
    payment_method = request.get("payment", "카드")
    
    print(f"DEBUG: 상태 업데이트 요청 수신! 대상: {len(target_ids)}건, 변경상태: {new_status}")
    
    updated_ids = []
    for b in knowledge_pool:
        if b.id in target_ids:
            print(f"DEBUG: 주문ID {b.id} 상태 변경: {b.status} -> {new_status}")
            b.status = new_status
            if new_status == "archived":
                b.payment = payment_method
            save_bundle_to_db(b)
            updated_ids.append(b.id)
            
    if updated_ids:
        await manager.broadcast({"type": "STATUS_UPDATED", "status": new_status, "ids": updated_ids})
        
    return {"status": "success", "updatedCount": len(updated_ids)}

@app.post("/api/order/settle")
async def settle_order(request: dict):
    raw_table_no = str(request.get("tableNo", "")).strip()
    clean_table_no = raw_table_no.replace("[", "").replace("]", "")
    target_order_code = str(request.get("orderCode", "")).upper().strip()
    target_bundle_id = str(request.get("bundleId", "")).strip()
    target_bundle_ids = request.get("bundleIds", []) # 리스트 형태의 ID들
    
    updated_ids = []
    print(f"DEBUG: 정산 요청 수신 - 테이블: {raw_table_no}, ID개수: {len(target_bundle_ids)}")
    
    for b in knowledge_pool:
        if b.type == "Orders" and b.status != "archived":
            match = False
            
            # 0. 전달받은 고유 ID 리스트에 포함되어 있는지 확인 (가장 확실함)
            if b.id in target_bundle_ids:
                match = True
            
            # 1. 주문 번호(order_code) 직접 매칭
            elif target_order_code and (b.order_code == target_order_code or b.id.upper().startswith(target_order_code)):
                match = True
            
            # 2. 고유 ID 직접 매칭
            elif target_bundle_id and b.id == target_bundle_id:
                match = True
                
            # 3. 테이블 명칭 기반 매칭 (기존 로직)
            elif raw_table_no or clean_table_no:
                b_table = str(b.table or "").strip().replace("[", "").replace("]", "")
                b_title = b.title or ""
                
                if b_table == clean_table_no or b_table == raw_table_no:
                    match = True
                elif f"테이블 {clean_table_no}" in b_title or f"Table {clean_table_no}" in b_title:
                    match = True
                elif clean_table_no == "포장" and "포장" in b_title:
                    match = True
                else:
                    for item in b.items:
                        if item.name in ["테이블", "table"]:
                            val = str(item.value).strip().replace("[", "").replace("]", "")
                            if val == clean_table_no or val == raw_table_no:
                                match = True
                                break
            
            if match:
                print(f"DEBUG: [매칭 성공] ID: {b.id}, 주문번호: {b.order_code} -> archived")
                b.status = "archived"
                b.payment = request.get("payment", "카드")
                save_bundle_to_db(b)
                updated_ids.append(b.id)
    
    print(f"DEBUG: 정산 완료 - 총 {len(updated_ids)}개의 주문이 아카이빙되었습니다.")
    
    if updated_ids:
        await manager.broadcast({"type": "SETTLEMENT_DONE", "tableNo": raw_table_no, "ids": updated_ids})
    
    return {"status": "success", "archivedCount": len(updated_ids)}

@app.get("/api/debug/search/{code}")
async def debug_search_order(code: str):
    found = []
    code_upper = code.upper()
    for b in knowledge_pool:
        # order_code 대조 또는 ID 포함 여부 확인
        b_code = (b.order_code or "").upper()
        if code_upper in b_code or code_upper in b.id.upper():
            found.append(b.model_dump())
    
    if not found:
        return {"status": "not_found", "message": f"'{code}'를 포함하는 주문을 찾을 수 없습니다."}
    
    return {"status": "found", "count": len(found), "data": found}

@app.get("/api/pool")
async def get_pool():
    return [b.model_dump() for b in knowledge_pool]

@app.websocket("/ws/kitchen")
async def websocket_kitchen(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "KITCHEN_DONE":
                target_id = data.get("bundleId")
                for b in knowledge_pool:
                    if b.id == target_id:
                        b.status = "ready"
                        save_bundle_to_db(b)
                        break
            await manager.broadcast(data)
    except Exception:
        manager.disconnect(websocket)
