'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { TurnstileWidget } from '@/components/apply/TurnstileWidget';
import { trackEvent } from '@/lib/analytics';
import { gradeAttempt } from '@/lib/tests/scoring';
import {
  answerQuestion,
  answeredCount,
  deserializeSession,
  goToQuestion,
  isComplete,
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
 * (src/lib/tests/study.ts) — this component only owns DOM concerns.
 *
 * Mobile-first: full-width answer buttons with ≥44px touch targets, sticky
 * bottom navigation, no horizontal scroll.
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
  const questionIds = questions.map((q) => q.id);

  // Hydrate from localStorage after mount (SSR renders the placeholder).
  useEffect(() => {
    const restored = deserializeSession(
      window.localStorage.getItem(studyStorageKey(test.slug)),
      test.slug,
      questionIds,
    );
    setSession(restored ?? newSession(test.slug, Date.now()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test.slug]);

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

  // Results render only on the explicit "See results" click — auto-jumping on
  // the last answer would hide that question's explanation mid-read. A resumed
  // complete session lands back on the quiz with the button available.
  if (view === 'results' && isComplete(session, questionIds)) {
    return (
      <StudyResults
        test={test}
        questions={questions}
        session={session}
        turnstileSiteKey={turnstileSiteKey}
        onRetake={restart}
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
  const allAnswered = done === total;
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
              else if (isSelected) styles = 'border-diesel bg-diesel/10 text-diesel';
              else styles = 'border-line bg-asphalt text-muted';
            }
            return (
              <button
                key={choice.key}
                type="button"
                disabled={answered}
                onClick={() => onAnswer(q.id, choice.key)}
                aria-pressed={isSelected}
                className={`flex min-h-[44px] w-full items-start gap-3 rounded-card border px-4 py-3 text-left transition-colors disabled:cursor-default ${styles}`}
              >
                <span className="font-display uppercase" aria-hidden="true">
                  {choice.key}.
                </span>
                <span className="flex-1">{choice.text}</span>
                {answered && isAnswerKey && <span aria-hidden="true">✓</span>}
                {answered && isSelected && !isAnswerKey && <span aria-hidden="true">✗</span>}
              </button>
            );
          })}
        </div>

        {/* Immediate feedback — answer, explanation, citation */}
        <div aria-live="polite">
          {answered && (
            <div
              className={`mt-6 rounded-card border p-5 ${
                isCorrect ? 'border-signal/50 bg-signal/5' : 'border-diesel/60 bg-diesel/5'
              }`}
            >
              <p
                className={`font-display text-lg uppercase ${isCorrect ? 'text-signal' : 'text-diesel'}`}
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

      {/* Navigation — thumb-reachable, ≥44px targets */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onNavigate(session.currentIndex - 1)}
          disabled={session.currentIndex === 0}
          className="min-h-[44px] rounded-card border border-line px-5 py-2.5 font-display uppercase tracking-wide text-ink transition-colors hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Previous
        </button>
        {allAnswered ? (
          <button
            type="button"
            onClick={onFinish}
            className="min-h-[44px] rounded-card bg-signal px-6 py-2.5 font-display uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600"
          >
            See results
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate(session.currentIndex + 1)}
            disabled={isLast}
            className={`min-h-[44px] rounded-card px-6 py-2.5 font-display uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              answered
                ? 'bg-signal text-asphalt hover:bg-signal-600'
                : 'border border-line text-ink hover:border-signal hover:text-signal'
            }`}
          >
            Next →
          </button>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        Progress saves automatically on this device — leave and pick up where you stopped.
      </p>
      <p className="mt-6 text-center text-sm">
        <Link href={`/practice-tests/${test.slug}`} className="text-muted hover:text-signal">
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
}: {
  test: RunnerTest;
  questions: Question[];
  session: StudySession;
  turnstileSiteKey: string;
  onRetake: () => void;
}) {
  const result = gradeAttempt(questions, session.answers, test.passThresholdPct);
  const posted = useRef(false);

  // Log the attempt once (anonymous — no PII). Fire-and-forget; the results
  // render regardless of whether the log lands.
  useEffect(() => {
    if (posted.current) return;
    posted.current = true;
    trackEvent('practice_test_completed', {
      test: test.slug,
      scorePct: result.scorePct,
      passed: result.passed,
    });
    fetch('/api/tests/attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test_slug: test.slug, answers: session.answers }),
    }).catch(() => {
      // Analytics only — never disturb the student over it.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {/* Score */}
      <div
        className={`rounded-card border p-8 text-center sm:p-10 ${
          result.passed ? 'border-signal/60 bg-signal/5' : 'border-diesel/60 bg-diesel/5'
        }`}
      >
        <p className="eyebrow">{test.title} — Study Mode results</p>
        <p
          className={`mt-2 font-display text-6xl uppercase ${result.passed ? 'text-signal' : 'text-diesel'}`}
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
          <button
            type="button"
            onClick={onRetake}
            className="min-h-[44px] rounded-card bg-signal px-6 py-2.5 font-display uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600"
          >
            Retake the test
          </button>
          <Link
            href={`/practice-tests/${test.slug}`}
            className="inline-flex min-h-[44px] items-center rounded-card border border-line px-6 py-2.5 font-display uppercase tracking-wide text-ink transition-colors hover:border-signal hover:text-signal"
          >
            Test overview
          </Link>
        </div>
      </div>

      {/* Email results */}
      <EmailResults test={test} answers={session.answers} turnstileSiteKey={turnstileSiteKey} />

      {/* Next-step CTAs */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-line bg-asphalt-800 p-6">
          <h3 className="font-display text-lg uppercase text-signal">
            {result.passed ? 'Ready for the real thing?' : 'Want hands-on help?'}
          </h3>
          <p className="mt-2 text-sm text-muted">
            Trucking Life Academy trains CDL-A drivers in Dalton, GA — off I-75. Drivers helping
            drivers.
          </p>
          <div className="mt-4">
            <Button href="/academy/apply">Apply to the Academy</Button>
          </div>
        </div>
        <div className="rounded-card border border-line bg-asphalt-800 p-6">
          <h3 className="font-display text-lg uppercase text-signal">Still before the permit?</h3>
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
              <p className={`mt-2 text-sm ${correct ? 'text-signal' : 'text-diesel'}`}>
                {correct ? '✓' : '✗'} Your answer:{' '}
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

/* ── Optional email capture (results → leads, Turnstile-verified) ──────── */

function EmailResults({
  test,
  answers,
  turnstileSiteKey,
}: {
  test: RunnerTest;
  answers: Record<string, string>;
  turnstileSiteKey: string;
}) {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  if (status === 'done') {
    return (
      <div className="mt-8 rounded-card border border-signal/50 bg-signal/10 p-5 text-sm text-signal">
        You&apos;re on the list — study tips and new practice tests will land in your inbox.
      </div>
    );
  }

  const submit = async () => {
    if (!email || !token) {
      setMessage('Enter your email and complete the verification.');
      setStatus('error');
      return;
    }
    setStatus('sending');
    try {
      const res = await fetch('/api/tests/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // The same selections the student just finished with, so the emailed
          // attempt is the attempt they saw graded.
          test_slug: test.slug,
          answers,
          email,
          turnstileToken: token,
        }),
      });
      if (!res.ok) throw new Error('failed');
      setStatus('done');
    } catch {
      setStatus('error');
      setMessage('Could not save your email. Try again in a minute.');
    }
  };

  return (
    <div className="mt-8 rounded-card border border-line bg-asphalt-800 p-6">
      <h3 className="font-display text-lg uppercase text-ink">Track your progress</h3>
      <p className="mt-1 text-sm text-muted">
        Drop your email and we&apos;ll tie this score to you — plus study tips and new tests as they
        launch. No spam, unsubscribe anytime.
      </p>
      <div className="mt-4 flex max-w-md flex-col gap-3 sm:flex-row">
        <label htmlFor="results-email" className="sr-only">
          Email address
        </label>
        <input
          id="results-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="min-h-[44px] flex-1 rounded-card border border-line bg-asphalt px-4 py-3 text-ink outline-none focus:border-signal"
        />
        <button
          type="button"
          onClick={submit}
          disabled={status === 'sending'}
          className="min-h-[44px] rounded-card bg-signal px-6 py-3 font-display uppercase text-asphalt transition-colors hover:bg-signal-600 disabled:opacity-50"
        >
          {status === 'sending' ? 'Saving…' : 'Save my score'}
        </button>
      </div>
      <div className="mt-3">
        <TurnstileWidget siteKey={turnstileSiteKey} onToken={setToken} onError={setMessage} />
      </div>
      {status === 'error' && message && (
        <p className="mt-2 text-sm text-diesel" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
