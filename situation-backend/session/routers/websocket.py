# WebSocket 엔드포인트 제거 — 모든 실시간 통신은 MQTT로 통일됨
# 주방·카운터: situation/kitchen
# 테이블 모바일: situation/table/{table_id}
from fastapi import APIRouter
router = APIRouter()
