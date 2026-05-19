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
      store/{store_id}/counter          — 카운터 (세션·호출·주차·결제)
      store/{store_id}/kitchen          — 주방 (주문·조리 상태)
      store/{store_id}/table/{table_id} — 모바일 (테이블별)
      store/broadcast/{channel}         — store_id 미확정 시 전체 broadcast
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

    def remove_seat_request(self, table_id: str):
        self._seat_requests.pop(table_id, None)

    def get_seat_requests(self, store_id: Optional[str] = None) -> list:
        reqs = list(self._seat_requests.values())
        if store_id and store_id not in ("Total", "default_store"):
            reqs = [r for r in reqs if r["store_id"] == store_id]
        return reqs

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
            await mqtt_publish(f"store/{store_id}/kitchen", message, qos=1)
            await mqtt_publish(f"store/{store_id}/counter", message, qos=1)
        else:
            await mqtt_publish("store/broadcast/kitchen", message, qos=1)
            await mqtt_publish("store/broadcast/counter", message, qos=1)
        print(f"[MQTT] broadcast type={message.get('type')!r} store={store_id!r}")

    async def send_to_table(self, table_id: str, message: dict):
        from .mqtt_handler import mqtt_publish
        store_id = self._extract_store_id(message)
        if store_id:
            await mqtt_publish(f"store/{store_id}/table/{table_id}", message, qos=1)
        else:
            await mqtt_publish(f"situation/table/{table_id}", message, qos=1)


manager = ConnectionManager()
