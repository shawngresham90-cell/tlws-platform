/**
 * Paid placement rules — pure, testable, no I/O.
 *
 * Two unrelated mechanisms serve paid placement, and every rule here has to
 * respect the difference (see docs/directory/revenue-operations-gap-analysis.md):
 *
 *   featured listing  → `locations.is_featured`, a bare boolean with no window
 *   corridor sponsor  → a `directory_sponsors` row with `starts_at`/`ends_at`
 *
 * Nothing in this file writes. It answers "may this be activated, and is it
 * still in its term?" so the admin actions can refuse before they touch a row,
 * and so the answers can be unit-tested without a database.
 *
 * Capacity is enforced here as a check-then-act guard, NOT as a database
 * invariant — that would need a partial unique index, i.e. a migration. With a
 * single administrator it is sound; two admins activating the same page in the
 * same instant could still overrun, and the admin UI says so.
 */

/** Approved capacity. One primary sponsor per corridor page. */
export const PRIMARY_CORRIDOR_SPONSORS = 1;
/** Approved capacity. Up to three sponsored businesses per category/corridor page. */
export const FEATURED_PER_PAGE = 3;

export type PlacementKind = 'featured-listing' | 'corridor-sponsor';

export const PLACEMENT_LABEL: Record<PlacementKind, string> = {
  'featured-listing': 'Featured listing',
  'corridor-sponsor': 'Corridor sponsor',
};

/**
 * Brands whose listings are never promoted. They are national chains we hold
 * out of the funnel entirely: nobody at the site can buy a placement, and
 * selling one would misrepresent the relationship. Matched on the listing name
 * because that is where the brand lives in our data.
 */
export const HELD_BRANDS = [
  "love's",
  'pilot',
  'flying j',
  'sapp bros',
  'goasis',
  'thorntons',
] as const;

/** True when a listing name carries a held brand. Case- and spacing-tolerant. */
export function isHeldBrand(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = name.toLowerCase().replace(/\s+/g, ' ');
  return HELD_BRANDS.some((b) => n.includes(b));
}

export type PromotableListing = {
  id: string;
  name: string | null;
  categorySlug: string | null;
  interstate: string | null;
  state: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  deletedAt: string | null;
};

/**
 * Whether a listing may be promoted at all, independent of capacity. Returns
 * every reason it may not, so the admin sees the whole story at once rather
 * than fixing one blocker to discover the next.
 */
export function promotionBlockers(listing: PromotableListing): string[] {
  const out: string[] = [];
  if (!listing.isPublished) out.push('The listing is not published.');
  if (listing.deletedAt) out.push('The listing is deleted.');
  if (isHeldBrand(listing.name)) out.push('Held brand — this listing is never promoted.');
  if (!listing.categorySlug) out.push('The listing has no category, so it has no category page.');
  return out;
}

/* ------------------------------------------------------------------ windows */

export type Window = { startsAt: string | null; endsAt: string | null };

export type WindowStatus = 'scheduled' | 'active' | 'expired' | 'open-ended';

/**
 * Where a term sits relative to `now`. `open-ended` is a real and slightly
 * dangerous state: a placement with no end date runs until a human stops it.
 */
export function windowStatus(w: Window, now: Date = new Date()): WindowStatus {
  const t = now.getTime();
  const start = parseStamp(w.startsAt);
  const end = parseStamp(w.endsAt);
  if (start !== null && t < start) return 'scheduled';
  if (end !== null && t > end) return 'expired';
  return end === null ? 'open-ended' : 'active';
}

/** In-term right now: active or open-ended, never scheduled or expired. */
export function isWithinWindow(w: Window, now: Date = new Date()): boolean {
  const s = windowStatus(w, now);
  return s === 'active' || s === 'open-ended';
}

function parseStamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/** Reasons a proposed term is unusable. Empty means it is fine. */
export function windowBlockers(w: Window): string[] {
  const out: string[] = [];
  const start = parseStamp(w.startsAt);
  const end = parseStamp(w.endsAt);
  if (w.startsAt && start === null) out.push('Start date is not a valid date.');
  if (w.endsAt && end === null) out.push('End date is not a valid date.');
  if (start !== null && end !== null && end <= start)
    out.push('End date must be after the start date.');
  return out;
}

/** The end date a term implies, given a start and the billing period. */
export function termEnd(startsAt: string, billing: 'monthly' | 'annual'): string {
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return startsAt;
  const end = new Date(d);
  if (billing === 'annual') end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end.toISOString();
}

/* --------------------------------------------------- featured-listing capacity */

export type FeaturedUsage = {
  /** Other featured listings sharing the target's category page. */
  category: { slug: string; used: number; limit: number };
  /** Other featured listings sharing the target's corridor page, when it has one. */
  corridor: { corridor: string; used: number; limit: number } | null;
};

/**
 * How full the pages a listing would appear on already are. `existing` is every
 * currently featured, published, non-deleted listing; the target itself is
 * excluded so re-activating an already-featured listing is not counted twice.
 */
export function featuredUsage(
  target: Pick<PromotableListing, 'id' | 'categorySlug' | 'interstate'>,
  existing: PromotableListing[],
): FeaturedUsage {
  const others = existing.filter(
    (l) => l.id !== target.id && l.isFeatured && l.isPublished && !l.deletedAt,
  );
  const category = {
    slug: target.categorySlug ?? '',
    used: target.categorySlug
      ? others.filter((l) => l.categorySlug === target.categorySlug).length
      : 0,
    limit: FEATURED_PER_PAGE,
  };
  const corridor = target.interstate
    ? {
        corridor: target.interstate,
        used: others.filter((l) => l.interstate === target.interstate).length,
        limit: FEATURED_PER_PAGE,
      }
    : null;
  return { category, corridor };
}

/**
 * May this listing be featured? A listing appears on BOTH its category page and
 * its corridor page, so both have to have room — a corridor page that is
 * already full blocks the sale even when the category page is empty.
 */
export function canActivateFeatured(
  target: PromotableListing,
  existing: PromotableListing[],
  window: Window,
): { ok: boolean; blockers: string[]; usage: FeaturedUsage } {
  const blockers = [...promotionBlockers(target), ...windowBlockers(window)];
  const usage = featuredUsage(target, existing);
  if (usage.category.slug && usage.category.used >= usage.category.limit)
    blockers.push(
      `The ${usage.category.slug} category page already has ${usage.category.used} sponsored listings (limit ${usage.category.limit}).`,
    );
  if (usage.corridor && usage.corridor.used >= usage.corridor.limit)
    blockers.push(
      `The ${usage.corridor.corridor} corridor page already has ${usage.corridor.used} sponsored listings (limit ${usage.corridor.limit}).`,
    );
  return { ok: blockers.length === 0, blockers, usage };
}

/* -------------------------------------------------- corridor-sponsor capacity */

export type CorridorSponsorRow = {
  id: string;
  name: string;
  placements: string[];
  interstates: string[];
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

/**
 * Sponsors that would compete for a corridor page's single primary slot.
 *
 * The subtle case is the wildcard: an empty `interstates` array means "every
 * corridor", so a sponsor created with blank targeting occupies the primary
 * slot on every corridor page in the country. Those are returned too — missing
 * them is exactly how a page ends up double-sold.
 */
export function corridorSponsorConflicts(
  sponsors: CorridorSponsorRow[],
  corridor: string,
  now: Date = new Date(),
  excludeId?: string,
): CorridorSponsorRow[] {
  return sponsors.filter(
    (s) =>
      s.id !== excludeId &&
      s.active &&
      s.placements.includes('interstate') &&
      isWithinWindow({ startsAt: s.startsAt, endsAt: s.endsAt }, now) &&
      (s.interstates.length === 0 || s.interstates.includes(corridor)),
  );
}

/**
 * May this corridor sponsor be activated? A blank corridor is rejected outright
 * rather than silently becoming a nationwide wildcard.
 */
export function canActivateCorridorSponsor(
  input: { corridor: string; url: string; name: string },
  existing: CorridorSponsorRow[],
  window: Window,
  now: Date = new Date(),
  excludeId?: string,
): { ok: boolean; blockers: string[]; conflicts: CorridorSponsorRow[] } {
  const blockers = [...windowBlockers(window)];
  if (!input.name.trim()) blockers.push('A sponsor name is required.');
  if (!/^I-\d{1,3}$/.test(input.corridor.trim()))
    blockers.push(
      'A specific corridor is required (for example I-95). Leaving it blank would target every corridor page.',
    );
  if (!/^https?:\/\/[^\s]+$/i.test(input.url.trim()))
    blockers.push('A sponsor link must be an http(s) URL.');

  const conflicts = /^I-\d{1,3}$/.test(input.corridor.trim())
    ? corridorSponsorConflicts(existing, input.corridor.trim(), now, excludeId)
    : [];
  if (conflicts.length >= PRIMARY_CORRIDOR_SPONSORS)
    blockers.push(
      `${input.corridor} already has a primary sponsor (${conflicts.map((c) => c.name).join(', ')}). There is one per corridor page.`,
    );

  return { ok: blockers.length === 0, blockers, conflicts };
}

/* ------------------------------------------------------------- audit trail */

export type PlacementRecord = {
  kind: PlacementKind;
  target: string;
  billing: 'monthly' | 'annual' | null;
  startsAt: string | null;
  endsAt: string | null;
  reviewer: string;
  action: 'activated' | 'deactivated';
};

/**
 * The single labelled line appended to `sponsors.notes` when a placement is
 * activated or stopped. `locations` has no actor column, so this — plus the
 * matching `sponsor_touches` row — is the audit trail, written in the same
 * "Label: value" shape the inquiry funnel already uses so one parser style
 * covers everything.
 */
export function placementNoteLine(r: PlacementRecord, at: string): string {
  const bits = [
    `Placement ${r.action}: ${PLACEMENT_LABEL[r.kind]} — ${r.target}`,
    r.billing ? `billing ${r.billing}` : null,
    r.startsAt ? `from ${r.startsAt.slice(0, 10)}` : null,
    r.endsAt ? `to ${r.endsAt.slice(0, 10)}` : null,
    `by ${r.reviewer}`,
    `on ${at.slice(0, 10)}`,
  ].filter(Boolean);
  return bits.join(' · ');
}

/** Short summary for the `sponsor_touches` row that mirrors the same event. */
export function placementTouchSummary(r: PlacementRecord): string {
  const term = r.endsAt ? ` through ${r.endsAt.slice(0, 10)}` : ' (no end date)';
  return `${PLACEMENT_LABEL[r.kind]} ${r.action}: ${r.target}${r.action === 'activated' ? term : ''}`;
}

/* ------------------------------------------------------- the term register */

export type RecordedTerm = {
  kind: PlacementKind;
  target: string;
  billing: 'monthly' | 'annual' | null;
  startsOn: string | null;
  endsOn: string | null;
  reviewer: string;
  recordedOn: string;
  action: 'activated' | 'deactivated';
};

const NOTE_RE =
  /^Placement (activated|deactivated): (Featured listing|Corridor sponsor) — (.+?)(?: · billing (monthly|annual))?(?: · from (\d{4}-\d{2}-\d{2}))?(?: · to (\d{4}-\d{2}-\d{2}))?(?: · by (.+?))? · on (\d{4}-\d{2}-\d{2})\s*$/gim;

const KIND_BY_LABEL: Record<string, PlacementKind> = {
  'Featured listing': 'featured-listing',
  'Corridor sponsor': 'corridor-sponsor',
};

/**
 * Read every placement line back out of a CRM note, newest last.
 *
 * This is the inverse of `placementNoteLine`, and it is the only way to know
 * when a featured listing was meant to end: `locations.is_featured` is a bare
 * boolean with no window, so the agreed term lives in the note or nowhere.
 * A note that does not match yields an empty list rather than a guess.
 */
export function parsePlacementNotes(notes: string | null | undefined): RecordedTerm[] {
  const out: RecordedTerm[] = [];
  if (!notes) return out;
  NOTE_RE.lastIndex = 0;
  for (const m of notes.matchAll(NOTE_RE)) {
    const kind = KIND_BY_LABEL[m[2]];
    if (!kind) continue;
    out.push({
      action: m[1] as 'activated' | 'deactivated',
      kind,
      target: m[3].trim(),
      billing: (m[4] as 'monthly' | 'annual') ?? null,
      startsOn: m[5] ?? null,
      endsOn: m[6] ?? null,
      reviewer: (m[7] ?? '').trim(),
      recordedOn: m[8],
    });
  }
  return out;
}

/**
 * The term currently in force for a CRM row: the latest activation, unless a
 * later line stopped it. Null when the note records no live placement.
 */
export function currentTerm(notes: string | null | undefined): RecordedTerm | null {
  const all = parsePlacementNotes(notes);
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].action === 'deactivated') return null;
    if (all[i].action === 'activated') return all[i];
  }
  return null;
}

export type TermHealth = 'no-term-recorded' | 'scheduled' | 'running' | 'due-soon' | 'overdue';

/**
 * How urgently a recorded term needs attention. `overdue` is the one that
 * matters: a featured listing past its end date is inventory being given away,
 * and the slot cannot be sold to anyone else while it sits there.
 */
export function termHealth(
  term: RecordedTerm | null,
  now: Date = new Date(),
  dueSoonDays = 7,
): TermHealth {
  if (!term || !term.endsOn) return 'no-term-recorded';
  const end = Date.parse(`${term.endsOn}T23:59:59Z`);
  if (Number.isNaN(end)) return 'no-term-recorded';
  const start = term.startsOn ? Date.parse(`${term.startsOn}T00:00:00Z`) : null;
  if (start !== null && !Number.isNaN(start) && now.getTime() < start) return 'scheduled';
  if (now.getTime() > end) return 'overdue';
  return end - now.getTime() <= dueSoonDays * 86400000 ? 'due-soon' : 'running';
}

export const TERM_HEALTH_LABEL: Record<TermHealth, string> = {
  'no-term-recorded': 'No term on record',
  scheduled: 'Starts later',
  running: 'Running',
  'due-soon': 'Ends within 7 days',
  overdue: 'PAST ITS END DATE',
};
