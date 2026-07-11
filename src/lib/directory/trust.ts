/**
 * Verification/trust statuses (Milestone 21). Status is derived ONLY from
 * stored evidence — verification timestamps, approved community activity,
 * change history — never from popularity or guesswork. Public pages show at
 * most the factual "Information last verified [date]" line; these statuses
 * are an admin filtering tool.
 */

export const TRUST_STATUSES = [
  'recently-verified',
  'verified',
  'community-confirmed',
  'needs-reverification',
  'unverified',
] as const;

export type TrustStatus = (typeof TRUST_STATUSES)[number];

export const TRUST_LABELS: Record<TrustStatus, string> = {
  'recently-verified': 'Recently verified',
  verified: 'Verified',
  'community-confirmed': 'Community confirmed',
  'needs-reverification': 'Needs re-verification',
  unverified: 'Unverified',
};

export const RECENT_DAYS = 90;
export const STALE_DAYS = 365;

export type TrustEvidence = {
  /** locations.verified_at (admin-set verification date). */
  verifiedAt?: string | null;
  /** Count of APPROVED reviews for the listing. */
  approvedReviews?: number;
  /** Count of APPROVED correction submissions applied to the listing. */
  approvedCorrections?: number;
  /** Most recent location_history timestamp from a verifying source, if any. */
  lastEvidenceAt?: string | null;
};

/**
 * Derive the status. `now` is injected so results are deterministic in tests.
 * Evidence precedence: explicit verification date → community confirmation →
 * unverified. A verification older than STALE_DAYS demotes to
 * needs-reverification regardless of other signals.
 */
export function trustStatus(evidence: TrustEvidence, now: Date): TrustStatus {
  const verifiedAt = evidence.verifiedAt ? new Date(evidence.verifiedAt) : null;
  const ageDays =
    verifiedAt && !Number.isNaN(verifiedAt.getTime())
      ? (now.getTime() - verifiedAt.getTime()) / 86_400_000
      : null;

  if (ageDays != null) {
    if (ageDays <= RECENT_DAYS) return 'recently-verified';
    if (ageDays <= STALE_DAYS) return 'verified';
    return 'needs-reverification';
  }
  if ((evidence.approvedReviews ?? 0) > 0 || (evidence.approvedCorrections ?? 0) > 0) {
    return 'community-confirmed';
  }
  return 'unverified';
}
