import { clearTokens, getTokens, hasRefreshToken, setTokens } from './tokens';
import { ApiError } from './errors';

// Local dev leaves this unset and rides the Vite proxy (see vite.config.js)
// so calls stay same-origin. Production sets VITE_API_BASE_URL to the
// separately-hosted backend, since the frontend and API live on different
// domains there (see CORS_ORIGIN in the backend .env).
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
let refreshInFlight = null;
const authExpiredListeners = new Set();

export function onAuthExpired(listener) {
  authExpiredListeners.add(listener);
  return () => authExpiredListeners.delete(listener);
}

function emitAuthExpired() {
  authExpiredListeners.forEach((l) => l());
}

function authHeader() {
  const tokens = getTokens();
  return tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {};
}

async function doRefresh() {
  const tokens = getTokens();
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokens?.refreshToken }),
  });
  if (!res.ok) throw await ApiError.fromResponse(res);
  const data = await res.json();
  setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data;
}

async function doFetch(path, opts = {}) {
  const { method = 'GET', body, headers = {}, skipAuth = false } = opts;
  return fetch(API_BASE + path, {
    method,
    headers: {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(skipAuth ? {} : authHeader()),
      ...headers,
    },
    body: body instanceof FormData ? body : body != null ? JSON.stringify(body) : undefined,
  });
}

async function requestRaw(path, opts = {}, _retried = false) {
  const { skipAuth = false } = opts;
  const res = await doFetch(path, opts);

  if (res.status === 401 && !skipAuth && !_retried && hasRefreshToken()) {
    refreshInFlight ??= doRefresh().finally(() => {
      refreshInFlight = null;
    });
    try {
      await refreshInFlight;
    } catch {
      clearTokens();
      emitAuthExpired();
      throw new ApiError(401, 'AUTH_EXPIRED', 'Phiên đăng nhập đã hết hạn');
    }
    return requestRaw(path, opts, true);
  }
  return res;
}

export async function request(path, opts = {}) {
  const res = await requestRaw(path, opts);
  if (!res.ok) throw await ApiError.fromResponse(res);
  if (res.status === 204) return null;
  return res.json();
}

// For endpoints that return a raw Response (e.g. file downloads).
export async function raw(path, opts = {}) {
  const res = await requestRaw(path, opts);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res;
}
