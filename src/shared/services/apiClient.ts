/**
 * Centralized API Client for Chit Fund Management System
 * Handles JWT token injection, authentication headers, error wrapping, and base URLs.
 */

export const JWT_STORAGE_KEY = 'chitfund_jwt_token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(JWT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(JWT_STORAGE_KEY, token);
  } catch (err) {
    console.error('Failed to store JWT token in localStorage', err);
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(JWT_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear JWT token', err);
  }
}

export function getApiBaseUrl(): string {
  // Can be configured via VITE_API_URL or defaults to relative '/api'
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  return '/api';
}

export interface ApiFetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  let url = `${baseUrl}/${endpoint.replace(/^\/+/, '')}`;

  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (!options.skipAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-Auth-Token'] = token;
    }
  }

  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token is invalid or expired
      window.dispatchEvent(new CustomEvent('chitfund_auth_unauthorized'));
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMsg);
    }

    return data as T;
  } catch (err: any) {
    // Re-throw with meaningful message
    throw new Error(err.message || 'Network request failed. Ensure the server is reachable.');
  }
}
