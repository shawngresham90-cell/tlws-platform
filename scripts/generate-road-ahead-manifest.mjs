/**
 * Build-time generator for the Road Ahead asset-presence manifest.
 *
 * WHY: the drop-in resolver must know which media files exist WITHOUT doing a
 * per-request `fs` scan — on serverless/ISR hosts (Netlify) `public/` is on the
 * CDN, not in the page function's file trace, so a runtime `existsSync` would
 * report every file missing after the first regeneration and silently revert
 * footage to gradients. Instead we scan `public/road-ahead/**` ONCE at build and
 * emit the list into a committed-shape TS module the resolver imports. Runs from
 * the `prebuild` npm hook, so every `next build` regenerates it from whatever
 * files are present in the deployed checkout.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(ROOT, 'public', 'road-ahead');
const SUBDIRS = ['video', 'poster', 'captions', 'audio'];
const OUT = join(ROOT, 'src', 'lib', 'road-ahead', 'asset-presence.generated.ts');

// 1) Dropped-in files present at build.
const present = [];
for (const dir of SUBDIRS) {
  const abs = join(BASE, dir);
  if (!existsSync(abs)) continue;
  for (const name of readdirSync(abs)) {
    if (name.startsWith('.') || name.endsWith('.md')) continue; // skip dotfiles + READMEs
    present.push(`${dir}/${name}`);
  }
}
present.sort();

// 2) YouTube-Unlisted mappings from public/road-ahead/youtube-sources.json:
//    { "<slot-id>": "<youtube id or url>" }. Extract the 11-char video id.
function extractYouTubeId(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(v)) return v; // already a bare id
  const m = v.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/,
  );
  return m ? m[1] : null;
}

const youtube = {};
const ytFile = join(BASE, 'youtube-sources.json');
if (existsSync(ytFile)) {
  try {
    const raw = JSON.parse(readFileSync(ytFile, 'utf8'));
    for (const [slot, value] of Object.entries(raw)) {
      if (slot.startsWith('_')) continue; // allow "_comment" keys
      if (typeof value !== 'string' || value.trim() === '') continue; // unset slot — silent
      const id = extractYouTubeId(value);
      if (id) youtube[slot] = id;
      else console.warn(`[road-ahead] youtube-sources: could not parse a video id for "${slot}" (value: ${JSON.stringify(value)})`);
    }
  } catch (e) {
    console.warn(`[road-ahead] youtube-sources.json is not valid JSON — ignoring. ${e.message}`);
  }
}
const youtubeSorted = Object.fromEntries(Object.entries(youtube).sort(([a], [b]) => a.localeCompare(b)));

// 3) Rich per-moment manifest from public/road-ahead/footage.json. Each moment
//    pulls a segment of a source (YouTube id/url OR a ./video/ filename) into a
//    scene slot with cinematic edits, so one long video can feed many scenes.
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
const GRADES = new Set(['none', 'night', 'dawn', 'noir', 'warm', 'steel', 'cool']);

/** Parse a time value: number of seconds, or "m:ss" / "h:mm:ss". null if unset. */
function toSeconds(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== 'string') return null;
  const parts = value.trim().split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const secs = parts.reduce((acc, n) => acc * 60 + n, 0);
  return secs >= 0 ? secs : null;
}

function clampSpeed(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.min(2, Math.max(0.25, v));
}

/** Normalize one raw moment into the resolved shape, or null if unusable. */
function normalizeMoment(m) {
  if (!m || typeof m !== 'object' || typeof m.slot !== 'string' || !m.slot) return null;
  const src = typeof m.source === 'string' ? m.source.trim() : '';
  const youtubeId = extractYouTubeId(src);
  const file = !youtubeId && VIDEO_EXT.test(src) ? src.replace(/^\/*/, '') : null;
  if (!youtubeId && !file) return null; // needs a real source
  const grade = typeof m.grade === 'string' && GRADES.has(m.grade) ? m.grade : 'none';
  const edit = {
    start: toSeconds(m.start),
    end: toSeconds(m.end),
    speed: clampSpeed(m.speed),
    loop: m.loop === false ? false : true,
    crop: typeof m.crop === 'string' && m.crop.trim() ? m.crop.trim() : null,
    zoom: typeof m.zoom === 'number' && m.zoom >= 1 ? m.zoom : null,
    grade,
    fadeIn: typeof m.fadeIn === 'number' && m.fadeIn >= 0 ? m.fadeIn : null,
    fadeOut: typeof m.fadeOut === 'number' && m.fadeOut >= 0 ? m.fadeOut : null,
    duck: m.duck === true,
  };
  let mobile = null;
  if (m.mobile && typeof m.mobile === 'object') {
    const mo = {};
    if ('start' in m.mobile) mo.start = toSeconds(m.mobile.start);
    if ('end' in m.mobile) mo.end = toSeconds(m.mobile.end);
    if ('speed' in m.mobile) mo.speed = clampSpeed(m.mobile.speed);
    if ('loop' in m.mobile) mo.loop = m.mobile.loop !== false;
    if (typeof m.mobile.crop === 'string') mo.crop = m.mobile.crop.trim() || null;
    if (typeof m.mobile.zoom === 'number') mo.zoom = m.mobile.zoom >= 1 ? m.mobile.zoom : null;
    if (typeof m.mobile.grade === 'string' && GRADES.has(m.mobile.grade)) mo.grade = m.mobile.grade;
    if (typeof m.mobile.fadeIn === 'number') mo.fadeIn = m.mobile.fadeIn;
    if (typeof m.mobile.fadeOut === 'number') mo.fadeOut = m.mobile.fadeOut;
    if ('duck' in m.mobile) mo.duck = m.mobile.duck === true;
    if (Object.keys(mo).length) mobile = mo;
  }
  const poster = typeof m.poster === 'string' && m.poster.trim() ? m.poster.trim() : null;
  return { slot: m.slot, youtubeId: youtubeId ?? null, file, poster, ...edit, mobile };
}

const moments = {};
const footageFile = join(BASE, 'footage.json');
if (existsSync(footageFile)) {
  try {
    const raw = JSON.parse(readFileSync(footageFile, 'utf8'));
    const list = Array.isArray(raw.moments) ? raw.moments : [];
    for (const m of list) {
      const norm = normalizeMoment(m);
      if (!norm) {
        console.warn(`[road-ahead] footage.json: skipped an unusable moment ${JSON.stringify(m)?.slice(0, 80)}`);
        continue;
      }
      if (moments[norm.slot]) {
        console.warn(`[road-ahead] footage.json: slot "${norm.slot}" already has a moment — keeping the first, ignoring a later one.`);
        continue;
      }
      const { slot, ...rest } = norm;
      moments[slot] = rest;
    }
  } catch (e) {
    console.warn(`[road-ahead] footage.json is not valid JSON — ignoring. ${e.message}`);
  }
}
const momentsSorted = Object.fromEntries(Object.entries(moments).sort(([a], [b]) => a.localeCompare(b)));

const body = `// AUTO-GENERATED by scripts/generate-road-ahead-manifest.mjs — do not edit by hand.
// Regenerated on every build (prebuild hook) from public/road-ahead/**. Lists the
// media present at build so the resolver never touches the filesystem at request
// time (serverless/ISR-safe). Empty = no owner media supplied yet.
export const PRESENT_ASSETS: readonly string[] = ${JSON.stringify(present, null, 2)};

// slot id → YouTube-Unlisted video id (from public/road-ahead/youtube-sources.json).
export const YOUTUBE_SOURCES: Readonly<Record<string, string>> = ${JSON.stringify(youtubeSorted, null, 2)};

// slot id → resolved cinematic MOMENT (segment + edits) from
// public/road-ahead/footage.json. Takes precedence over YOUTUBE_SOURCES for the
// same slot. \`file\` is validated against PRESENT_ASSETS by the resolver.
export type GeneratedMoment = {
  youtubeId: string | null;
  file: string | null;
  poster: string | null;
  start: number | null;
  end: number | null;
  speed: number | null;
  loop: boolean;
  crop: string | null;
  zoom: number | null;
  grade: string;
  fadeIn: number | null;
  fadeOut: number | null;
  duck: boolean;
  mobile: Record<string, unknown> | null;
};
export const FOOTAGE_MOMENTS: Readonly<Record<string, GeneratedMoment>> = ${JSON.stringify(momentsSorted, null, 2)};
`;

writeFileSync(OUT, body);
console.log(
  `[road-ahead] asset manifest: ${present.length} file(s) + ${Object.keys(youtubeSorted).length} youtube mapping(s) + ${Object.keys(momentsSorted).length} moment(s) → ${OUT}`,
);
