import {
  BOOKMARKS_STORAGE_KEY,
  MISSES_STORAGE_KEY,
  deserializeBookmarks,
  deserializeMisses,
  emptyBookmarks,
  emptyMisses,
  recordMisses,
  serializeBookmarks,
  serializeMisses,
  type BookmarkState,
  type MissState,
} from './saved';

/**
 * The browser side of the saved-state lib (Milestone 4 review): every reader
 * and writer of the bookmark/miss localStorage records goes through here, so
 * the two rules that keep concurrent writers consistent live in ONE place:
 *
 *   1. Always read-modify-write against a FRESH read — never against a React
 *      state snapshot (a drill, another component, or another tab may have
 *      written since mount; serializing a stale snapshot silently rolls their
 *      writes back).
 *   2. Fail soft — a blocked or full store must never throw into a quiz.
 *
 * saved.ts stays pure (no DOM) so it remains unit-testable in Node.
 */

/** Fresh parse of the bookmarks record. Blocked storage → empty. */
export function readBookmarks(): BookmarkState {
  try {
    return deserializeBookmarks(window.localStorage.getItem(BOOKMARKS_STORAGE_KEY));
  } catch {
    return emptyBookmarks();
  }
}

/** Persist bookmarks. Returns false (never throws) when storage is blocked. */
export function writeBookmarks(state: BookmarkState): boolean {
  try {
    window.localStorage.setItem(BOOKMARKS_STORAGE_KEY, serializeBookmarks(state));
    return true;
  } catch {
    return false;
  }
}

/** Fresh parse of the misses record. Blocked storage → empty. */
export function readMisses(): MissState {
  try {
    return deserializeMisses(window.localStorage.getItem(MISSES_STORAGE_KEY));
  } catch {
    return emptyMisses();
  }
}

/** Persist misses. Returns false (never throws) when storage is blocked. */
export function writeMisses(state: MissState): boolean {
  try {
    window.localStorage.setItem(MISSES_STORAGE_KEY, serializeMisses(state));
    return true;
  } catch {
    return false;
  }
}

/**
 * Record answered-wrong questions with a fresh read-modify-write — the one
 * miss write-through both runners share.
 */
export function recordMissesToStorage(slug: string, questionIds: string[], now: number): void {
  if (questionIds.length === 0) return;
  writeMisses(recordMisses(readMisses(), slug, questionIds, now));
}
