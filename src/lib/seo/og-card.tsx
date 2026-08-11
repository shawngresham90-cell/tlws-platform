import { SITE } from './site';

/**
 * Shared Open Graph card frame. One source of truth for the brand system —
 * colors, type scale, eyebrow, footer rule — so the root card and every
 * segment card render the same identity and can't drift apart. Each
 * opengraph-image route supplies its two headline lines and one support
 * line, and wraps the result in ImageResponse at the edge.
 *
 * Brand-driven by design: no photography is embedded. When real Shawn /
 * trucking imagery lands in the repo, segment cards upgrade here first.
 */

export const OG_SIZE = { width: 1200, height: 630 };

export function ogCard({
  headline,
  support,
}: {
  /** Two stacked lines — first renders in ink, second in signal yellow. */
  headline: [string, string];
  /** One quieter supporting sentence under the headline. */
  support: string;
}) {
  return (
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
        {headline[0]}
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
        {headline[1]}
      </div>
      <div style={{ display: 'flex', marginTop: 28, fontSize: 34, color: '#A3A3A3' }}>
        {support}
      </div>
      <div style={{ display: 'flex', marginTop: 44, alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', width: 64, height: 8, backgroundColor: '#FFEB00' }} />
        <div style={{ display: 'flex', fontSize: 28, color: '#F5F5F5' }}>
          {SITE.city}, {SITE.region} · off I-75 · {new URL(SITE.url).host}
        </div>
      </div>
    </div>
  );
}
