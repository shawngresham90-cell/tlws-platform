import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/seo/site';

/**
 * Root Open Graph / Twitter card. Applies to every route that doesn't ship
 * its own file-convention image (deeper segments like /cdl-pre-school keep
 * their more specific card). Generated at the edge from SITE constants so
 * branding can't drift; no third-party assets.
 */
export const runtime = 'edge';
export const alt = `${SITE.brand} — ${SITE.tagline} CDL training, guides, practice tests, and trucker tools.`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          backgroundColor: '#0E0E0E',
          color: '#F5F5F5',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            color: '#FFEB00',
            fontSize: 28,
            letterSpacing: 6,
            textTransform: 'uppercase',
          }}
        >
          {SITE.brand}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 24,
            fontSize: 104,
            fontWeight: 800,
            textTransform: 'uppercase',
            lineHeight: 1,
          }}
        >
          Drivers helping
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 104,
            fontWeight: 800,
            textTransform: 'uppercase',
            lineHeight: 1,
            color: '#FFEB00',
          }}
        >
          drivers.
        </div>
        <div style={{ display: 'flex', marginTop: 28, fontSize: 34, color: '#A3A3A3' }}>
          CDL training, DOT guides, practice tests, and trucker tools.
        </div>
        <div style={{ display: 'flex', marginTop: 44, alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', width: 64, height: 8, backgroundColor: '#FFEB00' }} />
          <div style={{ display: 'flex', fontSize: 28, color: '#F5F5F5' }}>
            {SITE.city}, {SITE.region} · off I-75 · truckinglifewithshawn.com
          </div>
        </div>
      </div>
    ),
    size,
  );
}
