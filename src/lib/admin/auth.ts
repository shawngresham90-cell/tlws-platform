import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Simple, secure, env-var-based admin gate (Milestone 10). No user accounts —
 * a single shared password (ADMIN_PASSWORD) unlocks the dashboard, and the
 * session is an HttpOnly cookie holding an HMAC token that can't be forged
 * without ADMIN_SESSION_SECRET. Both must be set or the dashboard fails closed
 * (inaccessible). This is intentionally separate from the Supabase-auth system
 * in src/lib/auth.ts, which the dashboard does not use.
 */
export const ADMIN_COOKIE_NAME = 'tlws_admin';
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** True only when both admin env vars are present. */
export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET);
}

/** The unforgeable session token stored in the cookie. */
export function issuedSessionToken(): string {
  const secret = process.env.ADMIN_SESSION_SECRET ?? '';
  return createHmac('sha256', secret).update('tlws-admin-session-v1').digest('hex');
}

/** Constant-time password check against ADMIN_PASSWORD. */
export function verifyPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? '';
  if (!expected) return false;
  return safeEqual(input, expected);
}

/** Is the current request an authenticated admin? */
export function isAdminAuthed(): boolean {
  if (!adminConfigured()) return false;
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;
  return safeEqual(token, issuedSessionToken());
}

/** Gate for server components / actions. Redirects to the login page if not authed. */
export function requireAdmin(): void {
  if (!isAdminAuthed()) redirect('/admin/login');
}
