"""
MQTT Handler — Mosquitto / HiveMQ Cloud 브로커 연동

Windows ProactorEventLoop + aiomqtt(paho-mqtt 2.x) TLS 호환을 위해
MQTT 루프를 별도 스레드의 SelectorEventLoop에서 실행합니다.

토픽 구조:
  store/{store_id}                  — 매장 이벤트 전체 발행 (Publish)
  store/broadcast                   — store_id 미확정 시 전체 발행 (Publish)
  store/{store_id}/table/{table_id} — 모바일 테이블별 (Publish)
  store/{store_id}/call             — 모바일 → 백엔드 호출 수신 (Subscribe)
"""

import asyncio
import os
import json
import ssl
import threading
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
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME") or None
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD") or None

_mqtt_client: Optional[Any] = None
_mqtt_loop: Optional[asyncio.AbstractEventLoop] = None  # MQTT 전용 SelectorEventLoop


async def mqtt_publish(topic: str, payload: dict, qos: int = 0) -> bool:
    """카운터/주방으로 MQTT 메시지 발행 (fire-and-forget, 스레드 안전)."""
    global _mqtt_client, _mqtt_loop
    if not MQTT_AVAILABLE:
        return False
    if _mqtt_client is None or _mqtt_loop is None:
        print(f"[MQTT 브로드캐스트 실패] 브로커 미연결 - topic={topic}")
        return False
    try:
        message = json.dumps(payload, ensure_ascii=False)

        async def _do_publish():
            await _mqtt_client.publish(topic, message, qos=qos)
            print(f"[MQTT 브로드캐스트] topic={topic} (QoS:{qos}) | {message[:150]}")

        asyncio.run_coroutine_threadsafe(_do_publish(), _mqtt_loop)
        return True
    except Exception as e:
        print(f"[MQTT 브로드캐스트 오류] topic={topic} error={e}")
        return False


async def _handle_call_message(store_id: str, payload: dict, ws_manager):
    """MQTT로 수신된 직원 호출 처리 (DB 저장 → MQTT 브로드캐스트)."""
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
    await ws_manager.broadcast_to_kitchen(broadcast_msg)


async def _mqtt_loop_coroutine(ws_manager):
    """MQTT 구독 루프 (SelectorEventLoop 스레드 내에서 실행)."""
    global _mqtt_client

    conn_kwargs: dict = {"hostname": MQTT_HOST, "port": MQTT_PORT}
    if MQTT_USERNAME:
        conn_kwargs["username"] = MQTT_USERNAME
    if MQTT_PASSWORD:
        conn_kwargs["password"] = MQTT_PASSWORD
    if MQTT_PORT == 8883:
        conn_kwargs["tls_context"] = ssl.create_default_context()

    tls_label = "TLS" if MQTT_PORT == 8883 else "plain"
    print(f"[MQTT] 브로커 연결 시도: {MQTT_HOST}:{MQTT_PORT} ({tls_label}, auth={'yes' if MQTT_USERNAME else 'no'})")

    retry_count = 0
    while True:
        try:
            async with aiomqtt.Client(**conn_kwargs) as client:
                _mqtt_client = client
                retry_count = 0
                print(f"[MQTT] 브로커 연결 성공: {MQTT_HOST}:{MQTT_PORT}")

                await client.subscribe("store/+/call")
                print("[MQTT] 구독 완료: store/+/call")

                async for message in client.messages:
                    topic = str(message.topic)
                    try:
                        payload = json.loads(message.payload)
                        parts = topic.split("/")
                        if len(parts) == 3 and parts[0] == "store" and parts[2] == "call":
                            store_id = parts[1]
                            if _main_loop:
                                asyncio.run_coroutine_threadsafe(
                                    _handle_call_message(store_id, payload, ws_manager),
                                    _main_loop,
                                )
                    except json.JSONDecodeError:
                        print(f"[MQTT 수신 오류] JSON 파싱 실패: topic={topic}")
                    except Exception as e:
                        print(f"[MQTT 수신 오류] topic={topic} error={e}")

        except Exception as e:
            retry_count += 1
            _mqtt_client = None
            delay = 5 if retry_count <= 5 else 60
            if retry_count == 1 or retry_count == 6:
                print(f"[MQTT] 연결 실패: {e} → {delay}초 후 재시도")
            await asyncio.sleep(delay)


_main_loop: Optional[asyncio.AbstractEventLoop] = None


def _run_mqtt_thread(ws_manager):
    """별도 스레드에서 SelectorEventLoop으로 MQTT 클라이언트 실행."""
    global _mqtt_loop
    loop = asyncio.SelectorEventLoop()
    _mqtt_loop = loop
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_mqtt_loop_coroutine(ws_manager))
    finally:
        loop.close()


async def run_mqtt_client(ws_manager):
    """메인 lifespan에서 호출 — MQTT를 별도 스레드로 기동."""
    global _main_loop
    if not MQTT_AVAILABLE:
        print("[MQTT] aiomqtt 미설치 - MQTT 서비스를 시작할 수 없습니다.")
        return

    _main_loop = asyncio.get_running_loop()

    thread = threading.Thread(
        target=_run_mqtt_thread,
        args=(ws_manager,),
        daemon=True,
        name="mqtt-thread",
    )
    thread.start()
    print("[MQTT] 전용 스레드(SelectorEventLoop) 기동 완료")
