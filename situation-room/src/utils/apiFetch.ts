import { API_BASE } from '../config';

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
