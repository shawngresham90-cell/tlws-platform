import { notFound } from 'next/navigation';
import { Container, Eyebrow, Section } from '@/components/ui';
import { GpsProvider } from '@/components/navigator/GpsProvider';
import { SafetyLockProvider } from '@/components/navigator/SafetyLockProvider';
import { DrivingScreen } from '@/components/navigator/DrivingScreen';
import { PublicBetaBadge, PublicBetaNotice } from '@/components/navigator/PublicBeta';
import { buildMetadata } from '@/lib/seo/metadata';
import { navigatorAccessGranted, requireNavigatorAccess } from '@/lib/navigator-api/pilot-session';
import { navigatorAccessMode } from '@/lib/navigator-api/access-policy';

/**
 * Navigator Phase 2A surface: the basic driving screen (N5, visual only)
 * inside the N4 safety lock. Same opt-in gate as the Phase 1 preview —
 * unless NEXT_PUBLIC_NAVIGATOR_ENABLED is exactly 'true' at build time
 * this route is a 404, so shipping it changes nothing in production.
 * No route source exists yet (N8): the screen's default state is
 * "route unavailable", and no HERE transaction can occur from here.
 *
 * TWO gates, in order: the flag decides whether the route exists at all,
 * then the access policy decides who may see it — everyone in `public`,
 * passcode holders in `pilot`, nobody in `closed`. The middleware enforces
 * the same thing a step earlier; this is the copy that cannot be undone by
 * a matcher edit. Reading the cookie makes the route dynamic.
 */

export const dynamic = 'force-dynamic';

const ENABLED = process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED === 'true';

export const metadata = buildMetadata({
  title: 'Navigator Preview — Driving Screen | Trucking Life with Shawn',
  description:
    'Driving-screen preview for the TLWS Navigator foundation. Position stays on your device.',
  path: '/drive',
  noindex: true,
});

export default async function DrivePreviewPage() {
  if (!ENABLED) notFound();
  await requireNavigatorAccess('/drive');
  /*
   * requireNavigatorAccess has already turned away anyone who may not be
   * here, so this is `true` by the time the page renders. It is read and
   * passed anyway rather than assumed: the driving screen's unlock rail
   * should depend on the server's actual verdict, not on the inference that
   * reaching this line implies one. If the gate above is ever loosened, the
   * screen closes with it instead of quietly staying open.
   *
   * In `public` this is true with no cookie — which is the whole point of
   * the mode. The screen's working Navigator (destination search, route
   * planning, trip restore) hangs off this one boolean, so a public visitor
   * gets the same Navigator a passcode holder gets, not a viewer's copy.
   */
  const mode = navigatorAccessMode();
  const authorized = await navigatorAccessGranted(mode);
  return (
    <Section>
      <Container>
        <div className="max-w-2xl space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Eyebrow>Navigator preview</Eyebrow>
              {mode === 'public' && <PublicBetaBadge />}
            </div>
            <h1 className="font-display text-3xl uppercase text-ink">Driving screen</h1>
          </div>
          <p className="text-ink/80">
            This is the Navigator foundation, not turn-by-turn navigation: no route is loaded, it
            does not give directions, and like the rest of this site it never provides offline truck
            routing.
          </p>
          {mode === 'public' && <PublicBetaNotice />}
          <GpsProvider>
            <SafetyLockProvider>
              {/*
               * `accountMode` is the SERVER's reading of the access mode,
               * handed down exactly as `authorized` is. The mode variable is
               * server-only and carries no NEXT_PUBLIC_ prefix, so the
               * client cannot read it — and must not guess, because a guess
               * would be a second copy of the gate that is free to disagree
               * with this one.
               *
               * False in pilot, public and closed, which is inert: no
               * session is read and no account row is fetched. Production
               * runs `pilot`, so this change adds nothing to the live
               * driving path.
               */}
              <DrivingScreen authorized={authorized} accountMode={mode === 'account'} />
            </SafetyLockProvider>
          </GpsProvider>
        </div>
      </Container>
    </Section>
  );
}
