/**
 * The pilot stop policy, the release register, and the operational
 * documents that quote them.
 *
 * Three things are pinned here, and the third is the one that earns the
 * file's existence.
 *
 * 1. THE POLICY MODULE behaves the way the policy says: one confirmed P0
 *    stops the pilot, an unconfirmed P0 report stops it growing, a
 *    judgment condition can never be fired by a count.
 *
 * 2. THE REGISTER is structurally honest: nothing is graded KNOWN-GOOD
 *    without a verification date and evidence, and every short sha in it
 *    has the same shape the driver reads off the build strip — so a
 *    register line and a phone screen can be compared character for
 *    character at the roadside.
 *
 * 3. THE DOCUMENTS AND THE MODULE CANNOT DRIFT. An operational document
 *    is read once, under pressure, months after it was written. If the
 *    condition list in the markdown and the condition list in the code
 *    disagree, the owner follows the wrong one and never finds out. So
 *    every catalogue id, every severity and every threshold is compared
 *    against the rendered table, both directions.
 *
 * And one negative assertion that matters more than any of them: the
 * policy module must have NO importer inside the running app. It
 * classifies; it does not act. An automated stop driven by field reports
 * would hand anyone who can file one the power to kill a driver's
 * navigation mid-trip.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-stop-policy.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --jsx=automatic \
 *     --outfile=/tmp/test-navigator-stop-policy.cjs && node /tmp/test-navigator-stop-policy.cjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  P0_CONDITIONS,
  P1_CONDITIONS,
  STOP_CONDITIONS,
  classifyPilotPosture,
  findStopCondition,
  postureSummary,
  worstPosture,
  type PilotObservation,
} from '@/lib/navigator/pilot-stop-policy';
import { resolveBuildId, shortCommit } from '@/lib/navigator/build-id';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 240)}`}`);
  }
}

const POLICY_DOC = readFileSync('docs/operations/navigator-pilot-stop-policy.md', 'utf8');
const REGISTER = readFileSync('docs/operations/navigator-release-register.md', 'utf8');
const ROLLBACK = readFileSync('docs/operations/navigator-rollback.md', 'utf8');
const WAVE0 = readFileSync('docs/operations/navigator-wave-0-road-test.md', 'utf8');
const WAVE1 = readFileSync('docs/operations/navigator-wave-1-gate.md', 'utf8');
const POLICY_SRC = readFileSync('src/lib/navigator/pilot-stop-policy.ts', 'utf8');

/**
 * Markdown wraps. A sentence that reads as one line on screen is two lines
 * in the file, so every PROSE assertion runs against a whitespace-flattened
 * copy — otherwise the test fails on where the author pressed return, which
 * is not a fact worth pinning. Table and fence parsing still uses the raw
 * text, because there the line breaks ARE the structure.
 */
const flat = (s: string) => s.replace(/\s+/g, ' ');
const POLICY_FLAT = flat(POLICY_DOC);
const REGISTER_FLAT = flat(REGISTER);
const ROLLBACK_FLAT = flat(ROLLBACK);
const WAVE0_FLAT = flat(WAVE0);
const WAVE1_FLAT = flat(WAVE1);

/* ------------------------------------------------- 1. catalogue shape */
{
  check('catalogue: 14 P0 conditions', P0_CONDITIONS.length === 14, P0_CONDITIONS.length);
  check('catalogue: 9 P1 conditions', P1_CONDITIONS.length === 9, P1_CONDITIONS.length);
  check(
    'catalogue: the combined list is exactly P0 then P1',
    STOP_CONDITIONS.length === P0_CONDITIONS.length + P1_CONDITIONS.length,
  );

  const ids = STOP_CONDITIONS.map((c) => c.id);
  check('catalogue: ids are unique', new Set(ids).size === ids.length, ids);
  for (const id of ids) {
    check(`catalogue: "${id}" is a stable kebab-case id`, /^[a-z][a-z0-9-]*[a-z0-9]$/.test(id), id);
  }

  for (const c of P0_CONDITIONS) {
    check(`P0 ${c.id}: severity is P0`, c.severity === 'P0');
    check(
      `P0 ${c.id}: carries no threshold — one confirmed P0 stops the pilot`,
      c.occurrenceThreshold === null && c.driverThreshold === null,
      `${c.occurrenceThreshold}/${c.driverThreshold}`,
    );
  }
  for (const c of P1_CONDITIONS) {
    check(`P1 ${c.id}: severity is P1`, c.severity === 'P1');
    if (c.judgment) {
      check(
        `P1 ${c.id}: a judgment condition carries no fake threshold`,
        c.occurrenceThreshold === null && c.driverThreshold === null,
        `${c.occurrenceThreshold}/${c.driverThreshold}`,
      );
    } else {
      check(
        `P1 ${c.id}: a counted condition has at least one threshold`,
        c.occurrenceThreshold !== null || c.driverThreshold !== null,
      );
    }
  }

  for (const c of STOP_CONDITIONS) {
    check(`${c.id}: has an observation a driver could actually report`, c.observed.length > 30);
    check(`${c.id}: explains WHY, not just what`, c.why.length > 30);
    check(`${c.id}: has owner actions`, c.ownerActions.length >= 2, c.ownerActions.length);
    check(`${c.id}: has a resume criterion`, c.resume.length > 20);
    check(
      `${c.id}: the resume criterion is not "it seems fine now"`,
      !/seems fine|looks ok|probably/i.test(c.resume),
      c.resume,
    );
  }

  check('lookup: a known id resolves', findStopCondition('secret-exposure') !== null);
  check('lookup: an unknown id does not', findStopCondition('made-up') === null);
  check('lookup: a non-string does not throw', findStopCondition(null) === null);
  check('lookup: undefined does not throw', findStopCondition(undefined) === null);
}

/* ------------------------------------------------------ 2. classifier */
{
  const stop = (o: PilotObservation[]) => classifyPilotPosture(o);

  check('classify: nothing observed is CONTINUE', stop([]).posture === 'continue');

  {
    const v = stop([{ conditionId: 'wrong-way-instruction', confirmed: true }]);
    check(
      'classify: ONE confirmed P0 stops the pilot',
      v.posture === 'stop-immediately',
      v.posture,
    );
    check('classify: and names it', v.stopping.includes('wrong-way-instruction'));
    check('classify: the summary says STOP', postureSummary(v).startsWith('STOP THE PILOT'));
  }
  {
    const v = stop([{ conditionId: 'wrong-way-instruction', confirmed: false }]);
    check(
      'classify: an UNCONFIRMED P0 report pauses expansion rather than stopping',
      v.posture === 'pause-expansion',
      v.posture,
    );
    check(
      'classify: and is listed as unconfirmed, not as stopping',
      v.unconfirmedP0.length === 1 && v.stopping.length === 0,
    );
  }
  {
    // The point of the ordering rule: a confirmed P0 anywhere in the set
    // wins, no matter how many benign observations surround it.
    const v = stop([
      { conditionId: 'follow-recenter-breaks', confirmed: true, occurrences: 1 },
      { conditionId: 'secret-exposure', confirmed: true },
      { conditionId: 'frequent-search-failure', confirmed: false },
    ]);
    check('classify: the worst observation wins', v.posture === 'stop-immediately', v.posture);
  }

  {
    const under = stop([
      { conditionId: 'repeat-reroute-failure', confirmed: true, occurrences: 2, drivers: 1 },
    ]);
    check(
      'classify: a counted P1 below threshold does not pause',
      under.posture === 'continue',
      under.reasons,
    );
    check('classify: but it is recorded', under.belowThreshold.includes('repeat-reroute-failure'));

    const at = stop([
      { conditionId: 'repeat-reroute-failure', confirmed: true, occurrences: 3, drivers: 1 },
    ]);
    check('classify: at the occurrence threshold it pauses', at.posture === 'pause-expansion');

    const byDrivers = stop([
      { conditionId: 'repeat-reroute-failure', confirmed: true, occurrences: 1, drivers: 2 },
    ]);
    check(
      'classify: two independent drivers pause it even at one occurrence each',
      byDrivers.posture === 'pause-expansion',
      byDrivers.reasons,
    );
  }

  {
    // The honesty rule. A judgment condition has no number, so a caller
    // cannot manufacture one by passing a big count.
    const counted = stop([
      { conditionId: 'excessive-voice-chatter', confirmed: false, occurrences: 999, drivers: 99 },
    ]);
    check(
      'classify: a judgment condition NEVER fires from a count alone',
      counted.posture === 'continue',
      counted.reasons,
    );
    const owned = stop([{ conditionId: 'excessive-voice-chatter', confirmed: true }]);
    check(
      'classify: it fires when the owner confirms it',
      owned.posture === 'pause-expansion' && owned.pausing.includes('excessive-voice-chatter'),
    );
  }

  {
    const v = stop([{ conditionId: 'reporting-fails', confirmed: true }]);
    check('classify: losing the reporting path pauses at one', v.posture === 'pause-expansion');
  }
  {
    const v = stop([{ conditionId: 'not-a-real-condition', confirmed: true }]);
    check('classify: an unknown id does not change posture', v.posture === 'continue');
    check(
      'classify: and is reported rather than dropped',
      v.unknown.includes('not-a-real-condition'),
    );
  }
  {
    // Totality: junk in the numeric fields must not throw or invent a pause.
    const v = stop([
      {
        conditionId: 'frequent-search-failure',
        confirmed: true,
        occurrences: Number.NaN,
        drivers: -5,
      },
    ]);
    check(
      'classify: NaN/negative counts degrade to 1, not to a pause',
      v.posture === 'continue',
      v.reasons,
    );
  }
  {
    const v = stop([{ conditionId: 'frequent-search-failure', confirmed: false, occurrences: 50 }]);
    check(
      'classify: an unconfirmed P1 is recorded and changes nothing',
      v.posture === 'continue' && v.belowThreshold.includes('frequent-search-failure'),
    );
  }

  check(
    'posture order: stop beats pause',
    worstPosture('pause-expansion', 'stop-immediately') === 'stop-immediately',
  );
  check(
    'posture order: pause beats continue',
    worstPosture('continue', 'pause-expansion') === 'pause-expansion',
  );
  check(
    'posture order: is symmetric',
    worstPosture('stop-immediately', 'continue') === 'stop-immediately',
  );
  check(
    'summary: continue does not imply the wave gate passed',
    postureSummary(stop([])).includes('wave gates still apply'),
  );
}

/* ------------------------------------------- 3. the module cannot act */
{
  // AD-2 purity, and the stronger rule: this module has no lever.
  //
  // Comments AND string literals are stripped first. Both legitimately
  // contain the words being searched for — the catalogue's owner actions
  // say "change the pilot password" and "every issued pilot cookie", which
  // is guidance to a human, not this module touching a cookie. Matching
  // prose would make the purity gate unable to describe what it guards.
  const CODE_ONLY = POLICY_SRC.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
  for (const [what, re] of [
    ['a clock', /\bDate\b|\bnow\(\)/],
    ['the network', /\bfetch\(|XMLHttpRequest/],
    ['browser globals', /\bwindow\.|\bdocument\.|localStorage|sessionStorage/],
    ['timers', /setTimeout|setInterval/],
    ['persistence', /supabase|document\.cookie|writeFile|readFile/i],
    ['logging', /console\./],
    ['a feature flag', /process\.env|NEXT_PUBLIC/],
    ['a module-level mutable', /^let /m],
  ] as const) {
    check(`policy module: does not reach ${what}`, !re.test(CODE_ONLY), what);
  }

  // No importer anywhere in src/. Docs and tests may reference it.
  const appImporters: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p) && !p.endsWith('pilot-stop-policy.ts')) {
        if (readFileSync(p, 'utf8').includes('pilot-stop-policy')) appImporters.push(p);
      }
    }
  };
  walk('src');
  check(
    'policy module: NOTHING in the app imports it — it classifies, it does not act',
    appImporters.length === 0,
    appImporters,
  );
}

/* ----------------------------------- 4. document and module agreement */
function section(doc: string, start: string, end: string): string {
  const a = doc.indexOf(start);
  const b = end === '' ? doc.length : doc.indexOf(end, a + start.length);
  if (a < 0) return '';
  return doc.slice(a, b < 0 ? doc.length : b);
}
/** Backticked kebab tokens appearing in table rows only. */
function tableIds(block: string): string[] {
  const out = new Set<string>();
  for (const line of block.split('\n')) {
    if (!line.trimStart().startsWith('|')) continue;
    for (const m of line.matchAll(/`([a-z][a-z0-9-]*[a-z0-9])`/g)) out.add(m[1]);
  }
  return [...out];
}

{
  const p0Block = section(POLICY_DOC, '## P0 — STOP THE PILOT', '## P1 — PAUSE EXPANSION');
  const p1Block = section(POLICY_DOC, '## P1 — PAUSE EXPANSION', '## Using the classifier');
  check('doc: the P0 section exists', p0Block.length > 200);
  check('doc: the P1 section exists', p1Block.length > 200);

  const docP0 = new Set(tableIds(p0Block));
  const docP1 = new Set(tableIds(p1Block));
  const codeP0 = new Set(P0_CONDITIONS.map((c) => c.id));
  const codeP1 = new Set(P1_CONDITIONS.map((c) => c.id));

  for (const id of codeP0) check(`doc: P0 table lists "${id}"`, docP0.has(id));
  for (const id of docP0) check(`doc: P0 table invents nothing — "${id}"`, codeP0.has(id), id);
  for (const id of codeP1) check(`doc: P1 table lists "${id}"`, docP1.has(id));
  for (const id of docP1) check(`doc: P1 table invents nothing — "${id}"`, codeP1.has(id), id);

  // Thresholds. A number in the code and a different number in the table
  // is exactly the drift this file exists to stop.
  for (const c of P1_CONDITIONS) {
    const row = p1Block.split('\n').find((l) => l.includes(`\`${c.id}\``)) ?? '';
    if (c.judgment) {
      check(`doc: "${c.id}" is shown as a judgment call, not a number`, /judgment/i.test(row), row);
      check(
        `doc: "${c.id}" shows no fake threshold`,
        !/\b\d+\b/.test(row.split('|').pop() ?? ''),
        row,
      );
    } else {
      if (c.occurrenceThreshold !== null) {
        check(
          `doc: "${c.id}" shows the occurrence threshold ${c.occurrenceThreshold}`,
          row.includes(String(c.occurrenceThreshold)),
          row,
        );
      }
      if (c.driverThreshold !== null) {
        check(
          `doc: "${c.id}" shows the driver threshold ${c.driverThreshold}`,
          row.includes(String(c.driverThreshold)),
          row,
        );
      }
    }
  }

  check(
    'doc: states the one-confirmed-P0 rule without hedging it into a rate',
    /One confirmed P0 stops the pilot/i.test(POLICY_FLAT) && /Not a rate/i.test(POLICY_FLAT),
  );
  check(
    'doc: distinguishes a REPORT from a CONFIRMATION',
    /is a \*report\*, not a confirmation/i.test(POLICY_FLAT),
  );
  check(
    'doc: states that nothing stops the pilot automatically',
    /Nothing in this repository stops the pilot on its own/i.test(POLICY_FLAT),
  );
  check('doc: records the #272 blocker', /#272/.test(POLICY_FLAT));
}

/* ---------------------------------------------------- 5. the register */
type Block = { title: string; cells: Map<string, string> };
function registerBlocks(doc: string): Block[] {
  const out: Block[] = [];
  let current: Block | null = null;
  let inFence = false;
  for (const line of doc.split('\n')) {
    // The "how to add a row" template is a fenced example, not a row. A
    // parser that reads it would grade the template and fail on it.
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (line.startsWith('### ')) {
      if (current) out.push(current);
      current = { title: line.slice(4).trim(), cells: new Map() };
      continue;
    }
    if (current && line.trimStart().startsWith('|')) {
      const parts = line.split('|').map((s) => s.trim());
      // | key | value |  →  ['', key, value, '']
      if (parts.length >= 4 && parts[1] !== '' && !/^-+$/.test(parts[1])) {
        current.cells.set(parts[1].replace(/\*\*/g, ''), parts.slice(2, -1).join('|').trim());
      }
    }
  }
  if (current) out.push(current);
  return out;
}

{
  const blocks = registerBlocks(REGISTER);
  const graded = blocks.filter((b) => b.cells.has('Evidence grade'));
  check(
    'register: at least one graded block',
    graded.length >= 1,
    blocks.map((b) => b.title),
  );

  for (const b of graded) {
    const grade = (b.cells.get('Evidence grade') ?? '').replace(/\*/g, '').trim();
    check(
      `register: "${b.title}" uses a known grade`,
      ['KNOWN-GOOD', 'CANDIDATE', 'UNVERIFIED'].includes(grade),
      grade,
    );
    if (grade === 'KNOWN-GOOD') {
      const verified = b.cells.get('Owner verified in production on') ?? '';
      const evidence = b.cells.get('Evidence') ?? '';
      check(
        `register: KNOWN-GOOD "${b.title}" carries a verification date`,
        verified.length > 0 && !/blank/i.test(verified),
        verified,
      );
      check(
        `register: KNOWN-GOOD "${b.title}" carries evidence`,
        evidence.length > 20 && !/blank/i.test(evidence),
        evidence,
      );
    }
  }

  // Every short sha in the register must be the exact shape a driver reads
  // off the build strip — seven lowercase hex characters.
  const shorts = [...REGISTER.matchAll(/`([0-9a-fA-F]{7})`/g)].map((m) => m[1]);
  check('register: contains short shas', shorts.length >= 2, shorts);
  for (const s of shorts) {
    check(`register: "${s}" is the shape shortCommit() emits`, shortCommit(s) === s, s);
  }

  // A full sha and its short form must actually correspond.
  for (const m of REGISTER.matchAll(/`([0-9a-f]{40})`/g)) {
    const full = m[1];
    check(
      `register: short form of ${full.slice(0, 7)}… is present and correct`,
      REGISTER.includes(`\`${full.slice(0, 7)}\``),
      full,
    );
  }

  check(
    'register: names exactly one rollback target section',
    (REGISTER.match(/^### Rollback target$/gm) ?? []).length === 1,
  );
  check(
    'register: does not claim production state it cannot see',
    /NOT VERIFIED FROM THIS REPOSITORY/.test(REGISTER_FLAT),
  );
  check(
    'register: records #272 as unmerged and unverified',
    /READY FOR OWNER ROAD RETEST/.test(REGISTER_FLAT),
  );
  check(
    'register: warns that the public flag is inlined at build time',
    /inlined into the bundle at build time|inlined at build time/i.test(REGISTER_FLAT),
  );

  // The labels these documents promise are the labels the code renders. A
  // register that shows a driver a different string than the build strip
  // does is worse than one that shows nothing.
  for (const [full, doc, where] of [
    ['b6a1260a17e9f01c007782791c0a28f8bf08b55c', REGISTER_FLAT, 'register (production)'],
    ['94fc6591707fa6e1cc2a335cd660ce393a9ec749', ROLLBACK_FLAT, 'rollback doc (target)'],
  ] as const) {
    const label = resolveBuildId({ commitRef: full, context: 'production' }).label;
    check(
      `${where}: build label matches resolveBuildId`,
      label === `pilot 2.0 · ${full.slice(0, 7)} · production` && doc.includes(label),
      label,
    );
  }
}

/* ------------------------------------------- 6. rollback + wave gates */
{
  check(
    'rollback: preserves evidence BEFORE redeploying',
    /Preserve the evidence — before you deploy/i.test(ROLLBACK_FLAT),
  );
  check(
    'rollback: names the owner-authorization stops',
    /OWNER AUTHORIZATION REQUIRED/.test(ROLLBACK_FLAT),
  );
  for (const stopStep of [
    'Publish an earlier Netlify deploy',
    'Change any Netlify environment variable',
    'Revert a commit on `main`',
  ]) {
    check(
      `rollback: "${stopStep}" is reported as not performed`,
      ROLLBACK.includes(stopStep),
      stopStep,
    );
  }
  check(
    'rollback: records the drill actually run',
    /22 Navigator harnesses, all passed/.test(ROLLBACK_FLAT),
  );
  check(
    'rollback: is honest that the target was never driven',
    /Nobody has driven `94fc659`/.test(ROLLBACK_FLAT),
  );
  check(
    'rollback: flags the unverified env-var question rather than asserting it',
    /Unverified/.test(ROLLBACK_FLAT) &&
      /cannot be established from this repository/.test(ROLLBACK_FLAT),
  );

  check(
    'wave 0: nothing is pre-marked as passed',
    !/\bPASS\b\s*\|/.test(WAVE0.replace(/\| PASS \| \|/g, '')),
  );
  check('wave 0: records NOT STARTED', /NOT STARTED/.test(WAVE0_FLAT));
  check('wave 0: covers the #272 reroute section', /PR #272, not yet on `main`/.test(WAVE0_FLAT));
  const shieldCount = (WAVE0.match(/🛑/g) ?? []).length;
  check('wave 0: marks the safety-critical lines', shieldCount >= 15, shieldCount);
  check(
    'wave 0: says an unmarked line counts as NOT TESTED',
    /An unmarked line is `NOT TESTED`/.test(WAVE0_FLAT),
  );

  check('wave 1: is currently NO GO', /# 🔴 NO GO/.test(WAVE1_FLAT));
  check(
    'wave 1: names the #272 retest as a blocker',
    /PR #272 owner road retest\*\* \| \*\*NOT PERFORMED/.test(WAVE1_FLAT),
  );
  check('wave 1: caps the wave at 2–3 drivers', /2–3\. Hard stop/.test(WAVE1_FLAT));
  check('wave 1: refuses to invent statistical significance', /not statistical/i.test(WAVE1_FLAT));
  check(
    'wave 1: marks the report destination as an owner decision',
    /OWNER DECISION REQUIRED — REPORT DESTINATION/.test(WAVE1_FLAT),
  );
  check(
    'wave 1: quotes the real provider limits',
    /6\/hour\/IP/.test(WAVE1_FLAT) &&
      /30\/min\/IP/.test(WAVE1_FLAT) &&
      /5,000 truck transactions\/month/.test(WAVE1_FLAT),
  );
}

console.log(`navigator-stop-policy: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
