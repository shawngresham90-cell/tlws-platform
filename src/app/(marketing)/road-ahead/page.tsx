import { buildMetadata } from '@/lib/seo/metadata';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildAuthoritativeWall, buildAuthoritativeCampaign } from '@/lib/road-ahead/founders-data';
import { RoadAheadExperience } from '@/components/road-ahead/RoadAheadExperience';

/**
 * THE ROAD AHEAD — the flagship, homepage-quality experience that explains the
 * whole Trucking Life ecosystem and ends on the Founders Wall.
 *
 * Server component. The Founder Wall + fundraising total come from the
 * authoritative owner-supplied roster (src/lib/road-ahead/founders-data.ts) —
 * a single source of truth summed to the verified campaign total — so the first
 * paint is complete, crawlable, and identical everywhere, with the client only
 * layering cinematic motion on top.
 */
export const revalidate = 60;

export const metadata = buildMetadata({
  title: 'The Road Ahead — Trucking Life',
  description:
    'The story of Trucking Life — the CDL school, the tools, and the drivers building it. See where the road goes, then put your name on the Founders Wall.',
  path: '/road-ahead',
});

export default function RoadAheadPage() {
  const founders = buildAuthoritativeWall();
  const campaign = buildAuthoritativeCampaign();

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
