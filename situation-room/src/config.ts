/**
 * 🌐 Network Configuration
 * Automatically detects the server IP to allow mobile access.
 */
const getApiBase = () => {
    const host = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    // 로컬 환경(localhost/127.0.0.1)이면 .env 캐싱에 구애받지 않고 항상 8000 포트로 접속
    if (host === 'localhost' || host === '127.0.0.1') {
        return `${protocol}://${host}:8000`;
    }
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    return `${protocol}://${host}:8000`;
};

const getWsBase = () => {
    const host = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    // 로컬 환경(localhost/127.0.0.1)이면 .env 캐싱에 구애받지 않고 항상 8000 포트로 접속
    if (host === 'localhost' || host === '127.0.0.1') {
        return `${protocol}://${host}:8000`;
    }
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
    // Production (same origin): no port needed
    if (host !== 'localhost' && !host.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        return `${protocol}://${host}`;
    }
    return `${protocol}://${host}:8000`;
};

export const API_BASE = getApiBase();
export const WS_BASE = getWsBase();
export const TOSS_CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY || 'test_ck_D5b4Zne68wxL1Pn6k0m8rlzYWBn1';
