/**
 * Prospect shortlist — who the owner could call first, derived only from the
 * public directory.
 *
 * This exists because the pipeline is empty. Every other part of the revenue
 * system answers "what do I do with an inquiry"; none of them answers "there
 * are no inquiries yet, so who do I ring". Without something bounded here that
 * question gets answered by scrolling 2,400 listings, which is how the first
 * sale quietly never happens.
 *
 * The strict boundaries, because a prospecting list is exactly where a platform
 * starts doing things it should not:
 *
 *   * Only PUBLIC BUSINESS data. The phone and website used here are the ones
 *     already printed on the listing page for any driver to see. No personal
 *     contact, no scraped owner name, no email harvesting, nothing that is not
 *     already public on our own site.
 *   * No invented signal. Ranking uses listing completeness, corridor presence
 *     and category — facts we hold. There is no traffic estimate, no
 *     "likelihood to buy", no lead score dressed up as data we do not have.
 *   * Held brands are excluded, because nobody at a national chain's local site
 *     can sell us a placement and pretending otherwise misrepresents it.
 *   * It is a READ. Nothing here writes, contacts, emails, or queues an
 *     automated anything. It produces a list a human chooses to work.
 */

import { isHeldBrand } from './placements';

/** Categories where a local operator can plausibly buy a placement. */
export const MONETIZABLE_CATEGORIES = [
  'truck-stops',
  'truck-washes',
  'tire-repair',
  'roadside-service',
  'parking',
  'hotels-truck-parking',
  'cdl-schools',
] as const;

/**
 * Categories deliberately left out, and why. `weigh-stations` and `cat-scales`
 * are infrastructure rather than businesses with a marketing budget — a weigh
 * station has nobody to sell to.
 */
export const NON_MONETIZABLE_CATEGORIES = ['weigh-stations', 'cat-scales'] as const;

export function isMonetizableCategory(slug: string | null | undefined): boolean {
  return Boolean(slug && (MONETIZABLE_CATEGORIES as readonly string[]).includes(slug));
}

export type ProspectListing = {
  id: string;
  name: string | null;
  detailSlug: string | null;
  categorySlug: string | null;
  state: string | null;
  city: string | null;
  interstate: string | null;
  /** Public business phone as printed on the listing. */
  phone: string | null;
  /** Public business website as printed on the listing. */
  website: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  deletedAt: string | null;
};

/** A CRM row, reduced to what duplicate-matching needs. */
export type KnownContact = {
  id: string;
  company: string | null;
};

export type Prospect = {
  listing: ProspectListing;
  score: number;
  /** Plain, checkable statements. Never a prediction. */
  reasons: string[];
  /** Set when this business already appears in the CRM, so it is not sold twice. */
  existingCrmId: string | null;
};

function normalise(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/\b(?:inc|llc|ltd|co|corp|company|the)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Why a listing is not a prospect at all. Empty means it is eligible. */
export function eligibilityBlockers(l: ProspectListing): string[] {
  const out: string[] = [];
  if (!l.isPublished) out.push('not published');
  if (l.deletedAt) out.push('deleted');
  if (l.isFeatured) out.push('already sponsored');
  if (isHeldBrand(l.name)) out.push('held brand — never promoted');
  if (!isMonetizableCategory(l.categorySlug)) out.push('category has nobody to sell to');
  if (!l.phone?.trim() && !l.website?.trim()) out.push('no public business contact');
  if (!l.name?.trim() || !l.detailSlug?.trim()) out.push('listing identity incomplete');
  return out;
}

/**
 * How complete a listing looks, 0–4. A more complete listing is a better first
 * call for a reason that holds up when said aloud: the operator can see what
 * they would be sponsoring, and there is less for us to have to fix first.
 */
function completeness(l: ProspectListing): number {
  let n = 0;
  if (l.phone?.trim()) n++;
  if (l.website?.trim()) n++;
  if (l.city?.trim()) n++;
  if (l.state?.trim()) n++;
  return n;
}

/**
 * Rank eligible listings. The score exists only to order the list; it is not
 * shown as a probability, a grade, or a value, because it is none of those.
 */
export function scoreProspect(l: ProspectListing): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (l.phone?.trim() && l.website?.trim()) {
    score += 3;
    reasons.push('Public phone and website on the listing');
  } else if (l.phone?.trim()) {
    score += 2;
    reasons.push('Public business phone on the listing');
  } else if (l.website?.trim()) {
    score += 1;
    reasons.push('Public business website on the listing');
  }

  if (l.interstate?.trim()) {
    score += 2;
    reasons.push(`Appears on the ${l.interstate} corridor page`);
  }

  if (l.categorySlug) {
    score += 1;
    reasons.push(`Eligible category: ${l.categorySlug}`);
  }

  score += completeness(l);
  reasons.push('No current sponsor on this listing');

  return { score, reasons };
}

/**
 * The shortlist. `known` are existing CRM rows: a match is flagged rather than
 * removed, because "we already talked to them" is a different conversation from
 * "we have never heard of them", and both belong in front of the owner.
 *
 * `limit` is applied after sorting and the caller is told what was dropped —
 * a silently truncated list reads as "that is everyone", which it is not.
 */
export function shortlist(
  listings: ProspectListing[],
  known: KnownContact[],
  limit = 25,
): { prospects: Prospect[]; eligible: number; dropped: number } {
  const knownByName = new Map<string, string>();
  for (const k of known) {
    const key = normalise(k.company);
    if (key && !knownByName.has(key)) knownByName.set(key, k.id);
  }

  const eligible = listings.filter((l) => eligibilityBlockers(l).length === 0);
  const scored: Prospect[] = eligible.map((listing) => {
    const { score, reasons } = scoreProspect(listing);
    const existingCrmId = knownByName.get(normalise(listing.name)) ?? null;
    return {
      listing,
      score,
      reasons: existingCrmId
        ? [...reasons, 'Already in the CRM — check before contacting']
        : reasons,
      existingCrmId,
    };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (a.listing.name ?? '').localeCompare(b.listing.name ?? '') ||
      a.listing.id.localeCompare(b.listing.id),
  );

  return {
    prospects: scored.slice(0, limit),
    eligible: scored.length,
    dropped: Math.max(0, scored.length - limit),
  };
}

/**
 * One line per prospect, for the owner to paste into whatever they actually
 * work from. Public business details only — the same phone and website a driver
 * sees on the listing page — and no message text, because this file never
 * writes outreach and nothing sends it.
 */
export function outreachQueueLines(prospects: Prospect[]): string[] {
  return prospects.map((p) => {
    const l = p.listing;
    const where = [l.city, l.state, l.interstate].filter(Boolean).join(', ');
    const contact = [l.phone?.trim(), l.website?.trim()].filter(Boolean).join(' | ');
    return [l.name ?? l.id, where, contact, `/directory/location/${l.detailSlug ?? ''}`]
      .filter(Boolean)
      .join(' — ');
  });
}
