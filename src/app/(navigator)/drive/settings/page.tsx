import { notFound } from 'next/navigation';
import { Container, Eyebrow, Section } from '@/components/ui';
import { NavigatorSettings } from '@/components/navigator/NavigatorSettings';
import { buildMetadata } from '@/lib/seo/metadata';
import { requireNavigatorAccess } from '@/lib/navigator-api/pilot-session';
import { navigatorAccessMode } from '@/lib/navigator-api/access-policy';

/**
 * Navigator settings (NAV-ENTRY-1) — everything a driver can change, in one
 * place, reachable at any time.
 *
 * NO GPS PROVIDER, NO SAFETY-LOCK PROVIDER, NO LIFECYCLE. That is the design,
 * not an omission. This route cannot start a watch, cannot request a route and
 * cannot cancel the one being driven, because none of the machinery that could
 * is mounted here. "Opening Settings mid-trip does not destroy the trip" is
 * therefore a structural fact about this file rather than a behaviour someone
 * has to remember not to break.
 *
 * It inherits the access gate from the `/drive` prefix, like `/drive/navigate`.
 */

export const dynamic = 'force-dynamic';

const ENABLED = process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED === 'true';

export const metadata = buildMetadata({
  title: 'Navigator — Settings | Trucking Life with Shawn',
  description: 'Truck, clocks, voice, display, units and route preferences. Stored on your device.',
  path: '/drive/settings',
  noindex: true,
});

export default async function DriveSettingsPage() {
  if (!ENABLED) notFound();
  await requireNavigatorAccess('/drive/settings');
  /*
   * Account sync is told about the mode by the SERVER, exactly as the driving
   * screen is: the access mode is a server-only variable, and a client that
   * inferred it would be a second copy of the gate free to disagree with this
   * one. The truck, the preferences and the clocks are edited here now, so
   * this is where their sync nudges have to come from.
   */
  const accountMode = navigatorAccessMode() === 'account';
  return (
    <Section>
      <Container>
        <div className="max-w-2xl space-y-6">
          <div>
            <Eyebrow>Navigator</Eyebrow>
            <h1 className="font-display text-3xl uppercase text-ink">Settings</h1>
          </div>
          <NavigatorSettings accountMode={accountMode} />
        </div>
      </Container>
    </Section>
  );
}
