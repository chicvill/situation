/**
 * MQTT 싱글톤 클라이언트 — 모든 실시간 통신 통합
 * Mosquitto 브로커에 WebSocket(포트 9001)으로 연결.
 *
 * 토픽:
 *   situation/kitchen           — 주방·카운터 전체 broadcast
 *   situation/table/{table_id}  — 특정 테이블 모바일 대상 메시지
 */

import mqtt, { type MqttClient } from 'mqtt';
import { MQTT_WS_BASE } from '../config';

let _client: MqttClient | null = null;

// topic → handlers (레퍼런스 카운팅으로 중복 subscribe/unsubscribe 방지)
const _handlers = new Map<string, Set<(data: any) => void>>();

function buildClient(): MqttClient {
    const client = mqtt.connect(MQTT_WS_BASE, {
        reconnectPeriod: 5000,
        connectTimeout: 10000,
        clientId: `situation-room-${Math.random().toString(16).slice(2, 8)}`,
    });

    client.on('connect', () => {
        console.log(`[MQTT] 브로커 연결 성공: ${MQTT_WS_BASE}`);
        // 재연결 시 등록된 모든 토픽 재구독
        for (const topic of _handlers.keys()) {
            client.subscribe(topic);
        }
    });

    client.on('error', (err) => {
        console.error('[MQTT] 연결 오류:', err.message);
    });

    client.on('close', () => {
        console.log('[MQTT] 연결 종료. 자동 재연결 대기 중...');
    });

    client.on('message', (topic, payload) => {
        const handlers = _handlers.get(topic);
        if (!handlers) return;
        try {
            const data = JSON.parse(payload.toString());
            handlers.forEach(h => h(data));
        } catch (e) {
            console.error('[MQTT] 메시지 파싱 오류:', e);
        }
    });

    return client;
}

function getClient(): MqttClient {
    if (_client && (_client.connected || _client.reconnecting)) return _client;
    _client = buildClient();
    return _client;
}

/** 레거시 코드 호환용 — 직접 client 접근이 필요한 경우 */
export function getMqttClient(): MqttClient {
    return getClient();
}

/**
 * 토픽 구독 + 메시지 핸들러 등록.
 * 반환값을 cleanup 함수로 useEffect의 return에 사용하면 됨.
 */
export function subscribeTopic(topic: string, handler: (data: any) => void): () => void {
    const client = getClient();

    if (!_handlers.has(topic)) {
        _handlers.set(topic, new Set());
        client.subscribe(topic);
    }
    _handlers.get(topic)!.add(handler);

    return () => {
        const handlers = _handlers.get(topic);
        if (!handlers) return;
        handlers.delete(handler);
        if (handlers.size === 0) {
            _handlers.delete(topic);
            try { client.unsubscribe(topic); } catch (_) {}
        }
    };
}

export function closeMqttClient() {
    if (_client) {
        _client.end(true);
        _client = null;
        _handlers.clear();
    }
}
