import { notFound } from 'next/navigation';
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
    /*
     * THE PAGE CHROME IS A TIGHT WRAPPER, NOT A MARKETING SECTION
     * (NAV-ENTRY-2).
     *
     * This used to be the shared `<Section>`, whose whole job is to space
     * a marketing block off the one above it: `py-16 sm:py-24` — 64 px of
     * empty page above the driving surface on a phone, 96 px on a desktop,
     * plus a second `<Container>` nested inside the one `Section` already
     * renders. On a 390x844 phone that put the first pixel of the surface
     * at 129 px with 65 px of it being site header, and every pixel of
     * that padding pushed the destination search further from the top.
     *
     * A driver who has just tapped START DRIVING is not reading a page,
     * so the padding that separates prose from prose is replaced by the
     * small amount this surface actually wants. The landmark stays a
     * `<section>` and the container's own gutters are unchanged, so
     * nothing about the page's structure or its horizontal rhythm moves —
     * only the dead vertical space above the fold.
     */
    <section className="px-5 pb-8 pt-4 [@media(max-height:480px)]:pt-2 sm:px-8">
      <div className="mx-auto w-full max-w-content">
        <div className="max-w-2xl space-y-4">
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
      </div>
    </section>
  );
}
