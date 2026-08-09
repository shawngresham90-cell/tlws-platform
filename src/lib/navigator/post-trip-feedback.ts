/**
 * Post-trip feedback (pilot-ops priority 3) and issue triage (priority 4).
 *
 * FEEDBACK. Ten questions, nine of them a tap. The design constraint is
 * not screen space but willingness: this is asked at the end of a shift,
 * by an app, of someone who has just finished driving. Every question
 * that needs typing is a question that gets skipped, so nine are
 * multiple choice and the tenth is optional and short.
 *
 * Every answer defaults to 'skipped' rather than to a good outcome.
 * Unanswered must never read as "fine" — a feedback system that scores
 * silence as success will report a healthy pilot right up until someone
 * gets hurt.
 *
 * TRIAGE. A severity model with one rule that matters: nothing is
 * classified automatically. A category can SUGGEST a severity, and the
 * suggestion for a truck-legality problem is P0 — but `suggestSeverity`
 * is named for what it does, and the triage record carries a severity a
 * human set. Auto-classification fails in both directions: it inflates,
 * until P0 means nothing and the real one is missed in the noise, and it
 * deflates, by scoring an unfamiliar report as minor.
 *
 * Pure: no clock, no storage, no I/O.
 */

/* ============================================================== feedback */

export type FeedbackAnswer = string;

export type FeedbackQuestion = Readonly<{
  id: string;
  prompt: string;
  /** Ordered choices. The first is never assumed. */
  choices: readonly FeedbackAnswer[];
}>;

const YES_NO = ['yes', 'no'] as const;

export const FEEDBACK_QUESTIONS: readonly FeedbackQuestion[] = Object.freeze([
  { id: 'destination', prompt: 'Did it take you to the right place?', choices: [...YES_NO] },
  {
    id: 'truck-legal',
    prompt: 'Did the route look truck-legal the whole way?',
    choices: [...YES_NO],
  },
  {
    id: 'instruction-timing',
    prompt: 'Did turn instructions come early enough?',
    choices: ['early enough', 'too late'],
  },
  {
    id: 'voice-amount',
    prompt: 'Voice guidance was…',
    choices: ['about right', 'too much', 'too little'],
  },
  {
    id: 'reroute-speed',
    prompt: 'Was rerouting fast enough?',
    choices: ['fast enough', 'too slow', 'never needed it'],
  },
  { id: 'map', prompt: 'Did the map behave?', choices: [...YES_NO] },
  { id: 'gps', prompt: 'Any GPS problems?', choices: ['none', 'some', 'bad'] },
  { id: 'stability', prompt: 'Did it freeze or crash?', choices: ['no', 'yes'] },
  { id: 'would-use-again', prompt: 'Would you use it again?', choices: [...YES_NO] },
]);

export const FEEDBACK_NOTE_MAX = 280;
export const SKIPPED = 'skipped';

export type FeedbackResponse = Readonly<{
  answers: Readonly<Record<string, string>>;
  note: string;
  answeredCount: number;
}>;

function normalizeNote(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return '';
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  return collapsed.slice(0, FEEDBACK_NOTE_MAX);
}

/**
 * Build a response. An answer that is not one of the offered choices is
 * recorded as skipped rather than kept: a value we did not offer is a
 * value we cannot interpret, and storing it would let a malformed or
 * hostile input become a data point.
 */
export function buildFeedback(input: {
  answers?: Readonly<Record<string, string>> | null;
  note?: string | null;
}): FeedbackResponse {
  const given = input.answers ?? {};
  const answers: Record<string, string> = {};
  let answeredCount = 0;
  for (const q of FEEDBACK_QUESTIONS) {
    const value = given[q.id];
    if (typeof value === 'string' && q.choices.includes(value)) {
      answers[q.id] = value;
      answeredCount += 1;
    } else {
      answers[q.id] = SKIPPED;
    }
  }
  return Object.freeze({
    answers: Object.freeze(answers),
    note: normalizeNote(input.note),
    answeredCount,
  });
}

export function feedbackLines(r: FeedbackResponse): string[] {
  const out = ['POST-TRIP FEEDBACK', `  answered: ${r.answeredCount}/${FEEDBACK_QUESTIONS.length}`];
  for (const q of FEEDBACK_QUESTIONS) out.push(`  ${q.id}: ${r.answers[q.id]}`);
  if (r.note !== '') out.push(`  note: ${r.note}`);
  return out;
}

/**
 * The answers that mean "stop expanding the pilot and look at this".
 * Reported, never acted on automatically.
 */
export function feedbackConcerns(r: FeedbackResponse): string[] {
  const concerns: string[] = [];
  if (r.answers['truck-legal'] === 'no') concerns.push('route did not look truck-legal');
  if (r.answers.destination === 'no') concerns.push('wrong destination');
  if (r.answers['instruction-timing'] === 'too late') concerns.push('instructions came too late');
  if (r.answers.stability === 'yes') concerns.push('froze or crashed');
  if (r.answers.gps === 'bad') concerns.push('bad GPS');
  return concerns;
}

/* =============================================================== triage */

export type Severity = 'P0' | 'P1' | 'P2' | 'P3';

export const SEVERITY_MEANING: Readonly<Record<Severity, string>> = Object.freeze({
  P0: 'Safety-critical or unusable. Stop pilot expansion until it is resolved.',
  P1: 'Major navigation failure. The trip was completed, but the app failed at its job.',
  P2: 'Important but recoverable. The driver worked around it.',
  P3: 'Minor UX issue. Worth fixing, not worth blocking on.',
});

export type TriageRecord = Readonly<{
  severity: Severity;
  build: string;
  category: string;
  reproduction: string;
  expected: string;
  actual: string;
  driverImpact: string;
  evidence: string;
  routeState: string;
  suggestedAction: string;
}>;

/**
 * A SUGGESTION, never an assignment — see the module note. A truck-legality
 * report is the one that deserves the benefit of the doubt upward, because
 * the cost of under-rating it is a truck on a road it cannot take.
 */
export function suggestSeverity(categoryId: string): Severity {
  switch (categoryId) {
    case 'wrong-truck-route':
      return 'P0';
    case 'freeze-crash':
    case 'missing-turn-instruction':
    case 'wrong-turn-instruction':
      return 'P1';
    case 'reroute-too-slow':
    case 'reroute-unnecessary':
    case 'gps':
    case 'destination-entrance':
      return 'P2';
    default:
      return 'P3';
  }
}

const REQUIRED_FIELDS: readonly (keyof TriageRecord)[] = [
  'severity',
  'build',
  'category',
  'reproduction',
  'expected',
  'actual',
  'driverImpact',
  'routeState',
];

/** Which required fields are still empty. A triage record with holes is
 *  not evidence, and saying so is more useful than filling them in. */
export function triageGaps(record: Partial<TriageRecord>): string[] {
  return REQUIRED_FIELDS.filter((f) => {
    const v = record[f];
    return typeof v !== 'string' || v.trim() === '';
  }).map(String);
}

export function triageLines(record: TriageRecord): string[] {
  return [
    `${record.severity} — ${record.category}`,
    `  build: ${record.build}`,
    `  reproduction: ${record.reproduction}`,
    `  expected: ${record.expected}`,
    `  actual: ${record.actual}`,
    `  driver impact: ${record.driverImpact}`,
    `  route state: ${record.routeState}`,
    `  evidence: ${record.evidence}`,
    `  suggested action: ${record.suggestedAction}`,
  ];
}
