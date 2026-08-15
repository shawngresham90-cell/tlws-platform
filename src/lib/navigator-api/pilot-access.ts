/**
 * Navigator pilot access gate — the shared password that fronts the pilot
 * surfaces while they are being road-tested.
 *
 * This module is deliberately DEPENDENCY-FREE and runtime-agnostic: it is
 * imported by the Edge middleware, by Node server components/actions, and by
 * the offline harness. That rules out `node:crypto` (absent on Edge) and
 * `next/headers` (absent in middleware), so the token is signed with Web
 * Crypto, which all three runtimes provide. Cookie reading lives in
 * pilot-session.ts, which is Node-only by construction.
 *
 * Design notes, in the order they matter:
 *
 * 1. The password NEVER leaves the server. It is read from
 *    NAVIGATOR_PREVIEW_PASSWORD — a server-only variable with no NEXT_PUBLIC_
 *    prefix, so Next cannot inline it into a client bundle even by accident.
 * 2. The cookie does NOT contain the password. It carries
 *    `v1.<issuedAt>.<hmac>`, where the HMAC is keyed by the password. Knowing
 *    the cookie tells you nothing about the password, and forging a cookie
 *    requires the password you do not have.
 * 3. Expiry is verified SERVER-SIDE from the signed issuedAt, not merely
 *    hinted at with the cookie's Max-Age. A copied cookie stops working after
 *    PILOT_MAX_AGE_SECONDS even if the client keeps presenting it.
 * 4. This is a temporary pilot gate, not user authentication. There are no
 *    accounts, no identity, and no authorization beyond "knows the password".
 */

/** Cookie holding the signed pilot-access token. */
export const PILOT_COOKIE_NAME = 'tlws_navigator_pilot';

/** ~12 hours, per the pilot brief. Enforced by signature AND by Max-Age. */
export const PILOT_MAX_AGE_SECONDS = 12 * 60 * 60;

/** Where an unauthorized visitor is sent. Must stay outside the gate. */
export const PILOT_ACCESS_PATH = '/navigator/access';

/** The Navigator entry surface a successful unlock lands on. */
export const PILOT_DEFAULT_DESTINATION = '/drive';

/**
 * Page routes that require pilot authorization. The access page itself is
 * excluded by isProtectedNavigatorPath() — gating it would loop forever.
 *
 * Kept as prefixes so nested Navigator routes added later inherit the gate
 * instead of quietly shipping unprotected.
 */
export const PROTECTED_NAVIGATOR_PREFIXES = ['/drive', '/navigator'] as const;

/** API routes that require pilot authorization (they spend provider budget). */
export const PROTECTED_NAVIGATOR_API_PREFIXES = ['/api/navigator'] as const;

const TOKEN_VERSION = 'v1';
const TOKEN_MESSAGE_PREFIX = 'navigator-pilot-v1:';

/** Tolerance for a client clock running ahead of the server. */
const FUTURE_SKEW_MS = 60_000;

/**
 * Constant-time string comparison.
 *
 * The early length check leaks the LENGTH of the expected value, which is the
 * same trade the existing admin gate makes (crypto.timingSafeEqual requires
 * equal-length buffers). It does not leak content, which is what matters here.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The configured pilot password, or '' when the owner has not set one. */
function configuredPassword(): string {
  return process.env.NAVIGATOR_PREVIEW_PASSWORD ?? '';
}

/**
 * True only when the owner has set NAVIGATOR_PREVIEW_PASSWORD. Everything
 * below fails CLOSED when this is false: an unconfigured deploy cannot be
 * unlocked, rather than being wide open.
 */
export function pilotConfigured(): boolean {
  return configuredPassword().length > 0;
}

/** Is the Navigator feature flag on for this build? */
export function navigatorFlagEnabled(): boolean {
  return process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED === 'true';
}

/** Constant-time check of a submitted password against the configured one. */
export function verifyPilotPassword(input: string): boolean {
  const expected = configuredPassword();
  if (!expected) return false;
  return constantTimeEqual(input, expected);
}

async function hmacHex(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Mint the cookie value for a successful unlock: `v1.<issuedAt>.<hmac>`.
 * Returns null when no password is configured, so a misconfigured deploy
 * cannot issue a token that would later be accepted.
 */
export async function issuePilotToken(issuedAtMs: number): Promise<string | null> {
  const password = configuredPassword();
  if (!password) return null;
  if (!Number.isFinite(issuedAtMs)) return null;
  const issuedAt = Math.floor(issuedAtMs);
  const mac = await hmacHex(password, `${TOKEN_MESSAGE_PREFIX}${issuedAt}`);
  return `${TOKEN_VERSION}.${issuedAt}.${mac}`;
}

/**
 * Verify a presented cookie value. Rejects on: no password configured, a
 * malformed or wrong-version token, a bad signature, a token older than
 * PILOT_MAX_AGE_SECONDS, or one issued implausibly far in the future.
 */
export async function verifyPilotToken(
  token: string | undefined | null,
  nowMs: number,
): Promise<boolean> {
  const password = configuredPassword();
  if (!password) return false;
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [version, issuedAtRaw, presentedMac] = parts;
  if (version !== TOKEN_VERSION) return false;
  if (!/^\d+$/.test(issuedAtRaw)) return false;

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isSafeInteger(issuedAt)) return false;

  const ageMs = nowMs - issuedAt;
  if (ageMs > PILOT_MAX_AGE_SECONDS * 1000) return false;
  if (ageMs < -FUTURE_SKEW_MS) return false;

  const expectedMac = await hmacHex(password, `${TOKEN_MESSAGE_PREFIX}${issuedAt}`);
  return constantTimeEqual(presentedMac, expectedMac);
}

/** Does this pathname sit behind the pilot gate? */
export function isProtectedNavigatorPath(pathname: string): boolean {
  if (pathname === PILOT_ACCESS_PATH) return false;
  if (pathname.startsWith(`${PILOT_ACCESS_PATH}/`)) return false;
  const all = [...PROTECTED_NAVIGATOR_PREFIXES, ...PROTECTED_NAVIGATOR_API_PREFIXES];
  return all.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Is this an API route (answer with a status code, never a redirect)? */
export function isNavigatorApiPath(pathname: string): boolean {
  return PROTECTED_NAVIGATOR_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Only same-origin Navigator paths are valid post-unlock destinations.
 * Anything else — an absolute URL, a protocol-relative `//evil.example`, a
 * backslash trick, or an unrelated internal path — collapses to /drive. This
 * is what stops the `next` parameter becoming an open redirect.
 */
export function sanitizeNextPath(candidate: string | undefined | null): string {
  if (!candidate) return PILOT_DEFAULT_DESTINATION;
  if (!candidate.startsWith('/')) return PILOT_DEFAULT_DESTINATION;
  if (candidate.startsWith('//') || candidate.startsWith('/\\')) {
    return PILOT_DEFAULT_DESTINATION;
  }
  const pathname = candidate.split(/[?#]/)[0];
  if (isNavigatorApiPath(pathname)) return PILOT_DEFAULT_DESTINATION;
  const allowed = PROTECTED_NAVIGATOR_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!allowed) return PILOT_DEFAULT_DESTINATION;
  if (pathname === PILOT_ACCESS_PATH) return PILOT_DEFAULT_DESTINATION;
  return candidate;
}

/**
 * Structural shape of the only thing this module needs from a request, so
 * route handlers and middleware can both use it without this file importing
 * `next/server`. NextRequest satisfies it.
 */
export interface CookieBearingRequest {
  cookies: { get(name: string): { value: string } | undefined };
}

/** Does this request carry a valid, unexpired pilot token? */
export async function requestHasPilotAccess(request: CookieBearingRequest): Promise<boolean> {
  return verifyPilotToken(request.cookies.get(PILOT_COOKIE_NAME)?.value, Date.now());
}

/*
 * THE GATE DECISION USED TO LIVE HERE.
 *
 * It answered one question — "did you type the password?" — and public beta
 * needs three answers, so it moved to ./access-policy.ts as
 * `navigatorAccessDecision`, which subsumes it: pass `mode: 'pilot'` and the
 * behaviour is identical, including the deferral when a layer cannot see the
 * password. It is not re-exported from here, deliberately. Two names for one
 * gate is how a surface ends up open in the layer that reads one of them.
 */
