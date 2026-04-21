/**
 * 🌐 Network Configuration
 * Automatically detects the server IP to allow mobile access.
 */
const getApiBase = () => {
    // If we're on localhost, use localhost for local dev. 
    // If we're on a real IP (mobile access), use that IP.
    const host = window.location.hostname;
    return `http://${host}:8000`;
};

export const API_BASE = getApiBase();
export const WS_BASE = `ws://${window.location.hostname}:8000`;
