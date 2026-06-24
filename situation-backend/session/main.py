import os
import asyncio
import httpx  # type: ignore
from contextlib import asynccontextmanager
from datetime import datetime
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())  # situation-backend/.env 자동 탐색 및 로드
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db_v2, get_db_conn, seed_stores_from_pool
from .db.session_db import init_archive_table
from .state import manager, load_pool, save_pool, POOL_FILE  # noqa: F401 — re-exported for legacy imports
from .models import OrderItem, OrderRequest, StatusUpdate, StoreCreateRequest, StoreUpdateRequest  # noqa: F401

from .routers import store, pool, session_routes, payment, order, operations, staff, chat, manual, notify, stats, dutch
from .routers import auth_router
from .routers import debug_router
from .mqtt_handler import run_mqtt_client


# --- Render Keep-Alive ---
async def keep_alive_task():
    """Render 서버가 잠들지 않도록 10분마다 DB 작업 및 셀프 핑을 수행합니다."""
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
                print(f"[{datetime.now().strftime('%H:%M:%S')}] DB Keep-alive pulse sent.")

            # 2. 셀프 핑 (HTTP 요청이 있어야 Render가 잠들지 않음)
            render_url = os.getenv("RENDER_EXTERNAL_URL") or "http://localhost:8080"
            async with httpx.AsyncClient() as client:
                await client.get(render_url)
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Self-ping sent to {render_url}")

        except Exception as e:
            print(f"Keep-alive pulse failed: {e}")

        await asyncio.sleep(840)  # 14분 간격 (Render 15분 슬립 타임아웃 방지)


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(keep_alive_task())
    asyncio.create_task(run_mqtt_client(manager))  # MQTT 병행 운용 시작
    yield


app = FastAPI(lifespan=lifespan)

# DB 초기화
init_db_v2()
seed_stores_from_pool()  # stores 테이블이 비어있으면 pool.json에서 자동 시딩


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Store Config init ---
def init_config_db():
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS store_configs (
            store_id TEXT PRIMARY KEY,
            manual TEXT DEFAULT ''
        )
    """)
    # 주방 사용 여부 컬럼 추가 (기존 배포 환경 호환)
    cur.execute("ALTER TABLE stores ADD COLUMN IF NOT EXISTS table_count INTEGER DEFAULT 12")
    cur.execute("ALTER TABLE stores ADD COLUMN IF NOT EXISTS use_kitchen BOOLEAN DEFAULT TRUE")
    cur.execute("ALTER TABLE stores ADD COLUMN IF NOT EXISTS use_call BOOLEAN DEFAULT TRUE")
    cur.execute("ALTER TABLE stores ADD COLUMN IF NOT EXISTS use_waiting BOOLEAN DEFAULT TRUE")
    cur.execute("ALTER TABLE stores ADD COLUMN IF NOT EXISTS use_parking BOOLEAN DEFAULT TRUE")
    cur.execute("ALTER TABLE stores ADD COLUMN IF NOT EXISTS use_points BOOLEAN DEFAULT TRUE")
    cur.execute("ALTER TABLE stores ADD COLUMN IF NOT EXISTS use_reservation BOOLEAN DEFAULT TRUE")
    cur.execute("ALTER TABLE stores ADD COLUMN IF NOT EXISTS use_display BOOLEAN DEFAULT TRUE")
    cur.execute("ALTER TABLE stores ADD COLUMN IF NOT EXISTS use_staff BOOLEAN DEFAULT TRUE")
    cur.execute("ALTER TABLE stores ADD COLUMN IF NOT EXISTS use_dutch BOOLEAN DEFAULT TRUE")
    conn.commit()
    cur.close()
    conn.close()

init_config_db()
init_archive_table()

# --- Frontend Serving ---
# Render 환경과 로컬 환경 모두 지원하는 경로 설정
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # situation-backend/
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "situation-room", "dist")

if os.path.exists(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")
    
    # Mount separate AI Physiognomy Saju app served at /gwansang/
    GWANSANG_DIR = os.path.join(FRONTEND_DIR, "gwansang")
    if os.path.exists(GWANSANG_DIR):
        app.mount("/gwansang", StaticFiles(directory=GWANSANG_DIR, html=True), name="gwansang")

GWANSANG_DIR = os.path.join(os.path.dirname(BASE_DIR), "ai관상SaaS", "dist")
if os.path.exists(GWANSANG_DIR):
    app.mount("/gwansang-app", StaticFiles(directory=GWANSANG_DIR, html=True), name="gwansang-app")


@app.get("/")
@app.head("/")
async def serve_index():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Frontend not built yet. Please run 'npm run build' in situation-room directory."}


# --- Include Routers ---
app.include_router(auth_router.router)
app.include_router(store.router)
app.include_router(pool.router)
app.include_router(session_routes.router)
app.include_router(payment.router)
app.include_router(order.router)
app.include_router(operations.router)
app.include_router(staff.router)
app.include_router(chat.router)
app.include_router(manual.router)
app.include_router(notify.router)
app.include_router(debug_router.router)
app.include_router(stats.router)
app.include_router(dutch.router)
# app.include_router(websocket.router)  # Removed as part of MQTT migration
