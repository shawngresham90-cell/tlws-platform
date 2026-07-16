/**
 * Saved study state — bookmarks and missed-question history (Milestone 4).
 * Pure functions, no DOM, no DB, no accounts: everything lives in versioned
 * localStorage on the student's device, following the same conventions as the
 * study/timed session libs (fail-soft parsing, version gate, unknown ids
 * dropped against the live bank). Unit-tested in scripts/test-saved-drills.ts.
 *
 * Shapes (one global record each, grouped by test slug so the saved pages can
 * render every test from a single read):
 *
 *   bookmarks: { v: 1, tests: { [slug]: string[] } }            // question ids
 *   misses:    { v: 1, tests: { [slug]: { [qid]: { n, at } } } } // count + last-missed epoch ms
 *
 * A "miss" is an ANSWERED-wrong question (matching the server-side miss_count
 * semantics) — unanswered questions are never recorded.
 */

export const SAVED_STORAGE_VERSION = 1;

export const BOOKMARKS_STORAGE_KEY = `tlws:bookmarks:v${SAVED_STORAGE_VERSION}`;
export const MISSES_STORAGE_KEY = `tlws:misses:v${SAVED_STORAGE_VERSION}`;

export type BookmarkState = {
  tests: Record<string, string[]>;
};

export type MissEntry = {
  /** Times this question has been answered wrong. */
  n: number;
  /** Epoch ms of the most recent miss. */
  at: number;
};

export type MissState = {
  tests: Record<string, Record<string, MissEntry>>;
};

export function emptyBookmarks(): BookmarkState {
  return { tests: {} };
}

export function emptyMisses(): MissState {
  return { tests: {} };
}

/* ── Bookmarks ──────────────────────────────────────────────────────────── */

export function serializeBookmarks(state: BookmarkState): string {
  return JSON.stringify({ v: SAVED_STORAGE_VERSION, tests: state.tests });
}

/** Parse stored bookmarks. Fail-soft: junk or a version mismatch → empty. */
export function deserializeBookmarks(raw: string | null): BookmarkState {
  if (!raw) return emptyBookmarks();
  try {
    const parsed = JSON.parse(raw) as { v?: number; tests?: Record<string, unknown> };
    if (parsed.v !== SAVED_STORAGE_VERSION) return emptyBookmarks();
    if (typeof parsed.tests !== 'object' || parsed.tests === null) return emptyBookmarks();
    const tests: Record<string, string[]> = {};
    for (const [slug, ids] of Object.entries(parsed.tests)) {
      if (Array.isArray(ids)) {
        const clean = ids.filter((id): id is string => typeof id === 'string');
        if (clean.length > 0) tests[slug] = clean;
      }
    }
    return { tests };
  } catch {
    return emptyBookmarks();
  }
}

export function isBookmarked(state: BookmarkState, slug: string, questionId: string): boolean {
  return (state.tests[slug] ?? []).includes(questionId);
}

/** Add or remove one bookmark. Immutable; empty test buckets are dropped. */
export function toggleBookmark(
  state: BookmarkState,
  slug: string,
  questionId: string,
): BookmarkState {
  const current = state.tests[slug] ?? [];
  const next = current.includes(questionId)
    ? current.filter((id) => id !== questionId)
    : [...current, questionId];
  const tests = { ...state.tests };
  if (next.length > 0) tests[slug] = next;
  else delete tests[slug];
  return { tests };
}

export function removeBookmark(
  state: BookmarkState,
  slug: string,
  questionId: string,
): BookmarkState {
  if (!isBookmarked(state, slug, questionId)) return state;
  return toggleBookmark(state, slug, questionId);
}

/** Bookmarked ids for a test, pruned against the live bank's question ids. */
export function bookmarkedIds(
  state: BookmarkState,
  slug: string,
  liveQuestionIds: string[],
): string[] {
  const live = new Set(liveQuestionIds);
  return (state.tests[slug] ?? []).filter((id) => live.has(id));
}

export function totalBookmarks(state: BookmarkState): number {
  return Object.values(state.tests).reduce((n, ids) => n + ids.length, 0);
}

/* ── Missed questions ───────────────────────────────────────────────────── */

export function serializeMisses(state: MissState): string {
  return JSON.stringify({ v: SAVED_STORAGE_VERSION, tests: state.tests });
}

/** Parse stored misses. Fail-soft: junk or a version mismatch → empty. */
export function deserializeMisses(raw: string | null): MissState {
  if (!raw) return emptyMisses();
  try {
    const parsed = JSON.parse(raw) as { v?: number; tests?: Record<string, unknown> };
    if (parsed.v !== SAVED_STORAGE_VERSION) return emptyMisses();
    if (typeof parsed.tests !== 'object' || parsed.tests === null) return emptyMisses();
    const tests: Record<string, Record<string, MissEntry>> = {};
    for (const [slug, entries] of Object.entries(parsed.tests)) {
      if (typeof entries !== 'object' || entries === null || Array.isArray(entries)) continue;
      const clean: Record<string, MissEntry> = {};
      for (const [qid, entry] of Object.entries(entries as Record<string, unknown>)) {
        const e = entry as { n?: unknown; at?: unknown };
        if (typeof e?.n === 'number' && e.n > 0 && typeof e?.at === 'number') {
          clean[qid] = { n: Math.trunc(e.n), at: e.at };
        }
      }
      if (Object.keys(clean).length > 0) tests[slug] = clean;
    }
    return { tests };
  } catch {
    return emptyMisses();
  }
}

/** Record answered-wrong questions: count++ and stamp recency. Immutable. */
export function recordMisses(
  state: MissState,
  slug: string,
  missedQuestionIds: string[],
  now: number,
): MissState {
  if (missedQuestionIds.length === 0) return state;
  const bucket = { ...(state.tests[slug] ?? {}) };
  for (const qid of missedQuestionIds) {
    const prev = bucket[qid];
    bucket[qid] = { n: (prev?.n ?? 0) + 1, at: now };
  }
  return { tests: { ...state.tests, [slug]: bucket } };
}

/** Clear one test's history, or everything when no slug is given. */
export function clearMisses(state: MissState, slug?: string): MissState {
  if (slug === undefined) return emptyMisses();
  if (!(slug in state.tests)) return state;
  const tests = { ...state.tests };
  delete tests[slug];
  return { tests };
}

/**
 * Missed ids for a test, pruned against the live bank and ordered
 * most-missed first (ties: most recent first) — the drill order.
 */
export function missedIdsForTest(
  state: MissState,
  slug: string,
  liveQuestionIds: string[],
): string[] {
  const live = new Set(liveQuestionIds);
  return Object.entries(state.tests[slug] ?? {})
    .filter(([qid]) => live.has(qid))
    .sort(([, a], [, b]) => b.n - a.n || b.at - a.at)
    .map(([qid]) => qid);
}

export function missEntry(state: MissState, slug: string, questionId: string): MissEntry | null {
  return state.tests[slug]?.[questionId] ?? null;
}

export function totalMisses(state: MissState): number {
  return Object.values(state.tests).reduce((n, bucket) => n + Object.keys(bucket).length, 0);
}
