import os
import json
import asyncio
from fastapi import WebSocket
from typing import Dict, List, Optional

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
    _pool_cache = pool  # 캐시 즉시 갱신
    try:
        with open(POOL_FILE, "w", encoding="utf-8") as f:
            json.dump(pool, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Save Pool Error: {e}")
        return False


async def _safe_send(ws: WebSocket, message: dict):
    try:
        await ws.send_json(message)
    except Exception:
        pass


class ConnectionManager:
    def __init__(self):
        # table_id: [websockets]
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.kitchen_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket, client_id: str = "mobile"):
        await websocket.accept()
        if client_id == "kitchen":
            self.kitchen_connections.append(websocket)
        else:
            if client_id not in self.active_connections:
                self.active_connections[client_id] = []
            self.active_connections[client_id].append(websocket)

    def disconnect(self, websocket: WebSocket, client_id: str = "mobile"):
        if client_id == "kitchen":
            if websocket in self.kitchen_connections:
                self.kitchen_connections.remove(websocket)
        else:
            if client_id in self.active_connections:
                if websocket in self.active_connections[client_id]:
                    self.active_connections[client_id].remove(websocket)

    async def broadcast_to_kitchen(self, message: dict):
        if not self.kitchen_connections:
            return
        await asyncio.gather(
            *[_safe_send(ws, message) for ws in self.kitchen_connections]
        )

    async def send_to_table(self, table_id: str, message: dict):
        conns = self.active_connections.get(table_id)
        if not conns:
            return
        await asyncio.gather(
            *[_safe_send(ws, message) for ws in conns]
        )


manager = ConnectionManager()
