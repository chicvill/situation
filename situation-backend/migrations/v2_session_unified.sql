-- =============================================================
-- Migration: v2_session_unified
-- table_sessions에 orders / calls / parking / point / splits 임베딩
-- 실행 순서: 1 → 2 → 3 → 4 → 5 → 6
-- 롤백: v2_session_unified_rollback.sql 참조
-- =============================================================

-- ① 새 컬럼 추가 (기존 rows는 DEFAULT 값으로 채워짐)
ALTER TABLE table_sessions
    ADD COLUMN IF NOT EXISTS orders  JSONB   NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS splits  JSONB   NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS calls   JSONB   NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS parking JSONB,
    ADD COLUMN IF NOT EXISTS point   JSONB,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- ② 기존 table_orders → sessions.orders 마이그레이션
UPDATE table_sessions s
SET orders = sub.agg
FROM (
    SELECT
        session_id,
        jsonb_agg(
            jsonb_build_object(
                'order_id',       order_id,
                'seq',            order_seq,
                'items',          items,
                'total',          total_price,
                'status',         status,
                'payment_status', COALESCE(payment_status, 'unpaid'),
                'payment_method', payment_method,
                'created_at',     timestamp
            ) ORDER BY order_seq ASC
        ) AS agg
    FROM table_orders
    GROUP BY session_id
) sub
WHERE s.session_id = sub.session_id;

-- ③ 기존 table_calls → sessions.calls 마이그레이션
UPDATE table_sessions s
SET calls = sub.agg
FROM (
    SELECT
        session_id,
        jsonb_agg(
            jsonb_build_object(
                'call_id',     call_id,
                'type',        call_type,
                'status',      status,
                'created_at',  timestamp,
                'resolved_at', NULL
            ) ORDER BY timestamp ASC
        ) AS agg
    FROM table_calls
    WHERE session_id IS NOT NULL AND session_id <> ''
    GROUP BY session_id
) sub
WHERE s.session_id = sub.session_id;

-- ④ 기존 table_parkings → sessions.parking 마이그레이션 (세션당 1건)
UPDATE table_sessions s
SET parking = sub.p
FROM (
    SELECT DISTINCT ON (session_id)
        session_id,
        jsonb_build_object(
            'parking_id',       parking_id,
            'vehicle_number',   vehicle_number,
            'discount_minutes', discount_minutes,
            'status',           status,
            'created_at',       timestamp
        ) AS p
    FROM table_parkings
    ORDER BY session_id, timestamp DESC
) sub
WHERE s.session_id = sub.session_id;

-- ⑤ 인덱스 (GIN: JSONB 배열 내 order_id / call_id 빠른 검색)
CREATE INDEX IF NOT EXISTS idx_sess_orders_gin   ON table_sessions USING GIN (orders);
CREATE INDEX IF NOT EXISTS idx_sess_calls_gin    ON table_sessions USING GIN (calls);
CREATE INDEX IF NOT EXISTS idx_sess_store_status ON table_sessions (store_id, status);
CREATE INDEX IF NOT EXISTS idx_sess_table_active ON table_sessions (table_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_sess_checkin      ON table_sessions (checkin_time);

-- ⑥ 이전 독립 테이블 보관 (확인 후 DROP 예정 — 즉시 삭제 금지)
ALTER TABLE table_orders   RENAME TO _bak_table_orders;
ALTER TABLE table_calls    RENAME TO _bak_table_calls;
ALTER TABLE table_parkings RENAME TO _bak_table_parkings;

-- 확인 쿼리 (실행 후 검증용)
-- SELECT session_id, jsonb_array_length(orders) AS order_cnt,
--        jsonb_array_length(calls) AS call_cnt,
--        parking IS NOT NULL AS has_parking
-- FROM table_sessions LIMIT 20;
