import { buildMetadata } from '@/lib/seo/metadata';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { getCampaignProgress, getPublicFounders } from '@/lib/community/founders';
import { buildWallSequence } from '@/lib/road-ahead/founder-number';
import { RoadAheadExperience } from '@/components/road-ahead/RoadAheadExperience';

/**
 * THE ROAD AHEAD — the flagship, homepage-quality experience that explains the
 * whole Trucking Life ecosystem and ends on the Founders Wall.
 *
 * PRESENTATION LAYER ONLY. The Founder Wall + fundraising total are read from
 * the existing source of truth (the founders DB + campaign_progress aggregate)
 * via the shared community readers — this experience never defines founder
 * pricing, tiers, or totals. It just presents the current records cinematically.
 * Both reads fail soft (empty wall / zeroed thermometer), so the page always
 * ships. ISR (revalidate 60s); the client only layers motion on top.
 */
export const revalidate = 60;

export const metadata = buildMetadata({
  title: 'The Road Ahead — Trucking Life',
  description:
    'The story of Trucking Life — the CDL school, the tools, and the drivers building it. See where the road goes, then put your name on the Founders Wall.',
  path: '/road-ahead',
});

export default async function RoadAheadPage() {
  const [foundersRaw, campaign] = await Promise.all([getPublicFounders(), getCampaignProgress()]);
  const founders = buildWallSequence(foundersRaw);

  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'The Road Ahead', path: '/road-ahead' },
        ])}
      />
      <RoadAheadExperience founders={founders} campaign={campaign} />
    </>
  );
}
