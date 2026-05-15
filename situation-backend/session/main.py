import os
import json
import asyncio
import httpx  # type: ignore
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db_v2, get_db_conn
from .state import manager, load_pool, save_pool, POOL_FILE  # noqa: F401 — re-exported for legacy imports
from .models import OrderItem, OrderRequest, StatusUpdate, StoreCreateRequest, StoreUpdateRequest  # noqa: F401

from .routers import store, pool, session_routes, payment, order, operations, staff, chat, manual, websocket
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
                print(f"💓 [{datetime.now().strftime('%H:%M:%S')}] DB Keep-alive pulse sent.")

            # 2. 셀프 핑 (HTTP 요청이 있어야 Render가 잠들지 않음)
            render_url = os.getenv("RENDER_EXTERNAL_URL") or "http://localhost:8000"
            async with httpx.AsyncClient() as client:
                await client.get(render_url)
                print(f"🌐 [{datetime.now().strftime('%H:%M:%S')}] Self-ping sent to {render_url}")

        except Exception as e:
            print(f"⚠️ Keep-alive pulse failed: {e}")

        await asyncio.sleep(600)  # 10분 간격


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(keep_alive_task())
    asyncio.create_task(run_mqtt_client(manager))  # MQTT 병행 운용 시작
    yield


app = FastAPI(lifespan=lifespan)

# DB 초기화
init_db_v2()


# --- DB Debug / Sync Script ---
def force_seed_chicvill():
    import psycopg2  # type: ignore  — psycopg2 used directly here to bypass the module-level connection pool
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
    conn.commit()
    cur.close()
    conn.close()

init_config_db()

# --- Frontend Serving ---
# Render 환경과 로컬 환경 모두 지원하는 경로 설정
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # situation-backend/
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "situation-room", "dist")

if os.path.exists(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")


@app.get("/")
async def serve_index():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Frontend not built yet. Please run 'npm run build' in situation-room directory."}


# --- Include Routers ---
app.include_router(store.router)
app.include_router(pool.router)
app.include_router(session_routes.router)
app.include_router(payment.router)
app.include_router(order.router)
app.include_router(operations.router)
app.include_router(staff.router)
app.include_router(chat.router)
app.include_router(manual.router)
# app.include_router(websocket.router)  # Removed as part of MQTT migration
