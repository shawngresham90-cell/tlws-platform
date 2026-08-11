import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/seo/site';
import { ogCard, OG_SIZE } from '@/lib/seo/og-card';

/** Store-family card — applies to /store, categories, guides, and products. */
export const runtime = 'edge';
export const alt = `${SITE.brand} Store — driver-tested gear and guides, hand-picked for the road.`;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    ogCard({
      headline: ['Driver-tested', 'gear & guides.'],
      support: 'The Trucking Life Store — hand-picked for the road.',
    }),
    size,
  );
}
