/**
 * THE ROAD AHEAD — scene clip compressor.
 *
 * Takes one raw clip and produces the web-ready assets for a scene at the
 * recommended settings (see public/road-ahead/video/README.md):
 *   - public/road-ahead/video/scene-0N.mp4   (H.264, yuv420p, +faststart, muted)
 *   - public/road-ahead/video/scene-0N.webm  (VP9, muted) — smaller mobile payload
 *   - public/road-ahead/poster/scene-0N.jpg  (first-frame still)
 *
 * Usage:
 *   node scripts/compress-road-ahead-video.mjs <input> <scene 1-7> [maxSeconds]
 *   e.g. node scripts/compress-road-ahead-video.mjs ~/night-drive.mov 1
 *
 * ffmpeg is resolved from $FFMPEG, then PATH, then the bundled Playwright build
 * at /opt/pw-browsers/ffmpeg-linux.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const VIDEO_DIR = resolve(ROOT, 'public/road-ahead/video');
const POSTER_DIR = resolve(ROOT, 'public/road-ahead/poster');

function resolveFfmpeg() {
  if (process.env.FFMPEG && existsSync(process.env.FFMPEG)) return process.env.FFMPEG;
  const probe = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (probe.status === 0) return 'ffmpeg';
  const bundled = '/opt/pw-browsers/ffmpeg-linux';
  if (existsSync(bundled)) return bundled;
  return null;
}

function run(bin, args, label) {
  const r = spawnSync(bin, args, { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`\n✗ ${label} failed (exit ${r.status ?? 'signal'}).`);
    process.exit(1);
  }
}

function main() {
  const [input, sceneArg, maxArg] = process.argv.slice(2);
  const scene = Number(sceneArg);
  const maxSeconds = maxArg ? Number(maxArg) : 15;

  if (!input || !Number.isInteger(scene) || scene < 1 || scene > 7) {
    console.error(
      'Usage: node scripts/compress-road-ahead-video.mjs <input> <scene 1-7> [maxSeconds]',
    );
    process.exit(2);
  }
  if (!existsSync(input)) {
    console.error(`Input not found: ${input}`);
    process.exit(2);
  }

  const ffmpeg = resolveFfmpeg();
  if (!ffmpeg) {
    console.error('ffmpeg not found. Set $FFMPEG to an ffmpeg binary and retry.');
    process.exit(3);
  }

  mkdirSync(VIDEO_DIR, { recursive: true });
  mkdirSync(POSTER_DIR, { recursive: true });

  const n = String(scene).padStart(2, '0');
  const mp4 = resolve(VIDEO_DIR, `scene-${n}.mp4`);
  const webm = resolve(VIDEO_DIR, `scene-${n}.webm`);
  const poster = resolve(POSTER_DIR, `scene-${n}.jpg`);

  // Fit within 1920x1080 (never upscale), even dimensions, drop audio, cap length.
  const scale =
    "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2";
  const trim = ['-t', String(maxSeconds)];

  console.log(`\n[1/3] MP4 (H.264) → ${mp4}`);
  run(
    ffmpeg,
    [
      '-y',
      '-i',
      input,
      ...trim,
      '-vf',
      scale,
      '-an',
      '-c:v',
      'libx264',
      '-profile:v',
      'high',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '24',
      '-preset',
      'slow',
      '-movflags',
      '+faststart',
      mp4,
    ],
    'MP4 encode',
  );

  console.log(`\n[2/3] WebM (VP9) → ${webm}`);
  run(
    ffmpeg,
    [
      '-y',
      '-i',
      input,
      ...trim,
      '-vf',
      scale,
      '-an',
      '-c:v',
      'libvpx-vp9',
      '-b:v',
      '0',
      '-crf',
      '34',
      '-row-mt',
      '1',
      webm,
    ],
    'WebM encode',
  );

  console.log(`\n[3/3] Poster (first frame) → ${poster}`);
  run(
    ffmpeg,
    ['-y', '-i', input, '-vf', `${scale},thumbnail`, '-frames:v', '1', '-q:v', '4', poster],
    'Poster extract',
  );

  const mb = (p) => (statSync(p).size / (1024 * 1024)).toFixed(2);
  const kb = (p) => (statSync(p).size / 1024).toFixed(0);
  console.log('\n✓ Done. Wrote:');
  console.log(`   video/scene-${n}.mp4   ${mb(mp4)} MB`);
  console.log(`   video/scene-${n}.webm  ${mb(webm)} MB`);
  console.log(`   poster/scene-${n}.jpg  ${kb(poster)} KB`);
  if (Number(mb(mp4)) > 4) {
    console.log('\n⚠ MP4 exceeds the 4 MB target — try a shorter clip or a higher -crf.');
  }
  console.log('\nNext: set src/webmSrc/poster + license for this scene in');
  console.log('   src/lib/road-ahead/assets.ts → SCENE_BACKDROP.');
}

main();
