import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/seo/site';
import { ogCard, OG_SIZE } from '@/lib/seo/og-card';

/**
 * Root Open Graph / Twitter card. Applies to every route that doesn't ship
 * its own file-convention image (deeper segments like /academy or
 * /cdl-pre-school keep their more specific card). Rendered at the edge from
 * the shared ogCard frame so branding can't drift; no third-party assets.
 */
export const runtime = 'edge';
export const alt = `${SITE.brand} — ${SITE.tagline} CDL training, guides, practice tests, and trucker tools.`;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    ogCard({
      headline: ['Drivers helping', 'drivers.'],
      support: 'CDL training, DOT guides, practice tests, and trucker tools.',
    }),
    size,
  );
}
