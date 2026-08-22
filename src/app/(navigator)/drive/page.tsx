import { notFound } from 'next/navigation';
import { Container, Eyebrow, Section } from '@/components/ui';
import { NavigatorLauncher } from '@/components/navigator/NavigatorLauncher';
import { PublicBetaBadge, PublicBetaNotice } from '@/components/navigator/PublicBeta';
import { buildMetadata } from '@/lib/seo/metadata';
import { requireNavigatorAccess } from '@/lib/navigator-api/pilot-session';
import { navigatorAccessMode } from '@/lib/navigator-api/access-policy';

/**
 * The Navigator launcher (NAV-ENTRY-1) — what a driver sees the moment the
 * access gate lets them through.
 *
 * WHAT THIS ROUTE USED TO BE. `/drive` was the whole cockpit: a driver-name
 * form, a region picker, a five-row truck editor with a confirmation gate, a
 * route-preference panel, an HOS clock form, a motion-lock banner, a
 * destination search and a Start button underneath all of it. Measured on a
 * 390x844 phone, Start Route sat 5,906 px down a 7,590 px screen — about
 * seven phone screens of setup between a driver and the road, which is the
 * complaint this milestone answers.
 *
 * WHAT IT IS NOW. Three choices. The cockpit moved to `/drive/navigate` and
 * the setup moved to `/drive/settings`, both children of this path — so both
 * inherit the SAME gate from `PROTECTED_NAVIGATOR_PREFIXES` without a line of
 * new access code, and a typed URL to either is challenged exactly as `/drive`
 * always was. Splitting the surface did not split the lock.
 *
 * The two gates are unchanged and still in order: the build flag decides
 * whether the route exists at all, then the access policy decides who may see
 * it. Reading the cookie makes the route dynamic.
 */

export const dynamic = 'force-dynamic';

const ENABLED = process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED === 'true';

export const metadata = buildMetadata({
  title: 'Navigator | Trucking Life with Shawn',
  description:
    'Start driving, plan a trip, or change your settings. Position stays on your device.',
  path: '/drive',
  noindex: true,
});

export default async function DriveLauncherPage() {
  if (!ENABLED) notFound();
  await requireNavigatorAccess('/drive');
  const mode = navigatorAccessMode();
  return (
    <Section>
      <Container>
        <div className="max-w-2xl space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Eyebrow>Navigator</Eyebrow>
              {mode === 'public' && <PublicBetaBadge />}
            </div>
            <h1 className="font-display text-3xl uppercase text-ink">Where to?</h1>
          </div>
          {mode === 'public' && <PublicBetaNotice />}
          {/*
            No GPS provider, no safety-lock provider, no lifecycle, no map.
            The launcher genuinely cannot request a location, a route or a
            search — not because it chooses not to, but because nothing that
            could is mounted. That is the property the harness checks, and it
            is a much stronger one than a promise in a comment.
          */}
          <NavigatorLauncher />
          <p className="text-base text-ink/60">
            Navigator gives truck-aware routing and hours-of-service guidance. It is not an ELD, and
            it never replaces your own check of the road ahead.
          </p>
        </div>
      </Container>
    </Section>
  );
}
