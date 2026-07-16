/**
 * CDL Practice Tests — Milestone 4 (bookmarks + missed-question drilling) tests.
 *
 * Covers what Milestone 4 added:
 *   - Saved-state lib: versioned bookmark/miss records, fail-soft parsing,
 *     immutable toggles, pruning against the live bank, miss counting +
 *     recency ordering, per-test and full clearing, storage roundtrips.
 *   - Drill isolation: drill sessions use their own study-storage variant and
 *     never reach the attempt log (the drill gate in TestResults).
 *   - Recording: Study Mode records a miss the moment a wrong answer lands;
 *     the Timed runner records answered-wrong questions once, at submission.
 *   - Wiring: /practice-tests/bookmarks + /missed are noindex, render empty
 *     states, launch points exist on the hub, landing, and results surfaces,
 *     and no server secrets appear in the new client components.
 *
 * Run:
 *   npx esbuild scripts/test-saved-drills.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-saved-drills.cjs && node /tmp/test-saved-drills.cjs
 */
import { readFileSync } from 'node:fs';
import {
  BOOKMARKS_STORAGE_KEY,
  MISSES_STORAGE_KEY,
  SAVED_STORAGE_VERSION,
  bookmarkedIds,
  clearMisses,
  deserializeBookmarks,
  deserializeMisses,
  emptyBookmarks,
  emptyMisses,
  isBookmarked,
  missEntry,
  missedIdsForTest,
  recordMisses,
  removeBookmark,
  serializeBookmarks,
  serializeMisses,
  toggleBookmark,
  totalBookmarks,
  totalMisses,
} from '@/lib/tests/saved';
import { studyStorageKey } from '@/lib/tests/study';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};
const read = (p: string) => readFileSync(p, 'utf8');

// ── 1. Storage keys — versioned, and drills never clobber the full session ──
check('bookmarks key is versioned', BOOKMARKS_STORAGE_KEY === 'tlws:bookmarks:v1');
check('misses key is versioned', MISSES_STORAGE_KEY === 'tlws:misses:v1');
check('saved storage version is 1', SAVED_STORAGE_VERSION === 1);
check(
  'plain study key unchanged by the variant param (Study Mode untouched)',
  studyStorageKey('general-knowledge') === 'tlws:study:v1:general-knowledge',
);
check(
  'bookmark drills get their own study bucket',
  studyStorageKey('general-knowledge', 'bookmarks') === 'tlws:study:v1:general-knowledge:bookmarks',
);
check(
  'miss drills get their own study bucket',
  studyStorageKey('general-knowledge', 'misses') === 'tlws:study:v1:general-knowledge:misses',
);

// ── 2. Bookmarks — immutable toggle, prune, roundtrip ───────────────────────
const GK = 'general-knowledge';
let b = emptyBookmarks();
check('empty bookmarks has no tests', totalBookmarks(b) === 0);
check('isBookmarked false on empty', isBookmarked(b, GK, 'q1') === false);

const b0 = b;
b = toggleBookmark(b, GK, 'q1');
check('toggle adds a bookmark', isBookmarked(b, GK, 'q1'));
check('toggle is immutable (original untouched)', !isBookmarked(b0, GK, 'q1') && b !== b0);
b = toggleBookmark(b, GK, 'q2');
b = toggleBookmark(b, 'air-brakes', 'a1');
check(
  'bookmarks group by test slug',
  b.tests[GK]?.length === 2 && b.tests['air-brakes']?.length === 1,
);
check('totalBookmarks counts across tests', totalBookmarks(b) === 3);

b = toggleBookmark(b, GK, 'q1');
check('toggle removes an existing bookmark', !isBookmarked(b, GK, 'q1'));
check('other bookmarks survive a removal', isBookmarked(b, GK, 'q2'));
b = toggleBookmark(b, 'air-brakes', 'a1');
check('empty test buckets are dropped', !('air-brakes' in b.tests));

check('removeBookmark removes', !isBookmarked(removeBookmark(b, GK, 'q2'), GK, 'q2'));
check('removeBookmark on absent id is a no-op object', removeBookmark(b, GK, 'nope') === b);

// Roundtrip + fail-soft parsing.
b = toggleBookmark(b, GK, 'q3');
const bRaw = serializeBookmarks(b);
check(
  'bookmarks survive a storage roundtrip (refresh-proof)',
  (() => {
    const back = deserializeBookmarks(bRaw);
    return (
      isBookmarked(back, GK, 'q2') && isBookmarked(back, GK, 'q3') && totalBookmarks(back) === 2
    );
  })(),
);
check('bookmarks serialize with the version stamp', bRaw.includes(`"v":${SAVED_STORAGE_VERSION}`));
check('null → empty (first visit)', totalBookmarks(deserializeBookmarks(null)) === 0);
check('junk → empty (never throws)', totalBookmarks(deserializeBookmarks('{oops')) === 0);
check(
  'version mismatch → empty (old shapes discarded, not migrated)',
  totalBookmarks(deserializeBookmarks(JSON.stringify({ v: 99, tests: { [GK]: ['q1'] } }))) === 0,
);
check(
  'non-string ids are dropped on parse',
  totalBookmarks(
    deserializeBookmarks(JSON.stringify({ v: 1, tests: { [GK]: ['q1', 7, null] } })),
  ) === 1,
);
check(
  'non-array bucket is dropped on parse',
  totalBookmarks(deserializeBookmarks(JSON.stringify({ v: 1, tests: { [GK]: 'q1' } }))) === 0,
);

// Pruning against the live bank — a re-seeded bank never shows ghost rows.
check(
  'bookmarkedIds prunes ids missing from the live bank',
  bookmarkedIds(b, GK, ['q2', 'q9']).join(',') === 'q2',
);
check('bookmarkedIds for an unknown test is empty', bookmarkedIds(b, 'nope', ['q1']).length === 0);

// ── 3. Misses — count + recency, ordering, clearing ─────────────────────────
const T0 = 1_700_000_000_000;
let m = emptyMisses();
check('empty misses has no tests', totalMisses(m) === 0);
check('recordMisses with no ids is a no-op object', recordMisses(m, GK, [], T0) === m);

const m0 = m;
m = recordMisses(m, GK, ['q1', 'q2'], T0);
check('misses recorded with count 1', missEntry(m, GK, 'q1')?.n === 1);
check('misses stamp recency', missEntry(m, GK, 'q2')?.at === T0);
check('recordMisses is immutable', totalMisses(m0) === 0 && m !== m0);

m = recordMisses(m, GK, ['q1'], T0 + 1000);
check('repeat miss increments the count', missEntry(m, GK, 'q1')?.n === 2);
check('repeat miss refreshes recency', missEntry(m, GK, 'q1')?.at === T0 + 1000);
check('other entries keep their stamp', missEntry(m, GK, 'q2')?.at === T0);

m = recordMisses(m, 'air-brakes', ['a1'], T0 + 2000);
check('misses group by test slug', totalMisses(m) === 3);

// Drill order: most-missed first, recency breaks ties.
m = recordMisses(m, GK, ['q3'], T0 + 3000);
check(
  'missedIdsForTest orders most-missed first, then most recent',
  missedIdsForTest(m, GK, ['q1', 'q2', 'q3']).join(',') === 'q1,q3,q2',
);
check(
  'missedIdsForTest prunes ids missing from the live bank',
  missedIdsForTest(m, GK, ['q1', 'q2']).join(',') === 'q1,q2',
);

// Clearing — per test and everything.
const cleared = clearMisses(m, GK);
check(
  'clearMisses(slug) clears ONLY that test',
  !(GK in cleared.tests) && totalMisses(cleared) === 1,
);
check('clearMisses(slug) is immutable', totalMisses(m) === 4);
check('clearMisses on unknown slug is a no-op object', clearMisses(m, 'nope') === m);
check('clearMisses() clears everything', totalMisses(clearMisses(m)) === 0);

// Roundtrip + fail-soft parsing.
const mRaw = serializeMisses(m);
check(
  'misses survive a storage roundtrip (refresh-proof)',
  (() => {
    const back = deserializeMisses(mRaw);
    return missEntry(back, GK, 'q1')?.n === 2 && missEntry(back, GK, 'q1')?.at === T0 + 1000;
  })(),
);
check('misses serialize with the version stamp', mRaw.includes(`"v":${SAVED_STORAGE_VERSION}`));
check('null → empty misses', totalMisses(deserializeMisses(null)) === 0);
check('junk → empty misses (never throws)', totalMisses(deserializeMisses('[]')) === 0);
check(
  'version mismatch → empty misses',
  totalMisses(
    deserializeMisses(JSON.stringify({ v: 2, tests: { [GK]: { q1: { n: 1, at: T0 } } } })),
  ) === 0,
);
check(
  'invalid entries dropped on parse (n<=0, bad at, junk shapes)',
  totalMisses(
    deserializeMisses(
      JSON.stringify({
        v: 1,
        tests: {
          [GK]: { q1: { n: 0, at: T0 }, q2: { n: 2, at: 'y' }, q3: 'junk', q4: { n: 1.9, at: T0 } },
          bad: 'junk',
        },
      }),
    ),
  ) === 1,
);
check(
  'NaN/Infinity stamps and counts are rejected on parse (review hardening)',
  totalMisses(
    deserializeMisses(
      JSON.stringify({
        v: 1,
        tests: { [GK]: { q1: { n: 1, at: NaN }, q2: { n: Infinity, at: T0 } } },
      }),
    ),
  ) === 0,
);
check(
  'sub-1 fractional counts are dropped, not truncated to "Missed 0×"',
  totalMisses(
    deserializeMisses(JSON.stringify({ v: 1, tests: { [GK]: { q1: { n: 0.5, at: T0 } } } })),
  ) === 0,
);
check(
  'duplicate bookmark ids are deduped on parse (no duplicate React keys)',
  (
    deserializeBookmarks(JSON.stringify({ v: 1, tests: { [GK]: ['q1', 'q1', 'q2'] } })).tests[GK] ??
    []
  ).length === 2,
);

check(
  'fractional counts are truncated on parse',
  missEntry(
    deserializeMisses(JSON.stringify({ v: 1, tests: { [GK]: { q4: { n: 1.9, at: T0 } } } })),
    GK,
    'q4',
  )?.n === 1,
);

// ── 4. Saved lib stays pure — no DOM, no DB ─────────────────────────────────
const savedLib = read('src/lib/tests/saved.ts');
check(
  'saved.ts never touches localStorage',
  !savedLib.includes('localStorage.getItem') && !savedLib.includes('localStorage.setItem'),
);
check(
  'saved.ts never touches window/document',
  !savedLib.includes('window.') && !savedLib.includes('document.'),
);
check('saved.ts never imports supabase', !savedLib.includes('supabase'));

// ── 5. Recording wiring — Study immediate, Timed at submission ──────────────
const studyRunner = read('src/components/test/StudyRunner.tsx');
check(
  'StudyRunner records misses via the shared write-through',
  studyRunner.includes('recordMissesToStorage('),
);
check('StudyRunner records ONLY wrong answers', studyRunner.includes('key !== q.correctKey'));
check(
  'StudyRunner storage keys carry the drill variant',
  (studyRunner.match(/studyStorageKey\(test\.slug, drill\)/g) ?? []).length >= 3,
);
check(
  'StudyRunner passes drill-awareness to results',
  studyRunner.includes('drill={drill !== undefined}'),
);
check(
  'StudyRunner miss write is guarded (storage may be blocked)',
  studyRunner.includes('} catch {'),
);
check(
  'StudyRunner renders the bookmark button in feedback',
  studyRunner.includes('<BookmarkButton'),
);

const timedRunner = read('src/components/test/TimedRunner.tsx');
check(
  'TimedRunner records misses via the shared write-through',
  timedRunner.includes('recordMissesToStorage('),
);
check(
  'TimedRunner records misses once — ref latch, race-proof before re-render',
  timedRunner.includes('!missesRecorded.current && session.submittedAt === undefined'),
);
check(
  'TimedRunner resets the miss latch on retake',
  timedRunner.includes('missesRecorded.current = false'),
);
check(
  'TimedRunner only counts ANSWERED-wrong questions as misses',
  timedRunner.includes(
    'session.answers[q.id] !== undefined && session.answers[q.id] !== q.correctKey',
  ),
);
check(
  'TimedRunner exam view still shows no feedback (no correctness styling)',
  !timedRunner.includes('isCorrect'),
);

const results = read('src/components/test/TestResults.tsx');
check('TestResults gates the attempt log on drill', results.includes('if (drill || alreadyLogged'));
check(
  'TestResults defaults drill to false (Study/Timed unchanged)',
  results.includes('drill = false'),
);
check(
  'drill results never claim a real-exam verdict',
  /\{!drill && <> · \{test\.passThresholdPct\}% needed/.test(results),
);
check('TestResults renders a bookmark button per review row', results.includes('<BookmarkButton'));
check(
  'TestResults links to both saved pages',
  results.includes('/practice-tests/bookmarks') && results.includes('/practice-tests/missed'),
);

// ── 6. Drill isolation — subset only, own bucket, never logged ──────────────
const browser = read('src/components/test/SavedBrowser.tsx');
check(
  'drills map the SELECTED ids only, in list order (drill order)',
  browser.includes('drill.ids') && browser.includes('.map((id) => byId.get(id))'),
);
check(
  'drills run as their kind (one flag: storage + logging + copy)',
  browser.includes('drill={kind}'),
);
check(
  'drills always start fresh (stale sessions cleared at launch)',
  browser.includes('window.localStorage.removeItem(studyStorageKey(slug, kind))'),
);
check(
  'drills reuse the existing StudyRunner (no forked quiz UI)',
  browser.includes('<StudyRunner'),
);
check(
  'browser prunes both kinds against the live bank',
  browser.includes('bookmarkedIds(') && browser.includes('missedIdsForTest('),
);
check(
  'bookmark rows are removable (toggle-off via BookmarkButton)',
  browser.includes('<BookmarkButton'),
);
check(
  'miss history clears against a FRESH read (never the mount snapshot)',
  browser.includes('clearMisses(readMisses(), bank.test.slug)'),
);
check(
  'returning from a drill re-reads storage (list never goes stale)',
  /refresh\(\);\s*setDrill\(null\);/.test(browser),
);
check(
  'view swaps manage focus (no drop to body)',
  browser.includes('tabIndex={-1}') && browser.includes('.current?.focus()'),
);
check(
  'removals/clears announce via a persistent status region',
  browser.includes('role="status"') && browser.includes('setAnnounce('),
);
check(
  'drill back button meets the 44px target',
  /Back to your[\s\S]{0,400}min-h-\[44px\]|min-h-\[44px\][\s\S]{0,400}Back to your/.test(browser),
);
check('miss rows show count + recency', browser.includes('Missed {entry.n}'));
check(
  'empty states exist for both kinds',
  browser.includes('No bookmarks yet') && browser.includes('No missed questions on record'),
);
check(
  'rows show answer, explanation, and citation',
  browser.includes('q.correctKey.toUpperCase()') &&
    browser.includes('q.explanation') &&
    browser.includes('q.cfrCite'),
);

const bookmarkButton = read('src/components/test/BookmarkButton.tsx');
check(
  'bookmark button is a toggle (aria-pressed)',
  bookmarkButton.includes('aria-pressed={saved}'),
);
check('bookmark button meets the 44px target', bookmarkButton.includes('min-h-[44px]'));
check(
  'bookmark toggles are fresh read-modify-writes via savedStorage',
  bookmarkButton.includes('toggleBookmark(readBookmarks()') &&
    bookmarkButton.includes('writeBookmarks(next)'),
);
check(
  'bookmark accessible name is constant + disambiguated',
  bookmarkButton.includes('aria-label={context'),
);

// ── 7. Routes — noindex, ISR, launch points ─────────────────────────────────
const bookmarksPage = read('src/app/(learn)/practice-tests/bookmarks/page.tsx');
const missedPage = read('src/app/(learn)/practice-tests/missed/page.tsx');
for (const [label, src, kind] of [
  ['bookmarks', bookmarksPage, 'bookmarks'],
  ['missed', missedPage, 'misses'],
] as const) {
  check(`${label} page is noindex (personalized/thin)`, src.includes('noindex: true'));
  check(`${label} page uses ISR like its siblings`, src.includes('export const revalidate = 300'));
  check(`${label} page renders the browser with kind="${kind}"`, src.includes(`kind="${kind}"`));
  check(
    `${label} page only exposes the PUBLIC turnstile key`,
    (src.match(/process\.env\./g) ?? []).length ===
      (src.match(/process\.env\.NEXT_PUBLIC_/g) ?? []).length,
  );
  check(`${label} page fetches banks via the shared loader`, src.includes('getPublishedBanks'));
}

const hub = read('src/app/(learn)/practice-tests/page.tsx');
check(
  'hub links to both saved pages',
  hub.includes('/practice-tests/bookmarks') && hub.includes('/practice-tests/missed'),
);
const landing = read('src/app/(learn)/practice-tests/[slug]/page.tsx');
check(
  'test landing links to both saved pages',
  landing.includes('/practice-tests/bookmarks') && landing.includes('/practice-tests/missed'),
);

// ── 8. No secrets in the new client components ──────────────────────────────
const savedStorage = read('src/lib/tests/savedStorage.ts');
check(
  'savedStorage centralizes the fresh read-modify-write discipline',
  savedStorage.includes('recordMissesToStorage') &&
    savedStorage.includes('readBookmarks') &&
    savedStorage.includes('writeMisses'),
);
check('savedStorage never imports supabase', !savedStorage.includes('supabase'));

for (const [label, src] of [
  ['SavedBrowser', browser],
  ['BookmarkButton', bookmarkButton],
  ['savedStorage', savedStorage],
] as const) {
  check(`${label} never reads process.env`, !src.includes('process.env'));
  check(`${label} never references service-role`, !src.toLowerCase().includes('service_role'));
}

// ── Done ────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
