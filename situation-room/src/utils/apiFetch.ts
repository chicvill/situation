let API_BASE = import.meta.env.VITE_API_URL;
if (!API_BASE || ((API_BASE.includes('127.0.0.1') || API_BASE.includes('localhost')) && window.location.hostname !== '127.0.0.1' && window.location.hostname !== 'localhost')) {
    API_BASE = `http://${window.location.hostname}:8000`;
}

export const getApiBase = () => API_BASE;

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const token = localStorage.getItem('mqnet_token');
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> ?? {}),
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(`${API_BASE}${path}`, { ...options, headers });
}
