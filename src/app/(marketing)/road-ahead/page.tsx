import { buildMetadata } from '@/lib/seo/metadata';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { getCampaignProgress, getPublicFounders } from '@/lib/community/founders';
import { buildWallSequence } from '@/lib/road-ahead/founder-number';
import { RoadAheadExperience } from '@/components/road-ahead/RoadAheadExperience';

/**
 * THE ROAD AHEAD — the flagship, homepage-quality experience that explains the
 * whole Trucking Life ecosystem and ends on the Founders Wall.
 *
 * Server component: fetches the real founders + campaign totals and builds the
 * wall sequence up front (ISR, revalidate 60s), so the first paint is complete
 * and crawlable and the client only layers the cinematic motion on top. Both
 * data reads fail soft (empty wall / zeroed thermometer) — the page always ships.
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
