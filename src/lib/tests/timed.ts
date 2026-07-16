/**
 * Timed Test session state — pure functions, no DOM, no DB (Milestone 3).
 * Mirrors src/lib/tests/study.ts but with exam semantics:
 *
 *   * The countdown anchors on the PERSISTED startedAt, so a refresh resumes
 *     the ORIGINAL clock — reloading can never reset or extend the timer.
 *   * Answers may be CHANGED until submission (no feedback is shown during
 *     the exam, exactly like the real test), unlike Study Mode's answer-once.
 *   * Submission happens exactly once: submittedAt is a persisted one-way
 *     latch, guarding both the manual submit and the expiry auto-submit
 *     across re-renders and refreshes.
 *
 * The client runner (src/components/test/TimedRunner.tsx) owns localStorage;
 * everything here is deterministic and unit-tested in
 * scripts/test-timed-mode.ts.
 */

import { clampIndex } from './study';

export type TimedSession = {
  /** Catalog slug this session belongs to. */
  slug: string;
  /** Selected choice key per question id — replaceable until submission. */
  answers: Record<string, string>;
  /** Index of the question currently on screen. */
  currentIndex: number;
  /** Epoch ms the exam clock started — the refresh-proof countdown anchor. */
  startedAt: number;
  /** One-way latch: set on the single submission (manual or expiry). */
  submittedAt?: number;
  /** Set once the graded attempt has been logged to the API (never twice). */
  loggedAt?: number;
};

/** Bump when the stored shape changes — old sessions are discarded, not migrated. */
export const TIMED_STORAGE_VERSION = 1;

/** localStorage key for a test's Timed session. */
export function timedStorageKey(slug: string): string {
  return `tlws:timed:v${TIMED_STORAGE_VERSION}:${slug}`;
}

export function newTimedSession(slug: string, now: number): TimedSession {
  return { slug, answers: {}, currentIndex: 0, startedAt: now };
}

/** Milliseconds left on the original clock. Never negative. */
export function remainingMs(session: TimedSession, timeLimitSeconds: number, now: number): number {
  return Math.max(0, session.startedAt + timeLimitSeconds * 1000 - now);
}

/** True once the original clock has run out. */
export function isExpired(session: TimedSession, timeLimitSeconds: number, now: number): boolean {
  return remainingMs(session, timeLimitSeconds, now) === 0;
}

/** mm:ss for the visible countdown. */
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Record or CHANGE an answer — allowed freely until submission (the exam
 * shows no feedback, so revisiting a question is part of test strategy).
 * Ignored after the submission latch.
 */
export function answerTimedQuestion(
  session: TimedSession,
  questionId: string,
  choiceKey: string,
): TimedSession {
  if (session.submittedAt !== undefined) return session;
  if (session.answers[questionId] === choiceKey) return session;
  return { ...session, answers: { ...session.answers, [questionId]: choiceKey } };
}

/** Move to an absolute question index, clamped to the bank. */
export function goToTimedQuestion(
  session: TimedSession,
  index: number,
  total: number,
): TimedSession {
  const clamped = clampIndex(index, total);
  if (clamped === session.currentIndex) return session;
  return { ...session, currentIndex: clamped };
}

/** One-way submission latch — the first call wins, every later call is a no-op. */
export function submitTimedSession(session: TimedSession, now: number): TimedSession {
  if (session.submittedAt !== undefined) return session;
  return { ...session, submittedAt: now };
}

/** Mark the graded attempt as logged so it is never posted twice. */
export function markTimedLogged(session: TimedSession, now: number): TimedSession {
  if (session.loggedAt !== undefined) return session;
  return { ...session, loggedAt: now };
}

/** Serialize for localStorage. */
export function serializeTimedSession(session: TimedSession): string {
  return JSON.stringify({ v: TIMED_STORAGE_VERSION, ...session });
}

/**
 * Parse a stored session. Returns null (never throws) on junk, a version
 * mismatch, a slug mismatch, or a corrupt/absent startedAt — the clock anchor
 * must be trustworthy or the session is discarded. Answers for question ids
 * that no longer exist are dropped; currentIndex is re-clamped.
 */
export function deserializeTimedSession(
  raw: string | null,
  slug: string,
  questionIds: string[],
): TimedSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      v?: number;
      slug?: string;
      answers?: Record<string, unknown>;
      currentIndex?: number;
      startedAt?: number;
      submittedAt?: number;
      loggedAt?: number;
    };
    if (parsed.v !== TIMED_STORAGE_VERSION || parsed.slug !== slug) return null;
    if (typeof parsed.answers !== 'object' || parsed.answers === null) return null;
    // No trustworthy clock anchor → no session. (Never default to "now": that
    // would let a refresh reset the timer.)
    if (typeof parsed.startedAt !== 'number' || !Number.isFinite(parsed.startedAt)) return null;

    const known = new Set(questionIds);
    const answers: Record<string, string> = {};
    for (const [id, key] of Object.entries(parsed.answers)) {
      if (known.has(id) && typeof key === 'string') answers[id] = key;
    }
    return {
      slug,
      answers,
      currentIndex:
        typeof parsed.currentIndex === 'number' && Number.isFinite(parsed.currentIndex)
          ? clampIndex(parsed.currentIndex, questionIds.length)
          : 0,
      startedAt: parsed.startedAt,
      ...(typeof parsed.submittedAt === 'number' ? { submittedAt: parsed.submittedAt } : {}),
      ...(typeof parsed.loggedAt === 'number' ? { loggedAt: parsed.loggedAt } : {}),
    };
  } catch {
    return null;
  }
}
