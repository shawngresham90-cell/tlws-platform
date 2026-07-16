/**
 * Study Mode session state — pure functions, no DOM, no DB. The client runner
 * (src/components/test/StudyRunner.tsx) owns localStorage; everything here is
 * deterministic and unit-tested in scripts/test-study-mode.ts. Immutable
 * updates only, so React state transitions stay predictable.
 */

export type StudySession = {
  /** Catalog slug this session belongs to. */
  slug: string;
  /** Selected choice key per question id. Answered = present. */
  answers: Record<string, string>;
  /** Index of the question currently on screen. */
  currentIndex: number;
  startedAt: number;
  updatedAt: number;
  /**
   * Set once the completed attempt has been logged to the API — the guard that
   * keeps one sitting from ever producing two attempt rows (it survives
   * refreshes and results re-entry via localStorage).
   */
  loggedAt?: number;
};

/** Bump when the stored shape changes — old sessions are discarded, not migrated. */
export const STUDY_STORAGE_VERSION = 1;

/**
 * localStorage key for a test's in-progress Study session. Drill sessions
 * (bookmarks / misses, Milestone 4) pass a variant so they never clobber the
 * full-bank session.
 */
export function studyStorageKey(slug: string, variant?: string): string {
  const base = `tlws:study:v${STUDY_STORAGE_VERSION}:${slug}`;
  return variant ? `${base}:${variant}` : base;
}

/** Clamp an index into [0, total-1] (0 when the bank is empty). */
export function clampIndex(index: number, total: number): number {
  return Math.max(0, Math.min(Math.trunc(index), Math.max(0, total - 1)));
}

/**
 * Keep only string answers for question ids that exist in the live bank —
 * the ONE restoration rule both runners share, so a hardening fix here
 * applies to Study and Timed sessions alike.
 */
export function sanitizeAnswers(
  raw: Record<string, unknown>,
  questionIds: string[],
): Record<string, string> {
  const known = new Set(questionIds);
  const answers: Record<string, string> = {};
  for (const [id, key] of Object.entries(raw)) {
    if (known.has(id) && typeof key === 'string') answers[id] = key;
  }
  return answers;
}

export function newSession(slug: string, now: number): StudySession {
  return { slug, answers: {}, currentIndex: 0, startedAt: now, updatedAt: now };
}

/**
 * Record an answer. First answer wins — Study Mode reveals the correct answer
 * immediately, so changing after the reveal would let the student "un-miss."
 */
export function answerQuestion(
  session: StudySession,
  questionId: string,
  choiceKey: string,
  now: number,
): StudySession {
  if (session.answers[questionId] !== undefined) return session;
  return {
    ...session,
    answers: { ...session.answers, [questionId]: choiceKey },
    updatedAt: now,
  };
}

/** Move to an absolute question index, clamped to the bank. */
export function goToQuestion(session: StudySession, index: number, total: number): StudySession {
  const clamped = clampIndex(index, total);
  if (clamped === session.currentIndex) return session;
  return { ...session, currentIndex: clamped };
}

/** Mark the completed attempt as logged so it is never posted twice. */
export function markLogged(session: StudySession, now: number): StudySession {
  if (session.loggedAt !== undefined) return session;
  return { ...session, loggedAt: now, updatedAt: now };
}

export function answeredCount(session: StudySession, questionIds: string[]): number {
  return questionIds.reduce((n, id) => (session.answers[id] !== undefined ? n + 1 : n), 0);
}

export function isComplete(session: StudySession, questionIds: string[]): boolean {
  return questionIds.length > 0 && answeredCount(session, questionIds) === questionIds.length;
}

/** Serialize for localStorage. */
export function serializeSession(session: StudySession): string {
  return JSON.stringify({ v: STUDY_STORAGE_VERSION, ...session });
}

/**
 * Parse a stored session. Returns null (never throws) on junk, a version
 * mismatch, or a slug mismatch. Answers for question ids that no longer exist
 * (bank re-seeded) are dropped; currentIndex is re-clamped to the live bank.
 */
export function deserializeSession(
  raw: string | null,
  slug: string,
  questionIds: string[],
): StudySession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      v?: number;
      slug?: string;
      answers?: Record<string, unknown>;
      currentIndex?: number;
      startedAt?: number;
      updatedAt?: number;
      loggedAt?: number;
    };
    if (parsed.v !== STUDY_STORAGE_VERSION || parsed.slug !== slug) return null;
    if (typeof parsed.answers !== 'object' || parsed.answers === null) return null;

    const answers = sanitizeAnswers(parsed.answers, questionIds);
    const index =
      typeof parsed.currentIndex === 'number' && Number.isFinite(parsed.currentIndex)
        ? clampIndex(parsed.currentIndex, questionIds.length)
        : 0;
    return {
      slug,
      answers,
      currentIndex: index,
      startedAt: typeof parsed.startedAt === 'number' ? parsed.startedAt : Date.now(),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
      ...(typeof parsed.loggedAt === 'number' ? { loggedAt: parsed.loggedAt } : {}),
    };
  } catch {
    return null;
  }
}
