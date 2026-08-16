import { notFound } from 'next/navigation';
import { Container, Eyebrow, Section } from '@/components/ui';
import { GpsProvider } from '@/components/navigator/GpsProvider';
import { NavigatorStatus } from '@/components/navigator/NavigatorStatus';
import { PublicBetaBadge, PublicBetaNotice } from '@/components/navigator/PublicBeta';
import { buildMetadata } from '@/lib/seo/metadata';
import { requireNavigatorAccess } from '@/lib/navigator-api/pilot-session';
import { navigatorAccessMode } from '@/lib/navigator-api/access-policy';

/**
 * Navigator Phase 1 surface: position display only — no guidance, no map,
 * no maneuvers (those are milestones N4/N5 of the architecture package).
 *
 * Opt-in flag, default OFF: unless NEXT_PUBLIC_NAVIGATOR_ENABLED is
 * exactly 'true' at build time this route is a 404, so shipping the code
 * changes nothing in production until the owner flips the env var. This
 * inverts the planner kill-switch pattern (TpcReserveBand's !== 'false')
 * deliberately — an unreleased surface must default closed.
 */

export const dynamic = 'force-dynamic';

const ENABLED = process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED === 'true';

export const metadata = buildMetadata({
  title: 'Navigator Preview — Position | Trucking Life with Shawn',
  description:
    'Live GPS position preview for the TLWS Navigator foundation. Position stays on your device.',
  path: '/navigator',
  noindex: true,
});

export default async function NavigatorPreviewPage() {
  if (!ENABLED) notFound();
  await requireNavigatorAccess('/navigator');
  const mode = navigatorAccessMode();
  return (
    <Section>
      {/* Width is narrowed by an inner element: Container hardcodes
          max-w-content and cn() does not resolve Tailwind conflicts, so a
          max-w-2xl passed to Container silently loses. */}
      <Container>
        <div className="max-w-2xl space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Eyebrow>Navigator preview</Eyebrow>
              {mode === 'public' && <PublicBetaBadge />}
            </div>
            <h1 className="font-display text-3xl uppercase text-ink">Position</h1>
          </div>
          <p className="text-ink/80">
            This is the Navigator foundation, not turn-by-turn navigation: it does not give
            directions, and like the rest of this site it never provides offline truck routing.
          </p>
          {mode === 'public' && <PublicBetaNotice />}
          <GpsProvider>
            <NavigatorStatus />
          </GpsProvider>
        </div>
      </Container>
    </Section>
  );
}
