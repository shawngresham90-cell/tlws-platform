/**
 * Directory claim / featured-placement funnel — pure helpers.
 *
 * Both business-facing paths reuse the EXISTING sponsor inquiry pipeline
 * (`/sponsors` → `POST /api/sponsor-inquiry` → `sponsors` + `sponsor_touches`).
 * No new table, no migration, no payment, no price. `sponsors.tier_interest`
 * carries which path the business came through; the listing it refers to rides
 * along as bounded query params and is shown back to them before they send.
 *
 * Everything here is deliberately side-effect free so the bounding rules can be
 * unit-tested: every value that reaches a URL or an analytics event is length-
 * capped and character-restricted, and nothing personal is ever included.
 */

/** Values written to `sponsors.tier_interest` (free text in the DB, max 60). */
export const FUNNEL_INTEREST = {
  claim: 'listing-claim',
  featured: 'directory-placement',
} as const;

export type FunnelIntent = keyof typeof FUNNEL_INTEREST;

/** Analytics event names. Kept stable — dashboards key off these strings. */
export const DIRECTORY_EVENTS = {
  directoryView: 'directory_view',
  categoryView: 'directory_category_view',
  listingView: 'directory_listing_view',
  search: 'directory_search',
  filter: 'directory_filter',
  mapInteract: 'directory_map_interact',
  directionsClick: 'directory_directions_click',
  websiteClick: 'directory_website_click',
  phoneClick: 'directory_phone_click',
  claimInterest: 'directory_claim_interest',
  featuredInterest: 'directory_featured_interest',
  formStart: 'directory_inquiry_start',
  formSubmit: 'directory_inquiry_submit',
  formFail: 'directory_inquiry_fail',
} as const;

/**
 * Clamp any free text to a slug-ish, bounded token. Anything that is not a
 * plain word character collapses to a hyphen, so a name can never smuggle
 * markup, a query string, or an email address into a URL or an event.
 */
export function boundToken(value: string | null | undefined, max = 48): string | null {
  if (!value) return null;
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return slug || null;
}

/** Two-letter state code, or null. */
export function boundState(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : null;
}

/** `I-40` → `i40`, for corridor reporting. Null when there is no interstate. */
export function boundCorridor(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^I-?\s?(\d{1,3})$/i.exec(value.trim());
  return m ? `i${Number(m[1])}` : null;
}

export type ListingContext = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  category?: string | null;
  state?: string | null;
  interstate?: string | null;
};

/**
 * The analytics payload for a listing. Deliberately excludes anything a person
 * typed: no email, phone, message body, address, or free-form name — `name` is
 * reduced to the same bounded slug the URL uses.
 */
export function listingEventProps(
  ctx: ListingContext,
  extra?: Record<string, string | null | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (k: string, v: string | null | undefined) => {
    if (v) out[k] = v;
  };
  put('listing_id', ctx.id ?? null);
  put('slug', boundToken(ctx.slug, 64));
  put('category', boundToken(ctx.category, 32));
  put('state', boundState(ctx.state));
  put('corridor', boundCorridor(ctx.interstate));
  for (const [k, v] of Object.entries(extra ?? {})) put(k, typeof v === 'string' ? v : null);
  return out;
}

/**
 * Build the deep link into the existing sponsor inquiry form. The listing is
 * passed as bounded params so the form can show the business exactly which
 * listing the inquiry is about before they send it.
 */
export function funnelHref(intent: FunnelIntent, ctx: ListingContext, surface?: string): string {
  const params = new URLSearchParams({ interest: FUNNEL_INTEREST[intent] });
  const slug = boundToken(ctx.slug, 64);
  const name = boundToken(ctx.name, 64);
  const cat = boundToken(ctx.category, 32);
  const st = boundState(ctx.state);
  const from = boundToken(surface, 32);
  if (slug) params.set('listing', slug);
  if (name) params.set('lname', name);
  if (cat) params.set('lcat', cat);
  if (st) params.set('lstate', st);
  if (from) params.set('from', from);
  return `/sponsors?${params.toString()}#inquire`;
}

/**
 * The single, clearly-labelled line appended to the inquiry message so the
 * listing reaches the CRM note. Shown in the UI before sending — never hidden.
 * Returns '' when there is no listing context, so nothing is fabricated.
 */
export function listingContextLine(ctx: {
  name?: string | null;
  slug?: string | null;
  category?: string | null;
  state?: string | null;
}): string {
  const slug = boundToken(ctx.slug, 64);
  if (!slug) return '';
  const bits = [ctx.name?.trim() || slug];
  const cat = boundToken(ctx.category, 32);
  const st = boundState(ctx.state);
  if (cat) bits.push(cat);
  if (st) bits.push(st);
  return `Regarding directory listing: ${bits.join(' · ')} (/directory/location/${slug})`;
}

/** Human label for the two paths. No promises, no pricing. */
export function intentLabel(intent: FunnelIntent): string {
  return intent === 'claim' ? 'Claim this listing' : 'Ask about featured placement';
}
