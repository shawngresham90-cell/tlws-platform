import { notFound } from 'next/navigation';
import { Container, Eyebrow, Section } from '@/components/ui';
import { GpsProvider } from '@/components/navigator/GpsProvider';
import { SafetyLockProvider } from '@/components/navigator/SafetyLockProvider';
import { DrivingScreen } from '@/components/navigator/DrivingScreen';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * Navigator Phase 2A surface: the basic driving screen (N5, visual only)
 * inside the N4 safety lock. Same opt-in gate as the Phase 1 preview —
 * unless NEXT_PUBLIC_NAVIGATOR_ENABLED is exactly 'true' at build time
 * this route is a 404, so shipping it changes nothing in production.
 * No route source exists yet (N8): the screen's default state is
 * "route unavailable", and no HERE transaction can occur from here.
 */

const ENABLED = process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED === 'true';

export const metadata = buildMetadata({
  title: 'Navigator Preview — Driving Screen | Trucking Life with Shawn',
  description:
    'Driving-screen preview for the TLWS Navigator foundation. Position stays on your device.',
  path: '/drive',
  noindex: true,
});

export default function DrivePreviewPage() {
  if (!ENABLED) notFound();
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
              <DrivingScreen />
            </SafetyLockProvider>
          </GpsProvider>
        </div>
      </Container>
    </Section>
  );
}
