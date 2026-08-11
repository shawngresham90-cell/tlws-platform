import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/seo/site';
import { ogCard, OG_SIZE } from '@/lib/seo/og-card';

/**
 * Directory-family card — applies to /directory and every state, corridor,
 * exit, flow, and listing page beneath it that has no more specific card.
 */
export const runtime = 'edge';
export const alt = `${SITE.brand} directory — truck stops, parking, scales, and driver services, exit by exit.`;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    ogCard({
      headline: ['Truck stops,', 'exit by exit.'],
      support: 'The driver-built directory — parking, scales & services, state by state.',
    }),
    size,
  );
}
