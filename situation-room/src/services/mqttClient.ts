/**
 * MQTT 싱글톤 클라이언트 — 모든 실시간 통신 통합
 * Mosquitto 브로커에 WebSocket(포트 9001)으로 연결.
 * MQTT Client Service (HiveMQ Cloud 연동)
 * 브로커에 WebSocket(포트 8884)으로 연결.
 *
 * 토픽 구조:
 *   store/{store_id}                  — 매장 이벤트 전체 (카운터·주방·대기 통합)
 *   store/{store_id}/table/{table_id} — 모바일 (테이블별)
 *   store/broadcast                   — store_id 미확정 시 전체 broadcast
 *   store/{store_id}/call             — 모바일 → 백엔드 호출 (Subscribe 전용)
 *
 * 와일드카드:
 *   store/+   — 모든 매장 이벤트 (Total 모드)
 */

import mqtt, { type MqttClient } from 'mqtt';
import { MQTT_WS_BASE } from '../config';

let _client: MqttClient | null = null;

// topic/pattern → handlers (레퍼런스 카운팅으로 중복 subscribe/unsubscribe 방지)
const _handlers = new Map<string, Set<(data: any) => void>>();
const _globalListeners = new Set<(topic: string, data: any) => void>();

export function addGlobalMqttListener(callback: (topic: string, data: any) => void) {
    _globalListeners.add(callback);
    return () => _globalListeners.delete(callback);
}

/** MQTT 와일드카드 패턴 매칭 (+: 단일 레벨, #: 다중 레벨) */
function mqttTopicMatch(pattern: string, topic: string): boolean {
    const pp = pattern.split('/');
    const tp = topic.split('/');
    if (pp[pp.length - 1] === '#') {
        return topic.startsWith(pp.slice(0, -1).join('/'));
    }
    if (pp.length !== tp.length) return false;
    return pp.every((seg, i) => seg === '+' || seg === tp[i]);
}

function buildClient(): MqttClient {
    // 탭마다 고정 clientId를 사용해 HiveMQ에 이전 세션을 덮어씀 (연결 수 누적 방지)
    const tabId = sessionStorage.getItem('_mqttTabId') || Math.random().toString(16).slice(2, 10);
    sessionStorage.setItem('_mqttTabId', tabId);

    const opts: Record<string, unknown> = {
        reconnectPeriod: 8000,   // 빠른 재연결 폭풍 방지
        connectTimeout: 20000,   // HiveMQ 응답 대기 늘림
        keepalive: 60,
        clean: true,
        protocolVersion: 5,      // HiveMQ Cloud 최적화 (MQTT 5.0)
        clientId: `sr-${tabId}-${Math.random().toString(16).slice(2, 6)}`, // 고유성 보장 강화
    };
    const mqttUser = import.meta.env.VITE_MQTT_USERNAME || 'situation';
    const mqttPass = import.meta.env.VITE_MQTT_PASSWORD || 'M!nkim5053hivemq';
    if (mqttUser) opts.username = mqttUser;
    if (mqttPass) opts.password = mqttPass;

    console.log(`[MQTT] 연결 시도 → ${MQTT_WS_BASE} (clientId: sr-${tabId})`);
    const client = mqtt.connect(MQTT_WS_BASE, opts as any);

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
        try {
            const data = JSON.parse(payload.toString());
            // 글로벌 디버깅 리스너에 이벤트 전송
            _globalListeners.forEach(h => h(topic, data));

            _handlers.forEach((handlers, pattern) => {
                if (mqttTopicMatch(pattern, topic)) {
                    handlers.forEach(h => h(data));
                }
            });
        } catch (e) {
            console.error('[MQTT] 메시지 파싱 오류:', e);
        }
    });

    return client;
}

function getClient(): MqttClient {
    if (_client) return _client;
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

// Vite HMR: 모듈 교체 전 연결 정리 (dev 중 연결 누적 방지)
if (import.meta.hot) {
    import.meta.hot.dispose(() => { closeMqttClient(); });
}

// 페이지 언로드 시 연결 정리
window.addEventListener('beforeunload', () => { closeMqttClient(); });
