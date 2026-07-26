/**
 * Claim review — pure decision mapping, no I/O.
 *
 * A listing claim is free and always reviewed by a person
 * (docs/directory/claim-verification.md). There is no claim table and adding
 * one would be a migration, so a decision is recorded entirely in fields that
 * already exist:
 *
 *   sponsors.stage   'closed_won' when verified, 'closed_lost' when rejected
 *   sponsors.notes   one labelled line: reviewer, date, decision, reason
 *   sponsor_touches  one append-only row mirroring the same decision
 *
 * Reviewing a claim NEVER touches `locations`. Verifying it means "we believe
 * this person represents this business"; any correction they asked for is a
 * separate, deliberate listing edit made afterwards by a human.
 */

export type ClaimDecision = 'verified' | 'rejected';

/** The pipeline stage a decision moves the CRM row to. Both are existing enum values. */
export const CLAIM_DECISION_STAGE: Record<ClaimDecision, 'closed_won' | 'closed_lost'> = {
  verified: 'closed_won',
  rejected: 'closed_lost',
};

export const CLAIM_DECISION_LABEL: Record<ClaimDecision, string> = {
  verified: 'Claim verified',
  rejected: 'Claim rejected',
};

/**
 * The checklist items from docs/directory/claim-verification.md that a reviewer
 * confirms before verifying. Rejection needs a reason, not a checklist.
 */
export const CLAIM_CHECKLIST = [
  { id: 'identity', label: 'Business identity matches the listing (name, address, phone)' },
  { id: 'authority', label: 'Claimant states their role and has authority to represent it' },
  { id: 'match', label: 'At least two of phone / domain / address match an official source' },
  { id: 'changes', label: 'Requested changes are written down and separately evidenced' },
  { id: 'fraud', label: 'No fraud warning signs (urgency, competitor details, removal request)' },
] as const;

export type ClaimChecklistId = (typeof CLAIM_CHECKLIST)[number]['id'];

export type ClaimReview = {
  decision: ClaimDecision;
  reviewer: string;
  /** Checklist ids the reviewer confirmed. Required in full to verify. */
  confirmed: string[];
  /** Free text. Required to reject, optional to verify. */
  reason: string;
};

/** Reasons this review cannot be recorded. Empty means it is good to submit. */
export function reviewBlockers(review: ClaimReview): string[] {
  const out: string[] = [];
  if (!review.reviewer.trim()) out.push('Reviewer name is required.');
  if (review.decision === 'verified') {
    const missing = CLAIM_CHECKLIST.filter((c) => !review.confirmed.includes(c.id));
    if (missing.length)
      out.push(
        `Every check must be confirmed before verifying. Outstanding: ${missing.map((m) => m.id).join(', ')}.`,
      );
  }
  if (review.decision === 'rejected' && !review.reason.trim())
    out.push('A rejection needs a reason, so the business can be told what would resolve it.');
  return out;
}

/**
 * The labelled line appended to `sponsors.notes`. Same "Label: value" shape as
 * the inquiry funnel's lines, so the inbox parser style stays uniform.
 */
export function reviewNoteLine(review: ClaimReview, at: string): string {
  const bits = [
    `${CLAIM_DECISION_LABEL[review.decision]}: by ${review.reviewer.trim()}`,
    `on ${at.slice(0, 10)}`,
    review.decision === 'verified'
      ? `checks ${review.confirmed.length}/${CLAIM_CHECKLIST.length}`
      : null,
    review.reason.trim() ? `note ${review.reason.trim()}` : null,
  ].filter(Boolean);
  return bits.join(' · ');
}

/** Summary for the append-only `sponsor_touches` row mirroring the decision. */
export function reviewTouchSummary(review: ClaimReview): string {
  return `${CLAIM_DECISION_LABEL[review.decision]} by ${review.reviewer.trim()}${
    review.reason.trim() ? ` — ${review.reason.trim()}` : ''
  }`;
}

const REVIEW_RE = /^Claim (verified|rejected): by (.+?) · on (\d{4}-\d{2}-\d{2})/im;

/** Read a recorded decision back out of a note. Null when there is none. */
export function parseReview(
  notes: string | null | undefined,
): { decision: ClaimDecision; reviewer: string; date: string } | null {
  const m = REVIEW_RE.exec(notes ?? '');
  if (!m) return null;
  return { decision: m[1] as ClaimDecision, reviewer: m[2], date: m[3] };
}
