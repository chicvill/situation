from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..state import manager

router = APIRouter()


@router.websocket("/ws/kitchen")
async def ws_kitchen(websocket: WebSocket):
    await manager.connect(websocket, "kitchen")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, "kitchen")


@router.websocket("/ws/table/{table_id}")
async def ws_table(websocket: WebSocket, table_id: str):
    await manager.connect(websocket, table_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, table_id)
