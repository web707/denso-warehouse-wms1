const KEY = 'logi_auth';

export function getTokens() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setTokens({ accessToken, refreshToken }) {
  localStorage.setItem(KEY, JSON.stringify({ accessToken, refreshToken }));
}

export function clearTokens() {
  localStorage.removeItem(KEY);
}

export function hasRefreshToken() {
  return !!getTokens()?.refreshToken;
}
