/**
 * Directory offers — the three business-facing options, exactly as approved.
 *
 * These are **inquiry offers**, not a checkout. Nothing here collects payment,
 * creates a subscription, activates featured status, or modifies a listing.
 * Every path ends at the existing sponsor inquiry form, and every request is
 * reviewed by a human before anything changes.
 *
 * Prices are the approved figures and live in exactly one place so every page
 * that shows them cannot drift apart (asserted by scripts/test-directory-offers).
 *
 * Capacity numbers are the REAL operating limits agreed for the directory —
 * they are stated as a policy ("up to three per page"), never as live
 * availability, and the UI must never claim a spot count is running out.
 */

export type BillingPeriod = 'monthly' | 'annual';

export type Offer = {
  /** Stable key; also the value written to `sponsors.tier_interest`. */
  id: 'listing-claim' | 'featured-listing' | 'corridor-sponsor';
  name: string;
  /** Cents, so no floating-point money. `null` = free. */
  monthlyCents: number | null;
  annualCents: number | null;
  /** The real operating limit for this offer, or null when it does not apply. */
  capacity: string | null;
  summary: string;
  includes: string[];
};

export const OFFERS: readonly Offer[] = [
  {
    id: 'listing-claim',
    name: 'Listing claim',
    monthlyCents: null,
    annualCents: null,
    capacity: null,
    summary: 'Free. Tell us you run the business and we review it by hand.',
    includes: [
      'Free — there is nothing to pay',
      'Reviewed manually by Shawn',
      'Correct your hours, services, phone and website',
      'Claiming does not transfer or change the listing on its own',
    ],
  },
  {
    id: 'featured-listing',
    name: 'Featured listing',
    monthlyCents: 9900,
    annualCents: 99900,
    capacity: 'Up to three featured businesses per category or corridor page',
    summary: 'Your listing shown in the featured position on the pages that cover your area.',
    includes: [
      'Featured position on your category and corridor pages',
      'Labelled as sponsored, as every paid placement is',
      'Up to three featured businesses per page — a real limit, not a countdown',
      'Inquiry and manual approval only; nothing activates automatically',
    ],
  },
  {
    id: 'corridor-sponsor',
    name: 'Corridor sponsor',
    monthlyCents: 29900,
    annualCents: 299900,
    capacity: 'One primary sponsor per corridor page',
    summary: 'The primary sponsor position on an interstate corridor page.',
    includes: [
      'Primary sponsor position on the corridor page you choose',
      'One primary sponsor per corridor page',
      'Labelled as sponsored',
      'Inquiry and manual approval only; nothing activates automatically',
    ],
  },
] as const;

export type OfferId = Offer['id'];

export function getOffer(id: OfferId): Offer {
  const found = OFFERS.find((o) => o.id === id);
  if (!found) throw new Error(`Unknown offer: ${id}`);
  return found;
}

/** `9900` → `$99`, `299900` → `$2,999`. Whole dollars only — all prices are. */
export function formatPrice(cents: number | null): string {
  if (cents === null) return 'Free';
  const dollars = cents / 100;
  const whole = Number.isInteger(dollars) ? dollars : Math.round(dollars);
  return `$${whole.toLocaleString('en-US')}`;
}

/** "$99/month or $999/year", or "Free". */
export function priceLabel(offer: Offer): string {
  if (offer.monthlyCents === null && offer.annualCents === null) return 'Free';
  const parts: string[] = [];
  if (offer.monthlyCents !== null) parts.push(`${formatPrice(offer.monthlyCents)}/month`);
  if (offer.annualCents !== null) parts.push(`${formatPrice(offer.annualCents)}/year`);
  return parts.join(' or ');
}

/**
 * What an annual plan saves versus twelve monthly payments. Derived, never
 * hand-written, so it can never contradict the prices above.
 */
export function annualSavingsCents(offer: Offer): number | null {
  if (offer.monthlyCents === null || offer.annualCents === null) return null;
  return offer.monthlyCents * 12 - offer.annualCents;
}

/** Billing preference recorded on an inquiry. Never a charge. */
export const BILLING_LABEL: Record<BillingPeriod, string> = {
  monthly: 'Monthly',
  annual: 'Annual',
};
