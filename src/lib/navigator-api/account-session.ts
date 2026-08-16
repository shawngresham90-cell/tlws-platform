import { createClient } from '@/lib/supabase/server';

/**
 * Does this request carry a REAL, verified Supabase session?
 *
 * ---------------------------------------------------------------------------
 * WHY `getUser()` AND NEVER `getSession()`
 *
 * `getSession()` decodes the JWT sitting in the request's cookies and hands
 * back what it says. It does not ask Supabase whether that token is genuine,
 * unexpired, or belongs to an account that still exists. It trusts a value the
 * caller supplied — which, for deciding whether to spend money on someone's
 * behalf, is not a check at all. A forged or stale cookie satisfies it.
 *
 * `getUser()` verifies the token against the auth server. It costs a round
 * trip. That round trip is the whole point: it is the difference between
 * "the caller says they are signed in" and "they are".
 *
 * ---------------------------------------------------------------------------
 * WHY THE PAGE GATE IS NOT ENOUGH, AND WHY THIS FILE EXISTS
 *
 * The middleware gates Navigator PAGES. The page is not what spends money, and
 * an attacker does not use the page — they POST to the endpoint. Gating the
 * cockpit while leaving the metered route open protects nobody and looks like
 * protection, which is worse than looking like nothing.
 *
 * The defect this closes was real and shipped in the same shape: both metered
 * handlers called the access policy without passing `signedIn` at all, so in
 * account mode the verdict read `undefined === true` and refused everyone. It
 * failed CLOSED, so it was never a hole — but it meant account mode was
 * functionally broken above the page layer, and a page-level test would have
 * shown it working. Only reading the endpoints found it.
 *
 * ---------------------------------------------------------------------------
 * FAILS CLOSED, ALWAYS
 *
 * Every failure — no cookies, an unreachable auth server, missing Supabase
 * environment, a thrown client constructor — returns `false`, meaning "not
 * signed in", meaning refused. There is deliberately no distinction returned
 * between "definitely anonymous" and "could not tell", because a caller that
 * could act on the difference would be choosing to spend money while unsure
 * who it was spending it for.
 */
export async function requestHasAccountSession(): Promise<boolean> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    return !error && user !== null && typeof user.id === 'string' && user.id.length > 0;
  } catch {
    return false;
  }
}

/**
 * The verified user id, or null.
 *
 * Separate from the boolean above because the per-user usage ceiling needs the
 * id itself, and a caller that only needs a yes/no should not be handed an
 * identifier it has no use for.
 *
 * THE ID COMES FROM THE VERIFIED SESSION AND NOWHERE ELSE. There is no
 * parameter here, no header read, no body field — nothing a caller could set
 * to spend against another driver's allowance or to escape their own.
 */
export async function accountUserId(): Promise<string | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || user === null) return null;
    return typeof user.id === 'string' && user.id.length > 0 ? user.id : null;
  } catch {
    return null;
  }
}
