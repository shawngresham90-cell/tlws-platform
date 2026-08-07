import { notFound, redirect } from 'next/navigation';
import { Button, Container } from '@/components/ui';
import { buildMetadata } from '@/lib/seo/metadata';
import {
  navigatorFlagEnabled,
  pilotConfigured,
  sanitizeNextPath,
} from '@/lib/navigator-api/pilot-access';
import { isPilotAuthorized } from '@/lib/navigator-api/pilot-session';
import { unlockNavigatorAction } from './actions';

/**
 * Navigator pilot password screen — the one Navigator route that is NOT
 * behind the gate, since gating it would redirect to itself forever.
 *
 * Still flag-gated: when NEXT_PUBLIC_NAVIGATOR_ENABLED is off this 404s like
 * every other Navigator surface, so a build without the pilot never hints
 * that a hidden one exists.
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
  if (!navigatorFlagEnabled()) notFound();

  const next = sanitizeNextPath(
    typeof searchParams?.next === 'string' ? searchParams.next : undefined,
  );
  if (await isPilotAuthorized()) redirect(next);

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
            Pilot access isn’t configured yet. Set <code>NAVIGATOR_PREVIEW_PASSWORD</code> in the
            environment.
          </p>
        )}
        {configured && error && (
          <p
            role="alert"
            className="mb-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300"
          >
            Incorrect password.
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
