import { SHIRTS_LEFT, SHIRTS_TOTAL_RUN } from './shirt-inventory';

/**
 * TRUCKING LIFE DIRECT PRODUCTS — the storefront Trucking Life actually sells.
 *
 * Separate from the Amazon catalog on purpose. `StoreProduct` is an
 * Amazon-shaped contract (asin / rating / reviewCount / verifiedTitle) and
 * every consumer of it — the affiliate CTA, the Offer schema, the readiness
 * audit — is written against those fields. Widening that type into a union
 * would have rewritten all of them for no gain. A direct product shares almost
 * nothing with an affiliate listing except having a name and a picture, so it
 * gets its own model and its own render path, and the Amazon code stays
 * untouched and restorable.
 *
 * CHECKOUT IS EXTERNAL. Every purchase or download happens on Stan; this repo
 * has no payment processor and creates none. A product's `stanUrl` is the only
 * outbound destination, and it must live under the approved account prefix.
 *
 * PRICES ARE NEVER INVENTED. `priceUsd: null` means the owner has not confirmed
 * a price, and a null price is what disables the purchase CTA — see
 * `ctaState()`. Nothing here guesses, rounds, or infers a number.
 */

export type DirectProductType = 'free' | 'digital' | 'merch' | 'coaching';

/** How the buyer actually receives it. Drives the copy, not just a label. */
export type Fulfillment = 'digital' | 'physical' | 'scheduled-service';

/** The one Stan account Trucking Life sells through. */
export const STAN_ACCOUNT_PREFIX = 'https://stan.store/TRUCKINGLIFEWITHSHAWN/p/';

/**
 * Order-support address for physical products, owner-designated 2026-08-02.
 * Deliberately NOT the privacy address — that one is scoped to privacy and SMS
 * matters and must not absorb order support.
 */
export const SHIRT_SUPPORT_EMAIL = 'shawngresham90@gmail.com';

/** Where the owner-confirmed physical-product terms live. */
export const SHIPPING_RETURNS_HREF = '/store/shipping-returns';

export type DirectProduct = {
  slug: string;
  name: string;
  type: DirectProductType;
  /** Plain-language grouping shown on cards and used by the category filter. */
  category: string;
  tagline: string;
  description: string;
  /**
   * Whole US dollars, ONLY when the owner has confirmed it. `null` means
   * unconfirmed — never a placeholder, never a guess, and it suppresses the
   * purchase CTA.
   */
  priceUsd: number | null;
  /** Approved Stan checkout / download URL. Validated against the prefix. */
  stanUrl: string;
  fulfillment: Fulfillment;
  /** Short label on the card. `null` renders no badge. */
  badge: string | null;
  /** Owner-created asset under /public/store/products/. */
  image: string;
  featured: boolean;
  /**
   * Blocks the purchase CTA for a reason that is NOT about price — a legal or
   * policy gate that has to clear first. Free products are never blocked.
   */
  purchaseBlockedReason: string | null;
};

/**
 * Reasons a listed product cannot yet be bought. Owner-set, and deliberately
 * spelled out rather than implied, so the blocker is visible in the catalog
 * instead of buried in a component.
 */
const NEEDS_DISCLAIMER =
  'Awaiting approved disclaimer copy — listed for information only until then.';

export const DIRECT_PRODUCTS: DirectProduct[] = [
  /* ── Free driver guides ─────────────────────────────────────────────── */
  {
    slug: 'drivers-mind',
    name: 'The Driver’s Mind — A Trucker’s Guide to Mindset',
    type: 'free',
    category: 'Mindset',
    tagline: 'Straight answers on mindset for life on the road.',
    description:
      'A free digital guide on the mental side of trucking. Protect your head so you can protect your career.',
    priceUsd: 0,
    stanUrl: `${STAN_ACCOUNT_PREFIX}the-drivers-mind--a-truckers-guide-to-mindset-`,
    fulfillment: 'digital',
    badge: 'Free',
    image: '/store/products/drivers-mind.webp',
    featured: true,
    purchaseBlockedReason: null,
  },
  {
    slug: 'free-dot-mistakes',
    name: '7 DOT Inspection Mistakes That Cost Truckers',
    type: 'free',
    category: 'DOT Inspection',
    tagline: 'Common inspection mistakes that cost drivers time and money.',
    description:
      'Free digital guide covering seven DOT inspection mistakes that cost truckers. Digital delivery.',
    priceUsd: 0,
    stanUrl: `${STAN_ACCOUNT_PREFIX}free-7-dot-inspection-mistakes-that-cost-truckers`,
    fulfillment: 'digital',
    badge: 'Free',
    image: '/store/products/7-dot-inspection-mistakes.webp',
    featured: true,
    purchaseBlockedReason: null,
  },
  {
    slug: 'first-72-hours',
    name: 'The First 72 Hours — What to Do If You Fail a DOT Test',
    type: 'free',
    category: 'CDL Protection',
    tagline: 'Legitimate response and recovery steps after a failed DOT test.',
    description:
      'Free digital guide on the first 72 hours after a failed DOT test. Response and recovery information only — not a method to defeat or manipulate a test.',
    priceUsd: 0,
    stanUrl: `${STAN_ACCOUNT_PREFIX}-free-the-first-72-hours--what-to-do-if-you-fa`,
    fulfillment: 'digital',
    badge: 'Free',
    image: '/store/products/first-72-hours.webp',
    featured: true,
    purchaseBlockedReason: null,
  },
  {
    slug: 'dot-inspection-cheat-sheet',
    name: 'DOT Inspection Cheat Sheet',
    type: 'free',
    category: 'DOT Inspection',
    tagline: 'Printable reference for drivers.',
    description: 'Free digital DOT inspection cheat sheet. Printable reference for drivers.',
    priceUsd: 0,
    stanUrl: `${STAN_ACCOUNT_PREFIX}-dot-inspection-cheat-sheet`,
    fulfillment: 'digital',
    badge: 'Free',
    image: '/store/products/dot-inspection-cheat-sheet.webp',
    featured: true,
    purchaseBlockedReason: null,
  },
  {
    slug: 'freedom-we-haul',
    name: 'The Freedom We Haul',
    type: 'free',
    category: 'Trucking Life',
    tagline: 'What the road gives and what it takes.',
    description: 'Free digital guide on what the road gives and takes. Trucking Life perspective.',
    priceUsd: 0,
    stanUrl: `${STAN_ACCOUNT_PREFIX}the-freedom-we-haul-`,
    fulfillment: 'digital',
    badge: 'Free',
    image: '/store/products/freedom-we-haul.webp',
    featured: true,
    purchaseBlockedReason: null,
  },

  /* ── Merch ──────────────────────────────────────────────────────────── */
  {
    slug: 'founding-member-shirt',
    name: 'Founding Member Shirt',
    type: 'merch',
    category: 'Merch',
    // Stock wording is NEVER written here — it comes from shirt-inventory.ts,
    // the single source of truth, via shirtStockLabel() below.
    tagline: 'Wear the build. Supports the Trucking Life Academy.',
    // Corrected 2026-08-02 alongside the policy: fulfillment is NOT "handled on
    // the Stan page" — Trucking Life With Shawn makes and ships it. Stan is
    // checkout only.
    description:
      'A limited run of Founding Member shirts. Made and shipped by Trucking Life With Shawn; checkout and sizing happen on the Stan page.',
    priceUsd: 35,
    stanUrl: `${STAN_ACCOUNT_PREFIX}founding-member-shirt--only-100-made`,
    fulfillment: 'physical',
    badge: 'Limited run',
    image: '/store/products/founding-member-shirt.webp',
    featured: true,
    // Unblocked 2026-08-02: the owner confirmed the fulfillment, dispatch,
    // damaged-order, returns and exchange terms, and they are published at
    // SHIPPING_RETURNS_HREF. That was the only thing holding this back — the
    // $35 price was already confirmed.
    purchaseBlockedReason: null,
  },

  /* ── Digital guides ─────────────────────────────────────────────────── */
  {
    slug: '17-years-zero-violations',
    name: '17 Years. Zero Violations.',
    type: 'digital',
    category: 'CDL Protection',
    tagline: 'The habits and decisions that keep a CDL intact.',
    description:
      'Practical mindset, habits, and decisions that keep a CDL intact. Built from 17 years on the road with a clean record.',
    priceUsd: 19,
    stanUrl: `${STAN_ACCOUNT_PREFIX}17-years-zero-violations`,
    fulfillment: 'digital',
    badge: 'Shawn’s pick',
    image: '/store/products/17-years-zero-violations.webp',
    featured: true,
    purchaseBlockedReason: null,
  },
  {
    slug: 'carnivore-trucker-health-system',
    name: 'Carnivore Trucker Health System',
    type: 'digital',
    category: 'Health',
    tagline: 'Eating and discipline that survive an irregular schedule.',
    description:
      'A carnivore-focused system for drivers: meals, discipline, and health that work with irregular schedules and long days. Digital product — no physical book is shipped.',
    priceUsd: null,
    stanUrl: `${STAN_ACCOUNT_PREFIX}carnivore-in-the-truck`,
    fulfillment: 'digital',
    badge: null,
    image: '/store/products/carnivore-trucker-health-system.webp',
    featured: false,
    purchaseBlockedReason: NEEDS_DISCLAIMER,
  },
  {
    slug: 'save-your-cdl-sap-guide',
    name: 'Save Your CDL: DOT Drug Test & SAP Guide',
    type: 'digital',
    category: 'CDL Protection',
    tagline: 'What the DOT drug test and SAP process actually involve.',
    description:
      'Clear information on DOT drug tests and what the SAP process involves. Digital delivery.',
    priceUsd: null,
    stanUrl: `${STAN_ACCOUNT_PREFIX}save-your-cdl-dot-drug-test--sap-guide-`,
    fulfillment: 'digital',
    badge: null,
    image: '/store/products/save-your-cdl-sap-guide.webp',
    featured: false,
    purchaseBlockedReason: NEEDS_DISCLAIMER,
  },
  {
    slug: 'cdl-crusher-guide',
    name: 'Pass Your CDL Permit Test — The Crusher Guide',
    type: 'digital',
    category: 'CDL Training',
    tagline: 'Focused material for the CDL permit test.',
    description: 'Focused material for the CDL permit test. Digital delivery.',
    priceUsd: null,
    stanUrl: `${STAN_ACCOUNT_PREFIX}pass-your-cdl-permit-test--the-crusher-guide`,
    fulfillment: 'digital',
    badge: null,
    image: '/store/products/cdl-crusher-guide.webp',
    featured: false,
    purchaseBlockedReason: NEEDS_DISCLAIMER,
  },
  {
    slug: 'hos-bible',
    name: 'The HOS Bible',
    type: 'digital',
    category: 'Hours of Service',
    tagline: 'A clear reference on Hours of Service rules.',
    description: 'Clear reference on Hours of Service rules. Digital delivery.',
    priceUsd: null,
    stanUrl: `${STAN_ACCOUNT_PREFIX}the-hos-bible-hours-of-service-laws-every-truck-d`,
    fulfillment: 'digital',
    badge: null,
    image: '/store/products/hos-bible.webp',
    featured: false,
    purchaseBlockedReason: NEEDS_DISCLAIMER,
  },
  {
    slug: 'owner-operator-money',
    name: 'Keep More of Your Money — First-Year Owner-Operator Guide',
    type: 'digital',
    category: 'Owner-Operator',
    tagline: 'Practical guidance for a first-year owner-operator.',
    description:
      'Practical guidance for first-year owner-operators. Digital delivery. No income guarantees.',
    priceUsd: 19,
    stanUrl: `${STAN_ACCOUNT_PREFIX}keep-more-of-your-money--first-year-owneroperato`,
    fulfillment: 'digital',
    badge: null,
    image: '/store/products/owner-operator-money.webp',
    featured: false,
    purchaseBlockedReason: null,
  },

  /* ── Coaching ───────────────────────────────────────────────────────── */
  {
    slug: 'coaching-call',
    name: 'Book a 1:1 Call With Shawn',
    type: 'coaching',
    category: 'Coaching',
    tagline: 'A scheduled call — not a download.',
    description:
      'A personal 1:1 coaching session with Shawn. This is a scheduled call service, not a digital download or a physical product. Scheduling happens on the Stan page.',
    priceUsd: 20,
    stanUrl: `${STAN_ACCOUNT_PREFIX}book-a-11-call-with-me-wxbdizeg`,
    fulfillment: 'scheduled-service',
    badge: 'Coaching',
    image: '/store/products/coaching-call.webp',
    featured: true,
    purchaseBlockedReason: null,
  },
];

/* ── Invariants, enforced at module load ───────────────────────────────── */
// These are the rules that make the model safe. A violation is a build-time
// crash, not a runtime surprise on a customer-facing page.
for (const p of DIRECT_PRODUCTS) {
  if (!p.stanUrl.startsWith(STAN_ACCOUNT_PREFIX)) {
    throw new Error(`${p.slug}: checkout URL is not on the approved Stan account`);
  }
  if (p.type === 'free' && p.priceUsd !== 0) {
    throw new Error(`${p.slug}: a free product must be priced 0, got ${p.priceUsd}`);
  }
  if (p.type === 'merch' && p.fulfillment !== 'physical') {
    throw new Error(`${p.slug}: merch must ship physically, got ${p.fulfillment}`);
  }
  if (p.type === 'coaching' && p.fulfillment !== 'scheduled-service') {
    throw new Error(`${p.slug}: coaching must be a scheduled service, got ${p.fulfillment}`);
  }
  if (p.type === 'digital' && p.fulfillment !== 'digital') {
    throw new Error(`${p.slug}: a digital product must be delivered digitally`);
  }
  if (!p.image.startsWith('/store/products/')) {
    throw new Error(`${p.slug}: image must live under /store/products/`);
  }
}
if (new Set(DIRECT_PRODUCTS.map((p) => p.slug)).size !== DIRECT_PRODUCTS.length) {
  throw new Error('direct product slugs must be unique');
}

/* ── Derived helpers ───────────────────────────────────────────────────── */

const BY_SLUG = new Map(DIRECT_PRODUCTS.map((p) => [p.slug, p]));

export function directProduct(slug: string): DirectProduct | undefined {
  return BY_SLUG.get(slug);
}

export function directProductHref(slug: string): string {
  return `/store/products/${slug}`;
}

/** Distinct categories, in first-appearance order, for the browse filter. */
export function directCategories(): string[] {
  return [...new Set(DIRECT_PRODUCTS.map((p) => p.category))];
}

export type DirectCta =
  | { kind: 'get-free'; label: string; href: string }
  | { kind: 'buy'; label: string; href: string }
  | { kind: 'book'; label: string; href: string }
  | { kind: 'details'; label: string; reason: string };

/**
 * THE CTA GATE. A product may send someone to checkout only when there is a
 * confirmed price AND no outstanding policy blocker. Everything else renders a
 * neutral, non-transactional state — never a "Buy now" over an unknown price,
 * and never a booking button for a service whose cost nobody has approved.
 *
 * Free products are exempt from the price rule for the obvious reason: zero IS
 * the confirmed price.
 */
export function ctaState(p: DirectProduct): DirectCta {
  if (p.purchaseBlockedReason) {
    return { kind: 'details', label: 'View details', reason: p.purchaseBlockedReason };
  }
  if (p.type === 'free') {
    return { kind: 'get-free', label: 'Get it free', href: p.stanUrl };
  }
  if (p.priceUsd === null) {
    return {
      kind: 'details',
      label: 'Details coming soon',
      reason: 'Price not yet confirmed.',
    };
  }
  if (p.type === 'coaching') {
    return { kind: 'book', label: 'Book your call', href: p.stanUrl };
  }
  return { kind: 'buy', label: 'Buy now', href: p.stanUrl };
}

/** Price for display, or null when unconfirmed. Never a placeholder string. */
export function directPriceLabel(p: DirectProduct): string | null {
  if (p.priceUsd === null) return null;
  return p.priceUsd === 0 ? 'Free' : `$${p.priceUsd}`;
}

/**
 * Founder-shirt stock line. Reads shirt-inventory.ts — the enforced single
 * source of truth — so the number can never be hard-coded at a call site.
 */
export function shirtStockLabel(): string {
  return `${SHIRTS_LEFT} of ${SHIRTS_TOTAL_RUN} left`;
}

/**
 * Search + category filter over direct products. Pure, so the browse UI stays
 * a thin wiring layer and this can be unit-tested without a DOM. Featured
 * products sort first; ties keep catalog order, so the result is deterministic
 * across builds.
 */
export function filterDirectProducts(
  products: readonly DirectProduct[],
  { query = '', category = '' }: { query?: string; category?: string },
): DirectProduct[] {
  const q = query.trim().toLowerCase();
  return products
    .filter((p) => (category ? p.category === category : true))
    .filter((p) =>
      q ? `${p.name} ${p.tagline} ${p.category} ${p.type}`.toLowerCase().includes(q) : true,
    )
    .sort((a, b) => Number(b.featured) - Number(a.featured));
}

/** How the buyer receives it, in plain words. */
export function fulfillmentLabel(f: Fulfillment): string {
  if (f === 'physical') return 'Printed and shipped';
  if (f === 'scheduled-service') return 'Scheduled call — nothing is downloaded';
  return 'Digital delivery — nothing is shipped';
}
