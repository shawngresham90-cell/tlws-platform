import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import {
  NAVIGATOR_ACCOUNT_PATH,
  PILOT_ACCESS_PATH,
  PILOT_COOKIE_NAME,
  navigatorFlagEnabled,
  verifyPilotToken,
} from './pilot-access';
import { navigatorAccessMode, type NavigatorAccessMode } from './access-policy';
import { createClient } from '@/lib/supabase/server';

/**
 * Node-runtime half of the Navigator access gate: reading the credential and
 * enforcing the access policy inside server components and server actions.
 *
 * Split from pilot-access.ts on purpose — `next/headers` does not exist in
 * Edge middleware, so keeping it here lets the middleware import the token
 * logic without dragging in an import that would break the Edge bundle.
 *
 * The middleware already turns unauthorized visitors away, so this is the
 * SECOND layer, not the only one. It exists because a matcher is a
 * configuration file: one bad glob and every page behind it silently opens.
 * A guard inside the page cannot be skipped by editing a matcher.
 *
 * It is also the AUTHORITATIVE layer. Node can always read the server-only
 * settings; the Edge middleware may not, and defers whenever it is unsure.
 * Every decision the middleware declines to make is made here.
 */

/** Is the current request carrying a valid, unexpired pilot token? */
export async function isPilotAuthorized(): Promise<boolean> {
  const token = cookies().get(PILOT_COOKIE_NAME)?.value;
  return verifyPilotToken(token, Date.now());
}

/**
 * Is there a verified Supabase user on this request?
 *
 * `getUser()` and not `getSession()`, deliberately. `getSession` reads the
 * cookie and trusts what it decodes; `getUser` asks the auth server whether
 * the token is genuine and still valid. For an access gate the difference is
 * the whole point — a forged or revoked cookie must not open the Navigator.
 *
 * Returns false rather than throwing when Supabase is unreachable. A gate
 * that 500s on a network blip fails OPEN in the worst way: it takes down the
 * page for signed-in drivers too. Failing closed here means an outage looks
 * like "please sign in", which is recoverable.
 */
export async function isAccountAuthorized(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await createClient().auth.getUser();
    return Boolean(user);
  } catch {
    return false;
  }
}

/**
 * May the visitor making this request use the Navigator?
 *
 * This is the fact the driving screen needs — not "did they type the
 * password", which stopped being the same question the moment there was more
 * than one way in. In `public` it is true for everyone; in `pilot` it is the
 * cookie check; in `account` it is a verified Supabase user; in `closed` it
 * is false for everyone, including someone holding a still-valid credential
 * of either kind.
 */
export async function navigatorAccessGranted(
  mode: NavigatorAccessMode = navigatorAccessMode(),
): Promise<boolean> {
  if (mode === 'closed') return false;
  if (mode === 'public') return true;
  if (mode === 'account') return isAccountAuthorized();
  return isPilotAuthorized();
}

/**
 * Gate for Navigator server components.
 *
 * - `closed`: notFound(). The route reads as absent rather than as
 *   "something is here, come back later", matching what the build flag
 *   being off already does.
 * - `public`: returns. No password, no redirect, no interstitial.
 * - `pilot`: redirects to the passcode screen unless the cookie is valid.
 * - `account`: redirects to the account screen unless a verified session
 *   exists. The pilot cookie is NOT accepted as a substitute — account mode
 *   is what replaces the passcode, not a second door beside it.
 *
 * Does nothing when the build flag is off: in that state the page has
 * already called notFound(), and the route must keep reading as absent
 * rather than as "something is here, guess the password".
 */
export async function requireNavigatorAccess(returnTo: string): Promise<void> {
  if (!navigatorFlagEnabled()) return;
  const mode = navigatorAccessMode();
  if (mode === 'closed') notFound();
  if (mode === 'public') return;
  if (mode === 'account') {
    if (await isAccountAuthorized()) return;
    redirect(`${NAVIGATOR_ACCOUNT_PATH}?next=${encodeURIComponent(returnTo)}`);
  }
  if (await isPilotAuthorized()) return;
  redirect(`${PILOT_ACCESS_PATH}?next=${encodeURIComponent(returnTo)}`);
}
