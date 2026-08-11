import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/seo/site';
import { ogCard, OG_SIZE } from '@/lib/seo/og-card';

/** Academy-family card — applies to /academy and every route beneath it. */
export const runtime = 'edge';
export const alt = `${SITE.name} — CDL-A training in ${SITE.city}, ${SITE.region}, taught by working drivers.`;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    ogCard({
      headline: ['CDL-A training', `in ${SITE.city}, ${SITE.region}.`],
      support: `${SITE.name} — taught by working drivers, off I-75.`,
    }),
    size,
  );
}
