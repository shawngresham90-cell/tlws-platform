'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
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
import { TestResults, type RunnerTest } from './TestResults';
import { BookmarkButton } from './BookmarkButton';
import { CHOICE_BUTTON_BASE, QuizProgress } from './shared';
import {
  MISSES_STORAGE_KEY,
  deserializeMisses,
  recordMisses,
  serializeMisses,
} from '@/lib/tests/saved';
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
 * Results render via the shared TestResults component (also used by the
 * Timed Test runner) — score, review, retake, email save, CTAs.
 *
 * Accessibility: answered choices stay focusable (aria-disabled, not
 * disabled) so keyboard focus is never dropped; per-choice correctness
 * carries screen-reader text, not just color; feedback announces via a
 * polite live region; red state uses border/background with readable ink
 * text (diesel-as-text fails contrast on the dark theme).
 */

export function StudyRunner({
  test,
  questions,
  turnstileSiteKey,
  variant,
  logAttempt = true,
}: {
  test: RunnerTest;
  questions: Question[];
  turnstileSiteKey: string;
  /** Drill sessions (bookmarks/misses) get their own storage bucket. */
  variant?: string;
  /** Drills run on partial banks — their scores must never reach the attempt log. */
  logAttempt?: boolean;
}) {
  const [session, setSession] = useState<StudySession | null>(null);
  const [view, setView] = useState<'quiz' | 'results'>('quiz');
  const hydrated = useRef(false);

  // Hydrate from localStorage after mount (SSR renders the placeholder).
  // Once-only: an RSC refresh must never re-run this over a live session
  // whose storage writes are failing.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const ids = questions.map((q) => q.id);
    const restored = deserializeSession(
      window.localStorage.getItem(studyStorageKey(test.slug, variant)),
      test.slug,
      ids,
    );
    setSession(restored ?? newSession(test.slug, Date.now()));
  }, [test.slug, questions, variant]);

  // Persist every change.
  useEffect(() => {
    if (!session) return;
    try {
      window.localStorage.setItem(studyStorageKey(test.slug, variant), serializeSession(session));
    } catch {
      // Storage full/blocked — the session still works for this page view.
    }
  }, [session, test.slug, variant]);

  if (!session) {
    return (
      <div className="rounded-card border border-line bg-asphalt-800 p-8 text-muted" role="status">
        Loading your session…
      </div>
    );
  }

  const restart = () => {
    try {
      window.localStorage.removeItem(studyStorageKey(test.slug, variant));
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
  if (
    view === 'results' &&
    isComplete(
      session,
      questions.map((q) => q.id),
    )
  ) {
    return (
      <TestResults
        test={test}
        questions={questions}
        answers={session.answers}
        modeLabel="Study Mode"
        mode="study"
        elapsed={Math.max(0, Math.round((Date.now() - session.startedAt) / 1000))}
        logAttempt={logAttempt}
        alreadyLogged={session.loggedAt !== undefined}
        onLogged={() => setSession((s) => (s ? markLogged(s, Date.now()) : s))}
        onRetake={restart}
        turnstileSiteKey={turnstileSiteKey}
      />
    );
  }

  return (
    <StudyQuestion
      test={test}
      questions={questions}
      session={session}
      onAnswer={(qid, key) => {
        // A wrong first answer is a MISS — recorded immediately (study shows
        // the verdict instantly), feeding the "Practice my misses" drill.
        const q = questions.find((x) => x.id === qid);
        if (q && key !== q.correctKey) {
          try {
            const misses = deserializeMisses(window.localStorage.getItem(MISSES_STORAGE_KEY));
            window.localStorage.setItem(
              MISSES_STORAGE_KEY,
              serializeMisses(recordMisses(misses, test.slug, [qid], Date.now())),
            );
          } catch {
            // Storage blocked — drilling just won't have this one.
          }
        }
        setSession((s) => (s ? answerQuestion(s, qid, key, Date.now()) : s));
      }}
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
      <QuizProgress currentIndex={session.currentIndex} total={total} answered={done} />

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
                className={`${CHOICE_BUTTON_BASE} ${answered ? 'cursor-default' : ''} ${styles}`}
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
              <div className="mt-4">
                <BookmarkButton slug={test.slug} questionId={q.id} />
              </div>
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
