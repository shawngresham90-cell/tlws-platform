'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { testHref } from '@/lib/tests/catalog';
import {
  answerTimedQuestion,
  deserializeTimedSession,
  elapsedSeconds,
  formatRemaining,
  goToTimedQuestion,
  markTimedLogged,
  newTimedSession,
  remainingMs,
  serializeTimedSession,
  submitTimedSession,
  timedStorageKey,
  type TimedSession,
} from '@/lib/tests/timed';
import { TestResults, type RunnerTest } from './TestResults';
import { CHOICE_BUTTON_BASE, QuizProgress } from './shared';
import type { Question } from '@/lib/tests/types';

/**
 * Timed Test runner — the exam simulation (Milestone 3). Same bank, same
 * grading, opposite feedback rules from Study Mode:
 *
 *   * NO correct/incorrect feedback and NO explanations during the exam —
 *     everything is revealed on the results screen (shared TestResults).
 *   * Answers may be CHANGED until submission, like the real test.
 *   * The countdown anchors on the PERSISTED start time: refreshing resumes
 *     the original clock and can never reset or extend it (future anchors
 *     are clamped on restore).
 *   * Submission fires exactly once — a persisted one-way latch records the
 *     moment AND the reason ('manual' | 'expired'), so the results screen
 *     never misattributes why the exam ended.
 *
 * The clock starts on an explicit "Begin" click (never on page load), so
 * opening the page to read the rules costs no exam time.
 *
 * Accessibility: the visible countdown is a `role="timer"` (deliberately NOT
 * aria-live — a per-second announcement would drown a screen reader);
 * threshold announcements (10/5/1 min) derive purely from the remaining time
 * against a mount-time baseline, so resuming below a threshold never replays
 * an overstated one. Low time gains a visible text label, not just a color
 * shift. Arming "Submit test" disarms on any navigation or answer change.
 */

type TimedTest = RunnerTest & { timeLimitSeconds: number };

/** Thresholds (ms remaining) that trigger a screen-reader announcement. */
const ANNOUNCE_AT_MS = [10 * 60_000, 5 * 60_000, 60_000];

/** The active announcement threshold for a remaining time (smallest match). */
function activeThreshold(remaining: number): number | null {
  if (remaining <= 0) return null;
  const matches = ANNOUNCE_AT_MS.filter((at) => remaining <= at);
  return matches.length > 0 ? Math.min(...matches) : null;
}

export function TimedRunner({
  test,
  questions,
  turnstileSiteKey,
}: {
  test: TimedTest;
  questions: Question[];
  turnstileSiteKey: string;
}) {
  // null = hydrating; 'idle' = start gate (no session yet); TimedSession = live.
  const [session, setSession] = useState<TimedSession | null | 'idle'>(null);
  // Copy honesty: when storage is blocked we cannot promise refresh-proofing.
  const [persistBlocked, setPersistBlocked] = useState(false);
  const hydrated = useRef(false);

  // Hydrate from localStorage after mount (SSR renders the placeholder).
  // Once-only: an RSC refresh must never re-run this over a live exam whose
  // storage writes are failing (that would silently reset it to the gate).
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const ids = questions.map((q) => q.id);
    const restored = deserializeTimedSession(
      window.localStorage.getItem(timedStorageKey(test.slug)),
      test.slug,
      ids,
      Date.now(),
    );
    setSession(restored ?? 'idle');
  }, [test.slug, questions]);

  // Persist every change; surface (don't swallow) a blocked store so the UI
  // can stop promising refresh-safety it cannot deliver.
  useEffect(() => {
    if (!session || session === 'idle') return;
    try {
      window.localStorage.setItem(timedStorageKey(test.slug), serializeTimedSession(session));
    } catch {
      setPersistBlocked(true);
    }
  }, [session, test.slug]);

  if (session === null) {
    return (
      <div className="rounded-card border border-line bg-asphalt-800 p-8 text-muted" role="status">
        Loading…
      </div>
    );
  }

  const restart = () => {
    try {
      window.localStorage.removeItem(timedStorageKey(test.slug));
    } catch {
      // ignore
    }
    setSession('idle');
    window.scrollTo({ top: 0 });
  };

  if (session === 'idle') {
    return (
      <TimedStartGate
        test={test}
        questionCount={questions.length}
        onBegin={() => setSession(newTimedSession(test.slug, Date.now()))}
      />
    );
  }

  if (session.submittedAt !== undefined) {
    return (
      <TestResults
        test={test}
        questions={questions}
        answers={session.answers}
        modeLabel="Timed Test"
        mode="timed"
        elapsed={elapsedSeconds(session, session.submittedAt)}
        notice={
          session.submittedReason === 'expired'
            ? 'Time expired — your test was submitted automatically.'
            : undefined
        }
        alreadyLogged={session.loggedAt !== undefined}
        onLogged={() => setSession((s) => (s && s !== 'idle' ? markTimedLogged(s, Date.now()) : s))}
        onRetake={restart}
        turnstileSiteKey={turnstileSiteKey}
      />
    );
  }

  return (
    <TimedExam
      test={test}
      questions={questions}
      session={session}
      persistBlocked={persistBlocked}
      onAnswer={(qid, key) =>
        setSession((s) => (s && s !== 'idle' ? answerTimedQuestion(s, qid, key) : s))
      }
      onNavigate={(index) => {
        setSession((s) => (s && s !== 'idle' ? goToTimedQuestion(s, index, questions.length) : s));
        window.scrollTo({ top: 0 });
      }}
      onSubmit={(reason) => {
        setSession((s) => (s && s !== 'idle' ? submitTimedSession(s, Date.now(), reason) : s));
        window.scrollTo({ top: 0 });
      }}
    />
  );
}

/* ── Start gate — the clock starts on the click, never on page load ─────── */

function TimedStartGate({
  test,
  questionCount,
  onBegin,
}: {
  test: TimedTest;
  questionCount: number;
  onBegin: () => void;
}) {
  const minutes = Math.round(test.timeLimitSeconds / 60);
  return (
    <div className="rounded-card border border-line bg-asphalt-800 p-8">
      <h2 className="font-display text-2xl uppercase text-signal">Exam conditions</h2>
      <ul className="mt-4 space-y-2 text-sm text-muted">
        <li>
          · {questionCount} questions · <span className="text-ink">{minutes} minutes</span> ·{' '}
          {test.passThresholdPct}% to pass
        </li>
        <li>· No feedback and no explanations until you submit — just like the real exam.</li>
        <li>· You can move back and forth and change answers until you submit.</li>
        <li>· The clock keeps running if you refresh or leave — it starts once.</li>
        <li>· When time runs out, the test submits itself automatically.</li>
      </ul>
      <div className="mt-6">
        <Button onClick={onBegin}>Begin timed test</Button>
      </div>
      <p className="mt-4 text-sm">
        <Link href={testHref(test.slug)} className="text-muted hover:text-signal">
          ← Not ready? Back to {test.title}
        </Link>
      </p>
    </div>
  );
}

/* ── Exam view — countdown, no feedback, change answers freely ──────────── */

function TimedExam({
  test,
  questions,
  session,
  persistBlocked,
  onAnswer,
  onNavigate,
  onSubmit,
}: {
  test: TimedTest;
  questions: Question[];
  session: TimedSession;
  persistBlocked: boolean;
  onAnswer: (questionId: string, choiceKey: string) => void;
  onNavigate: (index: number) => void;
  onSubmit: (reason: 'manual' | 'expired') => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const remaining = remainingMs(session, test.timeLimitSeconds, now);
  const expired = remaining === 0;

  // Announcements derive purely from remaining time. The mount-time baseline
  // means resuming with 3:50 left never replays the stale "5 minutes" —
  // only thresholds crossed AFTER resume are announced.
  const baselineThreshold = useRef<number | null | undefined>(undefined);
  if (baselineThreshold.current === undefined) {
    baselineThreshold.current = activeThreshold(remaining);
  }
  const threshold = activeThreshold(remaining);
  const announcement =
    threshold !== null && threshold !== baselineThreshold.current && !expired
      ? `${Math.round(threshold / 60_000)} minute${threshold === 60_000 ? '' : 's'} remaining`
      : '';

  // 1-second tick while the exam runs (cleaned up when this view unmounts).
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Expiry → automatic submission. Fires once on the false→true transition;
  // the session's one-way latch makes any repeat a no-op regardless.
  useEffect(() => {
    if (expired) onSubmit('expired');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  const q = questions[session.currentIndex];
  const selected = session.answers[q.id];
  const total = questions.length;
  const done = Object.keys(session.answers).length;
  const unanswered = total - done;
  const isLast = session.currentIndex === total - 1;
  const lowTime = remaining <= 5 * 60_000;

  // Any interaction other than confirming disarms an armed submit.
  const navigate = (index: number) => {
    setConfirmSubmit(false);
    onNavigate(index);
  };
  const answer = (qid: string, key: string) => {
    setConfirmSubmit(false);
    onAnswer(qid, key);
  };

  return (
    <div>
      <QuizProgress
        currentIndex={session.currentIndex}
        total={total}
        answered={done}
        right={
          <p role="timer" aria-label="Time remaining" className="text-right">
            {lowTime && (
              <span className="mr-2 align-middle text-xs font-semibold uppercase tracking-wide text-signal">
                Low time
              </span>
            )}
            <span
              className={`font-display text-2xl tabular-nums ${lowTime ? 'text-signal' : 'text-ink'}`}
            >
              {formatRemaining(remaining)}
            </span>
          </p>
        }
      />
      {/* Screen-reader time announcements at crossed thresholds only. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* Question — NO feedback, NO explanation until submission */}
      <div className="rounded-card border border-line bg-asphalt-800 p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-ink sm:text-xl">{q.prompt}</h2>
        {q.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={q.imageUrl} alt="Question diagram" className="mt-4 max-w-full rounded-card" />
        )}

        <div className="mt-6 flex flex-col gap-3">
          {q.choices.map((choice) => {
            const isSelected = selected === choice.key;
            return (
              <button
                key={choice.key}
                type="button"
                aria-pressed={isSelected}
                onClick={() => answer(q.id, choice.key)}
                className={`${CHOICE_BUTTON_BASE} ${
                  isSelected
                    ? 'border-signal bg-signal/10 text-signal'
                    : 'border-line bg-asphalt text-ink hover:border-signal'
                }`}
              >
                <span className="font-display uppercase" aria-hidden="true">
                  {choice.key}.
                </span>
                <span className="flex-1">{choice.text}</span>
                {isSelected && (
                  <>
                    <span aria-hidden="true">●</span>
                    <span className="sr-only">(selected)</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted">
          You can change this answer any time before you submit.
        </p>
      </div>

      {/* Navigation + submit */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => navigate(session.currentIndex - 1)}
          disabled={session.currentIndex === 0}
          className="disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Previous
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate(session.currentIndex + 1)}
            disabled={isLast}
            className="disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </Button>
          {confirmSubmit ? (
            <Button onClick={() => onSubmit('manual')}>
              {unanswered > 0 ? `Submit with ${unanswered} unanswered` : 'Confirm submit'}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setConfirmSubmit(true)}>
              Submit test
            </Button>
          )}
        </div>
      </div>
      {confirmSubmit && (
        <p role="status" className="mt-3 text-right text-sm text-muted">
          {unanswered > 0
            ? `${unanswered} question${unanswered === 1 ? '' : 's'} still unanswered — unanswered counts as incorrect.`
            : 'All questions answered.'}{' '}
          <button
            type="button"
            onClick={() => setConfirmSubmit(false)}
            className="rounded-card font-semibold text-signal underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
          >
            Keep working
          </button>
        </p>
      )}
      <p className="mt-3 text-center text-xs text-muted">
        {persistBlocked
          ? 'Heads up: this browser is blocking storage, so progress can’t be saved — don’t refresh or leave until you submit.'
          : 'The clock keeps running if you leave — refreshing never resets it.'}
      </p>
    </div>
  );
}
