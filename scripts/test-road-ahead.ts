/**
 * THE ROAD AHEAD — offline unit tests for the pure logic behind the cinematic
 * experience. Deterministic, no DOM, no network:
 *   - scroll-math: clamping, easing, viewport/pinned/sub-beat progress
 *   - founder-number: wall ordering, global numbering, formatting, determinism
 *   - audio-state: the off-by-default soundtrack state machine
 *   - assets: manifest integrity + license/fallback contract
 *   - chapters / ecosystem: config integrity
 *
 * Run:
 *   npx esbuild scripts/test-road-ahead.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-road-ahead.cjs \
 *   && node /tmp/test-road-ahead.cjs
 */
import {
  clamp,
  clamp01,
  lerp,
  mapClamp,
  easeInOutCubic,
  smoothstep,
  crossViewportProgress,
  pinnedProgress,
  subBeat,
} from '@/lib/road-ahead/scroll-math';
import {
  tierRank,
  compareForWall,
  buildWallSequence,
  padFounderNumber,
  formatFounderNumber,
  founderNumberWidth,
  isSafeExternalUrl,
} from '@/lib/road-ahead/founder-number';
import {
  audioReducer,
  INITIAL_AUDIO_STATE,
  isAudioPlaying,
  isAudioControlVisible,
  audioControlLabel,
  type AudioState,
} from '@/lib/road-ahead/audio-state';
import {
  allVideoSlots,
  ROAD_AHEAD_AUDIO,
  hasFootage,
  hasSoundtrack,
  slotsForScene,
  sceneBackdropSlot,
  validateAssetManifest,
} from '@/lib/road-ahead/assets';
import { ROAD_AHEAD_CHAPTERS, validateChapters } from '@/lib/road-ahead/chapters';
import { ECOSYSTEM_PILLARS, validateEcosystem } from '@/lib/road-ahead/ecosystem';
import type { FounderTier, PublicFounder } from '@/lib/community/founders';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}
const approx = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

/* --------------------------------------------------------- scroll-math */
{
  check('clamp: within range', clamp(5, 0, 10) === 5);
  check('clamp: below min', clamp(-3, 0, 10) === 0);
  check('clamp: above max', clamp(20, 0, 10) === 10);
  check('clamp: NaN → min', clamp(NaN, 0, 10) === 0);
  check('clamp01: caps at 1', clamp01(1.5) === 1 && clamp01(-1) === 0);
  check('lerp: midpoint', lerp(0, 10, 0.5) === 5);

  check('mapClamp: linear', mapClamp(5, 0, 10, 0, 100) === 50);
  check('mapClamp: clamps low', mapClamp(-5, 0, 10, 0, 100) === 0);
  check('mapClamp: clamps high', mapClamp(15, 0, 10, 0, 100) === 100);
  check('mapClamp: zero-width input → outMin', mapClamp(5, 10, 10, 0, 100) === 0);
  check('mapClamp: reversed output range clamps', mapClamp(5, 0, 10, 100, 0) === 50);

  check('easeInOutCubic: endpoints', easeInOutCubic(0) === 0 && easeInOutCubic(1) === 1);
  check('easeInOutCubic: symmetric mid', approx(easeInOutCubic(0.5), 0.5));
  check(
    'easeInOutCubic: monotonic',
    easeInOutCubic(0.2) < easeInOutCubic(0.4) && easeInOutCubic(0.4) < easeInOutCubic(0.6),
  );
  check(
    'smoothstep: endpoints + mid',
    smoothstep(0) === 0 && smoothstep(1) === 1 && approx(smoothstep(0.5), 0.5),
  );

  // Element crossing the viewport (vh=800, elementHeight=400).
  check('cross: entering = 0', crossViewportProgress(800, 400, 800) === 0);
  check('cross: fully passed = 1', crossViewportProgress(-400, 400, 800) === 1);
  check('cross: midway ≈ 0.5', approx(crossViewportProgress(200, 400, 800), 0.5));
  check('cross: zero viewport safe', crossViewportProgress(0, 0, 0) === 0);

  check('pinned: midpoint', pinnedProgress(50, 100) === 0.5);
  check('pinned: zero range safe', pinnedProgress(10, 0) === 0);
  check('pinned: clamps', pinnedProgress(200, 100) === 1);

  check('subBeat: before window = 0', subBeat(0.1, 0.15, 0.5) === 0);
  check('subBeat: at window end = 1', subBeat(0.5, 0.15, 0.5) === 1);
  check('subBeat: mid window ≈ 0.5', approx(subBeat(0.325, 0.15, 0.5), 0.5));
  check('subBeat: past window stays 1', subBeat(0.9, 0.15, 0.5) === 1);
}

/* ------------------------------------------------------- founder-number */
{
  const mk = (over: Partial<PublicFounder> & { id: string; tier: FounderTier }): PublicFounder => ({
    display_name: over.id,
    business_name: null,
    business_url: null,
    position: null,
    message: null,
    logo_url: null,
    paid_at: '2025-01-01T00:00:00.000Z',
    ...over,
  });

  check(
    'tierRank: order',
    tierRank('equipment_sponsor') < tierRank('iron') && tierRank('iron') < tierRank('brick'),
  );

  // Cross-tier ordering: brick after iron regardless of position numbers.
  const mixed = [
    mk({ id: 'brick1', tier: 'brick', position: 1 }),
    mk({ id: 'iron1', tier: 'iron', position: 2 }),
    mk({ id: 'iron2', tier: 'iron', position: 1 }),
  ];
  const seq = buildWallSequence(mixed);
  check('wall: iron tier precedes brick', seq[0].tier === 'iron' && seq[2].tier === 'brick');
  check('wall: within-tier position asc', seq[0].id === 'iron2' && seq[1].id === 'iron1');
  check(
    'wall: global numbers are 1..n contiguous',
    seq.map((f) => f.wallNumber).join(',') === '1,2,3',
  );
  check(
    'wall: tierPosition resets per tier',
    seq[0].tierPosition === 1 && seq[1].tierPosition === 2 && seq[2].tierPosition === 1,
  );

  // Null positions sort after numbered ones within a tier.
  const nulls = buildWallSequence([
    mk({ id: 'b', tier: 'steel', position: null }),
    mk({ id: 'a', tier: 'steel', position: 3 }),
  ]);
  check('wall: null position sorts last', nulls[0].id === 'a' && nulls[1].id === 'b');

  // paid_at desc tie-break when positions equal.
  const dated = buildWallSequence([
    mk({ id: 'old', tier: 'iron', position: 1, paid_at: '2024-01-01T00:00:00.000Z' }),
    mk({ id: 'new', tier: 'iron', position: 1, paid_at: '2025-06-01T00:00:00.000Z' }),
  ]);
  check('wall: newer paid_at first on position tie', dated[0].id === 'new');

  // Determinism: shuffled input yields identical id→wallNumber mapping.
  const base = [
    mk({ id: 'x', tier: 'iron', position: 1 }),
    mk({ id: 'y', tier: 'steel', position: 1 }),
    mk({ id: 'z', tier: 'brick', position: 1 }),
  ];
  const a = buildWallSequence(base);
  const b = buildWallSequence([base[2], base[0], base[1]]);
  const keyOf = (s: ReturnType<typeof buildWallSequence>) =>
    s
      .map((f) => `${f.id}:${f.wallNumber}`)
      .sort()
      .join('|');
  check('wall: deterministic under shuffle', keyOf(a) === keyOf(b));
  check('wall: input not mutated', base[0].id === 'x');
  check('wall: empty input → empty', buildWallSequence([]).length === 0);

  check('url: https allowed', isSafeExternalUrl('https://acme-trucking.com'));
  check('url: http allowed', isSafeExternalUrl('http://acme-trucking.com'));
  check('url: javascript: rejected', !isSafeExternalUrl('javascript:alert(1)'));
  check('url: data: rejected', !isSafeExternalUrl('data:text/html,<script>'));
  check(
    'url: relative/malformed rejected',
    !isSafeExternalUrl('/not-absolute') && !isSafeExternalUrl('acme.com'),
  );
  check('url: null/empty rejected', !isSafeExternalUrl(null) && !isSafeExternalUrl(''));

  check(
    'format: padFounderNumber',
    padFounderNumber(7, 3) === '007' && padFounderNumber(42, 3) === '042',
  );
  check(
    'format: padFounderNumber guards bad input',
    padFounderNumber(-5, 3) === '000' && padFounderNumber(NaN, 2) === '00',
  );
  check('format: formatFounderNumber', formatFounderNumber(7, 3) === 'No. 007');
  check(
    'format: width scales with total',
    founderNumberWidth(9) === 2 && founderNumberWidth(120) === 3 && founderNumberWidth(0) === 2,
  );
}

/* ----------------------------------------------------------- audio-state */
{
  const s = (status: AudioState['status']): AudioState => ({ status });

  check(
    'audio: init without track → unavailable',
    audioReducer(INITIAL_AUDIO_STATE, { type: 'INIT', hasTrack: false }).status === 'unavailable',
  );
  const off = audioReducer(INITIAL_AUDIO_STATE, { type: 'INIT', hasTrack: true });
  check('audio: init with track → off', off.status === 'off');

  check(
    'audio: unavailable ignores TOGGLE',
    audioReducer(s('unavailable'), { type: 'TOGGLE' }).status === 'unavailable',
  );
  check(
    'audio: unavailable ignores ENABLE',
    audioReducer(s('unavailable'), { type: 'ENABLE' }).status === 'unavailable',
  );
  check('audio: off→on via TOGGLE', audioReducer(s('off'), { type: 'TOGGLE' }).status === 'on');
  check('audio: on→off via TOGGLE', audioReducer(s('on'), { type: 'TOGGLE' }).status === 'off');
  check(
    'audio: blocked→on via TOGGLE (retry)',
    audioReducer(s('blocked'), { type: 'TOGGLE' }).status === 'on',
  );
  check('audio: ENABLE→on', audioReducer(s('off'), { type: 'ENABLE' }).status === 'on');
  check('audio: DISABLE→off', audioReducer(s('on'), { type: 'DISABLE' }).status === 'off');
  check('audio: BLOCKED→blocked', audioReducer(s('on'), { type: 'BLOCKED' }).status === 'blocked');
  check('audio: ENDED from on→off', audioReducer(s('on'), { type: 'ENDED' }).status === 'off');
  check(
    'audio: ENDED from off unchanged',
    audioReducer(s('off'), { type: 'ENDED' }).status === 'off',
  );

  check(
    'audio: isPlaying only when on',
    isAudioPlaying(s('on')) && !isAudioPlaying(s('off')) && !isAudioPlaying(s('blocked')),
  );
  check(
    'audio: control hidden only when unavailable',
    !isAudioControlVisible(s('unavailable')) && isAudioControlVisible(s('off')),
  );
  check(
    'audio: labels',
    audioControlLabel(s('on')) === 'Turn off soundtrack' &&
      audioControlLabel(s('off')) === 'Turn on soundtrack' &&
      audioControlLabel(s('blocked')).toLowerCase().includes('retry'),
  );
}

/* --------------------------------------------------------------- assets */
{
  check(
    'assets: manifest is healthy',
    validateAssetManifest().length === 0,
    validateAssetManifest(),
  );
  const slots = allVideoSlots();
  check('assets: 21 video slots across the shot list', slots.length === 21);
  check(
    'assets: every slot has a gradient fallback',
    slots.every((v) => v.gradient.trim().length > 0),
  );
  check(
    'assets: every slot has an alt description',
    slots.every((v) => v.alt.trim().length > 0),
  );

  const ids = [...slots.map((v) => v.id), ROAD_AHEAD_AUDIO.id];
  check('assets: ids unique across video+audio', new Set(ids).size === ids.length);

  check(
    'assets: no footage supplied yet (pending)',
    slots.every((v) => !hasFootage(v)),
  );
  check('assets: no soundtrack supplied yet (pending)', !hasSoundtrack());

  // Scene grouping + backdrop resolution.
  check('assets: scene 1 has its four night slots', slotsForScene('nightDrive').length === 4);
  check('assets: scene 2 has its five pre-trip slots', slotsForScene('preTrip').length === 5);
  check('assets: scene 7 has its four payoff slots', slotsForScene('thePayoff').length === 4);
  check(
    'assets: no-video scenes carry no slots',
    slotsForScene('foundersWall').length === 0 && slotsForScene('nameEngraving').length === 0,
  );
  check(
    'assets: every video scene resolves a backdrop slot',
    (['nightDrive', 'preTrip', 'theGrind', 'firstLight', 'thePayoff'] as const).every(
      (s) => sceneBackdropSlot(s) !== undefined,
    ),
  );
  check(
    'assets: no-video scenes resolve no backdrop',
    sceneBackdropSlot('foundersWall') === undefined &&
      sceneBackdropSlot('nameEngraving') === undefined,
  );
}

/* ------------------------------------------------------ chapters + ecosystem */
{
  check('chapters: config valid', validateChapters().length === 0, validateChapters());
  check(
    'chapters: seven scenes in treatment order',
    ROAD_AHEAD_CHAPTERS.map((c) => c.id).join(',') ===
      'nightDrive,preTrip,theGrind,firstLight,foundersWall,nameEngraving,thePayoff',
  );
  check(
    'chapters: scenes 5 and 6 carry no video',
    ROAD_AHEAD_CHAPTERS[4].hasVideo === false && ROAD_AHEAD_CHAPTERS[5].hasVideo === false,
  );
  check(
    'chapters: anchors unique',
    new Set(ROAD_AHEAD_CHAPTERS.map((c) => c.anchor)).size === ROAD_AHEAD_CHAPTERS.length,
  );

  check('ecosystem: config valid', validateEcosystem().length === 0, validateEcosystem());
  check('ecosystem: six pillars', ECOSYSTEM_PILLARS.length === 6);
  check(
    'ecosystem: all internal hrefs',
    ECOSYSTEM_PILLARS.every((p) => p.href.startsWith('/')),
  );
  check(
    'ecosystem: ids unique',
    new Set(ECOSYSTEM_PILLARS.map((p) => p.id)).size === ECOSYSTEM_PILLARS.length,
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
