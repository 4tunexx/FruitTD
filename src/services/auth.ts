import { getUserId } from './api';

const TOKEN_KEY = 'fruit_td_token';
const AUTH_KEY = 'fruit_td_authed';

export interface AuthUser {
  userId: string;
  nickname: string;
  username: string;
  avatar: string;
  email: string | null;
  emailVerified: boolean;
  profileComplete: boolean;
  authProvider: string;
  steamId: string | null;
  steamPersona: string | null;
  steamAvatar: string | null;
  isAdmin: boolean;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  user?: AuthUser;
  needsEmailConfirm?: boolean;
  needsProfileSetup?: boolean;
  previewCode?: string;
  emailed?: boolean;
  error?: string;
}

let cachedUser: AuthUser | null = null;

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function isSessionAuthed(): boolean {
  return localStorage.getItem(AUTH_KEY) === '1' && !!getAuthToken();
}

export function setSessionAuthed(on: boolean): void {
  if (on) localStorage.setItem(AUTH_KEY, '1');
  else localStorage.removeItem(AUTH_KEY);
}

export function getCachedAuthUser(): AuthUser | null {
  return cachedUser;
}

export function setCachedAuthUser(user: AuthUser | null): void {
  cachedUser = user;
  if (user?.userId) localStorage.setItem('fruit_td_user_id', user.userId);
}

async function authRequest<T>(endpoint: string, options?: RequestInit): Promise<T & { error?: string }> {
  const token = getAuthToken();
  const res = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; success?: boolean };
  if (!res.ok) {
    return {
      ...(data as object),
      success: false,
      error: data.error || `Request failed (${res.status})`,
    } as unknown as T & { error?: string };
  }
  return data;
}

export async function fetchMe(): Promise<AuthUser | null> {
  if (!getAuthToken()) return null;
  const res = await authRequest<{ success: boolean; user: AuthUser }>('/api/auth/me');
  if (res.success && res.user) {
    cachedUser = res.user;
    localStorage.setItem('fruit_td_user_id', res.user.userId);
    return res.user;
  }
  return null;
}

export async function registerWithEmail(email: string, password: string): Promise<AuthResult> {
  const res = await authRequest<AuthResult>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (res.success && res.token && res.user) {
    setAuthToken(res.token);
    setCachedAuthUser(res.user);
  }
  return res;
}

export async function loginWithEmail(email: string, password: string): Promise<AuthResult> {
  const res = await authRequest<AuthResult>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (res.success && res.token && res.user) {
    setAuthToken(res.token);
    setCachedAuthUser(res.user);
  }
  return res;
}

export async function verifyEmailCode(code: string): Promise<AuthResult> {
  const res = await authRequest<AuthResult>('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  if (res.success && res.user) setCachedAuthUser(res.user);
  return res;
}

export async function setEmailForConfirm(email: string): Promise<AuthResult> {
  const res = await authRequest<AuthResult>('/api/auth/set-email', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  return res;
}

export async function resendVerifyCode(email?: string): Promise<AuthResult> {
  const res = await authRequest<AuthResult>('/api/auth/resend-verify', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  return res;
}

export async function completeProfile(username: string, avatar: string): Promise<AuthResult> {
  const res = await authRequest<AuthResult>('/api/auth/complete-profile', {
    method: 'POST',
    body: JSON.stringify({ username, avatar }),
  });
  if (res.success && res.user) setCachedAuthUser(res.user);
  return res;
}

export async function logoutAuth(): Promise<void> {
  try {
    await authRequest('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore
  }
  setAuthToken(null);
  setSessionAuthed(false);
  cachedUser = null;
}

/** Start Steam OpenID redirect. */
export function startSteamLogin(mode: 'login' | 'register' | 'link' = 'login'): void {
  const token = getAuthToken();
  const q = new URLSearchParams({ mode });
  if (mode === 'link' && token) q.set('token', token);
  // Hit API directly locally so OpenID return_to matches Express port
  const apiBase = import.meta.env.DEV ? 'http://localhost:3001' : '';
  window.location.href = `${apiBase}/api/steam/login?${q.toString()}`;
}

export function applyAuthUserToLocalIds(user: AuthUser): void {
  localStorage.setItem('fruit_td_user_id', user.userId);
  void getUserId();
}
