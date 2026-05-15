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

    토픽:
      situation/kitchen           — 주방·카운터 전체 broadcast
      situation/table/{table_id}  — 특정 테이블 모바일 대상 메시지
    """

    async def broadcast_to_kitchen(self, message: dict):
        from .mqtt_handler import mqtt_publish
        await mqtt_publish("situation/kitchen", message)

    async def send_to_table(self, table_id: str, message: dict):
        from .mqtt_handler import mqtt_publish
        await mqtt_publish(f"situation/table/{table_id}", message)

    # --- 하위 호환: 기존 코드에서 active_connections를 순회하는 곳이 있어서 빈 dict 유지 ---
    @property
    def active_connections(self) -> dict:
        return {}


manager = ConnectionManager()
