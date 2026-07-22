import { ImageResponse } from 'next/og';

/**
 * Favicon (file convention). The site shipped no icon at all — browsers
 * showed a blank tab glyph. Brand mark: TL on asphalt with the signal-yellow
 * period, matching the header wordmark.
 */
export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0E0E0E',
          color: '#F5F5F5',
          fontSize: 18,
          fontWeight: 800,
          fontFamily: 'sans-serif',
        }}
      >
        TL<span style={{ color: '#FFEB00' }}>.</span>
      </div>
    ),
    size,
  );
}
