"""
debug_router.py — 개발/테스트용 상태 조회 엔드포인트

/api/debug/state      : session.json + state.json 합산 요약 (test_e2e.py 호환)
/api/debug/monitor    : session.json 파일 내용 (seat_requests + active sessions)
/api/debug/state-data : state.json 파일 내용 (calls, waiting, parking, points, reservations)
/api/debug/snapshots  : DB 저장 직전 스냅샷 파일 목록
/api/debug/snapshots/{fname} : 특정 스냅샷 내용
/api/debug/reset-test : 테스트 테이블(T98, T99) 초기화
"""
from fastapi import APIRouter
from ..state import manager
from ..debug_writer import get_monitor_data, get_state_data, list_snapshots, get_snapshot

router = APIRouter(tags=["debug"])


@router.get("/api/debug/state")
async def get_full_state():
    """session.json + state.json 갱신 후 테이블별 요약 반환 (test_e2e.py 호환)."""
    from ..debug_writer import record_event, _collect_sessions
    seat_reqs = list(manager._seat_requests.values())

    sessions = _collect_sessions(seat_reqs)

    # 테이블별 요약 (test_e2e.py 호환)
    summary = {}
    for s in sessions:
        tid = s["table_id"]
        summary[tid] = {
            "session_id":       s["session_id"],
            "status":           s["status"],
            "store_id":         s["store_id"],
            "order_count":      s["order_count"],
            "has_seat_request": s["seat_requested"],
        }
    for r in seat_reqs:
        tid = r["table_id"]
        if tid not in summary:
            summary[tid] = {
                "session_id": None, "status": None,
                "store_id": r.get("store_id"),
                "order_count": 0, "has_seat_request": True,
            }

    # session.json + state.json 동시 갱신
    record_event("DEBUG_STATE_QUERY", {}, seat_reqs)

    return {
        "memory":   {"seat_requests": seat_reqs},
        "sessions": {"count": len(sessions), "active": sessions},
        "summary":  summary,
    }


@router.get("/api/debug/monitor")
async def get_monitor():
    """session.json 내용 반환 (seat_requests + active sessions)"""
    return get_monitor_data()


@router.get("/api/debug/state-data")
async def get_state():
    """state.json 내용 반환 (calls + waiting + parking + points + reservations)"""
    return get_state_data()


@router.get("/api/debug/snapshots")
async def list_all_snapshots():
    """DB 저장 직전 스냅샷 파일 목록 (최근 30개)"""
    return list_snapshots(limit=30)


@router.get("/api/debug/snapshots/{fname}")
async def get_one_snapshot(fname: str):
    """특정 스냅샷 파일 내용 조회"""
    return get_snapshot(fname)


@router.post("/api/debug/cleanup-ghost")
async def cleanup_ghost_sessions(days: int = 1):
    """
    지정한 일수보다 오래된 활성 세션을 일괄 종료 (유령 세션 제거).
    days=1 이면 24시간 이상 된 세션 종료.
    """
    from ..database import get_db_conn, update_session_status
    conn = get_db_conn()
    if not conn:
        return {"error": "DB 연결 실패"}
    try:
        from psycopg2.extras import RealDictCursor
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT session_id, store_id, table_id, checkin_time
            FROM table_sessions
            WHERE status != 'closed'
              AND checkin_time < NOW() - INTERVAL '%s days'
        """, (days,))
        ghosts = cur.fetchall()
        cur.close(); conn.close()
    except Exception as e:
        return {"error": str(e)}

    closed = []
    for g in ghosts:
        update_session_status(g['session_id'], 'closed')
        manager.remove_seat_request(g['table_id'])
        closed.append({"session_id": g['session_id'], "table_id": g['table_id'], "store_id": g['store_id']})

    return {"closed_count": len(closed), "closed": closed}


@router.get("/api/debug/archive")
async def get_archive(store_id: str = "Total", limit: int = 20):
    """세션 아카이브 조회 (종료된 세션 요약)."""
    from ..database import get_db_conn
    from psycopg2.extras import RealDictCursor
    conn = get_db_conn()
    if not conn:
        return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if store_id and store_id != "Total":
            cur.execute("""
                SELECT * FROM session_archive
                WHERE store_id = %s
                ORDER BY archived_at DESC LIMIT %s
            """, (store_id, limit))
        else:
            cur.execute("""
                SELECT * FROM session_archive
                ORDER BY archived_at DESC LIMIT %s
            """, (limit,))
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        return {"error": str(e)}


@router.post("/api/debug/reset-test")
async def reset_test_tables():
    """테스트 테이블(T98, T99) 초기화 — 테스트 스크립트 전후 정리용"""
    from ..database import get_all_active_sessions, update_session_status, get_orders_by_session, update_order_status
    cleaned = []
    sessions = get_all_active_sessions("Total") or []
    test_tables = {"T98", "T99"}
    for s in sessions:
        if s.get("table_id") in test_tables:
            sid = s["session_id"]
            orders = get_orders_by_session(sid) or []
            for o in orders:
                update_order_status(o["order_id"], "cancelled")
            update_session_status(sid, "closed")
            manager.remove_seat_request(s["table_id"])
            cleaned.append(s["table_id"])
    return {"cleaned": cleaned}


from fastapi.responses import HTMLResponse
import os

@router.get("/api/doc/checklist", response_class=HTMLResponse)
async def get_checklist_html():
    """MQnet 최종 체크리스트 HTML 반환"""
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))) # situation/
    checklist_path = os.path.join(base_dir, "doc", "situation_최종_체크리스트.html")
    if os.path.exists(checklist_path):
        with open(checklist_path, "r", encoding="utf-8") as f:
            content = f.read()
        return HTMLResponse(content=content)
    return HTMLResponse(content=f"<h1>Checklist file not found</h1><p>Tried path: {checklist_path}</p>", status_code=404)

