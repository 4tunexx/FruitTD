import crypto from 'crypto';
import type { Request } from 'express';
import { getCollection, type UserDoc } from './db';

const SESSION_DAYS = 30;

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): string {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const next = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(next, 'hex'));
  } catch {
    return false;
  }
}

export function makeVerifyCode(): string {
  return String(crypto.randomInt(100000, 999999));
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function makeSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function requestSessionToken(req: Request): string | null {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7);
  const cookie = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('fruit_td_session='));
  return cookie ? decodeURIComponent(cookie.slice('fruit_td_session='.length)) : null;
}

export interface SessionDoc {
  tokenHash: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}

export async function createSession(userId: string): Promise<string> {
  const token = makeSessionToken();
  const col = await getCollection<SessionDoc>('sessions');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await col.insertOne({
    tokenHash: hashToken(token),
    userId,
    createdAt: new Date(),
    expiresAt,
  });
  return token;
}

export async function resolveSession(token: string | undefined | null): Promise<UserDoc | null> {
  if (!token) return null;
  const col = await getCollection<SessionDoc>('sessions');
  const doc = await col.findOne({ tokenHash: hashToken(token) });
  if (!doc || doc.expiresAt.getTime() < Date.now()) return null;
  const users = await getCollection<UserDoc>('users');
  return users.findOne({ userId: doc.userId });
}

export async function resolveRequestUser(req: Request): Promise<UserDoc | null> {
  return resolveSession(requestSessionToken(req));
}

export async function destroySession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  const col = await getCollection<SessionDoc>('sessions');
  await col.deleteOne({ tokenHash: hashToken(token) });
}

export function publicUser(user: UserDoc) {
  return {
    userId: user.userId,
    nickname: user.nickname,
    username: user.username || user.nickname,
    avatar: user.avatar,
    email: user.email || null,
    emailVerified: !!user.emailVerified,
    profileComplete: !!user.profileComplete,
    authProvider: user.authProvider || (user.steamId ? 'steam' : 'email'),
    steamId: user.steamId || null,
    steamPersona: user.steamPersona || null,
    steamAvatar: user.steamAvatar || null,
    isAdmin: Boolean(process.env.ADMIN_STEAM_ID && user.steamId === process.env.ADMIN_STEAM_ID),
  };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

import { verifyEmailHtml, verifyEmailText } from './emailTemplates';

/** Send verification code via Resend. Preview codes are development-only. */
export async function deliverVerifyCode(
  email: string,
  code: string
): Promise<{ previewCode?: string; emailed?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return process.env.NODE_ENV === 'production'
      ? { emailed: false, error: 'Email delivery is not configured.' }
      : { previewCode: code, emailed: false };
  }

  const from = process.env.EMAIL_FROM || 'Fruit TD <onboarding@resend.dev>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Fruit TD — your confirmation code',
        html: verifyEmailHtml(code),
        text: verifyEmailText(code),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('[auth] Resend failed:', res.status, body);
      return process.env.NODE_ENV === 'production'
        ? { emailed: false, error: 'Email delivery failed.' }
        : { previewCode: code, emailed: false, error: 'Email send failed' };
    }
    return { emailed: true };
  } catch (err) {
    console.error('[auth] Resend error:', err);
    return process.env.NODE_ENV === 'production'
      ? { emailed: false, error: 'Email delivery failed.' }
      : { previewCode: code, emailed: false, error: 'Email send failed' };
  }
}
