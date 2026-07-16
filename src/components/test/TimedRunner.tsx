'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { testHref } from '@/lib/tests/catalog';
import {
  answerTimedQuestion,
  deserializeTimedSession,
  formatRemaining,
  goToTimedQuestion,
  isExpired,
  markTimedLogged,
  newTimedSession,
  remainingMs,
  serializeTimedSession,
  submitTimedSession,
  timedStorageKey,
  type TimedSession,
} from '@/lib/tests/timed';
import { TestResults, type RunnerTest } from './TestResults';
import type { Question } from '@/lib/tests/types';

/**
 * Timed Test runner — the exam simulation (Milestone 3). Same bank, same
 * grading, opposite feedback rules from Study Mode:
 *
 *   * NO correct/incorrect feedback and NO explanations during the exam —
 *     everything is revealed on the results screen (shared TestResults).
 *   * Answers may be CHANGED until submission, like the real test.
 *   * The countdown anchors on the PERSISTED start time: refreshing resumes
 *     the original clock and can never reset or extend it.
 *   * Submission fires exactly once — a persisted one-way latch guards the
 *     manual submit, the expiry auto-submit, and any refresh in between.
 *
 * The clock starts on an explicit "Begin" click (never on page load), so
 * opening the page to read the rules costs no exam time.
 *
 * Accessibility: the visible countdown is a `role="timer"`; announcements
 * fire through a polite live region only at meaningful thresholds
 * (10 min / 5 min / 1 min) — a per-second announcement would drown a screen
 * reader. Touch targets stay ≥44px; brand tokens only.
 */

type TimedTest = RunnerTest & { timeLimitSeconds: number };

/** Thresholds (ms remaining) that trigger a screen-reader announcement. */
const ANNOUNCE_AT_MS = [10 * 60_000, 5 * 60_000, 60_000];

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

  // Hydrate from localStorage after mount (SSR renders the placeholder).
  useEffect(() => {
    const ids = questions.map((q) => q.id);
    const restored = deserializeTimedSession(
      window.localStorage.getItem(timedStorageKey(test.slug)),
      test.slug,
      ids,
    );
    setSession(restored ?? 'idle');
  }, [test.slug, questions]);

  // Persist every change.
  useEffect(() => {
    if (!session || session === 'idle') return;
    try {
      window.localStorage.setItem(timedStorageKey(test.slug), serializeTimedSession(session));
    } catch {
      // Storage full/blocked — the session still works for this page view.
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
    const expiredOut = isExpired(session, test.timeLimitSeconds, session.submittedAt);
    return (
      <TestResults
        test={test}
        questions={questions}
        answers={session.answers}
        modeLabel="Timed Test"
        notice={expiredOut ? 'Time expired — your test was submitted automatically.' : undefined}
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
      onAnswer={(qid, key) =>
        setSession((s) => (s && s !== 'idle' ? answerTimedQuestion(s, qid, key) : s))
      }
      onNavigate={(index) =>
        setSession((s) => (s && s !== 'idle' ? goToTimedQuestion(s, index, questions.length) : s))
      }
      onSubmit={() => {
        setSession((s) => (s && s !== 'idle' ? submitTimedSession(s, Date.now()) : s));
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
  onAnswer,
  onNavigate,
  onSubmit,
}: {
  test: TimedTest;
  questions: Question[];
  session: TimedSession;
  onAnswer: (questionId: string, choiceKey: string) => void;
  onNavigate: (index: number) => void;
  onSubmit: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const announcedRef = useRef<Set<number>>(new Set());
  const autoSubmitted = useRef(false);

  const remaining = remainingMs(session, test.timeLimitSeconds, now);

  // 1-second tick while the exam runs.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Expiry → automatic submission, exactly once (the session latch is the
  // real guard; the ref just stops repeat calls between renders).
  useEffect(() => {
    if (remaining === 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      onSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  // Threshold announcements for screen readers (not every second).
  useEffect(() => {
    for (const at of ANNOUNCE_AT_MS) {
      if (remaining <= at && remaining > 0 && !announcedRef.current.has(at)) {
        announcedRef.current.add(at);
        setAnnouncement(`${Math.round(at / 60_000)} minute${at === 60_000 ? '' : 's'} remaining`);
      }
    }
  }, [remaining]);

  const q = questions[session.currentIndex];
  const selected = session.answers[q.id];
  const total = questions.length;
  const done = Object.keys(session.answers).length;
  const unanswered = total - done;
  const isLast = session.currentIndex === total - 1;
  const lowTime = remaining <= 5 * 60_000;

  return (
    <div>
      {/* Countdown + progress */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            Question {session.currentIndex + 1} of {total}
          </p>
          <p
            role="timer"
            aria-label="Time remaining"
            className={`font-display text-2xl tabular-nums ${lowTime ? 'text-signal' : 'text-ink'}`}
          >
            {formatRemaining(remaining)}
          </p>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-label="Questions answered"
          className="mt-2 h-1.5 w-full overflow-hidden rounded-card bg-asphalt-700"
        >
          <div
            className="h-full bg-signal transition-all"
            style={{ width: `${total === 0 ? 0 : Math.round((done / total) * 100)}%` }}
          />
        </div>
        <p className="mt-1 text-right text-xs text-muted">{done} answered</p>
        {/* Screen-reader time announcements at meaningful thresholds only. */}
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </div>

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
                onClick={() => onAnswer(q.id, choice.key)}
                className={`flex min-h-[44px] w-full items-start gap-3 rounded-card border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt ${
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
          onClick={() => onNavigate(session.currentIndex - 1)}
          disabled={session.currentIndex === 0}
          className="disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Previous
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => onNavigate(session.currentIndex + 1)}
            disabled={isLast}
            className="disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </Button>
          {confirmSubmit ? (
            <Button onClick={onSubmit}>
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
            className="font-semibold text-signal underline-offset-2 hover:underline"
          >
            Keep working
          </button>
        </p>
      )}
      <p className="mt-3 text-center text-xs text-muted">
        The clock keeps running if you leave — refreshing never resets it.
      </p>
    </div>
  );
}
