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

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Real-time WebSocket Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"New client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print(f"Client disconnected. Remaining: {len(self.active_connections)}")

    async def broadcast(self, data: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except Exception as e:
                print(f"Error broadcasting to client: {e}")

manager = ConnectionManager()

@app.post("/api/analyze-image")
async def analyze_image_endpoint(doc_type: str, file: UploadFile = File(...)):
    print(f"\n[DEBUG] >>> 🔍 이미지 분석 시작 ({doc_type}) - {datetime.now().strftime('%H:%M:%S')}")
    try:
        contents = await file.read()
        print(f"[DEBUG] 1. 파일 읽기 성공 (크기: {len(contents)} bytes)")
        
        result = analyze_document_image(contents, doc_type)
        
        if not result:
            print("[DEBUG] ❌ 분석 결과가 비어있습니다.")
        elif "error" in result:
            print(f"[DEBUG] ❌ AI 내부 오류 발생: {result['error']}")
        else:
            print(f"[DEBUG] ✅ AI 분석 완료. 데이터 반환 중...")
            
        return result
    except Exception as e:
        print(f"[DEBUG] 🚨 서버 엔드포인트 치명적 오류: {str(e)}")
        return {"error": str(e)}

class SituationRequest(BaseModel):
    text: str
    targetId: Optional[str] = None # Optional: used for confirming a selection

class DirectUpdateRequest(BaseModel):
    items: List[BundleItem]
    type: Optional[str] = None
    title: Optional[str] = None

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

# Ensure models are fully initialized for Pydantic v2
SituationRequest.model_rebuild()
BundleData.model_rebuild()

# Persistence Settings
KNOWLEDGE_DB = "knowledge_pool.json" # Legacy local fallback
knowledge_pool: List[BundleData] = []

def init_db():
    if not DATABASE_URL:
        print("⚠️ DATABASE_URL not found in .env. Falling back to local JSON.")
        return
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
                status TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_bundle_type ON knowledge_bundles(type);
            CREATE INDEX IF NOT EXISTS idx_bundle_timestamp ON knowledge_bundles(timestamp DESC);
        """)
        conn.commit()
        cur.close()
        conn.close()
        print("✅ Supabase DB initialized (Optimized with Goal-based Indexing).")
    except Exception as e:
        print(f"❌ DB Init Error: {e}")

def save_bundle_to_db(bundle: BundleData):
    """Sync a single bundle to Supabase."""
    if not DATABASE_URL:
        save_pool_local()
        return
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO knowledge_bundles (id, type, title, timestamp, items, status)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                type = EXCLUDED.type,
                title = EXCLUDED.title,
                timestamp = EXCLUDED.timestamp,
                items = EXCLUDED.items,
                status = EXCLUDED.status;
        """, (
            bundle.id, 
            bundle.type, 
            bundle.title, 
            bundle.timestamp, 
            json.dumps([i.model_dump() for i in bundle.items]), 
            bundle.status
        ))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Supabase Sync Error: {e}")
        save_pool_local()

def save_pool_local():
    """Legacy local backup."""
    try:
        with open(KNOWLEDGE_DB, "w", encoding="utf-8") as f:
            data = [b.model_dump() for b in knowledge_pool]
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Failed to save local pool: {e}")

def load_pool():
    global knowledge_pool
    if DATABASE_URL:
        try:
            print("📡 Loading knowledge from Supabase...")
            conn = psycopg2.connect(DATABASE_URL)
            cur = conn.cursor(cursor_factory=RealDictCursor)
            # Load all bundles, ordered by timestamp
            cur.execute("SELECT * FROM knowledge_bundles ORDER BY timestamp DESC;")
            rows = cur.fetchall()
            cur.close()
            conn.close()
            
            knowledge_pool = []
            for row in rows:
                knowledge_pool.append(BundleData(
                    id=row['id'],
                    type=row['type'],
                    title=row['title'],
                    timestamp=row['timestamp'],
                    items=[BundleItem(**i) for i in row['items']],
                    status=row['status']
                ))
            print(f"✅ Loaded {len(knowledge_pool)} bundles from Supabase.")
            return
        except Exception as e:
            print(f"⚠️ Supabase Load Error: {e}. Falling back to local JSON.")
    
    # Fallback to local JSON
    try:
        with open(KNOWLEDGE_DB, "r", encoding="utf-8") as f:
            data = json.load(f)
            knowledge_pool = [BundleData(**b) for b in data]
            print(f"Loaded {len(knowledge_pool)} bundles from local {KNOWLEDGE_DB}")
    except Exception:
        print("No local persistence found.")

# Initialize DB and Load Data
init_db()
load_pool()

@app.post("/api/situation")
async def process_situation(request: SituationRequest):
    global knowledge_pool
    print(f"Received: {request.text} (Target: {request.targetId})")
    
    # 1. Selection Confirmation Mode
    if request.targetId:
        ai_result = parse_situation_text(request.text)
        items = [BundleItem(**item) for item in ai_result.get("items", [])]
        
        if request.targetId == "new":
            new_bundle = BundleData(
                id=str(uuid.uuid4()),
                type=ai_result.get("type", "Log"),
                title=ai_result.get("title", "신규 기록"),
                timestamp=datetime.now().strftime("%H:%M:%S"),
                items=items,
                status="cooking" if ai_result.get("type") == "Orders" else None
            )
            knowledge_pool.insert(0, new_bundle)
            target = new_bundle
        else:
            target = next((b for b in knowledge_pool if b.id == request.targetId), None)
            if target:
                target.items = items
                target.timestamp = datetime.now().strftime("%H:%M:%S")
            else:
                return {"error": "Target not found"}

        save_bundle_to_db(target)
        await manager.broadcast(target.model_dump())
        return target

    # 2. Query Mode
    query_keywords = ["얼마", "누가", "분석", "현황", "어때", "리스트", "계산", "몇 명", "합계", "통계"]
    is_query = "?" in request.text or any(k in request.text for k in query_keywords)
    
    if is_query:
        answer = analyze_history(request.text, knowledge_pool)
        return {
            "id": str(uuid.uuid4()),
            "type": "Analysis",
            "title": "지식 창고 분석",
            "answer": answer,
            "timestamp": datetime.now().strftime("%H:%M:%S")
        }

    # 3. Regular Processing with Conflict Detection
    ai_result = parse_situation_text(request.text)
    items_data = ai_result.get("items", [])
    if not isinstance(items_data, list):
        items_data = []
        
    try:
        items = [BundleItem(**item) for item in items_data if isinstance(item, dict) and "name" in item and "value" in item]
    except Exception as e:
        print(f"Item parsing error: {e}")
        items = []
    
    identifier_item = next((i for i in items if i.name in ['테이블', '주문번호', '이름', '메뉴', '메뉴명']), None)
    
    # 3.1 Handle Settlement (Archiving)
    if ai_result.get("type") == "Settlement" and identifier_item:
        for b in knowledge_pool:
            if any(i.value == identifier_item.value for i in b.items):
                b.status = "archived" 
                save_bundle_to_db(b) # Update each archived bundle
        await manager.broadcast({
            "type": "POOL_CLEARED",
            "subject": identifier_item.value
        })
        return {
            "id": str(uuid.uuid4()),
            "type": "Settlement",
            "title": f"{identifier_item.value} 정산 및 아카이빙 완료",
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "items": items
        }

    if identifier_item:
        candidates = []
        for b in knowledge_pool:
            b_id_item = next((i for i in b.items if i.name == identifier_item.name), None)
            if b.type == ai_result.get("type") and b_id_item and b_id_item.value == identifier_item.value:
                candidates.append({
                    "id": b.id,
                    "title": b.title,
                    "timestamp": b.timestamp
                })
        
        if candidates:
            return {
                "type": "SelectionRequired",
                "message": f"'{identifier_item.value}'와(과) 관련된 기존 내역이 있습니다.",
                "candidates": candidates[:3]
            }

    # 4. No Conflict - Create New
    new_bundle = BundleData(
        id=str(uuid.uuid4()),
        type=ai_result.get("type", "Log"),
        title=ai_result.get("title", "자동 기록"),
        timestamp=datetime.now().strftime("%H:%M:%S"),
        items=items,
        status="cooking" if ai_result.get("type") == "Orders" else None
    )
    knowledge_pool.insert(0, new_bundle)
    save_bundle_to_db(new_bundle)
    await manager.broadcast(new_bundle.model_dump())
    return new_bundle

@app.post("/api/order/direct")
async def process_direct_order(request: dict):
    items = [BundleItem(**item) for item in request.get("items", [])]
    table_no = request.get("tableNo", "-")
    
    new_bundle = BundleData(
        id=str(uuid.uuid4()),
        type="Orders",
        title=f"테이블 {table_no} - 디지털 주문",
        timestamp=datetime.now().strftime("%H:%M:%S"),
        items=items,
        status="cooking"
    )
    
    knowledge_pool.insert(0, new_bundle)
    save_bundle_to_db(new_bundle)
    await manager.broadcast(new_bundle.model_dump())
    return new_bundle

@app.get("/api/pool")
async def get_pool():
    return [b.model_dump() for b in knowledge_pool]

@app.put("/api/bundle/{bundle_id}")
async def direct_update_bundle(bundle_id: str, request: DirectUpdateRequest):
    """Directly update a bundle's items without AI parsing. Used for structured forms like StoreManager."""
    global knowledge_pool
    target = next((b for b in knowledge_pool if b.id == bundle_id), None)
    
    if not target:
        # Create a new bundle if not found
        new_bundle = BundleData(
            id=bundle_id,
            type=request.type or "StoreConfig",
            title=request.title or "매장 정보",
            timestamp=datetime.now().strftime("%H:%M:%S"),
            items=request.items
        )
        knowledge_pool.insert(0, new_bundle)
        save_bundle_to_db(new_bundle)
        await manager.broadcast(new_bundle.model_dump())
        return new_bundle
    
    # Replace all items with new ones for a clean state
    target.items = request.items
    
    if request.type:
        target.type = request.type
    if request.title:
        target.title = request.title
    
    target.timestamp = datetime.now().strftime("%H:%M:%S")
    save_bundle_to_db(target)
    await manager.broadcast(target.model_dump())
    return target

@app.websocket("/ws/kitchen")
async def websocket_kitchen(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "KITCHEN_DONE":
                # Update status in pool persistent
                target_id = data.get("bundleId")
                for b in knowledge_pool:
                    if b.id == target_id:
                        b.status = "ready"
                        save_bundle_to_db(b)
                        break
            await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket Error: {e}")
        manager.disconnect(websocket)

