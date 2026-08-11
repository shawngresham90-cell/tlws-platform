import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/seo/site';
import { ogCard, OG_SIZE } from '@/lib/seo/og-card';

/**
 * Knowledge Center card — applies to /knowledge, categories, and articles
 * without their own hero image (articles with hero_image_url keep it via
 * buildMetadata's explicit image option).
 */
export const runtime = 'edge';
export const alt = `${SITE.brand} Knowledge Center — DOT rules and CDL guides in plain English.`;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    ogCard({
      headline: ['Trucker answers,', 'plain English.'],
      support: 'DOT rules, CDL guides, and driver know-how from the Knowledge Center.',
    }),
    size,
  );
}
