import { Section, Button } from '@/components/ui';
import { SectionHeading } from './SectionHeading';
import { createClient } from '@/lib/supabase/server';
import { FundedStatusPanel } from '@/components/community/FundedStatusPanel';

export const revalidate = 60; // re-fetch the founder count at most once a minute

/**
 * Founders Wall teaser. The owner has declared the school funded, so this
 * section is recognition only — it renders the shared FundedStatusPanel
 * (SCHOOL IS FUNDED) and never any aggregate money.
 *
 * OUTAGE-PROOF BY CONSTRUCTION. This used to read raised/goal from
 * campaign_progress and fall back to `raised_cents: 0`, so a slow or
 * unreachable database rendered "$0 raised — $12,000 left to open the school"
 * on the homepage. The funded headline is now a static constant and the only
 * query left is a COUNT used for recognition: if it fails the panel simply
 * omits the count and still says SCHOOL IS FUNDED.
 */
async function getFounderCount(): Promise<number | null> {
  try {
    const supabase = createClient();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    // head:true — count only. No money column is selected on this path at all.
    const { count } = await supabase
      .from('founders')
      .select('id', { count: 'exact', head: true })
      .eq('is_public', true)
      .abortSignal(controller.signal);

    clearTimeout(timer);
    return typeof count === 'number' ? count : null;
  } catch {
    return null;
  }
}

export async function FoundersWall() {
  const founderCount = await getFounderCount();

  return (
    <Section id="founders" className="border-b border-line bg-asphalt-800">
      <SectionHeading
        eyebrow="Founders Wall"
        title="Built founder by founder"
        intro="Drivers and businesses funded Trucking Life Academy and put real people behind the wheel. Every founder who backed it is recognized on the wall."
      />
      <div className="mx-auto max-w-2xl">
        <FundedStatusPanel founderCount={founderCount} />
        <div className="mt-6">
          <Button href="/founders">See the Founders Wall</Button>
        </div>
      </div>
    </Section>
  );
}
