"""
MQTT Handler - 직원 호출(Staff Call) Phase 1
기존 WebSocket과 병행 운용. 브로커: Mosquitto

토픽 구조:
  store/{store_id}/call            - 모바일 → 백엔드 (Subscribe)
  store/{store_id}/call/broadcast  - 백엔드 → 카운터/주방 (Publish)
"""

import asyncio
import os
import json
import uuid
from datetime import datetime
from typing import Optional, Any

try:
    import aiomqtt
    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False
    print("[MQTT] aiomqtt 미설치 - MQTT 기능 비활성화. `pip install aiomqtt` 로 설치하세요.")

MQTT_HOST = os.getenv("MQTT_BROKER_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", "1885"))  # 1885: 기존 Windows 서비스(1883) 충돌 방지

_mqtt_client: Optional[Any] = None


async def mqtt_publish(topic: str, payload: dict) -> bool:
    """카운터/주방으로 MQTT 메시지 발행."""
    global _mqtt_client
    if not MQTT_AVAILABLE:
        return False
    if _mqtt_client is None:
        print(f"[MQTT 브로드캐스트 실패] 브로커 미연결 - topic={topic}")
        return False
    try:
        message = json.dumps(payload, ensure_ascii=False)
        await _mqtt_client.publish(topic, message)
        print(f"[MQTT 브로드캐스트] topic={topic} | {message[:150]}")
        return True
    except Exception as e:
        print(f"[MQTT 브로드캐스트 오류] topic={topic} error={e}")
        return False


async def _handle_call_message(store_id: str, payload: dict, ws_manager):
    """MQTT로 수신된 직원 호출 처리 (DB 저장 → WebSocket + MQTT 브로드캐스트)."""
    from .database import save_call, get_active_session

    table_id = payload.get("table_id") or payload.get("tableId")
    call_type = payload.get("call_type") or payload.get("callType") or "직원호출"

    if not table_id:
        print(f"[DB 저장 상태] 실패 - table_id 없음 / store_id={store_id}")
        return

    try:
        active = get_active_session(store_id, table_id)
        session_id = active["session_id"] if active else "SESS-NONE"
    except Exception as e:
        print(f"[DB 저장 상태] 세션 조회 오류: {e}")
        session_id = "SESS-NONE"

    call_id = payload.get("call_id") or f"CALL-{uuid.uuid4().hex[:4].upper()}"
    call_data = {
        "call_id": call_id,
        "table_id": table_id,
        "session_id": session_id,
        "call_type": call_type,
        "status": "pending",
        "timestamp": datetime.now().isoformat(),
    }

    try:
        saved = save_call(call_data)
        if saved:
            print(f"[DB 저장 상태] 성공 - call_id={call_id}, table={table_id}, store={store_id}")
        else:
            print(f"[DB 저장 상태] 실패 - call_id={call_id}")
    except Exception as e:
        print(f"[DB 저장 상태] 예외: {e}")

    broadcast_msg = {
        "type": "STAFF_CALL",
        "call_id": call_id,
        "table_id": table_id,
        "call_type": call_type,
        "status": "pending",
        "store_id": store_id,
    }

    # situation/kitchen 토픽으로 브로드캐스트 (주방·카운터)
    await ws_manager.broadcast_to_kitchen(broadcast_msg)


async def run_mqtt_client(ws_manager):
    """MQTT 구독 루프 - 앱 lifespan에서 백그라운드 태스크로 실행."""
    global _mqtt_client
    if not MQTT_AVAILABLE:
        print("[MQTT] aiomqtt 미설치 - MQTT 서비스를 시작할 수 없습니다.")
        return

    while True:
        try:
            print(f"[MQTT] 브로커 연결 시도: {MQTT_HOST}:{MQTT_PORT}")
            async with aiomqtt.Client(MQTT_HOST, MQTT_PORT) as client:
                _mqtt_client = client
                print(f"[MQTT] 브로커 연결 성공: {MQTT_HOST}:{MQTT_PORT}")

                await client.subscribe("store/+/call")
                print("[MQTT] 구독 완료: store/+/call (직원 호출 채널)")

                async for message in client.messages:
                    topic = str(message.topic)
                    try:
                        payload = json.loads(message.payload)
                        print(f"[MQTT 수신 - 백엔드] topic={topic} | {str(payload)[:150]}")

                        # store/{store_id}/call 파싱
                        parts = topic.split("/")
                        if len(parts) == 3 and parts[0] == "store" and parts[2] == "call":
                            store_id = parts[1]
                            await _handle_call_message(store_id, payload, ws_manager)
                        else:
                            print(f"[MQTT 수신 - 백엔드] 알 수 없는 토픽 형식: {topic}")
                    except json.JSONDecodeError:
                        print(f"[MQTT 수신 오류] JSON 파싱 실패: topic={topic}")
                    except Exception as e:
                        print(f"[MQTT 수신 오류] topic={topic} error={e}")

        except Exception as e:
            print(f"[MQTT] 연결 끊김 또는 오류: {e}. 5초 후 재연결...")
            _mqtt_client = None

        await asyncio.sleep(5)
