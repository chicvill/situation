import os
import json
from fastapi import WebSocket
from typing import Dict, List

POOL_FILE = os.path.join(os.path.dirname(__file__), "..", "knowledge_pool.json")


def load_pool():
    if os.path.exists(POOL_FILE):
        try:
            with open(POOL_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            return []
    return []


def save_pool(pool):
    try:
        with open(POOL_FILE, "w", encoding="utf-8") as f:
            json.dump(pool, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Save Pool Error: {e}")
        return False


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
        for connection in self.kitchen_connections:
            try:
                await connection.send_json(message)
            except:
                pass

    async def send_to_table(self, table_id: str, message: dict):
        if table_id in self.active_connections:
            for connection in self.active_connections[table_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass


manager = ConnectionManager()
