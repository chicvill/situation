import asyncio
import os
import json
from typing import Optional

POOL_FILE = os.path.join(os.path.dirname(__file__), "..", "knowledge_pool.json")

_pool_cache: Optional[list] = None


def load_pool() -> list:
    global _pool_cache
    if _pool_cache is not None:
        return _pool_cache
    if os.path.exists(POOL_FILE):
        try:
            with open(POOL_FILE, "r", encoding="utf-8") as f:
                _pool_cache = json.load(f)
                return _pool_cache
        except Exception:
            pass
    _pool_cache = []
    return _pool_cache


def save_pool(pool: list) -> bool:
    global _pool_cache
    _pool_cache = pool
    try:
        with open(POOL_FILE, "w", encoding="utf-8") as f:
            json.dump(pool, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Save Pool Error: {e}")
        return False


class ConnectionManager:
    """MQTT 기반 실시간 메시지 브로드캐스트 매니저.

    토픽 구조:
      store/{store_id}                  — 매장 이벤트 전체 (카운터·주방·대기 통합)
      store/{store_id}/table/{table_id} — 모바일 (테이블별)
      store/broadcast                   — store_id 미확정 시 전체 broadcast
      store/+/call                      — 모바일 → 백엔드 호출 수신 (구독 전용)
    """

    def __init__(self):
        # table_id → { table_id, store_id, timestamp } 형태의 대기 중인 좌석 요청
        self._seat_requests: dict = {}

    def add_seat_request(self, table_id: str, store_id: str, timestamp: str):
        self._seat_requests[table_id] = {
            "table_id": table_id,
            "store_id": store_id,
            "timestamp": timestamp,
        }
        self._monitor("SEAT_REQUEST_ADDED", {"table_id": table_id, "store_id": store_id})

    def remove_seat_request(self, table_id: str):
        self._seat_requests.pop(table_id, None)
        self._monitor("SEAT_REQUEST_REMOVED", {"table_id": table_id})

    def get_seat_requests(self, store_id: Optional[str] = None) -> list:
        reqs = list(self._seat_requests.values())
        if store_id and store_id not in ("Total", "default_store"):
            # 특정 매장 요청 시: 해당 매장 + store_id 미지정(default_store) 요청 모두 반환
            reqs = [r for r in reqs if r["store_id"] in (store_id, "default_store", "")]
        return reqs

    # session.json 갱신 대상 이벤트 (세션·주문·결제 관련)
    _SESSION_EVENTS = frozenset({
        "SEAT_REQUEST_ADDED", "SEAT_REQUEST_REMOVED",
        "SESSION_OPENED", "SESSION_CLOSED", "PARTIAL_SETTLEMENT",
        "NEW_ORDER", "ORDER_UPDATED", "STATUS_UPDATE", "PAYMENT_CONFIRMED",
        "JOIN_REQUEST", "JOIN_SESSION",
    })
    # state.json 갱신 대상 이벤트 (독립 데이터 관련)
    _STATE_EVENTS = frozenset({
        "WAITING_REGISTERED", "WAITING_UPDATED", "WAITING_STATUS_CHANGED",
        "STAFF_CALL", "CALL_SAVED", "CALL_STATUS_UPDATED",
        "PARKING_APPLIED",
        "RESERVATION_UPDATED",
        "POINTS_UPDATED",
    })

    def _monitor(self, event: str, payload: dict = None):
        if event not in self._SESSION_EVENTS and event not in self._STATE_EVENTS:
            return  # 무관한 이벤트(POOL_UPDATED 등) 는 스킵
        try:
            from .debug_writer import record_event
            seat_reqs = list(self._seat_requests.values())
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # 이벤트 루프 블로킹 방지: 스레드 풀에서 실행
                loop.run_in_executor(None, record_event, event, payload, seat_reqs)
            else:
                record_event(event, payload, seat_reqs)
        except Exception:
            pass

    def _extract_store_id(self, message: dict) -> Optional[str]:
        sid = message.get("store_id")
        if sid and sid not in ("Total", "default_store"):
            return sid
        for key in ("order", "session", "data", "call", "info"):
            sub = message.get(key)
            if isinstance(sub, dict):
                sid = sub.get("store_id")
                if sid and sid not in ("Total", "default_store"):
                    return sid
        return None

    async def broadcast_to_kitchen(self, message: dict):
        from .mqtt_handler import mqtt_publish
        store_id = self._extract_store_id(message)
        if store_id:
            await mqtt_publish(f"store/{store_id}", message, qos=1)
        else:
            await mqtt_publish("store/broadcast", message, qos=1)
        print(f"[MQTT] broadcast type={message.get('type')!r} store={store_id!r}")
        # 모든 브로드캐스트 이벤트를 session.json + state.json 에 자동 기록
        self._monitor(message.get("type", "BROADCAST"), message)

    async def send_to_table(self, table_id: str, message: dict):
        from .mqtt_handler import mqtt_publish
        store_id = self._extract_store_id(message)
        if store_id:
            await mqtt_publish(f"store/{store_id}/table/{table_id}", message, qos=1)
        else:
            await mqtt_publish(f"situation/table/{table_id}", message, qos=1)


manager = ConnectionManager()
