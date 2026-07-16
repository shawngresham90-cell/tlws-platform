'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { StudyRunner } from './StudyRunner';
import { BookmarkButton } from './BookmarkButton';
import { LoadingPanel } from './shared';
import { testHref } from '@/lib/tests/catalog';
import { studyStorageKey } from '@/lib/tests/study';
import {
  bookmarkedIds,
  clearMisses,
  missEntry,
  missedIdsForTest,
  type BookmarkState,
  type MissState,
  type SavedKind,
} from '@/lib/tests/saved';
import { readBookmarks, readMisses, writeMisses } from '@/lib/tests/savedStorage';
import type { RunnerTest } from './TestResults';
import type { Question } from '@/lib/tests/types';

/**
 * The saved-work browser behind /practice-tests/bookmarks and /missed
 * (Milestone 4). One component, two kinds — both group by test, drill through
 * the EXISTING StudyRunner on a filtered question set, and read everything
 * from versioned localStorage: no accounts, no server profile.
 *
 * State discipline (Milestone 4 review): this component holds only a RENDER
 * SNAPSHOT of its kind's record. Every mutation is a fresh read-modify-write
 * through savedStorage (drills and other tabs write the same keys — writing
 * a stale snapshot back would roll their updates over), and the snapshot is
 * re-read whenever a drill hands control back. Drills always start FRESH:
 * the saved set drifts between launches, so resuming a persisted drill
 * session would surface part-answered stale state.
 *
 * Accessibility: view swaps move focus (list ↔ drill ↔ empty state) so
 * keyboard/SR users are never dropped to <body> when the element they
 * activated unmounts, and row removals/clears announce via a persistent
 * polite status region.
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
  kind: SavedKind;
  banks: SavedBank[];
  turnstileSiteKey: string;
}) {
  // Only the record this page renders is held (narrowed by `kind` at every
  // use site). null = hydrating: SSR renders the placeholder.
  const [record, setRecord] = useState<BookmarkState | MissState | null>(null);
  const [drill, setDrill] = useState<{ slug: string; ids: string[] } | null>(null);
  const [announce, setAnnounce] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const drillRef = useRef<HTMLDivElement>(null);
  // Focus moves only after user interaction — never on initial hydration.
  const interacted = useRef(false);

  const refresh = () => setRecord(kind === 'bookmarks' ? readBookmarks() : readMisses());

  useEffect(() => {
    setRecord(kind === 'bookmarks' ? readBookmarks() : readMisses());
  }, [kind]);

  // Entering/leaving a drill unmounts the activated control — refocus.
  useEffect(() => {
    if (!interacted.current) return;
    (drill ? drillRef : listRef).current?.focus();
  }, [drill]);

  const focusList = () => {
    window.requestAnimationFrame(() => listRef.current?.focus());
  };

  // The saved sets, pruned against each live bank (a re-seeded bank never
  // shows ghost rows), with a per-bank id lookup for row rendering.
  const groups = useMemo(() => {
    if (!record) return [];
    return banks
      .map((bank) => {
        const liveIds = bank.questions.map((q) => q.id);
        const ids =
          kind === 'bookmarks'
            ? bookmarkedIds(record as BookmarkState, bank.test.slug, liveIds)
            : missedIdsForTest(record as MissState, bank.test.slug, liveIds);
        return { bank, ids, byId: new Map(bank.questions.map((q) => [q.id, q])) };
      })
      .filter((g) => g.ids.length > 0);
  }, [banks, record, kind]);

  const startDrill = (slug: string, ids: string[]) => {
    interacted.current = true;
    // Fresh start every launch: the previous drill's persisted session was
    // built from a different id set (bookmarks toggle, misses accrue) and
    // Study's first-answer-wins lock would freeze its stale answers.
    try {
      window.localStorage.removeItem(studyStorageKey(slug, kind));
    } catch {
      // Storage blocked — StudyRunner simply starts a new in-memory session.
    }
    setDrill({ slug, ids });
  };

  /* ── Render ────────────────────────────────────────────────────────────── */

  let body: React.ReactNode = null;

  if (!record) {
    body = <LoadingPanel>Loading your saved work…</LoadingPanel>;
  }

  /* Drill session: the existing Study runner on the selected subset, in the
     list's order (for misses that's most-missed-first — the drill order). */
  if (!body && drill) {
    const bank = banks.find((b) => b.test.slug === drill.slug);
    const byId = new Map((bank?.questions ?? []).map((q) => [q.id, q]));
    const subset = drill.ids
      .map((id) => byId.get(id))
      .filter((q): q is Question => q !== undefined);
    if (bank && subset.length > 0) {
      body = (
        <div ref={drillRef} tabIndex={-1} className="focus-visible:outline-none">
          <p className="mb-4">
            <button
              type="button"
              onClick={() => {
                interacted.current = true;
                // The drill wrote misses (and maybe bookmarks) — re-read so
                // the list reflects what just happened, not mount time.
                refresh();
                setDrill(null);
              }}
              className="inline-flex min-h-[44px] items-center rounded-card text-sm font-semibold text-muted underline-offset-2 hover:text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
            >
              ← Back to your {kind === 'bookmarks' ? 'bookmarks' : 'missed questions'}
            </button>
          </p>
          <StudyRunner
            test={bank.test}
            questions={subset}
            turnstileSiteKey={turnstileSiteKey}
            drill={kind}
          />
        </div>
      );
    }
    // Set changed underneath (e.g. everything removed) — fall through to list.
  }

  /* Empty state */
  if (!body && groups.length === 0) {
    body = (
      <div
        ref={listRef}
        tabIndex={-1}
        className="rounded-card border border-line bg-asphalt-800 p-8 focus-visible:outline-none"
      >
        <h2 className="font-display text-xl uppercase text-signal">
          {kind === 'bookmarks' ? 'No bookmarks yet' : 'No missed questions on record'}
        </h2>
        <p className="mt-3 text-muted">
          {kind === 'bookmarks'
            ? 'Bookmark any question from Study Mode feedback or a results review, and it lands here for later drilling.'
            : 'Miss a question in Study Mode or a Timed Test and it lands here, ready to practice until it sticks.'}
        </p>
        <div className="mt-6">
          <Button href={testHref('general-knowledge')}>Take the General Knowledge test</Button>
        </div>
      </div>
    );
  }

  /* Grouped list */
  if (!body) {
    body = (
      <div ref={listRef} tabIndex={-1} className="space-y-10 focus-visible:outline-none">
        {groups.map(({ bank, ids, byId }) => (
          <section key={bank.test.slug} aria-labelledby={`saved-${bank.test.slug}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2
                id={`saved-${bank.test.slug}`}
                className="font-display text-2xl uppercase text-ink"
              >
                {bank.test.title}{' '}
                <span className="text-muted">
                  ({ids.length} question{ids.length === 1 ? '' : 's'})
                </span>
              </h2>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => startDrill(bank.test.slug, ids)} className="min-h-[44px]">
                  {kind === 'bookmarks'
                    ? `Study these ${ids.length}`
                    : `Practice my misses (${ids.length})`}
                </Button>
                {kind === 'misses' && (
                  <Button
                    variant="ghost"
                    className="min-h-[44px]"
                    onClick={() => {
                      interacted.current = true;
                      // Fresh read-modify-write: NEVER serialize the mount
                      // snapshot back — drills/other tabs wrote since then.
                      const next = clearMisses(readMisses(), bank.test.slug);
                      if (writeMisses(next)) {
                        setRecord(next);
                        setAnnounce(`Missed-question history cleared for ${bank.test.title}.`);
                        focusList();
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
                const q = byId.get(qid);
                if (!q) return null;
                const correctText = q.choices.find((c) => c.key === q.correctKey)?.text;
                const entry =
                  kind === 'misses' ? missEntry(record as MissState, bank.test.slug, qid) : null;
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
                        {/* Toggling off IS the remove action — the row leaves
                            once state re-syncs from storage. */}
                        <BookmarkButton
                          slug={bank.test.slug}
                          questionId={qid}
                          context={q.prompt.slice(0, 60)}
                          onChange={() => {
                            interacted.current = true;
                            refresh();
                            setAnnounce('Removed from your bookmarks.');
                            focusList();
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

  return (
    <div>
      {/* Persistent polite region: removals and clears are announced (the
          control the user pressed unmounts, which is otherwise silent). */}
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      {body}
    </div>
  );
}
