import { Hero } from '@/components/sections/Hero';
import { ProofBar } from '@/components/sections/ProofBar';
import { RoadAheadTeaser } from '@/components/sections/RoadAheadTeaser';
import { ShirtHero } from '@/components/sections/ShirtHero';
import { FourPaths } from '@/components/sections/FourPaths';
import { Academy } from '@/components/sections/Academy';
import { KnowledgeCenter } from '@/components/sections/KnowledgeCenter';
import { FeaturedTest } from '@/components/sections/FeaturedTest';
import { FeaturedVideos } from '@/components/sections/FeaturedVideos';
import { Books } from '@/components/sections/Books';
import { Apps } from '@/components/sections/Apps';
import { Store } from '@/components/sections/Store';
import { TruckParking } from '@/components/sections/TruckParking';
import { FoundersWall } from '@/components/sections/FoundersWall';
import { Sponsors } from '@/components/sections/Sponsors';
import { Newsletter } from '@/components/sections/Newsletter';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({ path: '/' });

/**
 * Homepage order follows the design blueprint (§4): thesis → proof → the four
 * doors → the story → free value + email capture → gear & books → mission
 * momentum. LatestArticles (placeholder data) is intentionally not rendered —
 * a homepage never shows a dead end.
 */
export default function HomePage() {
  return (
    <>
      <JsonLd schema={breadcrumbSchema([{ name: 'Home', path: '/' }])} />
      {/* S1 — the thesis */}
      <Hero />
      {/* S2 — live proof (real numbers only) */}
      <ProofBar />
      {/* S3 — the four doors */}
      <FourPaths />
      {/* S4 — the story */}
      <RoadAheadTeaser />
      {/* School promise */}
      <Academy />
      {/* S5 — free value + email capture */}
      <KnowledgeCenter />
      <FeaturedTest />
      <Newsletter />
      {/* S6 — gear & books */}
      <Books />
      <Apps />
      <Store />
      <TruckParking />
      {/* S7 — mission momentum */}
      <FeaturedVideos />
      <ShirtHero />
      <FoundersWall />
      <Sponsors />
    </>
  );
}
