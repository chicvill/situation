import psycopg2  # type: ignore
from psycopg2 import pool as pg_pool  # type: ignore
from psycopg2.extras import RealDictCursor  # type: ignore
import os
import json
from datetime import datetime
from dotenv import load_dotenv, find_dotenv

# .env 파일 로드 (상위 디렉토리 포함 자동 탐색)
load_dotenv(find_dotenv())
DATABASE_URL = os.getenv("DATABASE_URL")

_connection_pool: pg_pool.ThreadedConnectionPool = None

def _get_pool() -> pg_pool.ThreadedConnectionPool:
    global _connection_pool
    if _connection_pool is None or _connection_pool.closed:
        _connection_pool = pg_pool.ThreadedConnectionPool(2, 10, dsn=DATABASE_URL)
    return _connection_pool

class SafeConnectionWrapper:
    def __init__(self, conn):
        self._conn = conn
        self._closed = False

    def cursor(self, *args, **kwargs):
        cur = self._conn.cursor(*args, **kwargs)
        return SafeCursorWrapper(cur, self)

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    def close(self):
        if not self._closed:
            try:
                self._conn.close()
            except:
                pass
            self._closed = True

    def __getattr__(self, name):
        return getattr(self._conn, name)

    def __del__(self):
        self.close()

class SafeCursorWrapper:
    def __init__(self, cur, conn_wrapper):
        self._cur = cur
        self._conn_wrapper = conn_wrapper
        self._closed = False

    def close(self):
        if not self._closed:
            try:
                self._cur.close()
            except:
                pass
            self._closed = True

    def __iter__(self):
        return iter(self._cur)

    def __next__(self):
        return next(self._cur)

    def __getattr__(self, name):
        return getattr(self._cur, name)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def __del__(self):
        self.close()

class PooledConnectionWrapper(SafeConnectionWrapper):
    """풀에서 가져온 연결 — close() 시 풀에 반환."""
    def __init__(self, conn, pool: pg_pool.ThreadedConnectionPool):
        super().__init__(conn)
        self._pool = pool

    def close(self):
        if not self._closed:
            try:
                if not self._conn.closed:
                    self._conn.rollback()
                self._pool.putconn(self._conn)
            except Exception:
                try:
                    self._conn.close()
                except Exception:
                    pass
            self._closed = True

    def __del__(self):
        self.close()


def get_db_conn():
    if not DATABASE_URL:
        raise Exception("DATABASE_URL environment variable is missing!")
    try:
        raw = _get_pool().getconn()
        raw.autocommit = False
        return PooledConnectionWrapper(raw, _get_pool())
    except Exception as e:
        print(f"DB Connection Error: {e}")
        raise e

def init_db_v2():
    """V2 세션 중심 스키마 초기화"""
    try:
        conn = get_db_conn()
    except Exception:
        return

    try:
        cur = conn.cursor()

        # 1. 세션 대장 테이블 (orders/calls/parking/point/splits 임베딩 v2)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_sessions (
                session_id TEXT PRIMARY KEY,
                store_id TEXT NOT NULL,
                table_id TEXT NOT NULL,
                device_id TEXT,
                status TEXT DEFAULT 'active',
                checkin_time TEXT NOT NULL,
                checkout_time TEXT,
                metadata JSONB DEFAULT '{}',
                orders  JSONB NOT NULL DEFAULT '[]',
                splits  JSONB NOT NULL DEFAULT '[]',
                calls   JSONB NOT NULL DEFAULT '[]',
                parking JSONB,
                point   JSONB,
                version INTEGER NOT NULL DEFAULT 1
            )
        """)

        # 2. 주문 내역 테이블 (세션에 종속)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_orders (
                order_id TEXT PRIMARY KEY,
                session_id TEXT REFERENCES table_sessions(session_id),
                store_id TEXT NOT NULL,
                table_id TEXT NOT NULL,
                device_id TEXT NOT NULL,
                items JSONB NOT NULL,
                total_price INTEGER DEFAULT 0,
                status TEXT DEFAULT 'cooking',
                payment_status TEXT DEFAULT 'unpaid',
                payment_method TEXT,
                order_seq INTEGER DEFAULT 1,
                timestamp TEXT NOT NULL
            )
        """)

        # 3. AI 상황 기록 테이블 (지식 인벤토리용)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS situation_pool (
                id SERIAL PRIMARY KEY,
                store_id TEXT NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                items JSONB NOT NULL,
                timestamp TEXT NOT NULL
            )
        """)

        # 4. 고객 포인트 테이블 (다중 매장 완벽 분리 연동)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS customer_points (
                phone TEXT NOT NULL,
                store_id TEXT NOT NULL DEFAULT 'store-1',
                points INTEGER DEFAULT 0,
                last_updated TEXT NOT NULL,
                PRIMARY KEY (phone, store_id)
            )
        """)
        try:
            cur.execute("ALTER TABLE customer_points ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'store-1'")
            cur.execute("ALTER TABLE customer_points DROP CONSTRAINT IF EXISTS customer_points_pkey")
            cur.execute("ALTER TABLE customer_points ADD PRIMARY KEY (phone, store_id)")
        except Exception as e:
            # Migration might already be applied or constraint names differ, safe to ignore
            pass

        # 5. 스마트 대기 테이블 (table_waitings)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_waitings (
                waiting_id TEXT PRIMARY KEY,
                store_id TEXT NOT NULL DEFAULT 'store-1',
                phone_number TEXT NOT NULL,
                party_size INTEGER NOT NULL,
                status TEXT DEFAULT 'waiting',
                timestamp TEXT NOT NULL
            )
        """)
        try:
            cur.execute("ALTER TABLE table_waitings ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'store-1'")
        except Exception as e:
            pass

        # 6. 스마트 직원 호출 테이블 (table_calls)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_calls (
                call_id TEXT PRIMARY KEY,
                table_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                call_type TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                timestamp TEXT NOT NULL
            )
        """)

        # 7. 실시간 사전 예약 테이블 (table_reservations)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_reservations (
                reservation_id TEXT PRIMARY KEY,
                store_id TEXT NOT NULL DEFAULT 'store-1',
                customer_name TEXT NOT NULL,
                phone_number TEXT NOT NULL,
                party_size INTEGER NOT NULL,
                reserved_time TEXT NOT NULL,
                table_id TEXT NOT NULL,
                status TEXT DEFAULT 'requested'
            )
        """)
        try:
            cur.execute("ALTER TABLE table_reservations ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'store-1'")
        except Exception:
            pass

        # 8. 원클릭 셀프 주차 테이블 (table_parkings)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_parkings (
                parking_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                vehicle_number TEXT NOT NULL,
                discount_minutes INTEGER NOT NULL,
                status TEXT DEFAULT 'applied',
                timestamp TEXT NOT NULL
            )
        """)

        # 9. 스태프 마스터 테이블 (table_staff_accounts)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_staff_accounts (
                staff_id TEXT PRIMARY KEY,
                store_id TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                hourly_wage INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                contract_period JSONB NOT NULL
            )
        """)

        # 10. 일일 출퇴근 타임카드 테이블 (table_attendance_logs)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_attendance_logs (
                log_id TEXT PRIMARY KEY,
                staff_id TEXT NOT NULL,
                store_id TEXT NOT NULL,
                check_in_time TEXT,
                check_out_time TEXT,
                work_minutes INTEGER,
                status TEXT DEFAULT 'working',
                tardy BOOLEAN DEFAULT FALSE,
                paid BOOLEAN DEFAULT FALSE,
                device_id TEXT
            )
        """)
        try:
            cur.execute("ALTER TABLE table_attendance_logs ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT FALSE")
            cur.execute("ALTER TABLE table_attendance_logs ADD COLUMN IF NOT EXISTS device_id TEXT")
        except Exception:
            pass

        # 11. 스태프 스케줄 테이블 (table_staff_schedules)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_staff_schedules (
                schedule_id TEXT PRIMARY KEY,
                staff_id TEXT NOT NULL,
                store_id TEXT NOT NULL DEFAULT 'default_store',
                day_of_week INTEGER NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL
            )
        """)
        try:
            cur.execute("ALTER TABLE table_staff_schedules ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'default_store'")
        except Exception:
            pass

        # 12. 매장 관리용 테이블
        cur.execute("""
            CREATE TABLE IF NOT EXISTS stores (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                ceo_name TEXT NOT NULL,
                signature_owner TEXT NOT NULL,
                monthly_fee INTEGER DEFAULT 0,
                payment_status TEXT DEFAULT '정상',
                payment_history JSONB DEFAULT '[]',
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        try:
            cur.execute("ALTER TABLE stores ADD COLUMN IF NOT EXISTS reservation_settings JSONB DEFAULT '{\"start\":\"11:00\", \"end\":\"20:00\"}'::jsonb")
        except Exception:
            pass

        try:
            # 기존 테이블 누락 컬럼 보완 (table_sessions v1 → v2)
            cur.execute("ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS device_id TEXT")
            cur.execute("ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS orders  JSONB NOT NULL DEFAULT '[]'")
            cur.execute("ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS splits  JSONB NOT NULL DEFAULT '[]'")
            cur.execute("ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS calls   JSONB NOT NULL DEFAULT '[]'")
            cur.execute("ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS parking JSONB")
            cur.execute("ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS point   JSONB")
            cur.execute("ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1")
            # table_orders 하위 호환 (마이그레이션 전 구형 DB)
            cur.execute("ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS device_id TEXT")
            cur.execute("ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid'")
            cur.execute("ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS payment_method TEXT")
            cur.execute("ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS payment_key TEXT")
        except Exception as e:
            print(f"⚠️ DB Migration Warning: {e}")

        # knowledge_bundles: 세션 정산 결과 / 통계 아카이브
        cur.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_bundles (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                store_id TEXT NOT NULL,
                title TEXT NOT NULL,
                items JSONB NOT NULL DEFAULT '[]',
                timestamp TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        cur.execute("CREATE INDEX IF NOT EXISTS idx_orders_session ON table_orders(session_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sessions_store_table ON table_sessions(store_id, table_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sess_orders_gin ON table_sessions USING GIN (orders)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sess_calls_gin  ON table_sessions USING GIN (calls)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_situation_store ON situation_pool(store_id)")
        cur.execute("ALTER TABLE table_sessions ALTER COLUMN device_id DROP NOT NULL")

        conn.commit()
        cur.close()
        conn.close()
        print("Session-centric DB Schema initialized and verified.")
    except Exception as e:
        print(f"DB Init V2 Error: {e}")
