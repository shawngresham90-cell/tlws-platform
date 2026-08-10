import { redirect } from 'next/navigation';
import { Button, Container } from '@/components/ui';
import { buildMetadata } from '@/lib/seo/metadata';
import {
  navigatorFlagEnabled,
  pilotConfigured,
  sanitizeNextPath,
} from '@/lib/navigator-api/pilot-access';
import { isPilotAuthorized } from '@/lib/navigator-api/pilot-session';
import { UNLOCK_THROTTLED } from '@/lib/navigator-api/pilot-unlock-throttle';
import { unlockNavigatorAction } from './actions';

/**
 * Navigator pilot password screen — the one Navigator route that is NOT
 * behind the gate, since gating it would redirect to itself forever.
 *
 * NOT flag-gated either, and that is deliberate. This is the landing point of
 * an always-visible homepage tile, so it must never 404. Reachability costs
 * nothing: this page holds no Navigator functionality, and every surface that
 * does — /drive, /navigator, both /api/navigator/* routes — keeps its own flag
 * check AND its own password check. The most an unauthorized visitor can learn
 * here is that a pilot exists, which the homepage tile already tells them.
 *
 * When the runtime flag is off, an authorized visitor is NOT forwarded to
 * /drive — that route 404s in that state, and dumping someone on a 404 after a
 * correct password reads as a broken site. They are told plainly that the
 * pilot is not running on this deploy.
 *
 * force-dynamic because the answer depends on a cookie; a cached render would
 * hand one visitor's authorized state to the next.
 */

export const dynamic = 'force-dynamic';

export const metadata = buildMetadata({
  title: 'Navigator Pilot Access | Trucking Life with Shawn',
  description: 'Enter the pilot password to continue to the Navigator.',
  path: '/navigator/access',
  noindex: true,
});

export default async function NavigatorAccessPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const next = sanitizeNextPath(
    typeof searchParams?.next === 'string' ? searchParams.next : undefined,
  );
  const runtimeEnabled = navigatorFlagEnabled();
  const authorized = await isPilotAuthorized();

  // Unlocked and the Navigator is live here — straight through, no second ask.
  if (authorized && runtimeEnabled) redirect(next);

  // Unlocked, but the runtime flag is off on this deploy. Say so, rather than
  // forwarding to a route that answers 404.
  if (authorized) {
    return (
      <Container className="py-20">
        <div className="mx-auto max-w-sm rounded-card border border-line bg-asphalt-800 p-8">
          <h1 className="display-section mb-1 text-2xl">
            Navigator Pilot Access<span className="text-signal">.</span>
          </h1>
          <p className="text-sm text-muted">
            You’re unlocked — but the Navigator pilot isn’t running on this deploy yet. Nothing more
            to do here; it will open the moment the pilot is switched on.
          </p>
        </div>
      </Container>
    );
  }

  const configured = pilotConfigured();
  const error = typeof searchParams?.error === 'string' ? searchParams.error : undefined;

  return (
    <Container className="py-20">
      <div className="mx-auto max-w-sm rounded-card border border-line bg-asphalt-800 p-8">
        <h1 className="display-section mb-1 text-2xl">
          Navigator Pilot Access<span className="text-signal">.</span>
        </h1>
        <p className="mb-6 text-sm text-muted">Enter the pilot password to continue.</p>

        {!configured && (
          <p className="mb-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300">
            Pilot access isn’t open yet. Check back soon.
          </p>
        )}
        {configured && error && (
          <p
            role="alert"
            className="mb-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300"
          >
            {/*
              The throttle fires BEFORE the password is compared, so this
              message reveals nothing about the guess — a correct one and a
              wrong one are throttled identically. It says how to recover
              and nothing about how many attempts remain, which would hand
              an attacker a progress bar.
            */}
            {error === UNLOCK_THROTTLED
              ? 'Too many attempts from this connection. Wait a couple of minutes and try again.'
              : 'Incorrect password.'}
          </p>
        )}

        <form action={unlockNavigatorAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-ink">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              className="w-full rounded-card border border-line bg-asphalt px-4 py-3 text-ink outline-none focus:border-signal"
            />
          </div>
          <Button type="submit" className="w-full">
            Unlock Navigator
          </Button>
        </form>
      </div>
    </Container>
  );
}
