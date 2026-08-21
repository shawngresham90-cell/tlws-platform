/**
 * BRICK READABILITY — FOUNDER-WALL-FUNDED-1 (2026-08-20).
 *
 * The Brick founders' names were hard to read: near-black #190c07 engraved into
 * dark red clay #8c3323 measures 2.38:1, well under the 4.5:1 WCAG AA floor for
 * normal-size text. Brick is now light warm sandstone with dark charcoal
 * engraving.
 *
 * These checks compute REAL WCAG contrast from the colours actually shipped in
 * road-ahead.module.css and FounderPlaque.tsx — not from restated constants —
 * and they measure against the DARKEST stop of the surface gradient plus the
 * darkening texture overlay, which is the worst case a name ever sits on.
 *
 * Founder / Shirt is verified INDEPENDENTLY. It used to reach the brick
 * material by fall-through, so it must now have its own explicit mapping and
 * must still render the original red clay.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

const css = read('src/components/road-ahead/road-ahead.module.css');
const plaque = read('src/components/road-ahead/FounderPlaque.tsx');

/* ------------------------------------------------------- WCAG primitives */

type RGB = { r: number; g: number; b: number };

function hex(h: string): RGB {
  const v = h.replace('#', '').trim();
  const full =
    v.length === 3
      ? v
          .split('')
          .map((c) => c + c)
          .join('')
      : v;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** WCAG 2.x relative luminance. */
function luminance({ r, g, b }: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg: string, bg: string): number {
  const a = luminance(hex(fg));
  const b = luminance(hex(bg));
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Multiply `c` toward black by `alpha` — models the texture overlay's worst case. */
function darken(h: string, alpha: number): string {
  const { r, g, b } = hex(h);
  const f = (x: number) => Math.round(x * (1 - alpha));
  return `#${[f(r), f(g), f(b)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

const round = (n: number) => Math.round(n * 100) / 100;

/* --------------------------------- read the shipped colours out of the CSS */

function ruleBody(name: string): string {
  const m = css.match(new RegExp(`\\.${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!m) throw new Error(`css rule .${name} not found`);
  return m[1];
}
/** Every #rrggbb in a rule, in source order. */
function hexesIn(body: string): string[] {
  return [...body.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase());
}
function colorOf(rule: string): string {
  const m = ruleBody(rule).match(/(?:^|\n)\s*color:\s*(#[0-9a-f]{3,6})/i);
  if (!m) throw new Error(`no color in .${rule}`);
  return m[1].toLowerCase();
}
function textureOpacity(rule: string): number {
  const m = css.match(new RegExp(`\\.${rule}::before\\s*\\{([\\s\\S]*?)\\n\\}`));
  const o = m?.[1].match(/opacity:\s*([\d.]+)/);
  return o ? Number(o[1]) : 0;
}

/* --------------------------------------------------------------- 1. BRICK */

const brickBody = ruleBody('matBrick');
const brickStops = hexesIn(brickBody).filter((h) => h !== '#8a6f47'); // drop the border
check('brick surface has a gradient', brickStops.length >= 2, brickStops);

// Worst case = darkest gradient stop, further darkened by the multiply texture.
const brickDarkest = brickStops
  .map((h) => ({ h, l: luminance(hex(h)) }))
  .sort((a, b) => a.l - b.l)[0].h;
const brickTex = textureOpacity('matBrick');
const brickWorst = darken(brickDarkest, brickTex);

check('brick surface is LIGHT (sandstone, not dark clay)', luminance(hex(brickDarkest)) > 0.35, {
  brickDarkest,
  L: round(luminance(hex(brickDarkest))),
});
check('brick texture is restrained enough to preserve contrast', brickTex <= 0.2, brickTex);

const brickName = colorOf('carveSandstone');
const nameRatio = contrast(brickName, brickWorst);
check(`brick NAME >= 4.5:1 (got ${round(nameRatio)}:1 on ${brickWorst})`, nameRatio >= 4.5, {
  brickName,
  brickWorst,
  ratio: round(nameRatio),
});
check(
  'brick name is dark charcoal, not low-opacity white',
  luminance(hex(brickName)) < 0.05,
  brickName,
);

// Tier label + business link colours live in FounderPlaque's brick entry.
const brickEntry = plaque.slice(plaque.indexOf('  brick: {'), plaque.indexOf('  founder_shirt: {'));
check('brick entry uses the sandstone carve', brickEntry.includes('carveSandstone'), brickEntry);
check('brick entry uses no low-opacity white', !/text-white\//.test(brickEntry), brickEntry);
check(
  'brick entry uses no bright signal-yellow body text',
  !/text-signal/.test(brickEntry),
  brickEntry,
);

const brickLabel = brickEntry.match(/label:\s*'text-\[(#[0-9a-f]{6})\]'/i)?.[1].toLowerCase();
const brickLink = brickEntry.match(/link:\s*'text-\[(#[0-9a-f]{6})\]/i)?.[1].toLowerCase();
check('brick tier label is an explicit hex', Boolean(brickLabel), brickEntry);
check('brick business link is an explicit hex', Boolean(brickLink), brickEntry);

if (brickLabel) {
  const r = contrast(brickLabel, brickWorst);
  check(`brick TIER LABEL >= 4.5:1 (got ${round(r)}:1)`, r >= 4.5, { brickLabel, ratio: round(r) });
}
if (brickLink) {
  const r = contrast(brickLink, brickWorst);
  check(`brick BUSINESS LINK >= 4.5:1 (got ${round(r)}:1)`, r >= 4.5, {
    brickLink,
    ratio: round(r),
  });
}
// Links must not be distinguished by colour alone.
check('brick link is underlined, not colour-only', /underline/.test(brickEntry), brickEntry);

/* ------------------------------------------- 2. FOUNDER / SHIRT (separate) */

check(
  'founder_shirt has an EXPLICIT material mapping (no brick fall-through)',
  /if \(tier === 'founder_shirt'\) return 'founder_shirt';/.test(plaque),
  plaque,
);
check("MaterialKey includes 'founder_shirt'", /MaterialKey =[^;]*'founder_shirt'/.test(plaque));

const shirtEntry = plaque.slice(
  plaque.indexOf('  founder_shirt: {'),
  plaque.indexOf('  sponsor: {'),
);
check(
  'founder_shirt keeps the ORIGINAL red clay surface',
  shirtEntry.includes('matClay'),
  shirtEntry,
);
check(
  'founder_shirt keeps the ORIGINAL stone carve',
  shirtEntry.includes('carveStone'),
  shirtEntry,
);
check('founder_shirt does NOT use the new sandstone', !shirtEntry.includes('matBrick'), shirtEntry);

// The clay rule must still be byte-identical in colour to the pre-change brick.
const clayStops = hexesIn(ruleBody('matClay'));
for (const original of ['#a13e2b', '#8c3323', '#792a1c', '#55190f']) {
  check(`founder_shirt clay retains ${original}`, clayStops.includes(original), clayStops);
}
check('founder_shirt carve colour unchanged (#190c07)', colorOf('carveStone') === '#190c07');

/* ------------------------- 3. modes: animated / reduced / static / hover */

// One material object drives every mode, so a mode cannot pick different
// colours. What varies by mode is only whether the carve ANIMATES.
check(
  'reduced motion drops straight to the carved static state',
  /reduced \? 'static' : 'pre'/.test(plaque),
);
check(
  'no IntersectionObserver -> render carved (not blank)',
  /IntersectionObserver/.test(plaque) && /'static'/.test(plaque),
);
check(
  'the full name is always in the DOM for screen readers',
  /sr-only/.test(plaque),
  'plaque must keep the sr-only name copy',
);
check(
  'focus state does not restyle the name colour',
  !/focused\s*&&\s*['"`][^'"`]*text-/.test(plaque),
);

/* -------------------------------------- 4. the 2D /founders cards stay OK */

const card = read('src/components/community/FounderCard.tsx');
check(
  '2D card name uses text-ink on asphalt',
  card.includes('text-ink') && card.includes('bg-asphalt-800'),
);
check(
  '2D card is unaffected by plaque materials',
  !/matBrick|matClay|carveStone|carveSandstone/.test(card),
);

console.log(`founder-wall-contrast: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
