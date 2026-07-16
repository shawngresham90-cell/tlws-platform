'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { TextField } from '@/components/apply/Fields';
import { TurnstileWidget } from '@/components/apply/TurnstileWidget';
import { trackEvent } from '@/lib/analytics';
import { gradeAttempt } from '@/lib/tests/scoring';
import { testHref } from '@/lib/tests/catalog';
import {
  answerQuestion,
  answeredCount,
  deserializeSession,
  goToQuestion,
  isComplete,
  markLogged,
  newSession,
  serializeSession,
  studyStorageKey,
  type StudySession,
} from '@/lib/tests/study';
import { PRESCHOOL_PATH, PRESCHOOL_PRICE_LABEL } from '@/lib/preschool/constants';
import type { Question } from '@/lib/tests/types';

/**
 * Study Mode runner — one question at a time with IMMEDIATE feedback: the
 * moment the student answers, the correct choice, a plain-English explanation,
 * and the 49 CFR / CDL-manual citation are revealed (the finalized answer-key
 * decision: education over bank protection). First answer per question is
 * final so a miss stays an honest miss.
 *
 * State lives in localStorage (per test slug) so a refresh or a lost signal
 * resumes exactly where the student left off. All session logic is pure
 * (src/lib/tests/study.ts) — this component only owns DOM concerns. The
 * completed attempt is logged to the API exactly once per sitting
 * (session.loggedAt guards it across refreshes and results re-entry).
 *
 * Accessibility: answered choices stay focusable (aria-disabled, not
 * disabled) so keyboard focus is never dropped; per-choice correctness
 * carries screen-reader text, not just color; feedback announces via a
 * polite live region; red state uses border/background with readable ink
 * text (diesel-as-text fails contrast on the dark theme).
 */

type RunnerTest = {
  slug: string;
  title: string;
  passThresholdPct: number;
};

export function StudyRunner({
  test,
  questions,
  turnstileSiteKey,
}: {
  test: RunnerTest;
  questions: Question[];
  turnstileSiteKey: string;
}) {
  const [session, setSession] = useState<StudySession | null>(null);
  const [view, setView] = useState<'quiz' | 'results'>('quiz');

  // Hydrate from localStorage after mount (SSR renders the placeholder).
  useEffect(() => {
    const ids = questions.map((q) => q.id);
    const restored = deserializeSession(
      window.localStorage.getItem(studyStorageKey(test.slug)),
      test.slug,
      ids,
    );
    setSession(restored ?? newSession(test.slug, Date.now()));
  }, [test.slug, questions]);

  // Persist every change.
  useEffect(() => {
    if (!session) return;
    try {
      window.localStorage.setItem(studyStorageKey(test.slug), serializeSession(session));
    } catch {
      // Storage full/blocked — the session still works for this page view.
    }
  }, [session, test.slug]);

  if (!session) {
    return (
      <div className="rounded-card border border-line bg-asphalt-800 p-8 text-muted" role="status">
        Loading your session…
      </div>
    );
  }

  const restart = () => {
    try {
      window.localStorage.removeItem(studyStorageKey(test.slug));
    } catch {
      // ignore
    }
    setSession(newSession(test.slug, Date.now()));
    setView('quiz');
    window.scrollTo({ top: 0 });
  };

  if (view === 'results') {
    return (
      <StudyResults
        test={test}
        questions={questions}
        session={session}
        turnstileSiteKey={turnstileSiteKey}
        onRetake={restart}
        onLogged={() => setSession((s) => (s ? markLogged(s, Date.now()) : s))}
      />
    );
  }

  return (
    <StudyQuestion
      test={test}
      questions={questions}
      session={session}
      onAnswer={(qid, key) => setSession((s) => (s ? answerQuestion(s, qid, key, Date.now()) : s))}
      onNavigate={(index) => {
        setSession((s) => (s ? goToQuestion(s, index, questions.length) : s));
        window.scrollTo({ top: 0 });
      }}
      onFinish={() => {
        setView('results');
        window.scrollTo({ top: 0 });
      }}
    />
  );
}

/* ── Quiz view ─────────────────────────────────────────────────────────── */

function StudyQuestion({
  test,
  questions,
  session,
  onAnswer,
  onNavigate,
  onFinish,
}: {
  test: RunnerTest;
  questions: Question[];
  session: StudySession;
  onAnswer: (questionId: string, choiceKey: string) => void;
  onNavigate: (index: number) => void;
  onFinish: () => void;
}) {
  const q = questions[session.currentIndex];
  const selected = session.answers[q.id];
  const answered = selected !== undefined;
  const isCorrect = answered && selected === q.correctKey;
  const total = questions.length;
  const done = answeredCount(
    session,
    questions.map((x) => x.id),
  );
  const allAnswered = isComplete(
    session,
    questions.map((x) => x.id),
  );
  const isLast = session.currentIndex === total - 1;

  return (
    <div>
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between gap-4 text-sm text-muted">
          <p className="font-semibold uppercase tracking-wide">
            Question {session.currentIndex + 1} of {total}
          </p>
          <p>{done} answered</p>
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
      </div>

      {/* Question */}
      <div className="rounded-card border border-line bg-asphalt-800 p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-ink sm:text-xl">{q.prompt}</h2>
        {q.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={q.imageUrl} alt="Question diagram" className="mt-4 max-w-full rounded-card" />
        )}

        <div className="mt-6 flex flex-col gap-3">
          {q.choices.map((choice) => {
            const isSelected = selected === choice.key;
            const isAnswerKey = choice.key === q.correctKey;
            let styles = 'border-line bg-asphalt text-ink hover:border-signal';
            if (answered) {
              if (isAnswerKey) styles = 'border-signal bg-signal/10 text-signal';
              else if (isSelected) styles = 'border-diesel bg-diesel/10 text-ink';
              else styles = 'border-line bg-asphalt text-muted';
            }
            return (
              // aria-disabled (not disabled) keeps answered choices focusable,
              // so keyboard focus is never dropped mid-quiz and the review
              // remains tabbable; the click handler enforces answer-once.
              <button
                key={choice.key}
                type="button"
                aria-disabled={answered}
                onClick={() => {
                  if (!answered) onAnswer(q.id, choice.key);
                }}
                className={`flex min-h-[44px] w-full items-start gap-3 rounded-card border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt ${answered ? 'cursor-default' : ''} ${styles}`}
              >
                <span className="font-display uppercase" aria-hidden="true">
                  {choice.key}.
                </span>
                <span className="flex-1">{choice.text}</span>
                {answered && isAnswerKey && (
                  <>
                    <span aria-hidden="true">✓</span>
                    <span className="sr-only">(correct answer)</span>
                  </>
                )}
                {answered && isSelected && !isAnswerKey && (
                  <>
                    <span aria-hidden="true">✗</span>
                    <span className="sr-only">(your answer — incorrect)</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Immediate feedback — answer, explanation, citation */}
        <div aria-live="polite">
          {answered && (
            <div
              className={`mt-6 rounded-card border p-5 ${
                isCorrect ? 'border-signal/50 bg-signal/5' : 'border-diesel bg-diesel/10'
              }`}
            >
              <p
                className={`font-display text-lg uppercase ${isCorrect ? 'text-signal' : 'text-ink'}`}
              >
                {isCorrect ? 'Correct' : `Not quite — the answer is ${q.correctKey.toUpperCase()}`}
              </p>
              {q.explanation && <p className="mt-2 text-sm text-ink">{q.explanation}</p>}
              {q.cfrCite && (
                <p className="mt-3 text-xs uppercase tracking-wide text-muted">
                  Source: <span className="text-ink">{q.cfrCite}</span>
                  {q.verifiedDate && <> · verified {q.verifiedDate}</>}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation — thumb-reachable; Next never disappears (review-in-place). */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => onNavigate(session.currentIndex - 1)}
          disabled={session.currentIndex === 0}
          className="disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Previous
        </Button>
        <div className="flex flex-wrap gap-3">
          <Button
            variant={answered && !allAnswered ? 'primary' : 'ghost'}
            onClick={() => onNavigate(session.currentIndex + 1)}
            disabled={isLast}
            className="disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </Button>
          {allAnswered && <Button onClick={onFinish}>See results</Button>}
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        Progress saves automatically on this device — leave and pick up where you stopped.
      </p>
      <p className="mt-6 text-center text-sm">
        <Link href={testHref(test.slug)} className="text-muted hover:text-signal">
          ← Back to {test.title} overview
        </Link>
      </p>
    </div>
  );
}

/* ── Results view ──────────────────────────────────────────────────────── */

function StudyResults({
  test,
  questions,
  session,
  turnstileSiteKey,
  onRetake,
  onLogged,
}: {
  test: RunnerTest;
  questions: Question[];
  session: StudySession;
  turnstileSiteKey: string;
  onRetake: () => void;
  onLogged: () => void;
}) {
  const result = gradeAttempt(questions, session.answers, test.passThresholdPct);
  const posting = useRef(false);

  // Log the attempt exactly once per sitting: session.loggedAt (persisted)
  // guards refreshes and results re-entry; the ref guards double-effects.
  const alreadyLogged = session.loggedAt !== undefined;
  useEffect(() => {
    if (alreadyLogged || posting.current) return;
    posting.current = true;
    trackEvent('practice_test_completed', {
      test: test.slug,
      scorePct: result.scorePct,
      passed: result.passed,
    });
    fetch('/api/tests/attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test_slug: test.slug, answers: session.answers }),
    })
      .then((res) => {
        if (res.ok) onLogged();
        else posting.current = false;
      })
      .catch(() => {
        // Analytics only — never disturb the student over it.
        posting.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alreadyLogged]);

  return (
    <div>
      {/* Score */}
      <div
        className={`rounded-card border p-8 text-center sm:p-10 ${
          result.passed ? 'border-signal/60 bg-signal/5' : 'border-diesel bg-diesel/10'
        }`}
      >
        <p className="eyebrow">{test.title} — Study Mode results</p>
        <p
          className={`mt-2 font-display text-6xl uppercase ${result.passed ? 'text-signal' : 'text-ink'}`}
        >
          {result.scorePct}%
        </p>
        <p className="mt-2 font-display text-2xl uppercase text-ink">
          {result.passed ? 'Pass' : 'Keep studying'}
        </p>
        <p className="mt-3 text-muted">
          {result.correct} of {result.total} correct · {test.passThresholdPct}% needed to pass the
          real exam
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={onRetake}>Retake the test</Button>
          <Button variant="ghost" href={testHref(test.slug)}>
            Test overview
          </Button>
        </div>
      </div>

      {/* Email results */}
      <EmailResults test={test} turnstileSiteKey={turnstileSiteKey} />

      {/* Next-step CTAs */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-line bg-asphalt-800 p-6">
          <h2 className="font-display text-lg uppercase text-signal">
            {result.passed ? 'Ready for the real thing?' : 'Want hands-on help?'}
          </h2>
          <p className="mt-2 text-sm text-muted">
            Trucking Life Academy trains CDL-A drivers in Dalton, GA — off I-75. Drivers helping
            drivers.
          </p>
          <div className="mt-4">
            <Button href="/academy/apply">Apply to the Academy</Button>
          </div>
        </div>
        <div className="rounded-card border border-line bg-asphalt-800 p-6">
          <h2 className="font-display text-lg uppercase text-signal">Still before the permit?</h2>
          <p className="mt-2 text-sm text-muted">
            CDL Pre-School walks you from zero to permit-ready — the full course for{' '}
            {PRESCHOOL_PRICE_LABEL}.
          </p>
          <div className="mt-4">
            <Button variant="ghost" href={PRESCHOOL_PATH}>
              See CDL Pre-School
            </Button>
          </div>
        </div>
      </div>

      {/* Full review */}
      <h2 className="mt-10 font-display text-2xl uppercase text-ink">Review every question</h2>
      <ol className="mt-4 space-y-4">
        {questions.map((q, i) => {
          const selected = session.answers[q.id];
          const correct = selected === q.correctKey;
          const selectedText = q.choices.find((c) => c.key === selected)?.text;
          const correctText = q.choices.find((c) => c.key === q.correctKey)?.text;
          return (
            <li key={q.id} className="rounded-card border border-line bg-asphalt-800 p-5">
              <p className="text-sm font-semibold text-ink">
                {i + 1}. {q.prompt}
              </p>
              <p className={`mt-2 text-sm ${correct ? 'text-signal' : 'text-ink'}`}>
                <span aria-hidden="true">{correct ? '✓' : '✗'}</span>
                <span className="sr-only">{correct ? 'Correct.' : 'Incorrect.'}</span> Your answer:{' '}
                {selected ? `${selected.toUpperCase()}. ${selectedText ?? ''}` : 'Not answered'}
              </p>
              {!correct && (
                <p className="mt-1 text-sm text-signal">
                  Correct: {q.correctKey.toUpperCase()}. {correctText ?? ''}
                </p>
              )}
              {q.explanation && <p className="mt-2 text-sm text-muted">{q.explanation}</p>}
              {q.cfrCite && (
                <p className="mt-2 text-xs uppercase tracking-wide text-muted">
                  Source: <span className="text-ink">{q.cfrCite}</span>
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ── Optional email capture (email-only save — never re-logs the attempt) ─ */

function EmailResults({ test, turnstileSiteKey }: { test: RunnerTest; turnstileSiteKey: string }) {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  // Remounting the widget (key bump) forces a FRESH token — Turnstile tokens
  // are single-use, so a failed submit must never retry a consumed token.
  const [widgetKey, setWidgetKey] = useState(0);
  // The third-party Turnstile script loads only once the student shows intent
  // (focuses the email field) — the non-emailing majority never pays for it.
  const [engaged, setEngaged] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  if (status === 'done') {
    return (
      <div className="mt-8 rounded-card border border-signal/50 bg-signal/10 p-5 text-sm text-signal">
        You&apos;re on the list — study tips and new practice tests will land in your inbox.
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !token) {
      setMessage('Enter your email and complete the verification.');
      setStatus('error');
      return;
    }
    setStatus('sending');
    try {
      // Email-only payload: saves the lead WITHOUT re-logging the attempt
      // (the attempt was already recorded once when results opened).
      const res = await fetch('/api/tests/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_slug: test.slug, email, turnstileToken: token }),
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || 'Could not save your email. Try again in a minute.');
      }
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setMessage((err as Error).message || 'Could not save your email. Try again in a minute.');
      // Spent token — get a fresh one before the next try.
      setToken('');
      setWidgetKey((k) => k + 1);
    }
  };

  return (
    <form onSubmit={submit} className="mt-8 rounded-card border border-line bg-asphalt-800 p-6">
      <h2 className="font-display text-lg uppercase text-ink">Track your progress</h2>
      <p className="mt-1 text-sm text-muted">
        Drop your email and we&apos;ll send study tips and new tests as they launch. No spam,
        unsubscribe anytime.
      </p>
      <div className="mt-4 flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1" onFocus={() => setEngaged(true)}>
          <TextField
            id="results-email"
            label="Email address"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={setEmail}
            error={status === 'error' ? message : undefined}
          />
        </div>
        <Button type="submit" disabled={status === 'sending'} className="disabled:opacity-50">
          {status === 'sending' ? 'Saving…' : 'Save my email'}
        </Button>
      </div>
      {engaged && (
        <div className="mt-3">
          <TurnstileWidget
            key={widgetKey}
            siteKey={turnstileSiteKey}
            onToken={setToken}
            onError={(m) => {
              setStatus('error');
              setMessage(m);
            }}
          />
        </div>
      )}
    </form>
  );
}
