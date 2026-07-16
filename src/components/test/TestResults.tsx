'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { TextField } from '@/components/apply/Fields';
import { TurnstileWidget } from '@/components/apply/TurnstileWidget';
import { trackEvent } from '@/lib/analytics';
import { gradeAttempt } from '@/lib/tests/scoring';
import { testHref } from '@/lib/tests/catalog';
import { PRESCHOOL_PATH, PRESCHOOL_PRICE_LABEL } from '@/lib/preschool/constants';
import type { Question } from '@/lib/tests/types';

/**
 * Shared results experience for BOTH runners (extracted in Milestone 3 so
 * Study Mode and Timed Test render identical results): score + pass/fail via
 * gradeAttempt, once-only attempt logging (persisted-guard + ref), optional
 * Turnstile-verified email save, Academy + CDL Pre-School CTAs, and the full
 * per-question review with correct answers, explanations, and CFR citations —
 * this is where a Timed Test's deferred explanations are finally revealed.
 */

export type RunnerTest = {
  slug: string;
  title: string;
  passThresholdPct: number;
};

export function TestResults({
  test,
  questions,
  answers,
  modeLabel,
  notice,
  alreadyLogged,
  onLogged,
  onRetake,
  turnstileSiteKey,
}: {
  test: RunnerTest;
  questions: Question[];
  answers: Record<string, string>;
  /** "Study Mode" | "Timed Test" — labels the score panel. */
  modeLabel: string;
  /** Optional banner above the score (e.g. "Time expired — submitted automatically"). */
  notice?: string;
  alreadyLogged: boolean;
  onLogged: () => void;
  onRetake: () => void;
  turnstileSiteKey: string;
}) {
  const result = gradeAttempt(questions, answers, test.passThresholdPct);
  const posting = useRef(false);

  // Log the attempt exactly once per sitting: the persisted loggedAt guard
  // (via alreadyLogged) covers refreshes and results re-entry; the ref guards
  // double-effects within a mount.
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
      body: JSON.stringify({ test_slug: test.slug, answers }),
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
      {notice && (
        <p
          role="status"
          className="mb-4 rounded-card border border-signal/50 bg-signal/10 px-4 py-3 text-sm font-medium text-signal"
        >
          {notice}
        </p>
      )}

      {/* Score */}
      <div
        className={`rounded-card border p-8 text-center sm:p-10 ${
          result.passed ? 'border-signal/60 bg-signal/5' : 'border-diesel bg-diesel/10'
        }`}
      >
        <p className="eyebrow">
          {test.title} — {modeLabel} results
        </p>
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

      {/* Full review — correct answers, explanations, and citations revealed */}
      <h2 className="mt-10 font-display text-2xl uppercase text-ink">Review every question</h2>
      <ol className="mt-4 space-y-4">
        {questions.map((q, i) => {
          const selected = answers[q.id];
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
