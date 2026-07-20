/**
 * THE ROAD AHEAD — footage acquisition ledger generator.
 *
 * Reads the footage manifests (public/road-ahead/youtube-sources.json +
 * footage.json) and emits docs/road-ahead-footage-ledger.md with three reports:
 *   1. Footage Inventory   — every submitted clip, status, scene/slot.
 *   2. Remaining Slots     — every empty slot by scene, priority, missing moment.
 *   3. Footage Quality     — structure for weak/duplicate/replace notes.
 *
 * Reports 1 and 2 are DERIVED from the manifests (source of truth), so re-running
 * this after any footage change keeps the ledger current. Report 3 requires
 * watching the footage (which the build agent cannot do) — it is populated from
 * owner / video-AI input; only manifest-derivable facts (e.g. a video id reused
 * across slots) are auto-filled.
 *
 * Run:  node scripts/road-ahead-footage-ledger.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(ROOT, 'public', 'road-ahead');
const OUT = join(ROOT, 'docs', 'road-ahead-footage-ledger.md');

// The locked scene → slot taxonomy (mirrors src/lib/road-ahead/assets.ts). The
// first slot per scene is the hero backdrop; the rest are B-roll/montage.
const SCENES = [
  {
    n: '01', name: 'Night Drive', act: 'The open road', video: true,
    slots: ['dark-highway', 'night-driving', 'headlights', 'windshield-rain'],
    need: 'Night highway, headlights on wet asphalt, windshield POV, rain',
  },
  {
    n: '02', name: 'The Pre-Trip', act: 'The craft', video: true,
    slots: ['pretrip', 'truck-walkaround', 'backing', 'climb-into-cab', 'air-brake-check'],
    need: 'Inspection, walk-around, backing, climbing into the cab, air-brake check',
  },
  {
    n: '03', name: 'The Grind', act: 'Sacrifice', video: true,
    slots: ['truck-stop', 'empty-highway', 'rain-driving', 'late-night-driving'],
    need: 'Truck stop at night, rain on glass, empty highway, late-night miles',
  },
  {
    n: '04', name: 'First Light', act: 'The future', video: true,
    slots: ['sunrise', 'hero-shot', 'drone-shot', 'academy-footage'],
    need: 'Sunrise, truck hero/beauty shot, aerial/drone flyover, academy',
  },
  { n: '05', name: 'The Founder Wall', act: 'Legacy', video: false, slots: [], need: '— (3D exhibit, no footage)' },
  { n: '06', name: 'Your Name', act: 'Passing the torch', video: false, slots: [], need: '— (name induction, no footage)' },
  {
    n: '07', name: 'Legacy', act: 'Bigger than yourself', video: true,
    slots: ['student-training', 'key-handoff', 'student-success', 'truck-driving-away'],
    need: 'Student training, handshake/keys, success, truck driving into the distance',
  },
];
const ALL_SLOTS = new Set(SCENES.flatMap((s) => s.slots));
const sceneOfSlot = (slot) => SCENES.find((s) => s.slots.includes(slot));

function readJson(name) {
  const p = join(BASE, name);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

const yt = readJson('youtube-sources.json') ?? {};
const footage = readJson('footage.json') ?? {};

// Live whole-clip YouTube mappings: slot -> id (skip _-keys and empties).
const liveYt = {};
for (const [k, v] of Object.entries(yt)) {
  if (k.startsWith('_') || typeof v !== 'string' || !v.trim()) continue;
  liveYt[k] = v.trim();
}
const pending = Array.isArray(yt._pending_unassigned) ? yt._pending_unassigned : [];

// Rich moments: slot -> moment.
const moments = {};
if (Array.isArray(footage.moments)) {
  for (const m of footage.moments) {
    if (m && typeof m.slot === 'string' && !moments[m.slot]) moments[m.slot] = m;
  }
}

/** Per-slot resolved status. */
function slotStatus(slot) {
  const m = moments[slot];
  if (m) {
    const seg = m.start != null || m.end != null ? `${m.start ?? '0'}–${m.end ?? 'end'}` : 'whole';
    return { state: 'MOMENT', source: String(m.source ?? ''), range: seg, grade: m.grade ?? '' };
  }
  if (liveYt[slot]) return { state: 'WHOLE CLIP', source: liveYt[slot], range: 'whole', grade: '' };
  return { state: 'OPEN', source: '', range: '', grade: '' };
}

function sceneFilled(scene) {
  return scene.slots.some((s) => slotStatus(s).state !== 'OPEN');
}

// ---- Report 1: Inventory ---------------------------------------------------
const assignedRows = [];
for (const scene of SCENES) {
  for (const slot of scene.slots) {
    const st = slotStatus(slot);
    if (st.state === 'OPEN') continue;
    assignedRows.push(
      `| \`${st.source}\` | Scene ${scene.n} · ${scene.name} | \`${slot}\` | ${st.range} | ${st.grade || '—'} | **USED** |`,
    );
  }
}
const pendingRows = pending.map(
  (id) => `| \`${id}\` | — | — | — | — | _pending_ |`,
);

// ---- Report 2: Remaining slots --------------------------------------------
// Priority: video scenes with NO backdrop first, then B-roll gaps.
const openByScene = SCENES.filter((s) => s.video).map((s) => ({
  scene: s,
  open: s.slots.filter((slot) => slotStatus(slot).state === 'OPEN'),
  filled: sceneFilled(s),
}));
const remainingRows = [];
let priority = 1;
// P-rank: scenes with no backdrop at all, then scenes needing B-roll.
const ranked = [
  ...openByScene.filter((o) => !o.filled),
  ...openByScene.filter((o) => o.filled && o.open.length),
];
for (const o of ranked) {
  for (const slot of o.open) {
    const isHero = o.scene.slots[0] === slot && !o.filled;
    remainingRows.push(
      `| ${priority++} | Scene ${o.scene.n} · ${o.scene.name} | \`${slot}\` | ${isHero ? '**HERO backdrop**' : 'B-roll'} | ${slotDesc(slot, o.scene)} | _unlabeled pending — needs viewing_ |`,
    );
  }
}

function slotDesc(slot, scene) {
  // A short "what's missing" per slot, derived from the slot id + scene need.
  const words = slot.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// ---- Report 3: Quality (auto: duplicate ids only) --------------------------
const idUse = {};
for (const [slot, id] of Object.entries(liveYt)) (idUse[id] ??= []).push(slot);
for (const [slot, m] of Object.entries(moments)) {
  const id = extractId(String(m.source ?? ''));
  if (id) (idUse[id] ??= []).push(slot);
}
const dupRows = Object.entries(idUse)
  .filter(([, slots]) => slots.length > 1)
  .map(([id, slots]) => `| \`${id}\` | used in ${slots.map((s) => `\`${s}\``).join(', ')} | reusing one clip across scenes — confirm it fits each, or diversify |`);

function extractId(v) {
  if (/^[A-Za-z0-9_-]{11}$/.test(v)) return v;
  const m = v.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ---- Compose ---------------------------------------------------------------
const filledScenes = SCENES.filter((s) => s.video && sceneFilled(s)).length;
const videoScenes = SCENES.filter((s) => s.video).length;

const md = `<!-- AUTO-GENERATED by scripts/road-ahead-footage-ledger.mjs — do not edit by hand.
     Re-run after any footage change: node scripts/road-ahead-footage-ledger.mjs -->
# THE ROAD AHEAD — footage acquisition ledger

The post-production asset ledger for \`/road-ahead\`. **Reports 1 & 2 are derived
from the footage manifests** (\`public/road-ahead/youtube-sources.json\` +
\`footage.json\`) — the source of truth — so this file is regenerated on every
footage change and always current. **Report 3 (quality) needs someone to watch
the footage**, which this build agent cannot do; it carries the structure and is
populated from owner / video-AI input, with only manifest-derivable facts
(e.g. one clip reused across slots) auto-filled.

**Scene coverage:** ${filledScenes} / ${videoScenes} footage-scenes have a backdrop assigned. A scene is
marked **COMPLETE** only on owner sign-off (a quality call), not automatically.

_To assign a clip:_ move its id from \`_pending_unassigned\` into a slot in
\`youtube-sources.json\` (whole clip), or add a \`moments\` entry in \`footage.json\`
(a trimmed segment + edits). Then re-run this generator.

---

## 1 · Footage Inventory Report

Every submitted clip, its status and (where assigned) scene · slot · segment.

| Clip | Scene | Slot | Segment | Grade | Status |
| --- | --- | --- | --- | --- | --- |
${assignedRows.join('\n') || '| _(none assigned yet)_ | | | | | |'}
${pendingRows.join('\n')}

- **Assigned (used):** ${assignedRows.length}
- **Pending (unassigned):** ${pending.length}
- Status legend: **USED** = live in a scene · _pending_ = submitted, awaiting a scene + moment · _rejected_ = recorded here when the owner rejects a clip.

---

## 2 · Remaining Asset Slots Report

Every empty slot, ranked. Priority orders scenes with **no backdrop at all**
first (they show the CSS atmosphere until filled), then B-roll gaps.

| Priority | Scene | Slot | Role | Missing moment | Candidate clips |
| --- | --- | --- | --- | --- | --- |
${remainingRows.join('\n') || '| — | — | — | — | _all video slots filled_ | — |'}

_Candidate clips_ stays "needs viewing" until a scene + timestamp is supplied per
clip — the agent can't watch the pending library to match moments to slots.

---

## 3 · Footage Quality Report

Populated from viewing (owner / video-AI). Auto-filled: clips reused across
slots. Add rows as clips are reviewed.

**Reused clips (auto-detected):**

| Clip | Reuse | Note |
| --- | --- | --- |
${dupRows.join('\n') || '| _(none — no clip is used in more than one slot)_ | | |'}

**Weak / duplicate / replace (from review):**

| Clip | Scene · slot | Issue | Better alternative | Action |
| --- | --- | --- | --- | --- |
| _(populated as clips are reviewed)_ | | | | |

---

### Acquisition targets — what to shoot/pick next (by priority)

${ranked.length
    ? ranked
        .map(
          (o) =>
            `- **Scene ${o.scene.n} · ${o.scene.name}** (${o.filled ? 'has a backdrop — needs B-roll' : 'NO backdrop yet — highest'}) — ${o.scene.need}`,
        )
        .join('\n')
    : '- All footage scenes have a backdrop. Only replace on a significantly better moment.'}
`;

writeFileSync(OUT, md);
console.log(
  `[road-ahead] footage ledger: ${assignedRows.length} used, ${pending.length} pending, ${filledScenes}/${videoScenes} scenes filled → ${OUT}`,
);
