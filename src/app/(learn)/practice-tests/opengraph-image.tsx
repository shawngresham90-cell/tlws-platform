import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/seo/site';
import { ogCard, OG_SIZE } from '@/lib/seo/og-card';

/** Practice-tests card — applies to the hub and every test landing. */
export const runtime = 'edge';
export const alt = `${SITE.brand} — free CDL practice tests with study and timed modes.`;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    ogCard({
      headline: ['Free CDL', 'practice tests.'],
      support: 'Study mode and timed mode — built by a working CDL instructor.',
    }),
    size,
  );
}
