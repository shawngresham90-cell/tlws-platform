'use client';

import { useEffect, useState } from 'react';
import { isBookmarked, toggleBookmark } from '@/lib/tests/saved';
import { readBookmarks, writeBookmarks } from '@/lib/tests/savedStorage';

/**
 * Save/unsave a question for later drilling (Milestone 4). Self-contained:
 * every toggle is a FRESH read-modify-write of the versioned bookmarks record
 * (via savedStorage), so it drops into the Study feedback panel and every
 * results-review row without threading state through the runners. ≥44px touch
 * target, brand tokens only.
 *
 * Accessibility: aria-pressed carries the saved state and the accessible name
 * stays CONSTANT (aria-label) — dozens of these render on a results page, so
 * `context` disambiguates which question each one toggles, and the visible
 * Bookmark/Bookmarked swap never mutates the announced name.
 */
export function BookmarkButton({
  slug,
  questionId,
  context,
  onChange,
}: {
  slug: string;
  questionId: string;
  /** Accessible-name context, e.g. "question 12" — for pages with many buttons. */
  context?: string;
  /** Optional: lets list views (the bookmarks page) react to removal. */
  onChange?: () => void;
}) {
  // SSR renders unsaved; the real state hydrates after mount.
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setSaved(isBookmarked(readBookmarks(), slug, questionId));
  }, [slug, questionId]);

  const toggle = () => {
    const next = toggleBookmark(readBookmarks(), slug, questionId);
    // Blocked storage: don't flip the UI to a state that didn't persist.
    if (!writeBookmarks(next)) return;
    setSaved(isBookmarked(next, slug, questionId));
    onChange?.();
  };

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={context ? `Bookmark ${context}` : 'Bookmark this question'}
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
