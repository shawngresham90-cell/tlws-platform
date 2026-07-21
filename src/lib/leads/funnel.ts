/**
 * Email funnel foundation (Block 2, M3). Pure logic only — no sending, no
 * provider. Defines the canonical source taxonomy, maps sources to
 * newsletter segments (so the owner can send targeted campaigns the day
 * email turns on), and implements first-touch attribution merging for
 * repeat signups.
 */

/** Canonical lead sources currently written by the platform. */
export const LEAD_SOURCES = ['newsletter', 'founder', 'practice-test'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export type LeadSegment = {
  /** Stable segment key for future email tooling. */
  key: string;
  /** Human name shown in admin. */
  label: string;
  /** What the owner should send this segment first (guidance, not automation). */
  firstSend: string;
};

const SEGMENTS: Record<string, LeadSegment> = {
  newsletter: {
    key: 'driver-general',
    label: 'Drivers — general newsletter',
    firstSend: 'Regulation updates and new resources; the general driver track.',
  },
  founder: {
    key: 'supporters',
    label: 'Supporters — founders & funders',
    firstSend: 'School build progress and Founders Wall updates.',
  },
  'practice-test': {
    key: 'students-cdl-prep',
    label: 'Students — CDL prep',
    firstSend: 'Study tips, missed-question drills, and CDL Pre-School.',
  },
};

const FALLBACK_SEGMENT: LeadSegment = {
  key: 'unsegmented',
  label: 'Unsegmented',
  firstSend: 'General newsletter until a better signal exists.',
};

/** Segment for a lead's (first-touch) source. Unknown sources fall back safely. */
export function segmentFor(source: string | null | undefined): LeadSegment {
  return (source && SEGMENTS[source]) || FALLBACK_SEGMENT;
}

export type LeadFields = {
  first_name?: string | null;
  phone?: string | null;
  /** undefined = this form did not collect SMS consent at all. */
  sms_consent?: boolean | null;
  source?: string | null;
  utm?: Record<string, string> | null;
};

/**
 * Merge semantics for a repeat signup, split by field class:
 *
 * - ATTRIBUTION (source, utm): first-touch — set once, never overwritten.
 *   Where the lead originally came from is a historical fact.
 * - CONTACT + CONSENT (first_name, phone, sms_consent): explicit-last-wins —
 *   a submission that PROVIDES the field updates it, including corrections
 *   and consent revocation; a form that didn't collect the field
 *   (undefined/empty) leaves it alone. This keeps planted or stale values
 *   correctable by a later genuine submission instead of sticky forever.
 *
 * Returns only the fields that should be updated — {} means no update.
 */
export function mergeLead(existing: LeadFields, incoming: LeadFields): Partial<LeadFields> {
  const update: Partial<LeadFields> = {};
  if (incoming.first_name && incoming.first_name !== existing.first_name) {
    update.first_name = incoming.first_name;
  }
  if (incoming.phone && incoming.phone !== existing.phone) update.phone = incoming.phone;
  if (
    incoming.sms_consent !== undefined &&
    incoming.sms_consent !== null &&
    incoming.sms_consent !== Boolean(existing.sms_consent)
  ) {
    update.sms_consent = incoming.sms_consent;
  }
  if (!existing.source && incoming.source) update.source = incoming.source;
  if (
    (!existing.utm || Object.keys(existing.utm).length === 0) &&
    incoming.utm &&
    Object.keys(incoming.utm).length > 0
  ) {
    update.utm = incoming.utm;
  }
  return update;
}
