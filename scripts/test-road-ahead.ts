/**
 * THE ROAD AHEAD — Phase 0.5 unit tests.
 *
 * Covers the engineering invariants the prototype must hold:
 *  - footage manifest shape (the drop-in contract) is well-formed;
 *  - the CDN resolver fails soft when unconfigured and joins URLs correctly
 *    when configured (real footage swaps in with no code change);
 *  - canonical founder numbering matches the owner ruling (chronological,
 *    deterministic ties) — read-only, derived, never written;
 *  - the /road-ahead surface performs NO founder-data writes and takes NO
 *    payment (static source guard).
 *
 * Run:
 *   npx esbuild scripts/test-road-ahead.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-road-ahead.cjs && node /tmp/test-road-ahead.cjs
 */
import { readFileSync } from 'node:fs';
import {
  FOOTAGE_SCENES,
  MONTAGE_CARDS,
  clipPoster,
  clipSources,
  footageReady,
  resolveAsset,
  type FootageClip,
} from '@/lib/road-ahead/footage-manifest';
import { toWallFounders, nextFounderNumber } from '@/lib/road-ahead/wall';
import type { PublicFounder } from '@/lib/community/founders';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

// ── 1. Manifest shape ───────────────────────────────────────────────────────
const scenes = Object.values(FOOTAGE_SCENES);
check('manifest: has scenes', scenes.length >= 2);
const allClipIds: string[] = [];
for (const scene of scenes) {
  check(`manifest: ${scene.id} has clips`, scene.clips.length > 0);
  for (const clip of scene.clips) {
    allClipIds.push(clip.id);
    check(
      `manifest: ${scene.id}/${clip.id} fields`,
      Boolean(clip.mobile && clip.desktop && clip.poster && clip.caption) && clip.holdMs > 0,
      clip,
    );
    check(
      `manifest: ${scene.id}/${clip.id} keys are relative (no scheme)`,
      !/^https?:/i.test(clip.mobile) && !/^https?:/i.test(clip.poster),
    );
  }
}
check('manifest: clip ids unique', new Set(allClipIds).size === allClipIds.length);
check('manifest: four montage cards', MONTAGE_CARDS.length === 4);

// ── 2. CDN resolver — fail-soft when unconfigured ───────────────────────────
delete process.env.NEXT_PUBLIC_ROAD_AHEAD_CDN;
const sampleClip: FootageClip = FOOTAGE_SCENES.scene1_dark_road.clips[0];
check('resolver: not ready when unset', footageReady() === false);
check('resolver: resolveAsset null when unset', resolveAsset('scene1/x.jpg') === null);
check('resolver: clipSources empty when unset', clipSources(sampleClip, 'mobile').length === 0);
check('resolver: clipPoster null when unset', clipPoster(sampleClip) === null);

// ── 3. CDN resolver — correct joins when configured ─────────────────────────
process.env.NEXT_PUBLIC_ROAD_AHEAD_CDN = 'https://cdn.test/road-ahead/'; // trailing slash
check('resolver: ready when set', footageReady() === true);
check(
  'resolver: trims trailing + leading slashes',
  resolveAsset('/scene1/x.jpg') === 'https://cdn.test/road-ahead/scene1/x.jpg',
);
const srcs = clipSources(sampleClip, 'mobile');
check('resolver: webm precedes mp4 when present', srcs[0]?.type === 'video/webm');
check('resolver: last source is mp4', srcs[srcs.length - 1]?.type === 'video/mp4');
check(
  'resolver: mobile variant picks mobile key',
  srcs.some((s) => s.src.endsWith(sampleClip.mobile)),
);
const desk = clipSources(FOOTAGE_SCENES.scene2_montage.clips[0], 'desktop');
check(
  'resolver: desktop variant picks desktop key',
  desk.some((s) => s.src.endsWith(FOOTAGE_SCENES.scene2_montage.clips[0].desktop)),
);
delete process.env.NEXT_PUBLIC_ROAD_AHEAD_CDN; // restore default

// ── 4. Canonical founder numbering (owner ruling) ───────────────────────────
const mk = (
  display_name: string,
  paid_at: string,
  tier: PublicFounder['tier'],
  position: number | null = null,
  business_name: string | null = null,
): PublicFounder => ({
  id: `${display_name}-${paid_at}`,
  display_name,
  business_name,
  business_url: null,
  tier,
  position,
  message: null,
  logo_url: null,
  paid_at,
});

const roster: PublicFounder[] = [
  mk('Third Later', '2026-03-01T00:00:00Z', 'brick'),
  mk('First Early', '2026-01-01T00:00:00Z', 'iron'),
  mk('Second Mid', '2026-02-01T00:00:00Z', 'steel', 5, 'Second Biz LLC'),
];
const wall = toWallFounders(roster);
check('numbering: sorted chronologically → №1 earliest', wall[0].name === 'First Early');
check('numbering: №1..№n assigned in order', wall.map((w) => w.number).join(',') === '1,2,3');
check('numbering: last is latest paid_at', wall[2].name === 'Third Later');
check('numbering: business_name preferred over display_name', wall[1].name === 'Second Biz LLC');
check('numbering: year derived from paid_at', wall[0].year === 2026);

// Deterministic tie-break: same paid_at → by position, then name.
const ties: PublicFounder[] = [
  mk('Bravo', '2026-05-01T00:00:00Z', 'brick', 2),
  mk('Alpha', '2026-05-01T00:00:00Z', 'brick', 2),
  mk('EarlyPos', '2026-05-01T00:00:00Z', 'brick', 1),
];
const tieWall = toWallFounders(ties);
check(
  'numbering: ties break by position then name',
  tieWall.map((w) => w.name).join(',') === 'EarlyPos,Alpha,Bravo',
  tieWall.map((w) => w.name),
);

check('nextNumber: max(loaded, aggregate) + 1 (loaded wins)', nextFounderNumber(3, 2) === 4);
check('nextNumber: aggregate wins when higher', nextFounderNumber(3, 10) === 11);
check('nextNumber: empty wall + zero aggregate → 1', nextFounderNumber(0, 0) === 1);

// ── 5. No writes / no payment on the /road-ahead surface (static guard) ──────
const surfaces = [
  'src/app/(community)/road-ahead/page.tsx',
  'src/components/road-ahead/RoadAheadExperience.tsx',
  'src/components/road-ahead/CinematicLayer.tsx',
  'src/components/road-ahead/VideoLayer.tsx',
  'src/components/road-ahead/progress.ts',
  'src/lib/road-ahead/footage-manifest.ts',
  'src/lib/road-ahead/wall.ts',
];
// Supabase writes + payment signals. (Set#delete is fine — not listed here.)
const forbidden = [/\.insert\(/, /\.update\(/, /\.upsert\(/, /amount_cents/, /stripe/i];
for (const rel of surfaces) {
  const src = readFileSync(rel, 'utf8');
  for (const pat of forbidden) {
    check(`no-write guard: ${rel} clean of ${pat}`, !pat.test(src), pat.source);
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\nRoad Ahead tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
