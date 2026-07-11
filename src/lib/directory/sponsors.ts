/**
 * Sponsor placements (Milestone 25) — reusable, admin-configurable ad slots
 * across the directory. This module is PURE: types, safe outbound-URL
 * validation, the required rel policy, and deterministic targeting/date
 * filtering. It holds no records and performs no I/O — the data reader lives in
 * the data layer and fails soft to [], so every surface shows a graceful empty
 * state until an admin creates a sponsor. Nothing here is created in
 * production.
 */

/** Where a sponsor block may appear. */
export type SponsorPlacement =
  | 'directory-hub'
  | 'state'
  | 'interstate'
  | 'detail'
  | 'map-sidebar'
  | 'parking';

export const SPONSOR_PLACEMENTS: { value: SponsorPlacement; label: string }[] = [
  { value: 'directory-hub', label: 'Directory hub' },
  { value: 'state', label: 'State pages' },
  { value: 'interstate', label: 'Interstate / corridor pages' },
  { value: 'detail', label: 'Listing detail pages' },
  { value: 'map-sidebar', label: 'Map sidebar' },
  { value: 'parking', label: 'Parking landing pages' },
];

export type Sponsor = {
  id: string;
  name: string;
  tagline?: string;
  /** Validated http(s) outbound URL. */
  url: string;
  /** Small emoji/glyph shown as a logo stand-in (no remote images). */
  logo?: string;
  placements: SponsorPlacement[];
  /** Uppercase two-letter state codes to target; empty = all states. */
  states?: string[];
  /** Interstate designations to target ("I-75"); empty = all. */
  interstates?: string[];
  /** Category slugs to target; empty = all. */
  categories?: string[];
  active: boolean;
  /** ISO window; a sponsor outside its window is never shown. */
  startsAt?: string;
  endsAt?: string;
};

/**
 * The rel policy for EVERY sponsor link. "sponsored" discloses the paid
 * relationship to search engines; noopener+noreferrer are the security
 * baseline for target=_blank outbound links.
 */
export const SPONSOR_REL = 'sponsored noopener noreferrer';

/** Only ever allow http(s) outbound URLs with a real host (defense in depth). */
export function isSafeSponsorUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.length > 0;
  } catch {
    return false;
  }
}

export type SponsorContext = {
  placement: SponsorPlacement;
  /** Two-letter state code of the current page, when scoped. */
  state?: string;
  /** Interstate designation of the current page, when scoped ("I-75"). */
  interstate?: string;
  /** Category slug of the current page, when scoped. */
  category?: string;
  /** Injected clock for deterministic tests. */
  now?: Date;
};

function withinWindow(s: Sponsor, now: Date): boolean {
  if (s.startsAt) {
    const t = Date.parse(s.startsAt);
    if (!Number.isNaN(t) && now.getTime() < t) return false;
  }
  if (s.endsAt) {
    const t = Date.parse(s.endsAt);
    if (!Number.isNaN(t) && now.getTime() > t) return false;
  }
  return true;
}

/**
 * The sponsors eligible to show in a given context: active, in-window, matching
 * placement, with a safe URL, and matching any targeting the sponsor declares
 * (empty targeting = matches everything). Pure and order-stable (by name, id).
 */
export function activeSponsorsFor(sponsors: Sponsor[], ctx: SponsorContext): Sponsor[] {
  const now = ctx.now ?? new Date();
  const state = ctx.state?.toUpperCase();
  return sponsors
    .filter(
      (s) =>
        s.active &&
        isSafeSponsorUrl(s.url) &&
        s.placements.includes(ctx.placement) &&
        withinWindow(s, now) &&
        (!s.states?.length || (state != null && s.states.map((x) => x.toUpperCase()).includes(state))) &&
        (!s.interstates?.length || (ctx.interstate != null && s.interstates.includes(ctx.interstate))) &&
        (!s.categories?.length || (ctx.category != null && s.categories.includes(ctx.category))),
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
