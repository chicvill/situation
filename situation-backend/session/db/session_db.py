"""
session_db.py — 통합 세션 DB 모듈

table_sessions 한 row에 orders / calls / parking / point / splits 를 모두 임베딩.
외부에서 참조하는 함수 시그니처는 이전과 동일하게 유지해 라우터 수정을 최소화한다.
"""

import json
from datetime import datetime
from typing import Optional
from psycopg2.extras import RealDictCursor  # type: ignore
from .connection import get_db_conn


# ──────────────────────────────────────────────
# 내부 헬퍼
# ──────────────────────────────────────────────

def _now() -> str:
    return datetime.now().isoformat()

def _dumps(v) -> str:
    return json.dumps(v, ensure_ascii=False)

def _normalize_order(o: dict, table_id: str = '', store_id: str = '') -> dict:
    """JSONB order 항목을 프론트가 기대하는 필드명으로 정규화."""
    o = dict(o)
    o.setdefault('total_price', o.get('total', 0))
    o.setdefault('order_seq',   o.get('seq', 1))
    o.setdefault('timestamp',   o.get('created_at', ''))
    if table_id:
        o.setdefault('table_id', table_id)
    if store_id:
        o.setdefault('store_id', store_id)
    return o


def _normalize_call(c: dict, table_id: str = '', store_id: str = '') -> dict:
    """JSONB call 항목을 프론트가 기대하는 필드명으로 정규화."""
    c = dict(c)
    c.setdefault('call_type', c.get('type', '직원호출'))
    c.setdefault('timestamp', c.get('created_at', ''))
    if table_id:
        c.setdefault('table_id', table_id)
    if store_id:
        c.setdefault('store_id', store_id)
    return c


def _row_to_dict(row) -> Optional[dict]:
    """RealDictRow → 일반 dict, JSONB 필드 파싱 및 프론트 필드명 정규화."""
    if row is None:
        return None
    d = dict(row)
    for field in ('orders', 'splits', 'calls', 'metadata'):
        if isinstance(d.get(field), str):
            try:
                d[field] = json.loads(d[field])
            except Exception:
                d[field] = [] if field != 'metadata' else {}
        elif d.get(field) is None and field != 'parking' and field != 'point':
            d[field] = [] if field != 'metadata' else {}
    # orders 배열 정규화 — 모든 경로에서 일관된 필드명 보장
    if isinstance(d.get('orders'), list):
        d['orders'] = [
            _normalize_order(o, d.get('table_id', ''), d.get('store_id', ''))
            for o in d['orders']
        ]
    return d


# ──────────────────────────────────────────────
# 1. 세션 기본 CRUD
# ──────────────────────────────────────────────

def save_session(session_data: dict) -> bool:
    """세션 생성 (INSERT) 또는 status/metadata 갱신 (UPDATE)."""
    conn = get_db_conn()
    if not conn:
        return False
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO table_sessions
                (session_id, store_id, table_id, device_id, status,
                 checkin_time, metadata, orders, splits, calls)
            VALUES
                (%(session_id)s, %(store_id)s, %(table_id)s, %(device_id)s, %(status)s,
                 %(checkin_time)s, %(metadata)s, '[]', '[]', '[]')
            ON CONFLICT (session_id) DO UPDATE SET
                status        = EXCLUDED.status,
                checkout_time = EXCLUDED.checkout_time,
                metadata      = EXCLUDED.metadata,
                version       = table_sessions.version + 1
        """, {
            'session_id':   session_data['session_id'],
            'store_id':     session_data['store_id'],
            'table_id':     session_data['table_id'],
            'device_id':    session_data.get('device_id', ''),
            'status':       session_data.get('status', 'active'),
            'checkin_time': session_data.get('checkin_time', _now()),
            'metadata':     _dumps(session_data.get('metadata', {})),
        })
        conn.commit()
        return True
    except Exception as e:
        print(f"[save_session] ERROR: {e}")
        return False
    finally:
        cur.close(); conn.close()


def get_session(session_id: str) -> Optional[dict]:
    """session_id로 전체 세션(orders/calls/parking/point/splits 포함) 반환."""
    conn = get_db_conn()
    if not conn:
        return None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "SELECT * FROM table_sessions WHERE session_id = %(sid)s",
            {'sid': session_id}
        )
        return _row_to_dict(cur.fetchone())
    except Exception as e:
        print(f"[get_session] ERROR: {e}")
        return None
    finally:
        cur.close(); conn.close()


def get_session_by_id(session_id: str) -> Optional[dict]:
    """get_session 별칭 (이전 호환)."""
    return get_session(session_id)


def get_active_session(store_id: str, table_id: str) -> Optional[dict]:
    """해당 테이블의 활성 세션 반환."""
    conn = get_db_conn()
    if not conn:
        return None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if not store_id or store_id in ('Total', 'default_store'):
            cur.execute("""
                SELECT * FROM table_sessions
                WHERE table_id = %(tid)s AND status != 'closed'
                ORDER BY checkin_time DESC LIMIT 1
            """, {'tid': table_id})
        else:
            cur.execute("""
                SELECT * FROM table_sessions
                WHERE store_id = %(sid)s AND table_id = %(tid)s AND status != 'closed'
                ORDER BY checkin_time DESC LIMIT 1
            """, {'sid': store_id, 'tid': table_id})
        return _row_to_dict(cur.fetchone())
    except Exception as e:
        print(f"[get_active_session] ERROR: {e}")
        return None
    finally:
        cur.close(); conn.close()


def get_all_active_sessions(store_id: Optional[str] = None) -> list:
    """활성 세션 전체 반환 — JOIN 없이 단일 쿼리."""
    conn = get_db_conn()
    if not conn:
        return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if store_id and store_id not in ('Total', 'default_store'):
            cur.execute("""
                SELECT * FROM table_sessions
                WHERE status != 'closed' AND store_id = %(sid)s
                ORDER BY checkin_time DESC
            """, {'sid': store_id})
        else:
            cur.execute("""
                SELECT * FROM table_sessions
                WHERE status != 'closed'
                ORDER BY checkin_time DESC
            """)
        return [_row_to_dict(r) for r in cur.fetchall()]
    except Exception as e:
        print(f"[get_all_active_sessions] ERROR: {e}")
        return []
    finally:
        cur.close(); conn.close()


def update_session_status(session_id: str, status: str) -> bool:
    conn = get_db_conn()
    if not conn:
        return False
    try:
        cur = conn.cursor()
        if status == 'closed':
            cur.execute("""
                UPDATE table_sessions
                SET status = %(s)s, checkout_time = %(t)s, version = version + 1
                WHERE session_id = %(sid)s
            """, {'s': status, 't': _now(), 'sid': session_id})
        else:
            cur.execute("""
                UPDATE table_sessions
                SET status = %(s)s, version = version + 1
                WHERE session_id = %(sid)s
            """, {'s': status, 'sid': session_id})
        conn.commit()
        return True
    except Exception as e:
        print(f"[update_session_status] ERROR: {e}")
        return False
    finally:
        cur.close(); conn.close()


def update_session_device_id(session_id: str, device_id: str) -> bool:
    conn = get_db_conn()
    if not conn:
        return False
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE table_sessions
            SET device_id = %(d)s, version = version + 1
            WHERE session_id = %(sid)s
        """, {'d': device_id, 'sid': session_id})
        conn.commit()
        return True
    except Exception as e:
        print(f"[update_session_device_id] ERROR: {e}")
        return False
    finally:
        cur.close(); conn.close()


# ──────────────────────────────────────────────
# 2. 주문 (orders[])
# ──────────────────────────────────────────────

def append_order(session_id: str, order_data: dict) -> bool:
    """세션에 주문 추가 (N차 주문 지원)."""
    conn = get_db_conn()
    if not conn:
        return False
    entry = {
        'order_id':       order_data['order_id'],
        'seq':            order_data.get('order_seq', 1),
        'items':          order_data.get('items', []),
        'total':          order_data.get('total_price', 0),
        'status':         order_data.get('status', 'pending'),
        'payment_status': order_data.get('payment_status', 'unpaid'),
        'payment_method': order_data.get('payment_method'),
        'created_at':     order_data.get('timestamp', _now()),
    }
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE table_sessions
            SET orders  = orders || %(o)s::jsonb,
                version = version + 1
            WHERE session_id = %(sid)s
        """, {'o': _dumps([entry]), 'sid': session_id})
        conn.commit()
        print(f"[append_order] {order_data['order_id']} → {session_id}")
        return True
    except Exception as e:
        print(f"[append_order] ERROR: {e}")
        return False
    finally:
        cur.close(); conn.close()


# 이전 호환 래퍼
def save_order(order_data: dict) -> bool:
    return append_order(order_data['session_id'], order_data)


def _update_order_field(order_id: str, patch: dict) -> bool:
    """order_id 기준으로 sessions.orders 배열 내 해당 항목 필드 갱신."""
    conn = get_db_conn()
    if not conn:
        return False
    patch_json = _dumps(patch)
    try:
        cur = conn.cursor()
        # GIN 인덱스로 빠르게 해당 세션 찾고, 배열 내 해당 항목만 merge
        cur.execute("""
            UPDATE table_sessions
            SET orders = (
                SELECT jsonb_agg(
                    CASE WHEN elem->>'order_id' = %(oid)s
                         THEN elem || %(patch)s::jsonb
                         ELSE elem END
                )
                FROM jsonb_array_elements(orders) AS elem
            ),
            version = version + 1
            WHERE orders @> jsonb_build_array(
                jsonb_build_object('order_id', %(oid)s)
            )
        """, {'oid': order_id, 'patch': patch_json})
        conn.commit()
        return cur.rowcount > 0
    except Exception as e:
        print(f"[_update_order_field] ERROR: {e}")
        return False
    finally:
        cur.close(); conn.close()


def update_order_status(order_id: str, status: str) -> bool:
    return _update_order_field(order_id, {'status': status})


def update_order_payment_status(order_id: str, payment_status: str) -> bool:
    return _update_order_field(order_id, {'payment_status': payment_status})


def update_order_payment_key(order_id: str, payment_key: str) -> bool:
    return _update_order_field(order_id, {'payment_key': payment_key})


def get_order_by_id(order_id: str) -> Optional[dict]:
    """order_id로 sessions.orders 배열에서 해당 주문 단건 반환."""
    conn = get_db_conn()
    if not conn:
        return None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT s.session_id, s.store_id, s.table_id, elem AS order_data
            FROM table_sessions s,
                 jsonb_array_elements(s.orders) AS elem
            WHERE elem->>'order_id' = %(oid)s
            LIMIT 1
        """, {'oid': order_id})
        row = cur.fetchone()
        if not row:
            return None
        o = dict(row['order_data'])
        o['session_id'] = row['session_id']
        return _normalize_order(o, row['table_id'], row['store_id'])
    except Exception as e:
        print(f"[get_order_by_id] ERROR: {e}")
        return None
    finally:
        cur.close(); conn.close()


def update_order_items(order_id: str, items: list, total_price: int) -> bool:
    return _update_order_field(order_id, {'items': items, 'total': total_price})


def get_orders_by_session(session_id: str) -> list:
    """세션의 orders 배열 반환 — _row_to_dict에서 이미 정규화됨."""
    sess = get_session(session_id)
    return sess.get('orders') or [] if sess else []


def get_max_order_seq(session_id: str) -> int:
    conn = get_db_conn()
    if not conn:
        return 0
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT COALESCE(MAX((elem->>'seq')::int), 0)
            FROM table_sessions, jsonb_array_elements(orders) AS elem
            WHERE session_id = %(sid)s
        """, {'sid': session_id})
        row = cur.fetchone()
        return row[0] if row else 0
    except Exception as e:
        print(f"[get_max_order_seq] ERROR: {e}")
        return 0
    finally:
        cur.close(); conn.close()


def get_kitchen_orders(store_id: Optional[str] = None) -> list:
    """주방 화면용: 조리 중·대기 중 주문을 sessions.orders에서 추출."""
    conn = get_db_conn()
    if not conn:
        return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        base = """
            SELECT
                s.session_id, s.store_id, s.table_id,
                elem AS order_data
            FROM table_sessions s,
                 jsonb_array_elements(s.orders) AS elem
            WHERE s.status != 'closed'
              AND elem->>'status' IN ('pending', 'cooking', 'pending_payment')
        """
        if store_id and store_id not in ('Total', 'default_store'):
            cur.execute(base + " AND s.store_id = %(sid)s ORDER BY elem->>'created_at' ASC",
                        {'sid': store_id})
        else:
            cur.execute(base + " ORDER BY elem->>'created_at' ASC")

        rows = cur.fetchall()
        result = []
        for r in rows:
            o = dict(r['order_data'])
            o['session_id'] = r['session_id']
            result.append(_normalize_order(o, r['table_id'], r['store_id']))
        return result
    except Exception as e:
        print(f"[get_kitchen_orders] ERROR: {e}")
        return []
    finally:
        cur.close(); conn.close()


def get_all_active_orders_as_bundles(store_id: Optional[str] = None) -> list:
    orders = get_kitchen_orders(store_id)
    bundles = []
    for o in orders:
        items_raw = o.get('items') or []
        if isinstance(items_raw, str):
            try:
                items_raw = json.loads(items_raw)
            except Exception:
                items_raw = []
        bundle_items = [
            {'name': i.get('name', '?'),
             'value': str(i.get('quantity') or i.get('qty') or 1)}
            for i in items_raw
        ]
        bundles.append({
            'id':       o.get('order_id', ''),
            'type':     'Orders',
            'title':    f"테이블 {o.get('table_id', '')} 주문",
            'store_id': o.get('store_id', ''),
            'status':   o.get('status', ''),
            'timestamp': o.get('created_at', ''),
            'table':    o.get('table_id', ''),
            'items':    bundle_items,
        })
    return bundles


# ──────────────────────────────────────────────
# 3. 직원 호출 (calls[])
# ──────────────────────────────────────────────

def append_call(session_id: str, call_data: dict) -> bool:
    conn = get_db_conn()
    if not conn:
        return False
    entry = {
        'call_id':     call_data['call_id'],
        'type':        call_data.get('call_type', '직원호출'),
        'status':      call_data.get('status', 'pending'),
        'created_at':  call_data.get('timestamp', _now()),
        'resolved_at': None,
    }
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE table_sessions
            SET calls   = calls || %(c)s::jsonb,
                version = version + 1
            WHERE session_id = %(sid)s
        """, {'c': _dumps([entry]), 'sid': session_id})
        conn.commit()
        return True
    except Exception as e:
        print(f"[append_call] ERROR: {e}")
        return False
    finally:
        cur.close(); conn.close()


# 이전 호환 래퍼
def save_call(call_data: dict) -> bool:
    session_id = call_data.get('session_id', '')
    if not session_id:
        # 세션 없는 이벤트(SEAT_REQUEST 등)는 무시 (events 테이블로 이동 예정)
        return False
    return append_call(session_id, call_data)


def update_call_in_session(call_id: str, status: str) -> bool:
    conn = get_db_conn()
    if not conn:
        return False
    patch = {'status': status}
    if status in ('completed', 'done', 'cancelled'):
        patch['resolved_at'] = _now()
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE table_sessions
            SET calls = (
                SELECT jsonb_agg(
                    CASE WHEN elem->>'call_id' = %(cid)s
                         THEN elem || %(patch)s::jsonb
                         ELSE elem END
                )
                FROM jsonb_array_elements(calls) AS elem
            ),
            version = version + 1
            WHERE calls @> jsonb_build_array(
                jsonb_build_object('call_id', %(cid)s)
            )
        """, {'cid': call_id, 'patch': _dumps(patch)})
        conn.commit()
        return cur.rowcount > 0
    except Exception as e:
        print(f"[update_call_in_session] ERROR: {e}")
        return False
    finally:
        cur.close(); conn.close()


# 이전 호환 래퍼
def update_call_status(call_id: str, status: str) -> bool:
    return update_call_in_session(call_id, status)


def get_active_calls(table_id: Optional[str] = None,
                     store_id: Optional[str] = None) -> list:
    conn = get_db_conn()
    if not conn:
        return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        base = """
            SELECT s.session_id, s.store_id, s.table_id, elem AS call_data
            FROM table_sessions s,
                 jsonb_array_elements(s.calls) AS elem
            WHERE s.status != 'closed'
              AND elem->>'status' = 'pending'
        """
        params: dict = {}
        if store_id and store_id not in ('Total', 'default_store'):
            base += " AND s.store_id = %(sid)s"
            params['sid'] = store_id
        if table_id:
            base += " AND s.table_id = %(tid)s"
            params['tid'] = table_id
        cur.execute(base + " ORDER BY elem->>'created_at' ASC", params)
        result = []
        for r in cur.fetchall():
            c = dict(r['call_data'])
            c['session_id'] = r['session_id']
            result.append(_normalize_call(c, r['table_id'], r['store_id']))
        return result
    except Exception as e:
        print(f"[get_active_calls] ERROR: {e}")
        return []
    finally:
        cur.close(); conn.close()


# ──────────────────────────────────────────────
# 4. 주차 (parking — 세션당 단건)
# ──────────────────────────────────────────────

def set_parking(session_id: str, parking_data: dict) -> bool:
    conn = get_db_conn()
    if not conn:
        return False
    entry = {
        'parking_id':       parking_data.get('parking_id', f"PARK-{session_id}"),
        'vehicle_number':   parking_data.get('vehicle_number', ''),
        'discount_minutes': parking_data.get('discount_minutes', 0),
        'status':           parking_data.get('status', 'pending'),
        'created_at':       parking_data.get('timestamp', _now()),
    }
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE table_sessions
            SET parking = %(p)s::jsonb,
                version = version + 1
            WHERE session_id = %(sid)s
        """, {'p': _dumps(entry), 'sid': session_id})
        conn.commit()
        return True
    except Exception as e:
        print(f"[set_parking] ERROR: {e}")
        return False
    finally:
        cur.close(); conn.close()


# 이전 호환 래퍼
def save_parking(park_data: dict) -> bool:
    return set_parking(park_data['session_id'], park_data)


def update_parking_status(session_id: str, status: str) -> bool:
    conn = get_db_conn()
    if not conn:
        return False
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE table_sessions
            SET parking = jsonb_set(parking, '{status}', %(s)s::jsonb),
                version = version + 1
            WHERE session_id = %(sid)s AND parking IS NOT NULL
        """, {'s': json.dumps(status), 'sid': session_id})
        conn.commit()
        return True
    except Exception as e:
        print(f"[update_parking_status] ERROR: {e}")
        return False


def complete_parking(parking_id: str) -> bool:
    """parking_id로 세션 찾아 주차 상태 → done."""
    conn = get_db_conn()
    if not conn:
        return False
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE table_sessions
            SET parking = jsonb_set(parking, '{status}', '"done"'),
                version = version + 1
            WHERE parking->>'parking_id' = %(pid)s
        """, {'pid': parking_id})
        conn.commit()
        return cur.rowcount > 0
    except Exception as e:
        print(f"[complete_parking] ERROR: {e}")
        return False
    finally:
        cur.close(); conn.close()


def get_parking_by_session(session_id: str) -> Optional[dict]:
    sess = get_session(session_id)
    return sess.get('parking') if sess else None


def get_active_parkings_db(store_id: Optional[str] = None) -> list:
    conn = get_db_conn()
    if not conn:
        return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        base = """
            SELECT store_id, table_id, session_id, parking
            FROM table_sessions
            WHERE status != 'closed'
              AND parking IS NOT NULL
              AND parking->>'status' = 'pending'
        """
        if store_id and store_id not in ('Total', 'default_store'):
            cur.execute(base + " AND store_id = %(sid)s ORDER BY checkin_time DESC",
                        {'sid': store_id})
        else:
            cur.execute(base + " ORDER BY checkin_time DESC")
        result = []
        for r in cur.fetchall():
            p = dict(r['parking'])
            p['session_id'] = r['session_id']
            p['store_id']   = r['store_id']
            p['table_id']   = r['table_id']
            result.append(p)
        return result
    except Exception as e:
        print(f"[get_active_parkings_db] ERROR: {e}")
        return []
    finally:
        cur.close(); conn.close()


# ──────────────────────────────────────────────
# 5. 포인트 (point — 세션당 단건)
# ──────────────────────────────────────────────

def set_point(session_id: str, point_data: dict) -> bool:
    conn = get_db_conn()
    if not conn:
        return False
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE table_sessions
            SET point   = %(p)s::jsonb,
                version = version + 1
            WHERE session_id = %(sid)s
        """, {'p': _dumps(point_data), 'sid': session_id})
        conn.commit()
        return True
    except Exception as e:
        print(f"[set_point] ERROR: {e}")
        return False
    finally:
        cur.close(); conn.close()


def get_point(session_id: str) -> Optional[dict]:
    sess = get_session(session_id)
    return sess.get('point') if sess else None


# ──────────────────────────────────────────────
# 6. 더치페이 분할 (splits[])
# ──────────────────────────────────────────────

def append_split(session_id: str, split_data: dict) -> bool:
    conn = get_db_conn()
    if not conn:
        return False
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE table_sessions
            SET splits  = splits || %(s)s::jsonb,
                version = version + 1
            WHERE session_id = %(sid)s
        """, {'s': _dumps([split_data]), 'sid': session_id})
        conn.commit()
        return True
    except Exception as e:
        print(f"[append_split] ERROR: {e}")
        return False
    finally:
        cur.close(); conn.close()


def update_split_status(session_id: str, split_id: str, status: str) -> bool:
    conn = get_db_conn()
    if not conn:
        return False
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE table_sessions
            SET splits = (
                SELECT jsonb_agg(
                    CASE WHEN elem->>'split_id' = %(spid)s
                         THEN elem || %(patch)s::jsonb
                         ELSE elem END
                )
                FROM jsonb_array_elements(splits) AS elem
            ),
            version = version + 1
            WHERE session_id = %(sid)s
        """, {'spid': split_id, 'patch': _dumps({'status': status}), 'sid': session_id})
        conn.commit()
        return cur.rowcount > 0
    except Exception as e:
        print(f"[update_split_status] ERROR: {e}")
        return False
    finally:
        cur.close(); conn.close()


def get_splits(session_id: str) -> list:
    sess = get_session(session_id)
    return (sess.get('splits') or []) if sess else []


# ──────────────────────────────────────────────
# 7. 세션 종료 → knowledge_pool 아카이브
# ──────────────────────────────────────────────

def close_session_and_archive(session_id: str) -> bool:
    """세션 종료 + 결제 결과를 knowledge_bundles에 기록 (단일 트랜잭션)."""
    conn = get_db_conn()
    if not conn:
        return False
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM table_sessions WHERE session_id = %(sid)s",
                    {'sid': session_id})
        sess = _row_to_dict(cur.fetchone())
        if not sess:
            return False

        orders = sess.get('orders') or []
        paid_total = sum(
            o.get('total', 0) for o in orders
            if o.get('payment_status') in ('paid', 'prepaid')
        )
        order_count = len([o for o in orders if o.get('status') != 'cancelled'])

        archive_id = f"SESS-RESULT-{session_id}"
        archive_items = json.dumps([
            {'name': '테이블',  'value': sess.get('table_id', '')},
            {'name': '총매출',  'value': str(paid_total)},
            {'name': '주문횟수', 'value': str(order_count)},
            {'name': '체크인',  'value': sess.get('checkin_time', '')},
            {'name': '체크아웃', 'value': _now()},
        ], ensure_ascii=False)

        cur.execute("""
            INSERT INTO knowledge_bundles
                (id, type, store_id, title, items, timestamp)
            VALUES
                (%(id)s, 'Settlement', %(store_id)s, %(title)s, %(items)s, NOW())
            ON CONFLICT (id) DO NOTHING
        """, {
            'id':       archive_id,
            'store_id': sess.get('store_id', ''),
            'title':    f"{sess.get('table_id', '')} 정산 완료",
            'items':    archive_items,
        })

        cur.execute("""
            UPDATE table_sessions
            SET status = 'closed', checkout_time = %(t)s, version = version + 1
            WHERE session_id = %(sid)s
        """, {'t': _now(), 'sid': session_id})

        conn.commit()
        print(f"[close_session_and_archive] {session_id} → 정산 완료")
        return True
    except Exception as e:
        conn.rollback()
        print(f"[close_session_and_archive] ERROR: {e}")
        return False
    finally:
        cur.close(); conn.close()
