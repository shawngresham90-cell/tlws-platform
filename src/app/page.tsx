import { Hero } from '@/components/sections/Hero';
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
import { LatestArticles } from '@/components/sections/LatestArticles';
import { Newsletter } from '@/components/sections/Newsletter';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({ path: '/' });

export default function HomePage() {
  return (
    <>
      <JsonLd schema={breadcrumbSchema([{ name: 'Home', path: '/' }])} />
      <Hero />
      <RoadAheadTeaser />
      <ShirtHero />
      <FourPaths />
      <Academy />
      <KnowledgeCenter />
      <FeaturedTest />
      <FeaturedVideos />
      <Books />
      <Apps />
      <Store />
      <TruckParking />
      <FoundersWall />
      <LatestArticles />
      <Newsletter />
    </>
  );
}
