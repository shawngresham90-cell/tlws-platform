import { FOUNDING_STUDENT_CAPACITY } from './constants';

/**
 * CDL Pre-School Founding Student Wall — types + pure helpers.
 *
 * Privacy model (Phase 5): the public wall renders ONLY the fields on
 * `PublicFoundingStudent`. Purchaser email, verification state, admin notes,
 * and timestamps live in the private claims table and never reach this type.
 * The DB reader (data.ts) selects exactly these columns; helpers here are pure
 * so capacity math and anonymity rules are unit-testable without a database.
 */

/** A wall row as the public is allowed to see it. */
export type PublicFoundingStudent = {
  /** Founding spot number, 1..20, assigned by the admin. */
  spotNumber: number | null;
  /** Chosen display name; ignored when anonymous. */
  displayName: string;
  /** Render as "Anonymous Founding Student" and suppress name/business/site. */
  isAnonymous: boolean;
  businessName?: string | null;
  websiteUrl?: string | null;
};

/** What a wall visitor should read for one spot. */
export function publicDisplayName(s: PublicFoundingStudent): string {
  if (s.isAnonymous) return 'Anonymous Founding Student';
  return s.displayName.trim() || 'Founding Student';
}

/** Anonymous rows never expose business or website, whatever the DB holds. */
export function publicLinkFields(s: PublicFoundingStudent): {
  businessName: string | null;
  websiteUrl: string | null;
} {
  if (s.isAnonymous) return { businessName: null, websiteUrl: null };
  return {
    businessName: s.businessName?.trim() || null,
    websiteUrl: isSafePublicUrl(s.websiteUrl) ? s.websiteUrl!.trim() : null,
  };
}

/** Only https URLs are ever rendered as public links. */
export function isSafePublicUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Approved + published rows = spots filled. Never above capacity. */
export function spotsFilled(approvedPublishedCount: number): number {
  if (!Number.isFinite(approvedPublishedCount) || approvedPublishedCount < 0) return 0;
  return Math.min(Math.floor(approvedPublishedCount), FOUNDING_STUDENT_CAPACITY);
}

/** Remaining spots — clamped so it can never go below zero. */
export function spotsRemaining(approvedPublishedCount: number): number {
  return FOUNDING_STUDENT_CAPACITY - spotsFilled(approvedPublishedCount);
}

/** True once every spot is verified and published. */
export function isSoldOut(approvedPublishedCount: number): boolean {
  return spotsRemaining(approvedPublishedCount) === 0;
}

/** Sort wall rows: numbered spots in order, then unnumbered by name. */
export function sortWall(rows: PublicFoundingStudent[]): PublicFoundingStudent[] {
  return [...rows].sort((a, b) => {
    if (a.spotNumber != null && b.spotNumber != null) return a.spotNumber - b.spotNumber;
    if (a.spotNumber != null) return -1;
    if (b.spotNumber != null) return 1;
    return publicDisplayName(a).localeCompare(publicDisplayName(b));
  });
}
