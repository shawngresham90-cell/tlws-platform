import type { FounderTier, PublicFounder } from '@/lib/community/founders';
import { TIER_LABEL, TIER_ORDER } from '@/components/community/tiers';

/**
 * Founder-number rendering for THE ROAD AHEAD wall.
 *
 * Turns the raw published founders into a stable, deterministic wall sequence:
 * grouped by tier in recognition order, each founder gets a 1-based place within
 * their tier AND a 1-based "founder number" across the whole wall in reading
 * order (top-left to bottom-right). The founder number is purely their position
 * on the wall — it is NOT derived from, and never implies, any contribution
 * amount (amounts are private and never leave the DB; see campaign.ts).
 *
 * DB-free and deterministic so the cinematic wall renders identically on the
 * server (first paint) and the client (3D animation), and so the sequencing is
 * unit-tested in isolation (scripts/test-road-ahead.ts).
 */

export type WallFounder = {
  id: string;
  displayName: string;
  businessName: string | null;
  businessUrl: string | null;
  tier: FounderTier;
  tierLabel: string;
  /** 1-based place within the founder's tier, as shown on the wall. */
  tierPosition: number;
  /** 1-based place across the ENTIRE wall in reading order — the founder number. */
  wallNumber: number;
  message: string | null;
};

/** Tier's rank in wall order; unknown/absent tiers sort after all known tiers. */
export function tierRank(tier: FounderTier): number {
  const i = TIER_ORDER.indexOf(tier);
  return i === -1 ? TIER_ORDER.length : i;
}

/**
 * Total ordering for the wall: tier first, then the founder's within-tier
 * `position` (nulls last), then newest paid first, then id as a final stable
 * tie-break so equal inputs never reorder between renders.
 */
export function compareForWall(a: PublicFounder, b: PublicFounder): number {
  const tr = tierRank(a.tier) - tierRank(b.tier);
  if (tr !== 0) return tr;

  const ap = a.position;
  const bp = b.position;
  if (ap !== bp) {
    if (ap === null) return 1; // nulls sort last within the tier
    if (bp === null) return -1;
    return ap - bp;
  }

  // paid_at descending (newest first) — matches the existing wall convention.
  const at = Date.parse(a.paid_at ?? '');
  const bt = Date.parse(b.paid_at ?? '');
  const avalid = !Number.isNaN(at);
  const bvalid = !Number.isNaN(bt);
  if (avalid && bvalid && at !== bt) return bt - at;
  if (avalid !== bvalid) return avalid ? -1 : 1;

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Assemble the ordered wall: assign each founder a within-tier place and a
 * global founder number. Pure — same input array always yields the same
 * sequence (the input is copied before sorting, never mutated).
 */
export function buildWallSequence(founders: PublicFounder[]): WallFounder[] {
  const ordered = [...founders].sort(compareForWall);
  const perTier = new Map<FounderTier, number>();

  return ordered.map((f, i) => {
    const tierPosition = (perTier.get(f.tier) ?? 0) + 1;
    perTier.set(f.tier, tierPosition);
    return {
      id: f.id,
      displayName: f.display_name,
      businessName: f.business_name,
      businessUrl: f.business_url,
      tier: f.tier,
      tierLabel: TIER_LABEL[f.tier] ?? 'Founder',
      tierPosition,
      wallNumber: i + 1,
      message: f.message,
    };
  });
}

/**
 * True only for absolute http(s) URLs. The wall renders a founder's
 * `business_url` as a link; this guards against a stored `javascript:`/`data:`
 * (or malformed) URL ever reaching an href, in which case the caller renders
 * plain text instead.
 */
export function isSafeExternalUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Zero-pad a founder number to at least `width` digits (default 3): 7 → "007". */
export function padFounderNumber(n: number, width = 3): string {
  const safe = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 0;
  return String(safe).padStart(width, '0');
}

/** Render a founder number for display: 7 → "No. 007". */
export function formatFounderNumber(n: number, width = 3): string {
  return `No. ${padFounderNumber(n, width)}`;
}

/**
 * Pick the zero-pad width from the wall size so numbering stays visually even:
 * ≤99 founders → 2 digits, ≤999 → 3, etc. Always at least 2 for a cinematic look.
 */
export function founderNumberWidth(total: number): number {
  const digits = total >= 1 ? String(Math.floor(total)).length : 1;
  return Math.max(2, digits);
}
