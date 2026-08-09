import { notFound } from 'next/navigation';
import { Container, Eyebrow, Section } from '@/components/ui';
import { GpsProvider } from '@/components/navigator/GpsProvider';
import { SafetyLockProvider } from '@/components/navigator/SafetyLockProvider';
import { DrivingScreen } from '@/components/navigator/DrivingScreen';
import { buildMetadata } from '@/lib/seo/metadata';
import { isPilotAuthorized, requirePilotAccess } from '@/lib/navigator-api/pilot-session';

/**
 * Navigator Phase 2A surface: the basic driving screen (N5, visual only)
 * inside the N4 safety lock. Same opt-in gate as the Phase 1 preview —
 * unless NEXT_PUBLIC_NAVIGATOR_ENABLED is exactly 'true' at build time
 * this route is a 404, so shipping it changes nothing in production.
 * No route source exists yet (N8): the screen's default state is
 * "route unavailable", and no HERE transaction can occur from here.
 *
 * TWO gates, in order: the flag decides whether the route exists at all,
 * then the pilot password decides who may see it. The middleware enforces
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
  await requirePilotAccess('/drive');
  /*
   * requirePilotAccess has already redirected anyone unauthorized, so this
   * is `true` by the time the page renders. It is read and passed anyway
   * rather than assumed: the driving screen's pilot rail should depend on
   * the server's actual verdict, not on the inference that reaching this
   * line implies one. If the gate above is ever loosened, the screen
   * closes with it instead of quietly staying open.
   */
  const authorized = await isPilotAuthorized();
  return (
    <Section>
      <Container>
        <div className="max-w-2xl space-y-6">
          <div>
            <Eyebrow>Navigator preview</Eyebrow>
            <h1 className="font-display text-3xl uppercase text-ink">Driving screen</h1>
          </div>
          <p className="text-ink/80">
            This is the Navigator foundation, not turn-by-turn navigation: no route is loaded, it
            does not give directions, and like the rest of this site it never provides offline truck
            routing.
          </p>
          <GpsProvider>
            <SafetyLockProvider>
              <DrivingScreen authorized={authorized} />
            </SafetyLockProvider>
          </GpsProvider>
        </div>
      </Container>
    </Section>
  );
}
