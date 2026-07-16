'use client';

import { useEffect, useState } from 'react';
import {
  BOOKMARKS_STORAGE_KEY,
  deserializeBookmarks,
  isBookmarked,
  serializeBookmarks,
  toggleBookmark,
} from '@/lib/tests/saved';

/**
 * Save/unsave a question for later drilling (Milestone 4). Self-contained:
 * reads and writes the versioned bookmarks record in localStorage directly,
 * so it drops into the Study feedback panel and every results-review row
 * without threading state through the runners. ≥44px touch target,
 * aria-pressed toggle semantics, brand tokens only.
 */
export function BookmarkButton({
  slug,
  questionId,
  onChange,
}: {
  slug: string;
  questionId: string;
  /** Optional: lets list views (the bookmarks page) react to removal. */
  onChange?: (bookmarked: boolean) => void;
}) {
  // SSR renders unsaved; the real state hydrates after mount.
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setSaved(
      isBookmarked(
        deserializeBookmarks(window.localStorage.getItem(BOOKMARKS_STORAGE_KEY)),
        slug,
        questionId,
      ),
    );
  }, [slug, questionId]);

  const toggle = () => {
    try {
      const state = deserializeBookmarks(window.localStorage.getItem(BOOKMARKS_STORAGE_KEY));
      const next = toggleBookmark(state, slug, questionId);
      window.localStorage.setItem(BOOKMARKS_STORAGE_KEY, serializeBookmarks(next));
      const nowSaved = isBookmarked(next, slug, questionId);
      setSaved(nowSaved);
      onChange?.(nowSaved);
    } catch {
      // Storage blocked — the button simply can't persist; never crash the quiz.
    }
  };

  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={toggle}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-card border px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt ${
        saved
          ? 'border-signal bg-signal/10 text-signal'
          : 'border-line text-muted hover:border-signal hover:text-signal'
      }`}
    >
      <span aria-hidden="true">{saved ? '★' : '☆'}</span>
      {saved ? 'Bookmarked' : 'Bookmark'}
    </button>
  );
}
