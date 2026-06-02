/**
 * 🌐 Network Configuration
 * Automatically detects the server IP to allow mobile access.
 */
const getApiBase = () => {
    const host = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');
    if (isLocal) return `${protocol}://${host}:8080`;
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    // Production (same origin): no port needed
    if (!host.match(/^\d+\.\d+\.\d+\.\d+$/)) return `${protocol}://${host}`;
    return `${protocol}://${host}:8080`;
};

const getWsBase = () => {
    const host = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');
    if (isLocal) {
        return `${protocol}://${host}:8080`;
    }
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
    // Production (same origin): no port needed
    if (host !== 'localhost' && !host.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        return `${protocol}://${host}`;
    }
    return `${protocol}://${host}:8080`;
};

const getMqttWsBase = () => {
    // 환경변수나 캐시 문제와 무관하게 명시적으로 HiveMQ Cloud WSS 주소 강제 반환
    return 'wss://315e5d948dad4a52b84916853d7e9344.s1.eu.hivemq.cloud:8884/mqtt';
};

export const API_BASE = getApiBase();
export const WS_BASE = getWsBase();
export const MQTT_WS_BASE = getMqttWsBase();
export const TOSS_CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY || 'test_ck_D5b4Zne68wxL1Pn6k0m8rlzYWBn1';
