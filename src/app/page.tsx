import { Hero } from '@/components/sections/Hero';
import { ProofBar } from '@/components/sections/ProofBar';
import { JourneyStrip } from '@/components/sections/JourneyStrip';
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
import { Reveal } from '@/components/motion/Reveal';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({ path: '/' });

/**
 * Homepage story flow (docs/design/homepage-story-framework.md):
 * THE CALL → THE PROOF → THE FOUR DOORS → THE JOURNEY → THE TOOLS →
 * THE ACADEMY → THE MOVEMENT → THE TRUST CLOSE (footer). Every section has a
 * live destination and verified data; LatestArticles (placeholder data) stays
 * unrendered. <Reveal> adds the one scroll-entrance treatment — below-fold
 * only, reduced-motion exempt, content always visible without JS.
 */
export default function HomePage() {
  return (
    <>
      <JsonLd schema={breadcrumbSchema([{ name: 'Home', path: '/' }])} />
      {/* 1 — THE CALL */}
      <Hero />
      {/* 2 — THE PROOF (real numbers only) */}
      <ProofBar />
      {/* 3 — THE FOUR DOORS */}
      <Reveal>
        <FourPaths />
      </Reveal>
      {/* 4 — THE JOURNEY: drove it, taught it, building it */}
      <Reveal>
        <JourneyStrip />
      </Reveal>
      {/* 5 — THE TOOLS: free value first, then gear that earns its keep */}
      <Reveal>
        <KnowledgeCenter />
      </Reveal>
      <Reveal>
        <FeaturedTest />
      </Reveal>
      <Reveal>
        <Apps />
      </Reveal>
      <Reveal>
        <TruckParking />
      </Reveal>
      <Reveal>
        <Books />
      </Reveal>
      <Reveal>
        <Store />
      </Reveal>
      {/* 6 — THE ACADEMY bridge + stay close */}
      <Reveal>
        <Academy />
      </Reveal>
      <Reveal>
        <Newsletter />
      </Reveal>
      {/* 7 — THE MOVEMENT: the drive, the channel, the founders, the shirt */}
      <Reveal>
        <RoadAheadTeaser />
      </Reveal>
      <Reveal>
        <FeaturedVideos />
      </Reveal>
      <Reveal>
        <FoundersWall />
      </Reveal>
      <Reveal>
        <ShirtHero />
      </Reveal>
      {/* 8 — THE TRUST CLOSE: partners, then the footer's identity block */}
      <Reveal>
        <Sponsors />
      </Reveal>
    </>
  );
}
