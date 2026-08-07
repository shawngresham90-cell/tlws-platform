import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  PILOT_ACCESS_PATH,
  PILOT_COOKIE_NAME,
  navigatorFlagEnabled,
  verifyPilotToken,
} from './pilot-access';

/**
 * Node-runtime half of the Navigator pilot gate: reading the cookie and
 * enforcing it inside server components and server actions.
 *
 * Split from pilot-access.ts on purpose — `next/headers` does not exist in
 * Edge middleware, so keeping it here lets the middleware import the token
 * logic without dragging in an import that would break the Edge bundle.
 *
 * The middleware already redirects unauthorized visitors, so this is the
 * SECOND layer, not the only one. It exists because a matcher is a
 * configuration file: one bad glob and every page behind it silently opens.
 * A guard inside the page cannot be skipped by editing a matcher.
 */

/** Is the current request carrying a valid, unexpired pilot token? */
export async function isPilotAuthorized(): Promise<boolean> {
  const token = cookies().get(PILOT_COOKIE_NAME)?.value;
  return verifyPilotToken(token, Date.now());
}

/**
 * Gate for Navigator server components. Redirects to the password screen
 * when the visitor is not authorized.
 *
 * Does nothing when the feature flag is off: in that state the page has
 * already called notFound(), and the route must keep reading as absent
 * rather than as "something is here, guess the password".
 */
export async function requirePilotAccess(returnTo: string): Promise<void> {
  if (!navigatorFlagEnabled()) return;
  if (await isPilotAuthorized()) return;
  redirect(`${PILOT_ACCESS_PATH}?next=${encodeURIComponent(returnTo)}`);
}
