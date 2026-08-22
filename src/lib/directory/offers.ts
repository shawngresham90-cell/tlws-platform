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

/** Which mechanism actually serves an offer once it is sold. */
export type PlacementMechanism =
  /** Nothing is placed — a human reviews a claim and records the outcome. */
  | 'manual-review'
  /** `locations.is_featured`, a bare boolean with no date window. */
  | 'locations.is_featured'
  /** A `directory_sponsors` row, with a real `starts_at`/`ends_at` window. */
  | 'directory_sponsors';

/** What an offer has to be pointed at before it can be activated. */
export type OfferTargetType = 'none' | 'listing' | 'corridor';

export type Offer = {
  /** Stable key; also the value written to `sponsors.tier_interest`. */
  id: 'listing-claim' | 'featured-listing' | 'corridor-sponsor';
  /** Public label, as a business reads it. */
  name: string;
  /** Admin/CRM label. Kept separate so a public rename cannot move admin copy. */
  adminLabel: string;
  /** Cents, so no floating-point money. `null` = free. */
  monthlyCents: number | null;
  annualCents: number | null;
  /** Terms a business may actually buy. Empty for a free offer. */
  terms: readonly BillingPeriod[];
  /** True when money changes hands. A free claim is never `true`. */
  paid: boolean;
  /** How the sold placement is stored and rendered. */
  mechanism: PlacementMechanism;
  /** Hard limit of simultaneous placements on the relevant surface. */
  maxPerSurface: number | null;
  /**
   * Whether the placement stops showing on its own at the end of its term.
   * `false` is a real operational cost, not a detail: a placement that cannot
   * expire has to be stopped by a human, and the admin says so.
   */
  autoExpires: boolean;
  /** What the placement must be pointed at before activation. */
  targetType: OfferTargetType;
  /** The exact word shown on the public placement, or null when nothing shows. */
  disclosure: string | null;
  /** What this offer explicitly does NOT buy. Used verbatim in the sales kit. */
  limitations: readonly string[];
  /** The real operating limit for this offer, or null when it does not apply. */
  capacity: string | null;
  summary: string;
  includes: string[];
};

/**
 * What NO paid placement on this directory ever buys. Stated once, reused
 * verbatim in the offer copy, the admin quote step and the owner sales kit, so
 * a proposal cannot quietly soften them.
 */
export const UNIVERSAL_LIMITATIONS = [
  'No guaranteed traffic, leads, calls or sales.',
  'No guaranteed search ranking.',
  'Paid placement never changes a listing\u2019s facts, parking truth, hours or reviews.',
  'Every paid placement is labelled Sponsored and carries rel="sponsored".',
] as const;

export const OFFERS: readonly Offer[] = [
  {
    id: 'listing-claim',
    name: 'Listing claim',
    adminLabel: 'Listing claim (free, manual review)',
    monthlyCents: null,
    annualCents: null,
    terms: [],
    paid: false,
    mechanism: 'manual-review',
    maxPerSurface: null,
    autoExpires: false,
    targetType: 'none',
    disclosure: null,
    limitations: [
      ...UNIVERSAL_LIMITATIONS,
      'Claiming does not give the claimant permission to edit the listing.',
      'A claim is reviewed by hand and can be rejected.',
    ],
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
    adminLabel: 'Featured listing (locations.is_featured — manual expiry)',
    monthlyCents: 9900,
    annualCents: 99900,
    terms: ['monthly', 'annual'],
    paid: true,
    mechanism: 'locations.is_featured',
    maxPerSurface: 3,
    // REVENUE-2: `locations.featured_until` gives the placement a real term and
    // the public read path enforces it, so a featured listing now stops showing
    // on its own exactly as a corridor sponsor does.
    //
    // This describes the PRODUCT. Whether this particular database can deliver
    // it depends on migration 057 having been applied, which is why
    // `renewalView` takes the schema state rather than trusting this flag
    // alone — before the migration an expired placement really is still
    // showing, and the admin says so.
    autoExpires: true,
    targetType: 'listing',
    disclosure: 'Sponsored',
    limitations: [
      ...UNIVERSAL_LIMITATIONS,
      'Not exclusive — up to three sponsored listings share a page.',
      'The placement ends automatically when the paid term does; it is not renewed unless you renew it.',
      'A sponsored listing is still ranked and described by the same rules as every other listing.',
    ],
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
    adminLabel: 'Corridor sponsor (directory_sponsors — auto-expires)',
    monthlyCents: 29900,
    annualCents: 299900,
    terms: ['monthly', 'annual'],
    paid: true,
    mechanism: 'directory_sponsors',
    maxPerSurface: 1,
    // A real starts_at/ends_at window, filtered on every render.
    autoExpires: true,
    targetType: 'corridor',
    disclosure: 'Sponsored',
    limitations: [
      ...UNIVERSAL_LIMITATIONS,
      'Sole primary sponsor of the one corridor page bought — not of the site, a state, or a category.',
      'The block is a sponsor unit, not a directory listing, and is never ranked among listings.',
    ],
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

/* --------------------------------------------------------------- authority */

/** Every offer id, in the order the offers are presented. */
export const OFFER_IDS = OFFERS.map((o) => o.id) as readonly OfferId[];

/** Runtime-safe narrowing for a value that arrived from a form or a URL. */
export function isOfferId(value: unknown): value is OfferId {
  return typeof value === 'string' && (OFFER_IDS as readonly string[]).includes(value);
}

/** Runtime-safe narrowing for a billing term. */
export function isBillingPeriod(value: unknown): value is BillingPeriod {
  return value === 'monthly' || value === 'annual';
}

/**
 * Every value the public inquiry form is allowed to submit as `tier_interest`.
 *
 * The three directory offers are the priced ones; the rest are conversation
 * starters that carry no price at all. This is the bounded set the API schema
 * validates against — an offer id is never free text, so a crafted request
 * cannot store an arbitrary "tier" against a CRM row, and a link cannot invent
 * an offer that does not exist.
 */
export const INQUIRY_OPTION_IDS = [
  'listing-claim',
  'featured-listing',
  'corridor-sponsor',
  'founding-sponsor',
  'directory-placement',
  'equipment-or-students',
  'other',
] as const;

// Written out as a literal tuple because `z.enum` needs one, then checked
// against the offer authority at compile time: adding an offer without adding
// it here — which would make the API silently reject its own funnel's links —
// stops the build rather than reaching production.
type _EveryOfferIsInquirable = OfferId extends (typeof INQUIRY_OPTION_IDS)[number] ? true : never;
const _everyOfferIsInquirable: _EveryOfferIsInquirable = true;
void _everyOfferIsInquirable;

export type InquiryOptionId = (typeof INQUIRY_OPTION_IDS)[number];

export function isInquiryOptionId(value: unknown): value is InquiryOptionId {
  return typeof value === 'string' && (INQUIRY_OPTION_IDS as readonly string[]).includes(value);
}

/**
 * The option list the public form renders. Priced options take their label from
 * the offer record, so a price exists in exactly one place in the codebase and
 * the dropdown cannot drift from the offer table beside it.
 */
export const INQUIRY_OPTIONS: readonly { value: InquiryOptionId; label: string }[] = [
  { value: 'listing-claim', label: 'Claim my directory listing (free)' },
  {
    value: 'featured-listing',
    label: `Featured listing — ${priceLabel(getOffer('featured-listing'))}`,
  },
  {
    value: 'corridor-sponsor',
    label: `Corridor sponsor — ${priceLabel(getOffer('corridor-sponsor'))}`,
  },
  { value: 'founding-sponsor', label: 'Founding Sponsor' },
  { value: 'directory-placement', label: 'Directory placement (not sure which)' },
  { value: 'equipment-or-students', label: 'Equipment / sponsor a student' },
  { value: 'other', label: 'Something else' },
];

/**
 * The standard price of an offer on a given term, in cents.
 *
 * `null` means the combination is not sellable — either the offer is free, or
 * the term is not one this offer is sold on. It is deliberately NOT `0`: a
 * caller must not be able to treat "no such price" as "costs nothing".
 */
export function standardAmountCents(id: OfferId, term: BillingPeriod): number | null {
  const offer = getOffer(id);
  if (!offer.terms.includes(term)) return null;
  return term === 'annual' ? offer.annualCents : offer.monthlyCents;
}

/** "Annual" / "Monthly". */
export function termLabel(term: BillingPeriod): string {
  return BILLING_LABEL[term];
}

/** The offers that actually cost money. A free claim is never in this list. */
export function paidOffers(): Offer[] {
  return OFFERS.filter((o) => o.paid);
}
