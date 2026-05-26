import os
import json
import uuid
import random
import psycopg2
from datetime import datetime, timedelta
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("[ERROR] DATABASE_URL not found!")
    exit(1)

print("[CONNECT] Connecting to Database...")
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Ensure table exists
cur.execute("""
    CREATE TABLE IF NOT EXISTS session_archive (
        session_id       TEXT PRIMARY KEY,
        store_id         TEXT,
        table_id         TEXT,
        checkin_time     TEXT,
        checkout_time    TEXT,
        duration_minutes INTEGER DEFAULT 0,
        order_count      INTEGER DEFAULT 0,
        total_revenue    INTEGER DEFAULT 0,
        cancelled_count  INTEGER DEFAULT 0,
        items_summary    JSONB   DEFAULT '[]',
        archived_at      TEXT
    )
""")
conn.commit()

# Delete existing entries
print("[CLEAR] Clearing old archive data...")
cur.execute("DELETE FROM session_archive")
conn.commit()

# Define menus matching our seed_db.py exactly
MENUS = [
    {
        "store_id": "store-1",
        "items": [
            {"name": "된장찌개", "value": 9000},
            {"name": "김치찌개", "value": 9000},
            {"name": "제육볶음", "value": 11000},
            {"name": "불고기 정식", "value": 15000},
            {"name": "비빔밥", "value": 10000},
            {"name": "돌솥비빔밥", "value": 12000},
            {"name": "막걸리", "value": 5000}
        ]
    },
    {
        "store_id": "store-2",
        "items": [
            {"name": "아메리카노", "value": 4500},
            {"name": "카페라떼", "value": 5500},
            {"name": "카푸치노", "value": 5500},
            {"name": "바닐라 라떼", "value": 6000},
            {"name": "얼그레이 티", "value": 4500},
            {"name": "스무디", "value": 6500},
            {"name": "크루아상", "value": 4000},
            {"name": "치즈 케이크", "value": 6500},
            {"name": "아보카도 토스트", "value": 8500}
        ]
    },
    {
        "store_id": "store-3",
        "items": [
            {"name": "마르게리타", "value": 16000},
            {"name": "페퍼로니", "value": 18000},
            {"name": "포카치아", "value": 12000},
            {"name": "까르보나라", "value": 14000},
            {"name": "봉골레", "value": 15000},
            {"name": "아라비아타", "value": 13000},
            {"name": "티라미수", "value": 8000},
            {"name": "하우스 와인", "value": 9000},
            {"name": "아란치니", "value": 7000}
        ]
    },
    {
        "store_id": "store-chicvill",
        "items": [
            {"name": "명품 한우 숯불구이", "value": 35000},
            {"name": "시골 순두부찌개", "value": 9000},
            {"name": "프리미엄 콜드브루 커피", "value": 4500}
        ]
    },
    {
        "store_id": "store-chicvill02",
        "items": [
            {"name": "광어", "value": 30000},
            {"name": "우럭", "value": 30000},
            {"name": "연어", "value": 30000},
            {"name": "낙지", "value": 18000},
            {"name": "해산물 모듬", "value": 35000},
            {"name": "소주", "value": 4000},
            {"name": "맥주", "value": 5000}
        ]
    },
    {
        "store_id": "store-chicvill03",
        "items": [
            {"name": "명품 한우 숯불구이", "value": 35000},
            {"name": "시골 순두부찌개", "value": 9000},
            {"name": "프리미엄 콜드브루 커피", "value": 4500}
        ]
    }
]

print("[SEED] Seeding historical sales data for the last 60 days...")
end_date = datetime.now() - timedelta(days=1)
start_date = datetime.now() - timedelta(days=60)

total_sessions = 0
total_rev = 0

current_date = start_date
while current_date <= end_date:
    date_str = current_date.strftime("%Y-%m-%d")
    
    for store in MENUS:
        store_id = store["store_id"]
        menus = store["items"]
        
        # 3 to 10 sessions per store per day
        sessions_count = random.randint(3, 10)
        for _ in range(sessions_count):
            session_id = f"SESS-ARCH-{uuid.uuid4().hex[:8].upper()}"
            table_id = f"T{random.randint(1, 6):02d}"
            
            items_count = random.randint(1, 3)
            chosen_menus = random.sample(menus, min(len(menus), items_count))
            
            order_count = len(chosen_menus)
            items_summary = []
            total_revenue = 0
            
            for menu in chosen_menus:
                qty = random.randint(1, 3)
                name = menu["name"]
                price = menu["value"]
                
                items_summary.append({
                    "name": name,
                    "qty": qty,
                    "price": price
                })
                total_revenue += price * qty
            
            hour = random.randint(11, 21)
            minute = random.randint(0, 59)
            checkin_time = f"{date_str} {hour:02d}:{minute:02d}:00"
            
            duration = random.randint(30, 90)
            checkout_dt = datetime.strptime(checkin_time, "%Y-%m-%d %H:%M:%S") + timedelta(minutes=duration)
            checkout_time = checkout_dt.strftime("%Y-%m-%d %H:%M:%S")
            
            cur.execute("""
                INSERT INTO session_archive
                    (session_id, store_id, table_id, checkin_time, checkout_time,
                     duration_minutes, order_count, total_revenue, cancelled_count,
                     items_summary, archived_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 0, %s::jsonb, %s)
            """, (
                session_id,
                store_id,
                table_id,
                checkin_time,
                checkout_time,
                duration,
                order_count,
                total_revenue,
                json.dumps(items_summary, ensure_ascii=False),
                checkout_time
            ))
            total_sessions += 1
            total_rev += total_revenue
            
    current_date += timedelta(days=1)

conn.commit()
cur.close()
conn.close()

print(f"[SUCCESS] Seeded {total_sessions} sessions with {total_rev:,} total sales!")
