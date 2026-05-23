"""
debug_writer.py — 실시간 시스템 상태 모니터링 모듈

생성 파일:
  debug/session.json  ← 세션 상태 (seat_requests + active sessions + orders)
  debug/state.json    ← 독립 데이터 (calls, waiting, parking, points, reservations)
  debug/snapshots/    ← DB 저장 직전 세션 스냅샷
"""
import json
import os
from datetime import datetime

_BASE        = os.path.join(os.path.dirname(__file__), "..", "debug")
SESSION_FILE = os.path.join(_BASE, "session.json")
STATE_FILE   = os.path.join(_BASE, "state.json")
MONITOR_FILE = SESSION_FILE   # 하위 호환 alias
SNAPSHOT_DIR = os.path.join(_BASE, "snapshots")

ENABLED = os.getenv("DEBUG_MONITOR", "1") != "0"
_server_start = datetime.now().isoformat()


def _ensure_dirs():
    os.makedirs(_BASE, exist_ok=True)
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)


# ── 세션 데이터 수집 ──────────────────────────────────────────────────────────

def _collect_sessions(seat_requests: list = None) -> list:
    """활성 세션 + 주문 목록."""
    try:
        from .db.session_db import get_all_active_sessions
        sessions = get_all_active_sessions("Total") or []
    except Exception:
        return []

    sr_tables = {r["table_id"] for r in (seat_requests or [])}

    result = []
    for s in sessions:
        orders = s.get("orders") or []
        active_orders = [o for o in orders if o.get("status") != "cancelled"]
        total_amount  = sum(o.get("total_price", 0) for o in active_orders)

        result.append({
            "session_id":     s.get("session_id"),
            "table_id":       s.get("table_id"),
            "store_id":       s.get("store_id"),
            "status":         s.get("status"),
            "checkin_time":   s.get("checkin_time"),
            "seat_requested": s.get("table_id") in sr_tables,
            "order_count":    len(active_orders),
            "total_amount":   total_amount,
            "orders": [
                {
                    "order_id":    o.get("order_id"),
                    "order_seq":   o.get("order_seq", 1),
                    "status":      o.get("status"),
                    "total_price": o.get("total_price", 0),
                    "items":       o.get("items", []),
                }
                for o in active_orders
            ],
        })
    return result


# ── 독립 데이터 수집 ──────────────────────────────────────────────────────────

def _collect_calls() -> list:
    """pending 상태 호출만 반환 (table_id, call_type, timestamp만 기록)."""
    try:
        from .db.operations_db import get_active_calls
        calls = get_active_calls() or []
        return [
            {
                "call_id":   c.get("call_id"),
                "table_id":  c.get("table_id"),
                "call_type": c.get("call_type", "직원호출"),
                "timestamp": str(c.get("timestamp", "")),
            }
            for c in calls
        ]
    except Exception:
        return []


def _collect_waiting() -> list:
    try:
        from .db.operations_db import get_active_waitings
        waitings = get_active_waitings() or []
        return [
            {
                "waiting_id": w.get("waiting_id"),
                "phone":      w.get("phone_number") or w.get("customer_name") or w.get("name"),
                "party_size": w.get("party_size"),
                "status":     w.get("status"),
                "timestamp":  str(w.get("timestamp", "")),
                "store_id":   w.get("store_id"),
            }
            for w in waitings
        ]
    except Exception:
        return []


def _collect_parking() -> list:
    try:
        from .db.operations_db import get_active_parkings_db
        parkings = get_active_parkings_db() or []
        return [
            {
                "parking_id":       p.get("parking_id"),
                "vehicle_number":   p.get("vehicle_number") or p.get("car_number"),
                "table_id":         p.get("table_id"),
                "discount_minutes": p.get("discount_minutes"),
                "timestamp":        str(p.get("timestamp", "")),
            }
            for p in parkings
        ]
    except Exception:
        return []


def _collect_points() -> list:
    try:
        from .db.points_db import get_points_list_db
        points = get_points_list_db() or []
        return [
            {
                "phone":        p.get("phone"),
                "remaining":    p.get("points", 0),
                "total_earned": p.get("accumulated_points", 0),
                "last_updated": str(p.get("last_updated", "")),
            }
            for p in points
        ]
    except Exception:
        return []


def _collect_reservations() -> list:
    try:
        from .db.operations_db import get_active_reservations
        reservations = get_active_reservations() or []
        return [
            {
                "reservation_id": r.get("reservation_id"),
                "name":           r.get("customer_name") or r.get("name"),
                "party_size":     r.get("party_size"),
                "reserved_time":  str(r.get("reserved_time", "")),
                "status":         r.get("status"),
                "store_id":       r.get("store_id"),
            }
            for r in reservations
        ]
    except Exception:
        return []


# ── 파일 쓰기 ─────────────────────────────────────────────────────────────────

def _write_session_json(seat_requests: list):
    """debug/session.json: seat_requests + active sessions."""
    sessions = _collect_sessions(seat_requests)
    data = {
        "updated_at":   datetime.now().isoformat(),
        "seat_requests": seat_requests or [],
        "sessions": {
            "count":  len(sessions),
            "active": sessions,
        },
    }
    try:
        with open(SESSION_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    except Exception as e:
        print(f"[Monitor] session.json 쓰기 실패: {e}")


def _write_state_json():
    """debug/state.json: calls + waiting + parking + points + reservations."""
    data = {
        "updated_at":   datetime.now().isoformat(),
        "calls":        _collect_calls(),
        "waiting":      _collect_waiting(),
        "parking":      _collect_parking(),
        "points":       _collect_points(),
        "reservations": _collect_reservations(),
    }
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    except Exception as e:
        print(f"[Monitor] state.json 쓰기 실패: {e}")


# ── 공개 API ─────────────────────────────────────────────────────────────────

def record_event(event: str, payload: dict = None, seat_requests: list = None):
    """이벤트 발생 시 session.json + state.json 동시 갱신."""
    if not ENABLED:
        return
    _ensure_dirs()
    _write_session_json(seat_requests)
    _write_state_json()


def snapshot_before_db(label: str, session_obj: dict):
    """DB 저장 직전 세션 객체 스냅샷."""
    if not ENABLED:
        return
    _ensure_dirs()
    table_id = session_obj.get("table_id", "UNKNOWN")
    ts       = datetime.now().strftime("%H%M%S_%f")[:-3]
    fpath    = os.path.join(SNAPSHOT_DIR, f"{ts}_{label}_{table_id}.json")
    try:
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump({
                "snapshot_time": datetime.now().isoformat(),
                "label":         label,
                "session":       session_obj,
            }, f, ensure_ascii=False, indent=2, default=str)
    except Exception as e:
        print(f"[Monitor] 스냅샷 저장 실패: {e}")


def get_monitor_data() -> dict:
    """session.json 내용 반환 (하위 호환)."""
    if os.path.exists(SESSION_FILE):
        try:
            with open(SESSION_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"error": "아직 이벤트 없음"}


def get_state_data() -> dict:
    """state.json 내용 반환."""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"error": "아직 이벤트 없음"}


def list_snapshots(limit: int = 20) -> list:
    if not os.path.exists(SNAPSHOT_DIR):
        return []
    return sorted(os.listdir(SNAPSHOT_DIR), reverse=True)[:limit]


def get_snapshot(fname: str) -> dict:
    fpath = os.path.join(SNAPSHOT_DIR, fname)
    if not os.path.exists(fpath):
        return {"error": "파일 없음"}
    try:
        with open(fpath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        return {"error": str(e)}
