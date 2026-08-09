/**
 * Truck-profile coverage (truck-routing priority 10).
 *
 * The audit question was: is there a restriction-relevant property of a
 * truck that the driver believes is being honoured, but which never
 * reaches the provider request?
 *
 * The answer is yes, and this module is where that answer is written down
 * rather than left in a report nobody reads next quarter. Each entry says
 * what the field is, whether the app MODELS it, and whether it reaches the
 * WIRE. A harness re-derives the wire column from the real URL builder, so
 * the day a field starts or stops being sent, this table fails until it is
 * updated. It cannot quietly go stale.
 *
 * The honest summary of the current state:
 *
 *   - height, width, length, gross weight, axle count, hazmat class,
 *     avoidances and departure time all reach the wire. Verified by
 *     `test-navigator-truck-integrity` against the real builder.
 *
 *   - vehicle TYPE does not. The request never names one, so the provider
 *     applies its own default, and the app's default profile is a 70 ft,
 *     5-axle combination. This is the single most consequential gap in
 *     the table and it is flagged 'provider-default', not 'sent'.
 *
 *   - per-axle weight, trailer count and hazmat TUNNEL CATEGORY are not
 *     modelled at all. They are restriction inputs a truck is subject to
 *     in the real world — bridge postings are frequently per-axle, and
 *     tunnel categories govern hazmat access independently of the goods
 *     class we do send.
 *
 * WHY THE GAPS ARE NOT CLOSED HERE. Sending a parameter the provider does
 * not accept is not a no-op: it risks a rejected request, which turns
 * "slightly wrong route" into "no route at all" for every trip. The exact
 * spelling and accepted values could not be confirmed against primary
 * provider documentation from this environment, and a truck-safety
 * parameter is the last place to guess. So the gaps are DECLARED, shown to
 * the driver, and left for a change that can be verified against the
 * provider's own contract.
 *
 * That is also why `driverAssurances()` exists. Until a field reaches the
 * wire, the honest thing is to tell the driver which restrictions are
 * actually being routed around — not to let a truck profile screen imply
 * enforcement the request never asked for.
 *
 * Pure data and pure functions. No clock, no I/O, no provider calls.
 */

export type WireStatus =
  /** Serialized into the provider request. Proven by the builder test. */
  | 'sent'
  /** Modelled by the app but never serialized — a silent drop. */
  | 'modelled-not-sent'
  /** Not sent, so the provider substitutes its own default. */
  | 'provider-default'
  /** Not modelled anywhere in the app. */
  | 'not-modelled';

export type ProfileField = Readonly<{
  id: string;
  /** What a driver would call it. */
  label: string;
  /** The app's field, or null when nothing models it. */
  appField: string | null;
  /** The provider parameter, or null when nothing is sent. */
  wireParam: string | null;
  status: WireStatus;
  /** Why it matters on a truck. One sentence, plain language. */
  why: string;
}>;

export const TRUCK_PROFILE_COVERAGE: readonly ProfileField[] = Object.freeze([
  {
    id: 'height',
    label: 'Height',
    appField: 'heightFt',
    wireParam: 'truck[height]',
    status: 'sent',
    why: 'Low bridges and overpasses.',
  },
  {
    id: 'width',
    label: 'Width',
    appField: 'widthFt',
    wireParam: 'truck[width]',
    status: 'sent',
    why: 'Narrow lanes and restricted roads.',
  },
  {
    id: 'length',
    label: 'Length',
    appField: 'lengthFt',
    wireParam: 'truck[length]',
    status: 'sent',
    why: 'Turn radius and length-restricted routes.',
  },
  {
    id: 'gross-weight',
    label: 'Gross weight',
    appField: 'grossWeightLbs',
    wireParam: 'truck[grossWeight]',
    status: 'sent',
    why: 'Posted bridge and road weight limits.',
  },
  {
    id: 'axles',
    label: 'Axle count',
    appField: 'axles',
    wireParam: 'truck[axleCount]',
    status: 'sent',
    why: 'Axle-count restrictions and toll classification.',
  },
  {
    id: 'hazmat',
    label: 'Hazmat class',
    appField: 'hazmatClass',
    wireParam: 'truck[shippedHazardousGoods]',
    status: 'sent',
    why: 'Roads and crossings closed to placarded loads.',
  },
  {
    id: 'avoidances',
    label: 'Avoid options',
    appField: 'avoid',
    wireParam: 'avoid[features]',
    status: 'sent',
    why: 'Tolls, ferries, tunnels, dirt roads, U-turns.',
  },
  {
    id: 'departure',
    label: 'Departure time',
    appField: 'departAtMs',
    wireParam: 'departureTime',
    status: 'sent',
    why: 'Time-of-day restrictions and traffic.',
  },
  {
    id: 'vehicle-type',
    label: 'Vehicle type',
    appField: null,
    wireParam: null,
    status: 'provider-default',
    why: 'A combination unit turns and is restricted differently from a straight truck.',
  },
  {
    id: 'weight-per-axle',
    label: 'Weight per axle',
    appField: null,
    wireParam: null,
    status: 'not-modelled',
    why: 'Many bridge postings are per-axle, not gross.',
  },
  {
    id: 'trailer-count',
    label: 'Trailer count',
    appField: null,
    wireParam: null,
    status: 'not-modelled',
    why: 'Doubles and triples are barred from some roads outright.',
  },
  {
    id: 'tunnel-category',
    label: 'Hazmat tunnel category',
    appField: null,
    wireParam: null,
    status: 'not-modelled',
    why: 'Tunnel access for placarded loads is governed by category, not class alone.',
  },
]);

/** Fields the request actually carries. */
export function sentFields(): readonly ProfileField[] {
  return TRUCK_PROFILE_COVERAGE.filter((f) => f.status === 'sent');
}

/** Everything a driver should not assume is being enforced. */
export function gapFields(): readonly ProfileField[] {
  return TRUCK_PROFILE_COVERAGE.filter((f) => f.status !== 'sent');
}

/**
 * A silent drop is the specific defect this audit hunted: a value the app
 * asks the driver for, stores, and then never sends. Finding none is the
 * result worth pinning — the gaps that exist are gaps in the MODEL, which
 * a driver can see, rather than values quietly discarded on the way out.
 */
export function silentDrops(): readonly ProfileField[] {
  return TRUCK_PROFILE_COVERAGE.filter((f) => f.status === 'modelled-not-sent');
}

export type DriverAssurances = Readonly<{
  /** Restrictions the route request actually asked the provider to honour. */
  routedAround: readonly string[];
  /** Restrictions it did not. Empty is a claim; non-empty is a disclosure. */
  notRoutedAround: readonly string[];
}>;

/**
 * What to tell the driver, in their words. Deliberately returns both
 * halves: a screen that lists only what works reads as a guarantee.
 */
export function driverAssurances(): DriverAssurances {
  return Object.freeze({
    routedAround: sentFields().map((f) => f.label),
    notRoutedAround: gapFields().map((f) => f.label),
  });
}
