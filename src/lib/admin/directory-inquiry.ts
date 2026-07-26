/**
 * Directory inquiry parsing for the admin sponsor inbox.
 *
 * The directory funnel cannot add columns to `sponsors` (that would be a
 * migration), so it writes two clearly-labelled lines into the existing
 * `notes` field and puts the offer id in the existing `tier_interest`:
 *
 *   Regarding directory listing: Name · category · ST · I-95 (/directory/location/slug)
 *   Billing preference: Annual (preference only — no payment was taken)
 *
 * This module reads those back out so the inbox can show inquiry type, listing,
 * category, state, corridor and billing preference as their own columns. It is
 * a pure read of data we already store — nothing here writes, approves, or
 * changes a listing, and a note that does not match simply yields nulls.
 */

export type DirectoryInquiryType = 'listing-claim' | 'featured-listing' | 'corridor-sponsor';

export type ParsedDirectoryInquiry = {
  /** Null when this sponsor row did not come from the directory funnel. */
  type: DirectoryInquiryType | null;
  typeLabel: string | null;
  listingName: string | null;
  listingSlug: string | null;
  listingPath: string | null;
  category: string | null;
  state: string | null;
  /** Display form, e.g. `I-95`. Null when the listing is not on a corridor. */
  corridor: string | null;
  billing: 'monthly' | 'annual' | null;
  /** The message with the machine-written lines removed, for readability. */
  message: string | null;
};

const TYPE_LABEL: Record<DirectoryInquiryType, string> = {
  'listing-claim': 'Listing claim',
  'featured-listing': 'Featured listing',
  'corridor-sponsor': 'Corridor sponsor',
};

const TYPES = new Set(Object.keys(TYPE_LABEL) as DirectoryInquiryType[]);

const LISTING_RE =
  /^Regarding directory listing:\s*(.+?)\s*\((\/directory\/location\/[a-z0-9-]+)\)\s*$/im;
const BILLING_RE = /^Billing preference:\s*(Monthly|Annual)\b/im;

export function parseDirectoryInquiry(
  tierInterest: string | null | undefined,
  notes: string | null | undefined,
): ParsedDirectoryInquiry {
  const empty: ParsedDirectoryInquiry = {
    type: null,
    typeLabel: null,
    listingName: null,
    listingSlug: null,
    listingPath: null,
    category: null,
    state: null,
    corridor: null,
    billing: null,
    message: notes?.trim() || null,
  };

  const t = (tierInterest ?? '').trim();
  const type = TYPES.has(t as DirectoryInquiryType) ? (t as DirectoryInquiryType) : null;

  const text = notes ?? '';
  const listing = LISTING_RE.exec(text);
  const billingMatch = BILLING_RE.exec(text);

  // Not a directory inquiry at all — return the note untouched.
  if (!type && !listing) return empty;

  let listingName: string | null = null;
  let category: string | null = null;
  let state: string | null = null;
  let corridor: string | null = null;
  let listingSlug: string | null = null;
  let listingPath: string | null = null;

  if (listing) {
    listingPath = listing[2];
    listingSlug = listingPath.replace('/directory/location/', '') || null;
    // "Name · category · ST · I-95" — trailing parts are only present when known.
    const parts = listing[1]
      .split('·')
      .map((p) => p.trim())
      .filter(Boolean);
    listingName = parts[0] ?? null;
    for (const p of parts.slice(1)) {
      if (/^[A-Z]{2}$/.test(p)) state = p;
      else if (/^I-\d{1,3}$/.test(p)) corridor = p;
      else if (!category) category = p;
    }
  }

  // Strip the machine lines so the human message reads cleanly.
  const message =
    text
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(
        (block) =>
          block &&
          !/^Regarding directory listing:/i.test(block) &&
          !/^Billing preference:/i.test(block),
      )
      .join('\n\n')
      .trim() || null;

  return {
    type,
    typeLabel: type ? TYPE_LABEL[type] : null,
    listingName,
    listingSlug,
    listingPath,
    category,
    state,
    corridor,
    billing: billingMatch ? (billingMatch[1].toLowerCase() as 'monthly' | 'annual') : null,
    message,
  };
}

/** True when the row came through the directory funnel. */
export function isDirectoryInquiry(parsed: ParsedDirectoryInquiry): boolean {
  return parsed.type !== null || parsed.listingSlug !== null;
}
