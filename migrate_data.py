import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# 설정 로드
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
POOL_FILE = "situation-backend/knowledge_pool.json"

def migrate():
    if not DATABASE_URL:
        print("❌ DATABASE_URL이 .env 파일에 설정되어 있지 않습니다.")
        return

    if not os.path.exists(POOL_FILE):
        print(f"❌ 로컬 지식 풀 파일을 찾을 수 없습니다: {POOL_FILE}")
        return

    try:
        with open(POOL_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ 파일 읽기 오류: {e}")
        return

    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # 1. 테이블 기본 생성
        cur.execute("CREATE TABLE IF NOT EXISTS knowledge_bundles (id TEXT PRIMARY KEY);")
        
        # 2. 필요한 모든 컬럼이 있는지 확인하고 없으면 추가 (Safe Add Column)
        columns = [
            ("type", "TEXT"),
            ("title", "TEXT"),
            ("timestamp", "TEXT"),
            ("items", "JSONB"),
            ("status", "TEXT"),
            ("order_code", "TEXT"),
            ("store", "TEXT"),
            ('"table"', "TEXT"), # "table"은 예약어이므로 큰따옴표 필요
            ("package", "TEXT"),
            ("payment", "TEXT")
        ]
        
        for col_name, col_type in columns:
            try:
                cur.execute(f"ALTER TABLE knowledge_bundles ADD COLUMN {col_name} {col_type};")
                print(f"➕ 컬럼 추가 완료: {col_name}")
            except psycopg2.errors.DuplicateColumn:
                conn.rollback() # 이미 있는 경우 무시
                continue
            except Exception as e:
                print(f"⚠️ 컬럼 확인 중 알림: {e}")
                conn.rollback()
        
        print(f"🚀 {len(data)}개의 데이터를 Supabase로 전송 중...")
        
        for b in data:
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
                b['id'], b['type'], b['title'], b['timestamp'], json.dumps(b['items']),
                b.get('status'), b.get('order_code'), b.get('store'), b.get('table'),
                b.get('Package'), b.get('payment')
            ))
        
        conn.commit()
        cur.close()
        conn.close()
        print("✅ Supabase 데이터 마이그레이션 및 테이블 구조 최신화 완료!")
    except Exception as e:
        print(f"❌ 마이그레이션 중 오류 발생: {e}")

if __name__ == "__main__":
    migrate()
