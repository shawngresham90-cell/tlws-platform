'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { StudyRunner } from './StudyRunner';
import { BookmarkButton } from './BookmarkButton';
import {
  BOOKMARKS_STORAGE_KEY,
  MISSES_STORAGE_KEY,
  bookmarkedIds,
  clearMisses,
  deserializeBookmarks,
  deserializeMisses,
  missEntry,
  missedIdsForTest,
  serializeMisses,
  type BookmarkState,
  type MissState,
} from '@/lib/tests/saved';
import type { RunnerTest } from './TestResults';
import type { Question } from '@/lib/tests/types';

/**
 * The saved-work browser behind /practice-tests/bookmarks and /missed
 * (Milestone 4). One component, two kinds — both group by test, drill through
 * the EXISTING StudyRunner on a filtered question set (its own storage
 * variant, never the attempt log), and read everything from versioned
 * localStorage: no accounts, no server profile, device-local by design.
 */

export type SavedBank = {
  test: RunnerTest;
  questions: Question[];
};

export function SavedBrowser({
  kind,
  banks,
  turnstileSiteKey,
}: {
  kind: 'bookmarks' | 'misses';
  banks: SavedBank[];
  turnstileSiteKey: string;
}) {
  // null = hydrating (SSR renders the placeholder).
  const [bookmarks, setBookmarks] = useState<BookmarkState | null>(null);
  const [misses, setMisses] = useState<MissState | null>(null);
  const [drill, setDrill] = useState<{ slug: string; ids: string[] } | null>(null);

  useEffect(() => {
    try {
      setBookmarks(deserializeBookmarks(window.localStorage.getItem(BOOKMARKS_STORAGE_KEY)));
      setMisses(deserializeMisses(window.localStorage.getItem(MISSES_STORAGE_KEY)));
    } catch {
      setBookmarks({ tests: {} });
      setMisses({ tests: {} });
    }
  }, []);

  // The saved sets, pruned against each live bank.
  const groups = useMemo(() => {
    if (!bookmarks || !misses) return [];
    return banks
      .map((bank) => {
        const liveIds = bank.questions.map((q) => q.id);
        const ids =
          kind === 'bookmarks'
            ? bookmarkedIds(bookmarks, bank.test.slug, liveIds)
            : missedIdsForTest(misses, bank.test.slug, liveIds);
        return { bank, ids };
      })
      .filter((g) => g.ids.length > 0);
  }, [banks, bookmarks, misses, kind]);

  if (!bookmarks || !misses) {
    return (
      <div className="rounded-card border border-line bg-asphalt-800 p-8 text-muted" role="status">
        Loading your saved work…
      </div>
    );
  }

  /* ── Drill session: the existing Study runner on the selected subset ── */
  if (drill) {
    const bank = banks.find((b) => b.test.slug === drill.slug);
    const subset = bank ? bank.questions.filter((q) => drill.ids.includes(q.id)) : [];
    if (bank && subset.length > 0) {
      return (
        <div>
          <p className="mb-4">
            <button
              type="button"
              onClick={() => setDrill(null)}
              className="rounded-card text-sm font-semibold text-muted underline-offset-2 hover:text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
            >
              ← Back to your {kind === 'bookmarks' ? 'bookmarks' : 'missed questions'}
            </button>
          </p>
          <StudyRunner
            test={bank.test}
            questions={subset}
            turnstileSiteKey={turnstileSiteKey}
            variant={kind}
            logAttempt={false}
          />
        </div>
      );
    }
    // Set changed underneath (e.g. everything removed) — fall through to list.
  }

  /* ── Empty state ── */
  if (groups.length === 0) {
    return (
      <div className="rounded-card border border-line bg-asphalt-800 p-8">
        <h2 className="font-display text-xl uppercase text-signal">
          {kind === 'bookmarks' ? 'No bookmarks yet' : 'No missed questions on record'}
        </h2>
        <p className="mt-3 text-muted">
          {kind === 'bookmarks'
            ? 'Bookmark any question from Study Mode feedback or a results review, and it lands here for later drilling.'
            : 'Miss a question in Study Mode or a Timed Test and it lands here, ready to practice until it sticks.'}
        </p>
        <div className="mt-6">
          <Button href="/practice-tests/general-knowledge">Take the General Knowledge test</Button>
        </div>
      </div>
    );
  }

  /* ── Grouped list ── */
  return (
    <div className="space-y-10">
      {groups.map(({ bank, ids }) => (
        <section key={bank.test.slug} aria-labelledby={`saved-${bank.test.slug}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={`saved-${bank.test.slug}`} className="font-display text-2xl uppercase text-ink">
              {bank.test.title}{' '}
              <span className="text-muted">
                ({ids.length} question{ids.length === 1 ? '' : 's'})
              </span>
            </h2>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => setDrill({ slug: bank.test.slug, ids })}
                className="min-h-[44px]"
              >
                {kind === 'bookmarks'
                  ? `Study these ${ids.length}`
                  : `Practice my misses (${ids.length})`}
              </Button>
              {kind === 'misses' && (
                <Button
                  variant="ghost"
                  className="min-h-[44px]"
                  onClick={() => {
                    try {
                      const next = clearMisses(misses, bank.test.slug);
                      window.localStorage.setItem(MISSES_STORAGE_KEY, serializeMisses(next));
                      setMisses(next);
                    } catch {
                      // storage blocked
                    }
                  }}
                >
                  Clear this history
                </Button>
              )}
            </div>
          </div>

          <ol className="mt-4 space-y-4">
            {ids.map((qid) => {
              const q = bank.questions.find((x) => x.id === qid);
              if (!q) return null;
              const correctText = q.choices.find((c) => c.key === q.correctKey)?.text;
              const entry = kind === 'misses' ? missEntry(misses, bank.test.slug, qid) : null;
              return (
                <li key={qid} className="rounded-card border border-line bg-asphalt-800 p-5">
                  <p className="text-sm font-semibold text-ink">{q.prompt}</p>
                  {entry && (
                    <p className="mt-1 text-xs uppercase tracking-wide text-muted">
                      Missed {entry.n}× · last on {new Date(entry.at).toLocaleDateString()}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-signal">
                    Answer: {q.correctKey.toUpperCase()}. {correctText ?? ''}
                  </p>
                  {q.explanation && <p className="mt-2 text-sm text-muted">{q.explanation}</p>}
                  {q.cfrCite && (
                    <p className="mt-2 text-xs uppercase tracking-wide text-muted">
                      Source: <span className="text-ink">{q.cfrCite}</span>
                    </p>
                  )}
                  {kind === 'bookmarks' && (
                    <div className="mt-3">
                      {/* Toggling off IS the remove action; the row leaves on refresh of state. */}
                      <BookmarkButton
                        slug={bank.test.slug}
                        questionId={qid}
                        onChange={() => {
                          try {
                            setBookmarks(
                              deserializeBookmarks(
                                window.localStorage.getItem(BOOKMARKS_STORAGE_KEY),
                              ),
                            );
                          } catch {
                            // storage blocked
                          }
                        }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      <p className="text-sm text-muted">
        Saved on this device only — no account needed.{' '}
        <Link
          href={kind === 'bookmarks' ? '/practice-tests/missed' : '/practice-tests/bookmarks'}
          className="font-semibold text-signal hover:underline"
        >
          {kind === 'bookmarks' ? 'See your missed questions →' : 'See your bookmarks →'}
        </Link>
      </p>
    </div>
  );
}
