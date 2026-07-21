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
  sms_consent?: boolean | null;
  source?: string | null;
  utm?: Record<string, string> | null;
};

/**
 * First-touch attribution merge: when a known email signs up again,
 * source/utm keep their ORIGINAL values (where the lead really came from),
 * missing contact fields fill in, and sms consent is true-wins (a later
 * opt-in must stick; a later form that defaults to false must not revoke).
 * Returns only the fields that should be updated — {} means no update.
 */
export function mergeLead(existing: LeadFields, incoming: LeadFields): Partial<LeadFields> {
  const update: Partial<LeadFields> = {};
  if (!existing.first_name && incoming.first_name) update.first_name = incoming.first_name;
  if (!existing.phone && incoming.phone) update.phone = incoming.phone;
  if (!existing.sms_consent && incoming.sms_consent) update.sms_consent = true;
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
