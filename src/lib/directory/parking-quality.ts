import { normalizeOvernightStatus, type OvernightStatus } from './overnight';
import { verifyListingCoordinate, type VerificationResult } from './coordinate-verification';
import { scoreCompleteness, type CompletenessInput } from './completeness';
import { haversineMiles } from '@/lib/map/geo';

/**
 * Parking publication evidence gate (PARKING-QUALITY-1, 2026-08-20).
 *
 * The directory holds 96 unpublished `parking` rows. Every one of them is
 * populated enough to LOOK publishable — 90 carry a description, 79 a
 * website, 91 an interstate — and that is exactly the problem this module
 * exists to state out loud: none of those fields is evidence.
 *
 * `scoreCompleteness` answers "is this field filled in?". It cannot answer
 * "is this claim true?", and it was never meant to: a third-party CSV row
 * with an address, a phone, a space count and two amenities scores
 * "Excellent" while nothing on record says a truck may park there. Worse,
 * `toEntry` always appends an overnight chip, so every parking row collects
 * amenity points for free. A completeness score therefore cannot gate
 * publication, and this module never reads it as one — it carries the score
 * through as a SECONDARY worklist signal only, so an admin can sort by
 * "cheapest to finish" without that ever becoming "safe to publish".
 *
 * THE SEPARATION THAT MATTERS. A row's publication eligibility and its
 * overnight truth are different questions with different evidence. A verified
 * truck stop whose overnight policy nobody has sourced is publishable today
 * with "Overnight unknown"; a rest area with an explicit overnight
 * prohibition is publishable today with "Overnight prohibited". Collapsing
 * the two into one number is what produces a directory that sounds certain
 * and is wrong, so the result type keeps five independent axes and a list of
 * reason codes rather than a score.
 *
 * WHAT COUNTS AS EVIDENCE. Not the row. `locations.website` is the facility's
 * public link — the thing a driver taps — and the schema has no column that
 * cites a source for a parking claim (`overnight_status_source` is the only
 * evidence column and is empty on all 172 parking rows, published and not).
 * So evidence arrives here as an explicit `ParkingEvidence` record naming the
 * source, its agency, what it was retrieved on, and precisely which claim it
 * supports. A row with no such record is blocked, and its `website` is
 * surfaced only as a CANDIDATE SOURCE TO CHECK — a worklist entry, never a
 * verification.
 *
 * The standing rules encoded below are the repository's own, from
 * data/imports/nationwide-parking-2026-07-26/SOURCING-QUEUE.md:
 *
 *   1. A rest area is not automatically truck parking. The source must say so.
 *   2. A weigh station is not parking. Only an explicit agency statement that
 *      parking is permitted moves one out of quarantine.
 *   3. Directional pairs get two coordinates, never one shared between them.
 *   4. Never resurface a held/excluded network.
 *
 * Read-only. Nothing in this file writes, publishes, geocodes, or infers a
 * coordinate.
 */

/* ------------------------------------------------------------ vocabulary */

/** Where a row came from. One class per row, and "unknown" is a real answer. */
export type ProvenanceClass =
  | 'official-government'
  | 'official-operator'
  | 'owner-reviewed'
  | 'published-listing-relationship'
  | 'driver-report-only'
  | 'third-party-directory'
  | 'legacy-import'
  | 'unknown';

/** What the facility actually is, as far as evidence establishes. */
export type FacilityVerdict =
  | 'confirmed-truck-parking'
  | 'rest-area-with-truck-evidence'
  | 'service-plaza-with-truck-evidence'
  | 'converted-weigh-site-with-evidence'
  | 'weigh-or-inspection-only'
  | 'car-only'
  | 'non-parking-business'
  | 'unknown';

/** Whether the stored coordinate can be trusted to place a truck. */
export type CoordinateVerdict =
  | 'verified'
  | 'missing'
  | 'invalid'
  | 'zero'
  | 'duplicate-coordinate'
  | 'proximity-collision'
  | 'direction-conflict'
  | 'unverifiable';

/** The publication disposition. `ready-for-owner-review` is not `publish`. */
export type PublicationVerdict =
  | 'ready-for-owner-review'
  | 'needs-official-parking-evidence'
  | 'needs-coordinate-verification'
  | 'needs-identity-enrichment'
  | 'needs-duplicate-review'
  | 'needs-direction-review'
  | 'needs-source-provenance'
  | 'held-network-review'
  | 'non-parking'
  | 'reject'
  | 'unverifiable';

/**
 * Stable reason codes. These strings are the contract shared by the pure
 * logic, the admin queue, the CSV, the manifest and the tests — an admin
 * reading "TRUCK_ACCESS_UNPROVEN" and a test asserting it must mean the
 * same thing, so they are never rephrased for display.
 */
export type ReasonCode =
  | 'PARKING_SOURCE_MISSING'
  | 'TRUCK_ACCESS_UNPROVEN'
  | 'COORDINATES_MISSING'
  | 'COORDINATES_INVALID'
  | 'COORDINATES_ZERO'
  | 'COORDINATE_PROVENANCE_MISSING'
  | 'COORDINATE_OUT_OF_STATE'
  | 'COORDINATE_OUT_OF_CORRIDOR'
  | 'OVERNIGHT_LEGACY_BOOLEAN_ONLY'
  | 'OVERNIGHT_CONFIRMED_SOURCE_MISSING'
  | 'OVERNIGHT_PROHIBITION_UNSOURCED'
  | 'POSSIBLE_PUBLISHED_DUPLICATE'
  | 'DIRECTIONAL_SIBLING'
  | 'DIRECTION_UNRESOLVED'
  | 'WEIGH_STATION_NOT_PARKING'
  | 'CAR_ONLY_REST_AREA'
  | 'NON_PARKING_BUSINESS'
  | 'HELD_NETWORK'
  | 'SPACE_COUNT_UNSOURCED'
  | 'AMENITIES_UNSOURCED'
  | 'HOURS_UNSOURCED'
  | 'FREE_PAID_UNSOURCED'
  | 'RESERVABILITY_UNSOURCED'
  | 'SOURCE_NOT_HTTPS'
  | 'SOURCE_IS_INDEX_PAGE'
  | 'SOURCE_DIRECTION_MISMATCH'
  | 'SOURCE_RETRIEVAL_DATE_MISSING'
  | 'IDENTITY_INCOMPLETE'
  | 'CATEGORY_NOT_PARKING';

/** Admin-facing sentence for each code. Explanation, not decoration. */
export const REASON_TEXT: Record<ReasonCode, string> = {
  PARKING_SOURCE_MISSING:
    'No source record cites this facility. The row has no evidence attached, only fields.',
  TRUCK_ACCESS_UNPROVEN:
    'Nothing on record states that trucks may park here. A rest area, welcome center or service plaza is not truck parking until the source says so.',
  COORDINATES_MISSING: 'No latitude/longitude. A driver cannot be routed to this row.',
  COORDINATES_INVALID: 'Coordinate is outside valid range or not a finite number.',
  COORDINATES_ZERO: 'Coordinate is 0,0 — the null island, not a location.',
  COORDINATE_PROVENANCE_MISSING:
    'Coordinate is present but no geocode source or manual verification is recorded, so it cannot be told apart from a guess.',
  COORDINATE_OUT_OF_STATE: 'Coordinate falls outside the framing bounds of its own state.',
  COORDINATE_OUT_OF_CORRIDOR: 'Coordinate falls far outside the corridor the row claims.',
  OVERNIGHT_LEGACY_BOOLEAN_ONLY:
    'Only the legacy overnight_parking boolean supports the overnight claim. It carried no evidence and never upgrades a status.',
  OVERNIGHT_CONFIRMED_SOURCE_MISSING:
    'Stored status is "confirmed" but no source and retrieval date back it.',
  OVERNIGHT_PROHIBITION_UNSOURCED:
    'Stored status is "prohibited" but no statute, policy or operator wording is cited.',
  POSSIBLE_PUBLISHED_DUPLICATE: 'Looks like a facility already published in the directory.',
  DIRECTIONAL_SIBLING:
    'Paired with an opposite-carriageway facility. Both are legitimate rows and must keep separate coordinates — do not merge.',
  DIRECTION_UNRESOLVED:
    'Name or source implies a carriageway but the row does not record which one.',
  WEIGH_STATION_NOT_PARKING:
    'This is a weigh or inspection site. Parking is permitted only where an agency says so explicitly.',
  CAR_ONLY_REST_AREA: 'Evidence describes a car-only facility.',
  NON_PARKING_BUSINESS: 'Evidence describes a business that is not truck parking.',
  HELD_NETWORK: 'Names a held/excluded network. Out of scope by standing rule.',
  SPACE_COUNT_UNSOURCED: 'A truck-space count is stored that no source states.',
  AMENITIES_UNSOURCED: 'Amenities are stored that no source states.',
  HOURS_UNSOURCED: 'Hours are stored that no source states.',
  FREE_PAID_UNSOURCED: 'A free/paid parking claim is stored that no source states.',
  RESERVABILITY_UNSOURCED: 'A reservation link is stored that no source states.',
  SOURCE_NOT_HTTPS: 'Source URL is not HTTPS.',
  SOURCE_IS_INDEX_PAGE:
    'Source is an agency index or search page, not a page making a claim about this facility.',
  SOURCE_DIRECTION_MISMATCH: 'Source describes a different carriageway than this row.',
  SOURCE_RETRIEVAL_DATE_MISSING: 'Source has no retrieval date, so the claim has no as-of.',
  IDENTITY_INCOMPLETE: 'Name, state, or locating identity is missing.',
  CATEGORY_NOT_PARKING: 'Row is not in the parking category.',
};

/**
 * Held/excluded networks (SOURCING-QUEUE rule 4). Matched as whole words so
 * "Pilot Mountain Rest Area" — a place name — is not mistaken for the chain.
 */
export const HELD_NETWORKS = [
  "Love's",
  'Loves',
  'Pilot',
  'Flying J',
  'Sapp Bros',
  'Goasis',
  'Thorntons',
] as const;

/* ---------------------------------------------------------------- inputs */

/** The row shape this module reads. A subset of `locations`, read-only. */
export type ParkingRow = {
  id: string;
  name: string | null;
  state: string | null;
  city: string | null;
  address: string | null;
  zip: string | null;
  categorySlug: string | null;
  detailSlug: string | null;
  isPublished: boolean;
  interstate: string | null;
  exitNumber: string | null;
  lat: number | null;
  lng: number | null;
  parkingSpaces: number | null;
  amenities: string[] | null;
  hours: unknown;
  freeParking: boolean | null;
  paidParking: boolean | null;
  reservedParking: boolean | null;
  overnightParking: boolean | null;
  overnightStatus: string | null;
  overnightStatusSource: string | null;
  overnightStatusVerifiedAt: string | null;
  website: string | null;
  phone: string | null;
  tpcUrl: string | null;
  description: string | null;
  source: string | null;
  geocodeSource: string | null;
  geocodeConfidence: string | null;
  coordVerificationStatus: string | null;
  manuallyVerifiedAt: string | null;
  verifiedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

/** What kind of authority a source speaks with. */
export type AgencyKind =
  | 'state-dot'
  | 'toll-authority'
  | 'federal'
  | 'operator'
  | 'owner-reviewed'
  | 'tourism'
  | 'third-party'
  | 'unknown';

/**
 * One retrieved source and the EXACT claims it supports. Nothing is inferred
 * from a source beyond what is recorded here: a page that proves a rest area
 * exists does not thereby prove a truck may park in it, so
 * `supportsTruckParking` is its own field and defaults to false.
 */
export type ParkingEvidence = {
  sourceUrl: string;
  agency: string;
  agencyKind: AgencyKind;
  /** ISO date the source was retrieved/reviewed. Required for any claim. */
  retrievedAt: string | null;
  /** True only when the source states trucks may park here. */
  supportsTruckParking: boolean;
  /** Explicit overnight wording, when the source carries it. */
  supportsOvernight?: 'confirmed' | 'prohibited' | null;
  /** Officially stated truck-space count, when the source states one. */
  statedSpaces?: number | null;
  /** Carriageway the source describes, when it names one. */
  direction?: string | null;
  /** True when the URL is an agency index/search page, not a facility page. */
  isIndexPage?: boolean;
  statedAmenities?: string[] | null;
  statedHours?: string | null;
  statedFreePaid?: 'free' | 'paid' | null;
  statedReservable?: boolean | null;
  notes?: string;
};

/** Neighbouring rows this one is checked against. */
export type ParkingContext = {
  /** Published rows, for duplicate and proximity checks. */
  published?: Array<
    Pick<ParkingRow, 'id' | 'name' | 'state' | 'city' | 'detailSlug' | 'lat' | 'lng'> & {
      categorySlug?: string | null;
    }
  >;
  /** Other rows in the same unpublished batch. */
  batch?: Array<Pick<ParkingRow, 'id' | 'name' | 'state' | 'city' | 'lat' | 'lng'>>;
  /** Pending driver reports, by location id. Attention only — never trust. */
  reportCountsByLocation?: Record<string, number>;
  /** Evidence records, by location id. */
  evidenceByLocation?: Record<string, ParkingEvidence[]>;
};

/* --------------------------------------------------------------- results */

export type ParkingQualityResult = {
  id: string;
  name: string;
  state: string;
  city: string;
  publication: PublicationVerdict;
  /** Every blocking reason, not just the first. */
  blockers: PublicationVerdict[];
  overnight: OvernightStatus;
  /** Set when the stored overnight status is not what evidence supports. */
  overnightStoredDiffers: boolean;
  coordinate: CoordinateVerdict;
  facility: FacilityVerdict;
  provenance: ProvenanceClass;
  reasons: ReasonCode[];
  /** Secondary worklist signal only. Never an input to `publication`. */
  completenessScore: number;
  /** Pending driver reports. Attention only — never an input to a verdict. */
  reportCount: number;
  /** Non-verifying: the URL an admin should go and check. */
  candidateSourceUrl: string | null;
  candidateAgencyKind: AgencyKind;
  duplicateCandidates: Array<{
    id: string;
    name: string;
    distanceMiles: number | null;
    why: string;
  }>;
  coordinateDetail: VerificationResult;
};

/* ------------------------------------------------------------- utilities */

const text = (v: string | null | undefined) => (v ?? '').trim();
const lower = (v: string | null | undefined) => text(v).toLowerCase();

/** Whole-word held-network match, so a place name is not a false positive. */
export function namesHeldNetwork(name: string | null | undefined): boolean {
  const n = lower(name);
  if (!n) return false;
  // Both sides are normalised THE SAME WAY. Stripping apostrophes from the
  // brand but turning them into spaces in the name is why "Love's Travel
  // Stop" once slipped past this: "loves" never matches "love s".
  const norm = (v: string) =>
    v
      .toLowerCase()
      .replace(/['\u2019]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const bare = ` ${norm(n)} `;
  return HELD_NETWORKS.some((brand) => bare.includes(` ${norm(brand)} `));
}

/** Carriageway named by a row or a source, when one is named. */
export function directionOf(value: string | null | undefined): string | null {
  const v = lower(value);
  if (!v) return null;
  if (/\b(northbound|nb)\b/.test(v)) return 'NB';
  if (/\b(southbound|sb)\b/.test(v)) return 'SB';
  if (/\b(eastbound|eb)\b/.test(v)) return 'EB';
  if (/\b(westbound|wb)\b/.test(v)) return 'WB';
  if (/\bboth directions\b/.test(v)) return 'BOTH';
  return null;
}

/**
 * Domain-based authority classification. Deliberately conservative: a state
 * tourism board is `tourism`, not `state-dot`, because "come visit" is not a
 * statement about truck access, and a `.gov` host alone does not make a page
 * an authority on parking.
 */
export function classifyAgencyKind(url: string | null | undefined): AgencyKind {
  const raw = text(url);
  if (!raw) return 'unknown';
  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return 'unknown';
  }
  if (/(^|\.)(visit|explore|travel)[a-z]*\.(org|com)$/.test(host)) return 'tourism';
  if (/(^|\.)(dot|transportation)\.gov$/.test(host)) return 'federal';
  if (/(^|\.)(bts|fhwa)\.[a-z.]*gov$/.test(host)) return 'federal';
  if (/dot|highways?|transportation/.test(host) && /\.gov$/.test(host)) return 'state-dot';
  if (/turnpike|tollroad|thruway|parkway/.test(host)) return 'toll-authority';
  if (/\.gov$/.test(host)) return 'state-dot';
  return 'third-party';
}

/** Agency kinds whose word may establish a truck-parking claim. */
const AUTHORITATIVE: ReadonlySet<AgencyKind> = new Set<AgencyKind>([
  'state-dot',
  'toll-authority',
  'federal',
  'operator',
  'owner-reviewed',
]);

export function isAuthoritative(kind: AgencyKind): boolean {
  return AUTHORITATIVE.has(kind);
}

/* ---------------------------------------------------------- provenance */

export function classifyProvenance(row: ParkingRow, evidence: ParkingEvidence[]): ProvenanceClass {
  if (row.manuallyVerifiedAt) return 'owner-reviewed';
  const authoritative = evidence.filter((e) => isAuthoritative(e.agencyKind));
  if (authoritative.some((e) => e.agencyKind === 'operator')) return 'official-operator';
  if (authoritative.length > 0) return 'official-government';
  if (evidence.some((e) => e.agencyKind === 'third-party' || e.agencyKind === 'tourism')) {
    return 'third-party-directory';
  }
  const src = lower(row.source);
  if (!src) return 'unknown';
  // A federal open-data extract is an official ORIGIN, but this class
  // describes where the row came from, not that its claims are proven —
  // the truck-parking gate below is unmoved by it.
  if (/^ntad/.test(src) || /^fhwa/.test(src) || /^bts/.test(src)) return 'official-government';
  if (/csv|import|legacy/.test(src)) return 'legacy-import';
  if (/driver|report|submission/.test(src)) return 'driver-report-only';
  return 'unknown';
}

/* ------------------------------------------------------------- facility */

const WEIGH_RE = /\b(weigh|inspection)\s*(station|site)?\b|\bscale house\b/i;
const REST_RE = /\brest\s*area\b|\bsafety roadside rest\b|\brest stop\b/i;
const WELCOME_RE = /\bwelcome center\b|\bvisitor center\b/i;
const PLAZA_RE = /\bservice plaza\b|\btravel plaza\b|\bservice area\b/i;

/**
 * What the facility is. The name is a hint about what to CHECK, never a
 * substitute for evidence: a name containing "truck" proves nothing (rule 1),
 * and neither does one containing "rest area" disprove anything — it just
 * means the truck-parking claim needs its own source.
 */
export function classifyFacility(row: ParkingRow, evidence: ParkingEvidence[]): FacilityVerdict {
  const name = text(row.name);
  const blob = `${name} ${text(row.description)}`;
  const proven = evidence.some((e) => e.supportsTruckParking && isAuthoritative(e.agencyKind));

  if (WEIGH_RE.test(blob)) {
    // Rule 2: only an explicit agency statement moves a weigh site out.
    return proven ? 'converted-weigh-site-with-evidence' : 'weigh-or-inspection-only';
  }
  if (/\bcar(s)?[- ]only\b|\bno truck(s)?\b|\bautomobiles? only\b/i.test(blob)) return 'car-only';
  if (PLAZA_RE.test(blob)) return proven ? 'service-plaza-with-truck-evidence' : 'unknown';
  if (REST_RE.test(blob) || WELCOME_RE.test(blob)) {
    return proven ? 'rest-area-with-truck-evidence' : 'unknown';
  }
  if (proven) return 'confirmed-truck-parking';
  return 'unknown';
}

/** Facility verdicts that satisfy the truck-parking gate. */
const FACILITY_OK: ReadonlySet<FacilityVerdict> = new Set<FacilityVerdict>([
  'confirmed-truck-parking',
  'rest-area-with-truck-evidence',
  'service-plaza-with-truck-evidence',
  'converted-weigh-site-with-evidence',
]);

/* ----------------------------------------------------------- coordinate */

/** ~150 m, the repository's existing proximity-collision convention. */
export const PROXIMITY_COLLISION_MILES = 0.0932;

export function classifyCoordinate(
  row: ParkingRow,
  context: ParkingContext,
): { verdict: CoordinateVerdict; detail: VerificationResult; reasons: ReasonCode[] } {
  const detail = verifyListingCoordinate({
    id: row.id,
    name: row.name ?? '',
    city: row.city ?? '',
    state: row.state,
    interstate: row.interstate,
    lat: row.lat,
    lng: row.lng,
  });
  const reasons: ReasonCode[] = [];

  if (row.lat == null || row.lng == null) {
    reasons.push('COORDINATES_MISSING');
    return { verdict: 'missing', detail, reasons };
  }
  if (row.lat === 0 || row.lng === 0) {
    reasons.push('COORDINATES_ZERO');
    return { verdict: 'zero', detail, reasons };
  }
  if (detail.severity === 'invalid') {
    reasons.push('COORDINATES_INVALID');
    return { verdict: 'invalid', detail, reasons };
  }

  // Provenance: a coordinate with no recorded origin cannot be told apart
  // from a city-centre guess, which is the exact failure this gate exists
  // for. Present-and-plausible is not verified.
  const hasProvenance =
    Boolean(text(row.geocodeSource)) ||
    Boolean(row.manuallyVerifiedAt) ||
    lower(row.coordVerificationStatus) === 'verified';
  if (!hasProvenance) {
    reasons.push('COORDINATE_PROVENANCE_MISSING');
    return { verdict: 'unverifiable', detail, reasons };
  }

  if (detail.findings.includes('outside-state-bounds')) reasons.push('COORDINATE_OUT_OF_STATE');
  if (detail.findings.includes('outside-interstate-corridor')) {
    reasons.push('COORDINATE_OUT_OF_CORRIDOR');
  }
  if (reasons.length > 0) return { verdict: 'invalid', detail, reasons };

  const here = { lat: row.lat, lng: row.lng };
  const rowDir = directionOf(row.name);

  for (const other of context.batch ?? []) {
    if (other.id === row.id || other.lat == null || other.lng == null) continue;
    if (haversineMiles(here, { lat: other.lat, lng: other.lng }) === 0) {
      // Rule 3: a directional pair sharing one coordinate is a defect even
      // though the two rows are legitimately separate.
      reasons.push('COORDINATES_INVALID');
      return { verdict: 'duplicate-coordinate', detail, reasons };
    }
  }

  for (const other of context.published ?? []) {
    if (other.lat == null || other.lng == null) continue;
    const miles = haversineMiles(here, { lat: other.lat, lng: other.lng });
    if (miles > PROXIMITY_COLLISION_MILES) continue;
    const otherDir = directionOf(other.name);
    if (rowDir && otherDir && rowDir !== otherDir && rowDir !== 'BOTH' && otherDir !== 'BOTH') {
      // Opposite carriageways can legitimately sit within 150 m of each
      // other across a median. That is a direction review, not a duplicate.
      reasons.push('DIRECTIONAL_SIBLING');
      return { verdict: 'direction-conflict', detail, reasons };
    }
    reasons.push('POSSIBLE_PUBLISHED_DUPLICATE');
    return { verdict: 'proximity-collision', detail, reasons };
  }

  return { verdict: 'verified', detail, reasons };
}

/* ------------------------------------------------------------ overnight */

/**
 * The overnight verdict this module is willing to STAND BEHIND. It is not a
 * replacement for `locations.overnight_status`, which remains the sole
 * driver-facing authority and is untouched here; it is the admin answer to
 * "does the stored value have evidence?". Where they disagree, the row is
 * flagged, never silently rewritten.
 */
export function classifyOvernight(
  row: ParkingRow,
  evidence: ParkingEvidence[],
): { verdict: OvernightStatus; reasons: ReasonCode[]; storedDiffers: boolean } {
  const stored = normalizeOvernightStatus(row.overnightStatus);
  const reasons: ReasonCode[] = [];

  const sourced = evidence.find(
    (e) => e.supportsOvernight && isAuthoritative(e.agencyKind) && Boolean(e.retrievedAt),
  );
  const verdict: OvernightStatus = sourced
    ? (sourced.supportsOvernight as OvernightStatus)
    : 'unknown';

  if (stored === 'confirmed' && verdict !== 'confirmed') {
    reasons.push('OVERNIGHT_CONFIRMED_SOURCE_MISSING');
  }
  if (stored === 'prohibited' && verdict !== 'prohibited') {
    reasons.push('OVERNIGHT_PROHIBITION_UNSOURCED');
  }
  // The legacy boolean is worth saying out loud precisely because it looks
  // like an answer. It never becomes one.
  if (row.overnightParking === true && verdict === 'unknown') {
    reasons.push('OVERNIGHT_LEGACY_BOOLEAN_ONLY');
  }
  return { verdict, reasons, storedDiffers: stored !== verdict };
}

/* ------------------------------------------------------- unsourced claims */

/**
 * Is a JSONB-ish column carrying an actual claim? `hours` is `{}` on all 96
 * unpublished parking rows — an empty object is the column's way of saying
 * "nothing recorded", exactly like NULL. Treating `!= null` as "a claim is
 * stored" flagged every row for unsourced hours it does not have, which
 * would have buried the 4 rows that carry a real unsourced space count.
 */
function hasStoredValue(v: unknown): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v as object).length > 0;
  if (typeof v === 'string') return v.trim().length > 0;
  return true;
}

function unsourcedClaimReasons(row: ParkingRow, evidence: ParkingEvidence[]): ReasonCode[] {
  const out: ReasonCode[] = [];
  const authoritative = evidence.filter((e) => isAuthoritative(e.agencyKind));
  const states = <K extends keyof ParkingEvidence>(key: K) =>
    authoritative.some((e) => e[key] != null);

  if (row.parkingSpaces != null && !authoritative.some((e) => e.statedSpaces != null)) {
    out.push('SPACE_COUNT_UNSOURCED');
  }
  // The overnight chip is synthesised by toEntry for every row, so it is not
  // a stored amenity and must not be counted as an unsourced claim.
  const stored = (row.amenities ?? []).filter((a) => !/^Overnight /.test(a));
  if (stored.length > 0 && !states('statedAmenities')) out.push('AMENITIES_UNSOURCED');
  if (hasStoredValue(row.hours) && !states('statedHours')) out.push('HOURS_UNSOURCED');
  if ((row.freeParking === true || row.paidParking === true) && !states('statedFreePaid')) {
    out.push('FREE_PAID_UNSOURCED');
  }
  if ((row.reservedParking === true || Boolean(text(row.tpcUrl))) && !states('statedReservable')) {
    out.push('RESERVABILITY_UNSOURCED');
  }
  return out;
}

/* ------------------------------------------------------ source hygiene */

function sourceHygieneReasons(evidence: ParkingEvidence[], row: ParkingRow): ReasonCode[] {
  const out: ReasonCode[] = [];
  const rowDir = directionOf(row.name);
  for (const e of evidence) {
    if (!/^https:/i.test(text(e.sourceUrl))) out.push('SOURCE_NOT_HTTPS');
    if (e.isIndexPage) out.push('SOURCE_IS_INDEX_PAGE');
    if (!e.retrievedAt) out.push('SOURCE_RETRIEVAL_DATE_MISSING');
    const srcDir = directionOf(e.direction);
    if (rowDir && srcDir && rowDir !== srcDir && rowDir !== 'BOTH' && srcDir !== 'BOTH') {
      out.push('SOURCE_DIRECTION_MISMATCH');
    }
  }
  return [...new Set(out)];
}

/* ------------------------------------------------------- duplicate scan */

function duplicateScan(
  row: ParkingRow,
  context: ParkingContext,
): { candidates: ParkingQualityResult['duplicateCandidates']; reasons: ReasonCode[] } {
  const candidates: ParkingQualityResult['duplicateCandidates'] = [];
  const reasons: ReasonCode[] = [];
  const norm = (v: string | null | undefined) =>
    lower(v)
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const rowName = norm(row.name);
  const rowDir = directionOf(row.name);

  for (const other of context.published ?? []) {
    const why: string[] = [];
    if (row.detailSlug && other.detailSlug && row.detailSlug === other.detailSlug) {
      why.push('same detail slug');
    }
    const sameState = text(row.state).toUpperCase() === text(other.state).toUpperCase();
    if (rowName && norm(other.name) === rowName && sameState) why.push('same name + state');
    let miles: number | null = null;
    if (row.lat != null && row.lng != null && other.lat != null && other.lng != null) {
      miles = haversineMiles({ lat: row.lat, lng: row.lng }, { lat: other.lat, lng: other.lng });
      if (miles != null && miles <= PROXIMITY_COLLISION_MILES) why.push('within 150 m');
    }
    if (why.length === 0) continue;

    const otherDir = directionOf(other.name);
    const oppositeCarriageway =
      rowDir && otherDir && rowDir !== otherDir && rowDir !== 'BOTH' && otherDir !== 'BOTH';
    candidates.push({
      id: other.id,
      name: text(other.name),
      distanceMiles: miles == null ? null : Number(miles.toFixed(3)),
      why: oppositeCarriageway ? `${why.join(', ')} (opposite carriageway)` : why.join(', '),
    });
    reasons.push(oppositeCarriageway ? 'DIRECTIONAL_SIBLING' : 'POSSIBLE_PUBLISHED_DUPLICATE');
  }
  return { candidates, reasons: [...new Set(reasons)] };
}

/* --------------------------------------------------------- the classifier */

/**
 * Classify one row. Every blocking reason is collected — a row is rarely
 * blocked by exactly one thing, and an admin who fixes the first blocker
 * only to meet a second has been told a half-truth.
 */
export function classifyParkingRow(
  row: ParkingRow,
  context: ParkingContext = {},
): ParkingQualityResult {
  const evidence = context.evidenceByLocation?.[row.id] ?? [];
  const reasons: ReasonCode[] = [];
  const blockers: PublicationVerdict[] = [];

  /* identity */
  const hasName = Boolean(text(row.name));
  const hasState = /^[A-Za-z]{2}$/.test(text(row.state));
  const hasLocatingIdentity =
    Boolean(text(row.address)) || Boolean(text(row.city)) || Boolean(text(row.interstate));
  if (!hasName || !hasState || !hasLocatingIdentity) {
    reasons.push('IDENTITY_INCOMPLETE');
    blockers.push('needs-identity-enrichment');
  }
  if (lower(row.categorySlug) !== 'parking') {
    reasons.push('CATEGORY_NOT_PARKING');
    blockers.push('non-parking');
  }
  if (namesHeldNetwork(row.name)) {
    reasons.push('HELD_NETWORK');
    blockers.push('held-network-review');
  }

  /* provenance + facility */
  const provenance = classifyProvenance(row, evidence);
  const facility = classifyFacility(row, evidence);
  if (facility === 'weigh-or-inspection-only') {
    reasons.push('WEIGH_STATION_NOT_PARKING');
    blockers.push('non-parking');
  }
  if (facility === 'car-only') {
    reasons.push('CAR_ONLY_REST_AREA');
    blockers.push('non-parking');
  }
  if (facility === 'non-parking-business') {
    reasons.push('NON_PARKING_BUSINESS');
    blockers.push('non-parking');
  }

  /* truck-parking evidence — the gate the whole milestone turns on */
  if (evidence.length === 0) {
    reasons.push('PARKING_SOURCE_MISSING');
    blockers.push('needs-source-provenance');
  }
  if (!FACILITY_OK.has(facility)) {
    reasons.push('TRUCK_ACCESS_UNPROVEN');
    blockers.push('needs-official-parking-evidence');
  }
  reasons.push(...sourceHygieneReasons(evidence, row));

  /* coordinate */
  const coord = classifyCoordinate(row, context);
  reasons.push(...coord.reasons);
  if (coord.verdict !== 'verified') {
    blockers.push(
      coord.verdict === 'direction-conflict'
        ? 'needs-direction-review'
        : coord.verdict === 'proximity-collision' || coord.verdict === 'duplicate-coordinate'
          ? 'needs-duplicate-review'
          : 'needs-coordinate-verification',
    );
  }

  /* duplicates */
  const dup = duplicateScan(row, context);
  reasons.push(...dup.reasons);
  if (dup.reasons.includes('POSSIBLE_PUBLISHED_DUPLICATE')) blockers.push('needs-duplicate-review');
  if (dup.reasons.includes('DIRECTIONAL_SIBLING')) blockers.push('needs-direction-review');

  /* overnight — independent axis, never gates publication */
  const overnight = classifyOvernight(row, evidence);
  reasons.push(...overnight.reasons);

  /* unsourced optional claims */
  reasons.push(...unsourcedClaimReasons(row, evidence));

  /* completeness — carried, never consulted */
  const completeness = scoreCompleteness({
    name: text(row.name),
    category: text(row.categorySlug),
    address: row.address ?? undefined,
    city: text(row.city),
    state: text(row.state),
    zip: row.zip ?? undefined,
    interstate: row.interstate ?? undefined,
    exitNumber: row.exitNumber ?? undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    phone: row.phone ?? undefined,
    website: row.website ?? undefined,
    amenities: row.amenities ?? undefined,
    parkingSpaces: row.parkingSpaces ?? undefined,
    description: row.description ?? undefined,
    tpcUrl: row.tpcUrl ?? undefined,
    verifiedAt: row.verifiedAt ?? undefined,
  } as CompletenessInput);

  const uniqueBlockers = [...new Set(blockers)];
  const publication: PublicationVerdict = uniqueBlockers.includes('non-parking')
    ? 'non-parking'
    : (uniqueBlockers[0] ?? 'ready-for-owner-review');

  return {
    id: row.id,
    name: text(row.name),
    state: text(row.state).toUpperCase(),
    city: text(row.city),
    publication,
    blockers: uniqueBlockers,
    overnight: overnight.verdict,
    overnightStoredDiffers: overnight.storedDiffers,
    coordinate: coord.verdict,
    facility,
    provenance,
    reasons: [...new Set(reasons)],
    completenessScore: completeness.score,
    reportCount: context.reportCountsByLocation?.[row.id] ?? 0,
    candidateSourceUrl: text(row.website) || null,
    candidateAgencyKind: classifyAgencyKind(row.website),
    duplicateCandidates: dup.candidates,
    coordinateDetail: coord.detail,
  };
}

/* ------------------------------------------------------------ aggregate */

export type ParkingQualitySummary = {
  total: number;
  publication: Record<PublicationVerdict, number>;
  overnight: Record<OvernightStatus, number>;
  coordinate: Record<CoordinateVerdict, number>;
  facility: Record<FacilityVerdict, number>;
  provenance: Record<ProvenanceClass, number>;
  byState: Record<string, number>;
  readyForOwnerReview: number;
};

const PUBLICATION_VERDICTS: PublicationVerdict[] = [
  'ready-for-owner-review',
  'needs-official-parking-evidence',
  'needs-coordinate-verification',
  'needs-identity-enrichment',
  'needs-duplicate-review',
  'needs-direction-review',
  'needs-source-provenance',
  'held-network-review',
  'non-parking',
  'reject',
  'unverifiable',
];
const COORDINATE_VERDICTS: CoordinateVerdict[] = [
  'verified',
  'missing',
  'invalid',
  'zero',
  'duplicate-coordinate',
  'proximity-collision',
  'direction-conflict',
  'unverifiable',
];
const FACILITY_VERDICTS: FacilityVerdict[] = [
  'confirmed-truck-parking',
  'rest-area-with-truck-evidence',
  'service-plaza-with-truck-evidence',
  'converted-weigh-site-with-evidence',
  'weigh-or-inspection-only',
  'car-only',
  'non-parking-business',
  'unknown',
];
const PROVENANCE_CLASSES: ProvenanceClass[] = [
  'official-government',
  'official-operator',
  'owner-reviewed',
  'published-listing-relationship',
  'driver-report-only',
  'third-party-directory',
  'legacy-import',
  'unknown',
];

const zeroed = <K extends string>(keys: readonly K[]): Record<K, number> =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

export function summarize(results: ParkingQualityResult[]): ParkingQualitySummary {
  const summary: ParkingQualitySummary = {
    total: results.length,
    publication: zeroed(PUBLICATION_VERDICTS),
    overnight: { confirmed: 0, prohibited: 0, unknown: 0 },
    coordinate: zeroed(COORDINATE_VERDICTS),
    facility: zeroed(FACILITY_VERDICTS),
    provenance: zeroed(PROVENANCE_CLASSES),
    byState: {},
    readyForOwnerReview: 0,
  };
  for (const r of results) {
    summary.publication[r.publication] += 1;
    summary.overnight[r.overnight] += 1;
    summary.coordinate[r.coordinate] += 1;
    summary.facility[r.facility] += 1;
    summary.provenance[r.provenance] += 1;
    summary.byState[r.state] = (summary.byState[r.state] ?? 0) + 1;
    if (r.publication === 'ready-for-owner-review') summary.readyForOwnerReview += 1;
  }
  return summary;
}

/** Deterministic CSV for the audit package. Non-sensitive columns only. */
export function auditCsv(results: ParkingQualityResult[]): string {
  const header = [
    'id',
    'name',
    'state',
    'city',
    'provenance',
    'publication_verdict',
    'facility_verdict',
    'coordinate_verdict',
    'overnight_verdict',
    'reason_codes',
    'duplicate_candidate_ids',
    'completeness_score',
    'pending_reports',
    'candidate_source_to_verify',
    'owner_action',
  ];
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [...results]
    .sort(
      (a, b) =>
        a.state.localeCompare(b.state) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    )
    .map((r) =>
      [
        r.id,
        r.name,
        r.state,
        r.city,
        r.provenance,
        r.publication,
        r.facility,
        r.coordinate,
        r.overnight,
        r.reasons.join(' '),
        r.duplicateCandidates.map((d) => d.id).join(' '),
        r.completenessScore,
        r.reportCount,
        r.candidateSourceUrl ?? '',
        ownerActionFor(r),
      ]
        .map(esc)
        .join(','),
    );
  return [header.join(','), ...rows].join('\n') + '\n';
}

/** The single next step an owner or admin would take for this row. */
export function ownerActionFor(r: ParkingQualityResult): string {
  if (r.publication === 'ready-for-owner-review') return 'review for publication';
  if (r.blockers.includes('non-parking')) return 'recategorise or reject';
  if (r.blockers.includes('held-network-review')) return 'out of scope — held network';
  if (r.blockers.includes('needs-source-provenance')) {
    return r.candidateSourceUrl
      ? `retrieve and record source: ${r.candidateSourceUrl}`
      : 'find an official source';
  }
  if (r.blockers.includes('needs-official-parking-evidence')) return 'confirm trucks may park here';
  if (r.blockers.includes('needs-coordinate-verification')) return 'obtain a verified coordinate';
  if (r.blockers.includes('needs-duplicate-review')) return 'compare with published listing';
  if (r.blockers.includes('needs-direction-review')) return 'confirm carriageway';
  if (r.blockers.includes('needs-identity-enrichment')) return 'complete name/state/location';
  return 'review';
}
