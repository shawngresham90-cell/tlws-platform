import { notFound } from 'next/navigation';
import { Container, Section } from '@/components/ui';
import { GpsProvider } from '@/components/navigator/GpsProvider';
import { SafetyLockProvider } from '@/components/navigator/SafetyLockProvider';
import { DrivingScreen } from '@/components/navigator/DrivingScreen';
import { PublicBetaNotice } from '@/components/navigator/PublicBeta';
import { buildMetadata } from '@/lib/seo/metadata';
import { navigatorAccessGranted, requireNavigatorAccess } from '@/lib/navigator-api/pilot-session';
import { navigatorAccessMode } from '@/lib/navigator-api/access-policy';

/**
 * The driving surface (NAV-ENTRY-1) — what START DRIVING opens.
 *
 * WHAT MOVED, AND WHAT DID NOT. This is the screen that used to be `/drive`,
 * unchanged in what it does: the same GPS provider, the same safety-lock
 * provider, the same `DrivingScreen` with the same two server-decided props.
 * Only its address changed, so the launcher could take the shorter one.
 *
 * IT INHERITS THE GATE. `/drive/navigate` sits under the `/drive` prefix in
 * `PROTECTED_NAVIGATOR_PREFIXES`, so the middleware challenges it exactly as
 * it challenges `/drive`, and `requireNavigatorAccess` below is the copy that
 * a matcher edit cannot undo. A driver who types this URL directly is asked
 * for the password first and lands back here afterwards.
 *
 * THE PAGE CHROME IS THINNER THAN THE OLD ONE ON PURPOSE. The heading and the
 * long "this is the Navigator foundation" paragraph were written when this
 * route WAS the entry screen and had to introduce itself. The introduction
 * now lives on the launcher, and a driver who has already tapped START
 * DRIVING wants the map, not a second explanation of it.
 */

export const dynamic = 'force-dynamic';

const ENABLED = process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED === 'true';

export const metadata = buildMetadata({
  title: 'Navigator — Driving | Trucking Life with Shawn',
  description: 'Truck-aware driving guidance. Position stays on your device.',
  path: '/drive/navigate',
  noindex: true,
});

export default async function DriveNavigatePage() {
  if (!ENABLED) notFound();
  await requireNavigatorAccess('/drive/navigate');
  /*
   * requireNavigatorAccess has already turned away anyone who may not be
   * here, so this is `true` by the time the page renders. It is read and
   * passed anyway rather than assumed: the driving screen's unlock rail
   * should depend on the server's actual verdict, not on the inference that
   * reaching this line implies one. If the gate above is ever loosened, the
   * screen closes with it instead of quietly staying open.
   */
  const mode = navigatorAccessMode();
  const authorized = await navigatorAccessGranted(mode);
  return (
    <Section>
      <Container>
        <div className="max-w-2xl space-y-6">
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
               */}
              <DrivingScreen authorized={authorized} accountMode={mode === 'account'} />
            </SafetyLockProvider>
          </GpsProvider>
        </div>
      </Container>
    </Section>
  );
}
