/**
 * 🌐 Network Configuration
 * Automatically detects the server IP to allow mobile access.
 */
const getApiBase = () => {
    // If we're on localhost, use localhost for local dev. 
    // If we're on a real IP (mobile access), use that IP.
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    const host = window.location.hostname;
    return `http://${host}:8000`;
};

export const API_BASE = getApiBase();
export const WS_BASE = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:8000`;
