/**
 * The approval lifecycle of an issue.
 *
 *   draft → owner-review → approved → ready-to-send → sent → archived
 *
 * NOTHING ADVANCES ITSELF. Every transition is an explicit, recorded act by a
 * named person. There is no scheduler, no "auto-approve after N days", and no
 * path from `approved` straight to `sent` — `ready-to-send` exists precisely so
 * that "this content is signed off" and "send it now" are two separate
 * decisions made at two separate moments. Collapsing them is how an issue
 * approved on Tuesday goes out during Thursday's outage.
 *
 * BACKWARDS IS ALLOWED, FORWARDS IS NOT SKIPPABLE. An issue can always fall
 * back to `draft` — review finds a problem, and the fix must re-enter the
 * pipeline from the start rather than keeping its stale approval. But it can
 * never skip a stage going forward.
 *
 * `sent` IS EFFECTIVELY TERMINAL. The only move from `sent` is `archived`.
 * Mail that has left cannot be unsent, so any state that implies "not yet
 * sent" would be a lie about the world. Re-sending is a new issue.
 */

export const ISSUE_STATES = [
  'draft',
  'owner-review',
  'approved',
  'ready-to-send',
  'sent',
  'archived',
] as const;
export type IssueState = (typeof ISSUE_STATES)[number];

/** Human labels, for the preview header and any future admin view. */
export const ISSUE_STATE_LABELS: Record<IssueState, string> = {
  draft: 'Draft',
  'owner-review': 'Owner review',
  approved: 'Approved',
  'ready-to-send': 'Ready to send',
  sent: 'Sent',
  archived: 'Archived',
};

/**
 * Legal next states. Note what is absent: nothing leads out of `archived`, and
 * `sent` leads only to `archived`.
 */
const TRANSITIONS: Record<IssueState, readonly IssueState[]> = {
  draft: ['owner-review'],
  'owner-review': ['approved', 'draft'],
  approved: ['ready-to-send', 'draft'],
  'ready-to-send': ['sent', 'approved', 'draft'],
  sent: ['archived'],
  archived: [],
};

/** States in which the issue is still being worked on and may be edited. */
export function isEditable(state: IssueState): boolean {
  return state === 'draft' || state === 'owner-review';
}

/**
 * States from which a send may even be attempted. Only one — and reaching it
 * still does not send anything; `evaluateSendReadiness` gets the final word.
 */
export function isSendable(state: IssueState): boolean {
  return state === 'ready-to-send';
}

export type TransitionRequest = {
  from: IssueState;
  to: IssueState;
  /** Who is making the change. Recorded; an unattributed transition is refused. */
  actor: string;
  /** ISO timestamp, supplied by the caller so this module stays pure. */
  at: string;
  /**
   * Whether the issue currently passes validation. Required for any FORWARD
   * transition. Passed in rather than computed here so this module has one job.
   */
  validationPasses: boolean;
};

export type TransitionResult =
  | { ok: true; state: IssueState; record: TransitionRecord }
  | { ok: false; blockers: { code: string; detail: string }[] };

export type TransitionRecord = {
  from: IssueState;
  to: IssueState;
  actor: string;
  at: string;
};

/** Forward means "closer to sent". Used to decide whether validation gates. */
function isForward(from: IssueState, to: IssueState): boolean {
  return ISSUE_STATES.indexOf(to) > ISSUE_STATES.indexOf(from);
}

/**
 * Attempt a transition. Pure: returns the new state and an audit record, or
 * every reason it was refused.
 */
export function transition(request: TransitionRequest): TransitionResult {
  const blockers: { code: string; detail: string }[] = [];

  // Returned on its own rather than collected: every check below indexes
  // TRANSITIONS by `from`, and an unrecognised key would read as undefined.
  if (!(ISSUE_STATES as readonly string[]).includes(request.from)) {
    return {
      ok: false,
      blockers: [
        {
          code: 'unknown_from_state',
          detail: `Unrecognised current state ${JSON.stringify(request.from)}.`,
        },
      ],
    };
  }

  if (!(ISSUE_STATES as readonly string[]).includes(request.to)) {
    blockers.push({
      code: 'unknown_target_state',
      detail: `Unrecognised target state ${JSON.stringify(request.to)}. Refusing to guess what it permits.`,
    });
  }

  if (!blockers.length && !TRANSITIONS[request.from].includes(request.to)) {
    const allowed = TRANSITIONS[request.from];
    blockers.push({
      code: 'illegal_transition',
      detail: allowed.length
        ? `Cannot go from "${request.from}" to "${request.to}". Allowed: ${allowed.join(', ')}.`
        : `"${request.from}" is terminal. Nothing follows it.`,
    });
  }

  if (typeof request.actor !== 'string' || request.actor.trim().length === 0) {
    blockers.push({
      code: 'actor_missing',
      detail: 'A transition must record who made it. An unattributed approval is not an approval.',
    });
  }

  if (isForward(request.from, request.to) && !request.validationPasses) {
    blockers.push({
      code: 'validation_failing',
      detail: 'The issue does not pass validation. It can move back to draft, but not forward.',
    });
  }

  if (blockers.length) return { ok: false, blockers };

  return {
    ok: true,
    state: request.to,
    record: { from: request.from, to: request.to, actor: request.actor, at: request.at },
  };
}

/**
 * Every state an issue must have passed through to reach `sent`, in order.
 * Used by the tests to assert the pipeline cannot be short-circuited.
 */
export const REQUIRED_PATH_TO_SENT: readonly IssueState[] = [
  'draft',
  'owner-review',
  'approved',
  'ready-to-send',
  'sent',
];
