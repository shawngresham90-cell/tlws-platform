'use client';

import { formatFounderNumber } from '@/lib/road-ahead/founder-number';

/**
 * The shareable "Founder Card" — a branded 1200x675 PNG a visitor can generate
 * with their name and next founder number and download to post. No upload, no
 * persistence, no account: the name lives only in the browser for as long as the
 * card is being drawn. Pure Canvas2D, no assets.
 */

/**
 * Clean a typed name for display/engraving: collapse whitespace, trim, cap
 * length. Pure + unit-tested. (An <input> can't contain control characters, and
 * the value only ever reaches Canvas2D fillText, so no further stripping is
 * needed.)
 */
export function sanitizeFounderName(raw: string, max = 26): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

const BG = '#0E0E0E';
const SIGNAL = '#FFEB00';
const INK = '#F5F5F5';
const MUTED = '#A3A3A3';

/**
 * Draw the founder card to an offscreen canvas and trigger a PNG download.
 * Client-only (needs the DOM). Returns true on success, false if the browser
 * can't provide a 2D context.
 */
export function downloadFounderCard(opts: {
  name: string;
  number: number;
  numberWidth: number;
  tierLabel?: string;
  year?: number;
}): boolean {
  const name = sanitizeFounderName(opts.name) || 'A FOUNDING DRIVER';
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 675;
  const g = canvas.getContext('2d');
  if (!g) return false;

  g.fillStyle = BG;
  g.fillRect(0, 0, 1200, 675);
  const glow = g.createRadialGradient(600, 0, 40, 600, 0, 700);
  glow.addColorStop(0, 'rgba(255,235,0,0.10)');
  glow.addColorStop(1, 'rgba(255,235,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 1200, 675);

  g.strokeStyle = 'rgba(255,235,0,0.55)';
  g.lineWidth = 3;
  g.strokeRect(40, 40, 1120, 595);

  g.textAlign = 'center';

  g.fillStyle = SIGNAL;
  g.font = '600 26px sans-serif';
  g.fillText('THE FOUNDING GENERATION', 600, 150);

  g.fillStyle = INK;
  g.font = 'bold 40px sans-serif';
  g.fillText('TRUCKING LIFE', 600, 205);

  g.fillStyle = INK;
  g.font = 'bold 84px Impact, sans-serif';
  g.fillText(name.toUpperCase(), 600, 360);

  g.fillStyle = SIGNAL;
  g.font = '600 34px sans-serif';
  const tier = opts.tierLabel ? ' - ' + opts.tierLabel.toUpperCase() : '';
  g.fillText('FOUNDER ' + formatFounderNumber(opts.number, opts.numberWidth) + tier, 600, 420);

  g.fillStyle = MUTED;
  g.font = '400 26px sans-serif';
  const year = opts.year ?? new Date().getFullYear();
  g.fillText('FOUNDED ' + year + ' - I WAS HERE WHEN IT BEGAN.', 600, 505);

  g.fillStyle = SIGNAL;
  g.font = '600 24px sans-serif';
  g.fillText('truckinglifewithshawn.com/founders', 600, 590);

  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'trucking-life-founder-' + opts.number + '.png';
  a.click();
  return true;
}
