/**
 * "Report a navigation problem" (pilot-ops priority 3).
 *
 * This EXTENDS the road-test report rather than standing up a second
 * reporting system. A road-test report already assembles the session and
 * already owns every privacy rail; what it lacked was the one field a
 * triager reads first — what kind of problem this is. A free-text note
 * cannot fill that role, because notes are written at a truck stop after
 * a ten-hour day and "it did the thing again" is not a category.
 *
 * So the category is a tap, the note is optional and short, and both ride
 * out through the SAME scrubber as everything else. Nothing here writes
 * its own output path.
 *
 * The note cap is a driver-safety decision, not a storage one. A long
 * free-text box invites typing, and typing is what the motion lock
 * exists to prevent; the affordance renders inside a stationary-only
 * gate, and the cap keeps it a sentence rather than an essay even there.
 *
 * Pure: no clock, no storage, no I/O.
 */

export type ProblemCategoryId =
  | 'wrong-truck-route'
  | 'reroute-too-slow'
  | 'reroute-unnecessary'
  | 'wrong-turn-instruction'
  | 'missing-turn-instruction'
  | 'voice'
  | 'map'
  | 'gps'
  | 'destination-entrance'
  | 'freeze-crash'
  | 'parking-dock'
  | 'other';

export type ProblemCategory = Readonly<{
  id: ProblemCategoryId;
  /** What the driver taps. Plain language, no engineering vocabulary. */
  label: string;
  /** One line of disambiguation, so two categories are never a coin toss. */
  hint: string;
}>;

/**
 * Ordered by what matters most on a truck. A route a truck cannot legally
 * drive is the reason this pilot has a reporting system at all, so it is
 * first; 'Other' is last because a list that opens with an escape hatch
 * collects nothing but escape hatches.
 */
export const PROBLEM_CATEGORIES: readonly ProblemCategory[] = Object.freeze([
  {
    id: 'wrong-truck-route',
    label: 'Wrong truck route',
    hint: 'Sent somewhere a truck should not go — low bridge, weight limit, no-truck road.',
  },
  {
    id: 'reroute-too-slow',
    label: 'Rerouted too slowly',
    hint: 'I was off the route for a while before it caught up.',
  },
  {
    id: 'reroute-unnecessary',
    label: 'Rerouted unnecessarily',
    hint: 'It changed the route when I was still on it.',
  },
  {
    id: 'wrong-turn-instruction',
    label: 'Wrong turn instruction',
    hint: 'It named the wrong turn, road, or direction.',
  },
  {
    id: 'missing-turn-instruction',
    label: 'Missing turn instruction',
    hint: 'A turn came with no instruction, or too late to take it.',
  },
  {
    id: 'voice',
    label: 'Voice issue',
    hint: 'Silent, too much talking, or spoke at the wrong time.',
  },
  { id: 'map', label: 'Map issue', hint: 'Map froze, drifted, would not recenter, or drew wrong.' },
  { id: 'gps', label: 'GPS issue', hint: 'Position jumped, lagged, or was lost.' },
  {
    id: 'destination-entrance',
    label: 'Destination or entrance issue',
    hint: 'Ended at the wrong place, or at a gate a truck cannot use.',
  },
  {
    id: 'freeze-crash',
    label: 'App freeze or crash',
    hint: 'The app stopped responding or reloaded.',
  },
  {
    id: 'parking-dock',
    label: 'Parking or dock issue',
    hint: 'Parking or dock information was wrong or missing.',
  },
  { id: 'other', label: 'Other', hint: 'Something else worth telling us about.' },
]);

const BY_ID: ReadonlyMap<string, ProblemCategory> = new Map(
  PROBLEM_CATEGORIES.map((c) => [c.id, c]),
);

export function findCategory(id: string | null | undefined): ProblemCategory | null {
  if (typeof id !== 'string') return null;
  return BY_ID.get(id) ?? null;
}

/** A sentence, not an essay. See the module note — this is a safety cap. */
export const MAX_NOTE_CHARS = 280;

/**
 * Collapse whitespace and cap length. Newlines go too: a report line is a
 * line, and a note that smuggles newlines can forge section headers in
 * the plain-text report it is pasted into.
 */
export function normalizeNote(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return '';
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  return collapsed.length <= MAX_NOTE_CHARS ? collapsed : collapsed.slice(0, MAX_NOTE_CHARS);
}

export type ProblemReport = Readonly<{
  categoryId: ProblemCategoryId;
  note: string;
}>;

export type ProblemReportResult =
  | { ok: true; report: ProblemReport }
  | { ok: false; reason: string };

export const NO_CATEGORY_REASON = 'Choose what kind of problem it was.';

export function buildProblemReport(input: {
  categoryId: string | null | undefined;
  note?: string | null;
}): ProblemReportResult {
  const category = findCategory(input.categoryId);
  if (category === null) return { ok: false, reason: NO_CATEGORY_REASON };
  return {
    ok: true,
    report: Object.freeze({ categoryId: category.id, note: normalizeNote(input.note) }),
  };
}

/**
 * Report lines for the category. Returned as lines rather than a block so
 * the road-test report keeps sole ownership of joining and scrubbing.
 */
export function problemReportLines(report: ProblemReport): string[] {
  const category = findCategory(report.categoryId);
  const out = [
    'REPORTED PROBLEM',
    `  category: ${category === null ? report.categoryId : category.label}`,
  ];
  if (report.note !== '') out.push(`  note: ${report.note}`);
  return out;
}
