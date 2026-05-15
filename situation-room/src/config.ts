/**
 * 🌐 Network Configuration
 * Automatically detects the server IP to allow mobile access.
 */
const getApiBase = () => {
    const host = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');
    if (isLocal) {
        return `${protocol}://${host}:8000`;
    }
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    return `${protocol}://${host}:8000`;
};

const getWsBase = () => {
    const host = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');
    if (isLocal) {
        return `${protocol}://${host}:8000`;
    }
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
    // Production (same origin): no port needed
    if (host !== 'localhost' && !host.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        return `${protocol}://${host}`;
    }
    return `${protocol}://${host}:8000`;
};

const getMqttWsBase = () => {
    if (import.meta.env.VITE_MQTT_WS_URL) return import.meta.env.VITE_MQTT_WS_URL;
    const host = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    // Mosquitto WebSocket 기본 포트: 9001
    return `${protocol}://${host}:9001`;
};

export const API_BASE = getApiBase();
export const WS_BASE = getWsBase();
export const MQTT_WS_BASE = getMqttWsBase();
export const TOSS_CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY || 'test_ck_D5b4Zne68wxL1Pn6k0m8rlzYWBn1';
