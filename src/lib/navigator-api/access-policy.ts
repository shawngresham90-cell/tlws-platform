/**
 * The one place that decides who may reach the Navigator.
 *
 * Before this module there was a single question — "did you type the pilot
 * password?" — spread across the middleware, two pages and two API routes.
 * Public beta needs a third answer ("nobody has to"), and adding a second
 * boolean beside the first is how a surface ends up open in one layer and
 * shut in another. So the question becomes one MODE, resolved once here.
 *
 *   closed  — the Navigator is unavailable. Surfaces answer 404, the same
 *             way the build flag being off answers, because "not here" is
 *             the honest response and it advertises nothing.
 *   pilot   — the existing passcode flow, byte-for-byte unchanged. This is
 *             the DEFAULT, and it is what an unset or misspelt variable
 *             resolves to.
 *   public  — no password. A visitor lands in the Navigator directly.
 *
 * WHY THE FALLBACK IS `pilot` AND NOT `public`
 *
 * Every failure that can reach this module — an unset variable, a typo, a
 * value from a deploy context that was never configured — is indistinguishable
 * from the others. The only safe reading of "I do not know what mode this is"
 * is the closed-ish one. Falling back to `public` would mean a single
 * mistyped environment variable silently opens a metered routing provider to
 * the internet. `pilot` costs a known driver one password; `public` costs an
 * unknown number of strangers' provider transactions.
 *
 * WHY THE MODE IS SERVER-ONLY
 *
 * `NAVIGATOR_ACCESS_MODE` carries no `NEXT_PUBLIC_` prefix, so Next cannot
 * inline it into a client bundle, and — more usefully — it can be changed
 * without a rebuild. Restoring the pilot gate is an environment-variable edit
 * and a redeploy of the same artifact, not a revert.
 *
 * RUNTIME-AGNOSTIC, like pilot-access.ts beside it: no `node:crypto`, no
 * `next/headers`, no `next/server`. The Edge middleware, Node server
 * components and the offline harness all import it.
 */

import {
  isNavigatorApiPath,
  isProtectedNavigatorPath,
  PILOT_DEFAULT_DESTINATION,
} from './pilot-access';

export type NavigatorAccessMode = 'closed' | 'pilot' | 'public' | 'account';

/**
 * Every accepted value.
 *
 * NOT in order of openness, because they do not form a line. `account` is
 * open to anyone willing to verify an email address, which is wider than
 * `pilot` in who may enter and narrower in what an anonymous script can
 * reach — a caller with no session gets nothing, where `public` hands them
 * a routing endpoint. Ordering them would imply a ranking that the cost
 * model does not support.
 */
export const NAVIGATOR_ACCESS_MODES = ['closed', 'pilot', 'public', 'account'] as const;

/** What an unset, empty or unrecognized setting means. Never anything wider. */
export const DEFAULT_ACCESS_MODE: NavigatorAccessMode = 'pilot';

/** The server-only variable that selects the mode. */
export const ACCESS_MODE_ENV_VAR = 'NAVIGATOR_ACCESS_MODE';

/**
 * Parse a raw setting into a mode.
 *
 * Whitespace and letter case are forgiven — a value pasted out of a
 * dashboard with a trailing newline meant what it said. Anything else at
 * all resolves to `pilot`: not the nearest match, not a guess. There is no
 * spelling of `public` other than `public`, and none of `account` other
 * than `account`.
 */
export function parseAccessMode(raw: string | undefined | null): NavigatorAccessMode {
  const value = (raw ?? '').trim().toLowerCase();
  return (NAVIGATOR_ACCESS_MODES as readonly string[]).includes(value)
    ? (value as NavigatorAccessMode)
    : DEFAULT_ACCESS_MODE;
}

/** The configured mode for this deploy. */
export function navigatorAccessMode(): NavigatorAccessMode {
  return parseAccessMode(process.env[ACCESS_MODE_ENV_VAR]);
}

/** Does this mode let a visitor in with no passcode? */
export function isPublicAccess(mode: NavigatorAccessMode): boolean {
  return mode === 'public';
}

/**
 * What a layer should do with a request.
 *
 *   'ignore'      — none of this layer's business: not a Navigator path, the
 *                   build flag is off, or this layer cannot see enough to
 *                   decide and a later one can.
 *   'allow'       — let it through.
 *   'challenge'   — pilot mode, no valid token: show the password screen
 *                   (or answer 401 for an API path).
 *   'sign-in'     — account mode, no verified session: show the account
 *                   screen (or answer 401 for an API path).
 *   'unavailable' — closed mode: answer as though the route does not exist.
 *
 * 'challenge' and 'sign-in' are separate verdicts for a reason a merged one
 * would lose: they send a visitor to different screens, and the wrong screen
 * is a dead end. A driver with an account bounced to the passcode form has
 * no passcode; a pilot driver bounced to the account form is being asked to
 * create an account the deploy is not running.
 */
export type AccessDecision = 'ignore' | 'allow' | 'challenge' | 'sign-in' | 'unavailable';

/**
 * The whole policy as one pure function, so every combination can be tested
 * without a server.
 *
 * `edgeDeferral` is the awkward one, and it is load-bearing. This decision
 * runs in TWO runtimes. In Node the server-only variables are always
 * readable. In the Edge middleware they may not be — which is why the pilot
 * gate already defers when it cannot see the password.
 *
 * An unreadable variable and an unset one look identical from inside the
 * process, so the middleware cannot detect the difference and must not try:
 * treating "I see nothing" as "defer" would switch off the pilot challenge
 * on every ordinary deploy, since an unset variable is exactly what `pilot`
 * looks like. It therefore resolves the default and challenges as it always
 * has. If the variable really was set to something else and merely
 * invisible here, the visitor lands on the password screen — which runs in
 * Node, reads the setting correctly, and forwards them. Wrong once, never
 * twice.
 *
 * What `edgeDeferral` does buy: a layer that is not certain must never
 * answer 'unavailable', because a wrongly-read `closed` would 404 a live
 * Navigator with no second chance to recover. That verdict is Node's alone.
 */
export function navigatorAccessDecision(input: {
  pathname: string;
  flagEnabled: boolean;
  mode: NavigatorAccessMode;
  pilotConfigured: boolean;
  tokenValid: boolean;
  /** Account mode: does this request carry a verified Supabase session? */
  signedIn?: boolean;
  /** True in the Edge middleware: never answer 'unavailable' from there. */
  edgeDeferral?: boolean;
}): AccessDecision {
  if (!isProtectedNavigatorPath(input.pathname)) return 'ignore';

  // The flag being off means the route 404s on its own. The gate must not
  // convert that into a password prompt, which would advertise that a hidden
  // Navigator exists.
  if (!input.flagEnabled) return 'ignore';

  if (input.mode === 'public') return 'allow';

  if (input.mode === 'closed') return input.edgeDeferral === true ? 'ignore' : 'unavailable';

  if (input.mode === 'account') {
    // The pilot cookie is deliberately NOT consulted here. Account mode is a
    // rollback target for the passcode, not a second door beside it: a stale
    // pilot cookie from last week must not walk past a sign-in.
    return input.signedIn === true ? 'allow' : 'sign-in';
  }

  // pilot. A layer that cannot see the password cannot verify a legitimate
  // cookie either, so challenging from there would bounce an already-unlocked
  // driver back to the password screen forever.
  if (!input.pilotConfigured) return 'ignore';
  return input.tokenValid ? 'allow' : 'challenge';
}

/**
 * Where a visitor who needs no password should be sent when they land on the
 * password screen. Public mode must never show that screen, and the cheapest
 * way to guarantee it is for the screen itself to forward.
 */
export const PUBLIC_ENTRY_PATH = PILOT_DEFAULT_DESTINATION;

/**
 * The account screen. Like the passcode screen it sits OUTSIDE the gate, or
 * signing in would redirect to itself forever — `isProtectedNavigatorPath`
 * excludes it for exactly that reason. Defined in pilot-access.ts beside the
 * other path constants, because that is the function that has to know.
 */
export { NAVIGATOR_ACCOUNT_PATH } from './pilot-access';

/**
 * The same policy for an API route, which answers with a status code rather
 * than a redirect.
 *
 * `closed` answers 404 and not 403, matching what the build flag being off
 * already answers. An endpoint that says "forbidden" has confirmed it
 * exists; one that says "not found" has confirmed nothing. There is no
 * reason to hand a scanner the first answer.
 *
 * Pure — the caller supplies both facts, so every combination is testable
 * without a request.
 */
export type ApiAccessVerdict = 'ok' | 'not-found' | 'unauthorized';

export function navigatorApiAccessVerdict(input: {
  flagEnabled: boolean;
  mode: NavigatorAccessMode;
  tokenValid: boolean;
  /** Account mode: does this request carry a verified Supabase session? */
  signedIn?: boolean;
}): ApiAccessVerdict {
  if (!input.flagEnabled) return 'not-found';
  if (input.mode === 'closed') return 'not-found';
  if (input.mode === 'public') return 'ok';
  // Account mode ignores the pilot cookie for the same reason the page gate
  // does: a stale passcode cookie must not reach a metered endpoint once the
  // deploy has moved to accounts.
  if (input.mode === 'account') return input.signedIn === true ? 'ok' : 'unauthorized';
  return input.tokenValid ? 'ok' : 'unauthorized';
}

/** Re-exported so callers need one import to make a full decision. */
export { isNavigatorApiPath, isProtectedNavigatorPath };
