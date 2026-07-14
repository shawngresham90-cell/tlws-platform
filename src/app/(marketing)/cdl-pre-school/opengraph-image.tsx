import { ImageResponse } from 'next/og';
import {
  FOUNDING_STUDENT_CAPACITY,
  PRESCHOOL_PRICE_LABEL,
} from '@/lib/preschool/constants';

/**
 * Open Graph / Twitter card for /cdl-pre-school — the first social image on
 * the site (shared links previously rendered bare). Generated at the edge
 * from the same constants as the page, so price and capacity can't drift.
 */
export const runtime = 'edge';
export const alt = `CDL Pre-School — Founding Student ${PRESCHOOL_PRICE_LABEL}, limited to ${FOUNDING_STUDENT_CAPACITY} verified students`;
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
        <div style={{ display: 'flex', color: '#FFEB00', fontSize: 28, letterSpacing: 6, textTransform: 'uppercase' }}>
          Trucking Life with Shawn
        </div>
        <div style={{ display: 'flex', marginTop: 24, fontSize: 96, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1 }}>
          CDL Pre-School
        </div>
        <div style={{ display: 'flex', marginTop: 24, fontSize: 36, color: '#A3A3A3' }}>
          Prepare before CDL school — 7 modules, 33 lessons, the driver way.
        </div>
        <div style={{ display: 'flex', marginTop: 48, alignItems: 'center', gap: 24 }}>
          <div
            style={{
              display: 'flex',
              backgroundColor: '#FFEB00',
              color: '#0E0E0E',
              fontSize: 36,
              fontWeight: 800,
              textTransform: 'uppercase',
              padding: '16px 32px',
              borderRadius: 4,
            }}
          >
            Founding Student — {PRESCHOOL_PRICE_LABEL}
          </div>
          <div style={{ display: 'flex', fontSize: 28, color: '#F5F5F5' }}>
            First {FOUNDING_STUDENT_CAPACITY} verified students only
          </div>
        </div>
      </div>
    ),
    size,
  );
}
