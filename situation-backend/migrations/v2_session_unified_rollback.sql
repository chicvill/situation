-- 롤백: 이전 테이블 복원 후 추가 컬럼 제거
ALTER TABLE _bak_table_orders   RENAME TO table_orders;
ALTER TABLE _bak_table_calls    RENAME TO table_calls;
ALTER TABLE _bak_table_parkings RENAME TO table_parkings;

ALTER TABLE table_sessions
    DROP COLUMN IF EXISTS orders,
    DROP COLUMN IF EXISTS splits,
    DROP COLUMN IF EXISTS calls,
    DROP COLUMN IF EXISTS parking,
    DROP COLUMN IF EXISTS point,
    DROP COLUMN IF EXISTS version;

DROP INDEX IF EXISTS idx_sess_orders_gin;
DROP INDEX IF EXISTS idx_sess_calls_gin;
