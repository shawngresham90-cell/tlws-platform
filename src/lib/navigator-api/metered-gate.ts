import type { NextRequest, NextResponse } from 'next/server';
import { errorJson } from '@/lib/trip-planner/api-util';
import { requestHasPilotAccess } from './pilot-access';
import { navigatorAccessMode, navigatorApiAccessVerdict } from './access-policy';
import { accountUserId } from './account-session';
import { PUBLIC_BUDGET_MESSAGE, publicBudget } from './public-budget';
import { reserveProviderUnits } from './usage-reservation';
import { guardEnforcedIn, USAGE_LIMIT_USER_MESSAGE } from './usage-guard';
import type { MeteredEndpointKey } from './metered-endpoints';

/**
 * ONE GATE, IN FRONT OF EVERY METERED ENDPOINT.
 *
 * Both metered handlers previously wrote their own gate. They wrote it
 * consistently, which is what made the shared defect possible: the same
 * omission — never passing `signedIn` to the access policy — was copied into
 * both, and reviewing one endpoint told you nothing about the other. A rail
 * that is duplicated is a rail that can be half-fixed.
 *
 * So the order below exists once, and the endpoints call it. The ORDER is the
 * security property, not the individual checks, and it is this:
 *
 *   1. AUTHENTICATE. In account mode, verify the Supabase session server-side
 *      against the auth server. In pilot mode, verify the passcode cookie.
 *   2. Refuse anonymous callers HERE — before step 3 and everything after it.
 *   3. Consume the all-callers ceiling (public mode only).
 *   4. Reserve centralized monthly budget (account and public modes).
 *   5. …and only then may the caller probe provider configuration, spend a
 *      per-IP limiter token, or reach the provider.
 *
 * WHY THE ORDER IS THE POINT. Every step after 2 either costs something or
 * reveals something. A limiter token spent by an anonymous caller is a token
 * a real driver no longer has. A budget unit reserved for them is money. And
 * a configuration probe that answers "the provider key is not configured for
 * this deploy context" — a distinct, useful 503 the route endpoint returns —
 * tells an unauthenticated stranger something true about the infrastructure.
 * None of that may happen before we know who is asking.
 *
 * The flag check stays in the handlers, ahead of this call, deliberately: a
 * disabled deploy must answer 404 (the route does not exist) rather than 401
 * (it exists, guess the credential), and that ordering is already pinned by
 * the access-mode suite.
 */

export type MeteredGateResult =
  /** Refused. Return this response unchanged; nothing metered has run. */
  | { ok: false; response: NextResponse }
  /**
   * Cleared. `userId` is the verified driver in account mode, and null in
   * pilot/public where there is no account to attribute the call to.
   */
  | { ok: true; mode: ReturnType<typeof navigatorAccessMode>; userId: string | null };

export async function meteredGate(input: {
  req: NextRequest;
  endpoint: MeteredEndpointKey;
  /** Injected by tests to drive month rollover. */
  nowMs?: number;
}): Promise<MeteredGateResult> {
  const { req, endpoint } = input;
  const mode = navigatorAccessMode();

  /* -- 1. Authenticate ---------------------------------------------------
   * `accountUserId()` performs a verified `getUser()` round trip — not
   * `getSession()`, which merely decodes what the caller's cookie claims.
   * Only consulted in account mode; the other modes have no account, and a
   * round trip on every pilot request would be a cost with no answer behind
   * it.
   */
  const userId = mode === 'account' ? await accountUserId() : null;

  const verdict = navigatorApiAccessVerdict({
    flagEnabled: true, // established by the caller, ahead of this gate
    mode,
    // Skipped entirely in public and account mode: there is no cookie to
    // verify, and the HMAC is not free.
    tokenValid: mode === 'pilot' ? await requestHasPilotAccess(req) : false,
    signedIn: userId !== null,
  });

  /* -- 2. Refuse before anything is spent or probed --------------------- */
  if (verdict === 'not-found') {
    return { ok: false, response: errorJson(404, 'not-enabled', 'Navigator is not enabled.') };
  }
  if (verdict === 'unauthorized') {
    /*
     * One sentence for both modes, and one code per mode. The code tells an
     * operator reading logs which credential was missing; the prose tells a
     * driver what to do. Neither confirms whether an account exists, which is
     * the same enumeration discipline the sign-in screen already keeps.
     */
    return mode === 'account'
      ? {
          ok: false,
          response: errorJson(
            401,
            'account-sign-in-required',
            'Sign in to your Navigator account to continue.',
          ),
        }
      : {
          ok: false,
          response: errorJson(401, 'pilot-access-required', 'Navigator pilot access is required.'),
        };
  }

  /* -- 3. The all-callers per-instance ceiling (public mode only) --------
   * Unchanged behaviour, kept where it was in the order. It is a per-process
   * bound and it is documented as such; the centralized guard below is the
   * one that bounds the month.
   */
  if (mode === 'public') {
    const kind = endpoint === 'navigator.route' ? 'route' : 'search';
    if (!publicBudget.spend(kind)) {
      return { ok: false, response: errorJson(429, 'public-beta-limit', PUBLIC_BUDGET_MESSAGE) };
    }
  }

  /* -- 4. The centralized monthly guard ----------------------------------
   * Enforced in account and public mode; inert in pilot and closed, so the
   * live pilot gains no new dependency on Supabase being reachable. See
   * `guardEnforcedIn()` for that argument in full.
   *
   * In public mode there is no account, so there is no per-user ceiling to
   * apply and no id to attribute a reservation to. The mode is merged but
   * must not be enabled, and the honest reading of "reserve against a user"
   * with no user is that the centralized guard cannot do its job — so public
   * mode is refused here rather than allowed through unguarded.
   */
  if (guardEnforcedIn(mode)) {
    if (userId === null) {
      return {
        ok: false,
        response: errorJson(503, 'usage-guard-unattributable', USAGE_LIMIT_USER_MESSAGE),
      };
    }
    const reservation = await reserveProviderUnits({
      endpoint,
      userId,
      nowMs: input.nowMs,
    });
    if (!reservation.allowed) {
      /*
       * 429 for a limit that time or a raised ceiling will clear; 503 for a
       * configuration or availability problem an operator must fix. The
       * driver-facing sentence is identical in every case and mentions no
       * threshold, no remaining balance, no provider and no database — see
       * USAGE_LIMIT_USER_MESSAGE for why a remaining-budget figure handed to
       * an anonymous caller is a progress bar for exhausting it.
       */
      const status =
        reservation.reason === 'global-threshold' || reservation.reason === 'user-limit'
          ? 429
          : 503;
      return {
        ok: false,
        response: errorJson(status, `usage-${reservation.reason}`, USAGE_LIMIT_USER_MESSAGE),
      };
    }
  }

  return { ok: true, mode, userId };
}
