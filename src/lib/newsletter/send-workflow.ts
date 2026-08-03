import { findPendingCopy, isPending, type Copy } from './approval';
import type { RenderedEmail } from './render';

/**
 * The send workflow — designed here, executed nowhere.
 *
 * This module is a decision function and nothing else. It takes the full state
 * of a proposed send and returns whether it may proceed and, if not, every
 * reason at once. It performs no I/O, touches no database, and has no path to
 * a transport. Wiring it to one is a later, separate, reviewable change.
 *
 * EVERY BLOCKER, NOT THE FIRST. Returning on the first failure produces a
 * fix-one-rerun-find-another loop, and the person doing that at 11pm before a
 * send is exactly the person who starts disabling checks. One pass returns the
 * complete list.
 *
 * FAIL CLOSED, ALWAYS. Every gate is written so that missing information blocks
 * the send. An unknown subscription status is not permission; an absent
 * approval is not approval; an unrecognised mode is not `test`. The default
 * answer to "may I send this to five thousand people" is no.
 */

/**
 * Where a campaign is in its life.
 *
 * `draft` is not a soft state. A draft can never be sent to anyone, including a
 * test address — because "just test it quickly" is how an unfinished email gets
 * a production recipient list pasted into it.
 */
export type CampaignMode = 'draft' | 'test' | 'production';

export type CampaignMetadata = {
  /** Stable id for the campaign. Appears in the audit log. */
  campaignId: string;
  /** The template being sent. */
  emailSlug: string;
  mode: CampaignMode;
  /** Who authored it, for the audit trail. */
  preparedBy: string;
};

/** Recorded approval from the owner. Absent means not approved. */
export type OwnerApproval = {
  approvedBy: string;
  approvedAt: string;
  /**
   * The exact rendered content the owner approved, as a digest. Re-rendering
   * after an edit changes it, which invalidates the approval — otherwise
   * "approved" would mean "approved once, then edited freely".
   */
  contentDigest: string;
};

/** A completed test send, which production sending requires. */
export type TestSendRecord = {
  sentAt: string;
  toAddress: string;
  /** Digest of what the test actually rendered, for the same reason as above. */
  contentDigest: string;
};

/**
 * A recipient's subscription state, as read from `email_subscription_status`
 * (migration 049). Deliberately mirrors that view rather than restating its
 * logic: latest instruction wins and ties fail closed are decided in one place.
 */
export type RecipientConsent = {
  email: string;
  /** `null` means no evidence exists — which is not consent. */
  isSubscribed: boolean | null;
};

/**
 * The sender identity this send would go out as.
 *
 * Passed in rather than imported from `brand.ts`. A gate that reaches for
 * module state cannot be exercised against an approved identity without
 * editing the module, which means the "everything is satisfied" path — the one
 * that decides real sends actually happen — would be the only path never
 * tested. Taking it as input keeps the function pure and every branch reachable.
 */
export type SenderIdentity = {
  fromAddress: Copy;
  fromName: Copy;
  replyTo: Copy;
  postalAddress: Copy;
};

export type SendReadinessInput = {
  metadata: CampaignMetadata;
  sender: SenderIdentity;
  rendered: RenderedEmail;
  /** Digest of `rendered`, computed by the caller. */
  contentDigest: string;
  approval?: OwnerApproval;
  testSend?: TestSendRecord;
  recipients: RecipientConsent[];
  /** Addresses with a recorded opt-out, from `email_unsubscribes`. */
  suppressionList: readonly string[];
  /** Whether a transport that can actually deliver has been configured. */
  transportCanDeliver: boolean;
  /** The explicit, typed-out confirmation required for a production send. */
  productionConfirmation?: string;
};

export type Blocker = { code: string; detail: string };

export type SendReadiness = {
  allowed: boolean;
  blockers: Blocker[];
  /** Recipients that passed every check. Empty whenever `allowed` is false. */
  eligibleRecipients: string[];
  /** Recipients removed, and why — so a shrinking list is never silent. */
  excluded: { email: string; reason: string }[];
};

/** The exact string a production send requires. Typed out, never a checkbox. */
export const PRODUCTION_CONFIRMATION_PHRASE = 'SEND THE ROAD REPORT TO THE PRODUCTION LIST';

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Decide whether a campaign may be sent.
 *
 * Pure. Given the same input it returns the same answer, which is what makes it
 * testable — and a send gate nobody can test is a send gate nobody should
 * trust.
 */
export function evaluateSendReadiness(input: SendReadinessInput): SendReadiness {
  const blockers: Blocker[] = [];
  const excluded: { email: string; reason: string }[] = [];

  // ── 1. Draft protection ────────────────────────────────────────────────
  if (input.metadata.mode === 'draft') {
    blockers.push({
      code: 'draft_mode',
      detail: 'Campaign is a draft. Drafts cannot be sent to anyone, including test addresses.',
    });
  } else if (input.metadata.mode !== 'test' && input.metadata.mode !== 'production') {
    // An unrecognised mode is treated as the most restrictive, not the loosest.
    blockers.push({
      code: 'unknown_mode',
      detail: `Unrecognised campaign mode. Refusing to guess what it permits.`,
    });
  }

  // ── 2. Nothing unapproved may leave ────────────────────────────────────
  const stillPending = findPendingCopy(input.rendered);
  if (stillPending.length > 0) {
    blockers.push({
      code: 'copy_pending_approval',
      detail: `${stillPending.length} item(s) still awaiting owner approval: ${stillPending.join(' | ')}`,
    });
  }

  // ── 3. Sender identity ─────────────────────────────────────────────────
  const unsetSender = Object.entries(input.sender)
    .filter(([, value]) => isPending(value))
    .map(([key]) => key);
  if (unsetSender.length > 0) {
    blockers.push({
      code: 'sender_identity_unset',
      detail: `Sender identity not approved: ${unsetSender.join(', ')} (ROAD-REPORT-SENDER-01).`,
    });
  }

  // ── 4. Owner approval, bound to this exact content ─────────────────────
  if (!input.approval) {
    blockers.push({ code: 'owner_approval_missing', detail: 'No recorded owner approval.' });
  } else if (input.approval.contentDigest !== input.contentDigest) {
    blockers.push({
      code: 'owner_approval_stale',
      detail:
        'The approved content and the current content differ. Editing after approval revokes it.',
    });
  }

  // ── 5. A test send has to have happened, on this same content ──────────
  if (input.metadata.mode === 'production') {
    if (!input.testSend) {
      blockers.push({
        code: 'test_send_missing',
        detail: 'No test send recorded. A production send requires seeing it in a real inbox.',
      });
    } else if (input.testSend.contentDigest !== input.contentDigest) {
      blockers.push({
        code: 'test_send_stale',
        detail: 'The tested content and the current content differ. Re-test before sending.',
      });
    }

    if (input.productionConfirmation !== PRODUCTION_CONFIRMATION_PHRASE) {
      blockers.push({
        code: 'production_confirmation_missing',
        detail: 'Production sending requires the confirmation phrase, typed out in full.',
      });
    }
  }

  // ── 6. A transport that can actually deliver ───────────────────────────
  if (!input.transportCanDeliver) {
    blockers.push({
      code: 'no_delivering_transport',
      detail: 'No transport capable of delivery is configured. Only the dry-run transport exists.',
    });
  }

  // ── 7. Per-recipient consent and suppression ───────────────────────────
  const suppressed = new Set(input.suppressionList.map(normalize));
  const seen = new Set<string>();
  const eligible: string[] = [];

  for (const recipient of input.recipients) {
    const email = normalize(recipient.email);

    if (!email) {
      excluded.push({ email: recipient.email, reason: 'blank address' });
      continue;
    }
    // A duplicate in the list is one person, not two. Sending twice is the
    // most visible possible mistake.
    if (seen.has(email)) {
      excluded.push({ email, reason: 'duplicate in recipient list' });
      continue;
    }
    seen.add(email);

    if (suppressed.has(email)) {
      excluded.push({ email, reason: 'on the suppression list' });
      continue;
    }
    if (recipient.isSubscribed === null) {
      excluded.push({ email, reason: 'no consent evidence on record' });
      continue;
    }
    if (!recipient.isSubscribed) {
      excluded.push({ email, reason: 'not currently subscribed' });
      continue;
    }
    eligible.push(email);
  }

  // Suppression is belt and braces: the view already resolves an opt-out to
  // not-subscribed, so a suppressed address should also fail the consent check.
  // Both run anyway — if they ever disagree, the send stops rather than
  // silently picking whichever is more permissive.
  const contradictions = input.recipients.filter(
    (r) => suppressed.has(normalize(r.email)) && r.isSubscribed === true,
  );
  if (contradictions.length > 0) {
    blockers.push({
      code: 'consent_contradiction',
      detail: `${contradictions.length} address(es) are on the suppression list but report as subscribed. Resolve before sending.`,
    });
  }

  if (input.recipients.length > 0 && eligible.length === 0) {
    blockers.push({
      code: 'no_eligible_recipients',
      detail: 'Every recipient was excluded. Nothing to send.',
    });
  }

  const allowed = blockers.length === 0;
  return {
    allowed,
    blockers,
    eligibleRecipients: allowed ? eligible : [],
    excluded,
  };
}

/**
 * What gets written to the audit log for an attempt — allowed or refused.
 *
 * A refused attempt is the more interesting record. "Who tried to send what,
 * and what stopped them" is the question worth being able to answer later.
 * Recipient addresses are counted, never listed: the log should survive being
 * read by someone who has no business seeing the list.
 */
export type SendAuditEntry = {
  campaignId: string;
  emailSlug: string;
  mode: CampaignMode;
  attemptedBy: string;
  attemptedAt: string;
  outcome: 'refused' | 'dry-run' | 'delivered';
  blockerCodes: string[];
  recipientCount: number;
  excludedCount: number;
  contentDigest: string;
};

export function buildAuditEntry(
  input: SendReadinessInput,
  readiness: SendReadiness,
  outcome: SendAuditEntry['outcome'],
  attemptedAt: string,
): SendAuditEntry {
  return {
    campaignId: input.metadata.campaignId,
    emailSlug: input.metadata.emailSlug,
    mode: input.metadata.mode,
    attemptedBy: input.metadata.preparedBy,
    attemptedAt,
    outcome,
    blockerCodes: readiness.blockers.map((b) => b.code),
    recipientCount: readiness.eligibleRecipients.length,
    excludedCount: readiness.excluded.length,
    contentDigest: input.contentDigest,
  };
}
