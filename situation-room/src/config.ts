/**
 * 🌐 Network Configuration
 * Automatically detects the server IP to allow mobile access.
 */
const getApiBase = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    const host = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    
    // Production (same origin): no port needed
    if (host !== 'localhost' && !host.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        return `${protocol}://${host}`;
    }
    return `${protocol}://${host}:8000`;
};

const getWsBase = () => {
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
    // HTTPS → wss://, HTTP → ws://
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname;
    // Production (same origin): no port needed
    if (host !== 'localhost' && !host.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        return `${protocol}://${host}`;
    }
    return `${protocol}://${host}:8000`;
};

export const API_BASE = getApiBase();
export const WS_BASE = getWsBase();
