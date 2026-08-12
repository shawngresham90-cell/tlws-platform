import type { TruckProfile } from '@/lib/trip-planner/types';
import { DEFAULT_TRUCK_PROFILE } from '@/lib/trip-planner/types';
import {
  AVOIDANCE_LABELS,
  HERE_AVOID_FEATURES,
  formatFeetInches,
  sanitizeAvoidances,
  truckWireParams,
} from '@/lib/trip-planner/here-truck-params';
import { validateNavigatorTruckProfile, type TruckValidationIssue } from './truck-validation';

/**
 * The truck a route is planned for — editing, confirming, and saying
 * honestly which parts of it reached the provider.
 *
 * THE PROBLEM THIS SOLVES. Until now every trip used one hard-coded
 * profile. A driver whose trailer is 13′6″ and a driver whose load is
 * 14′0″ got the same route, and neither could tell. A fleet manager
 * watching a demonstration could not answer "what truck was that routed
 * for?" — and the honest answer was "the app's default, whatever yours
 * is". So the driver may now set the values, and must CONFIRM them once
 * before a route is requested.
 *
 * THE RULE THE WHOLE MODULE EXISTS TO ENFORCE: a value the driver can
 * change must either reach the provider or be labelled as not reaching
 * it. Never a screen that implies enforcement the request never asked
 * for. `EDITABLE_FIELDS` is therefore derived from the wire mapping, not
 * written by hand — a field that stops being sent stops being editable.
 *
 * Pure: values in, values out. No clock, no storage, no I/O — the
 * component owns persistence and cadence.
 */

/** The routing-relevant, provider-verified part of a truck profile. */
export type EditableProfile = {
  heightFt: number;
  widthFt: number;
  lengthFt: number;
  grossWeightLbs: number;
  axles: number;
  /** DOT placard class ("3", "2.1"), or null for no placarded load. */
  hazmatClass: string | null;
  /** Whitelisted avoidance feature ids — each one reaches the wire. */
  avoid: readonly string[];
};

export type FieldKind = 'feet' | 'pounds' | 'count' | 'hazmat';

export type EditableField = {
  key: 'heightFt' | 'widthFt' | 'lengthFt' | 'grossWeightLbs' | 'axles';
  label: string;
  kind: FieldKind;
  unit: string;
  /** Big preset buttons — the common values, so typing is the exception. */
  presets: readonly number[];
  /** Inclusive bounds, from the shipped limits. Never silently clamped. */
  min: number;
  max: number;
  /** What this restriction does on the road, in one line. */
  why: string;
};

/**
 * Presets are the values a US tractor-trailer driver actually reads off a
 * cab card or a trailer placard — not a slider's arbitrary steps. Typing
 * stays available for everything else.
 */
export const EDITABLE_FIELDS: readonly EditableField[] = Object.freeze([
  {
    key: 'heightFt',
    label: 'Height',
    kind: 'feet',
    unit: 'ft',
    presets: [13.5, 13.6, 14],
    min: 8,
    max: 15,
    why: 'Low bridges and overpasses.',
  },
  {
    key: 'widthFt',
    label: 'Width',
    kind: 'feet',
    unit: 'ft',
    presets: [8.5, 8, 9],
    min: 7,
    max: 9,
    why: 'Narrow lanes and restricted roads.',
  },
  {
    key: 'lengthFt',
    label: 'Length',
    kind: 'feet',
    unit: 'ft',
    presets: [70, 65, 75],
    min: 20,
    max: 120,
    why: 'Turn radius and length-restricted routes.',
  },
  {
    key: 'grossWeightLbs',
    label: 'Gross weight',
    kind: 'pounds',
    unit: 'lb',
    presets: [80000, 34000, 60000],
    min: 10_000,
    max: 164_000,
    why: 'Posted bridge and road weight limits.',
  },
  {
    key: 'axles',
    label: 'Axles',
    kind: 'count',
    unit: 'axles',
    presets: [5, 4, 6],
    min: 2,
    max: 9,
    why: 'Axle-count restrictions and toll classification.',
  },
]);

/** Hazmat choices, each mapping to a value the provider actually accepts. */
export const HAZMAT_CHOICES: readonly { value: string | null; label: string }[] = Object.freeze([
  { value: null, label: 'None' },
  { value: '1', label: 'Class 1 — Explosives' },
  { value: '2', label: 'Class 2 — Gases' },
  { value: '3', label: 'Class 3 — Flammable liquid' },
  { value: '4', label: 'Class 4 — Flammable solid' },
  { value: '5', label: 'Class 5 — Oxidizer' },
  { value: '6', label: 'Class 6 — Poison' },
  { value: '7', label: 'Class 7 — Radioactive' },
  { value: '8', label: 'Class 8 — Corrosive' },
  { value: '9', label: 'Class 9 — Miscellaneous' },
]);

/** Avoidances offered to the driver — exactly the wire whitelist. */
export const AVOIDANCE_CHOICES: readonly { value: string; label: string }[] = Object.freeze(
  [...HERE_AVOID_FEATURES].map((value) => ({ value, label: AVOIDANCE_LABELS[value] ?? value })),
);

/** The shipped defaults, as an editable profile. Labelled as defaults
 *  everywhere until the driver has confirmed them. */
export const DEFAULT_EDITABLE_PROFILE: EditableProfile = Object.freeze({
  heightFt: DEFAULT_TRUCK_PROFILE.heightFt,
  widthFt: DEFAULT_TRUCK_PROFILE.widthFt,
  lengthFt: DEFAULT_TRUCK_PROFILE.lengthFt,
  grossWeightLbs: DEFAULT_TRUCK_PROFILE.grossWeightLbs,
  axles: DEFAULT_TRUCK_PROFILE.axles,
  hazmatClass: DEFAULT_TRUCK_PROFILE.hazmatClass,
  avoid: Object.freeze([]) as readonly string[],
});

/** Merge the editable part back onto the full profile the wire needs. */
export function toTruckProfile(edit: EditableProfile): TruckProfile {
  return {
    ...DEFAULT_TRUCK_PROFILE,
    heightFt: edit.heightFt,
    widthFt: edit.widthFt,
    lengthFt: edit.lengthFt,
    grossWeightLbs: edit.grossWeightLbs,
    axles: edit.axles,
    hazmatClass: edit.hazmatClass,
  };
}

/**
 * Validate an edited profile. Delegates every rule to the SHIPPED
 * validator — the same one the API route runs before spending a
 * transaction — so the screen and the server can never disagree about
 * what is routable.
 *
 * Nothing is corrected here. A bad value is reported, not clamped: a
 * silently "fixed" height is a route planned for a truck that does not
 * exist.
 */
export function validateEditableProfile(edit: EditableProfile): TruckValidationIssue[] {
  const issues = validateNavigatorTruckProfile(toTruckProfile(edit));
  // Counts are counts. The shipped validator bounds them; this catches
  // the fractional axle a numeric keypad can produce.
  if (!Number.isInteger(edit.axles)) {
    issues.push({
      field: 'axles',
      code: 'axles-not-integer',
      message: 'Axle count must be a whole number.',
    });
  }
  for (const a of edit.avoid) {
    if (!HERE_AVOID_FEATURES.has(a)) {
      issues.push({
        field: 'avoid',
        code: 'avoidance-unsupported',
        message: `"${a}" is not an avoidance this route provider supports.`,
      });
    }
  }
  return issues;
}

/** A driver-readable correction list — what to fix, not error codes. */
export function correctionsFor(issues: readonly TruckValidationIssue[]): string[] {
  return issues.map((i) => i.message);
}

/**
 * The FINGERPRINT of everything that changes the route request.
 *
 * Confirmation is bound to this string, so the question "is the confirmed
 * truck still the truck being routed?" is answered by comparing two
 * strings rather than by remembering which edits mattered. A field that
 * does not reach the wire cannot appear here — which is exactly why
 * changing a display-only value must NOT invalidate a confirmation, and
 * why this is built from the wire mapping itself.
 */
export function routingFingerprint(edit: EditableProfile): string {
  return truckWireParams(toTruckProfile(edit), edit.avoid)
    .map((w) => `${w.param}=${w.value}`)
    .join('&');
}

export type ConfirmationState = {
  /** The fingerprint the driver confirmed, or null if they never have. */
  confirmedFingerprint: string | null;
};

export const NO_CONFIRMATION: ConfirmationState = Object.freeze({ confirmedFingerprint: null });

/**
 * May a route be requested for this profile right now?
 *
 * 'invalid'      — values must be corrected first (zero provider calls).
 * 'unconfirmed'  — never confirmed, or a routing value changed since.
 * 'ready'        — confirmed, unchanged, valid: Start plans immediately.
 */
export function profileGate(
  edit: EditableProfile,
  state: ConfirmationState,
): 'invalid' | 'unconfirmed' | 'ready' {
  if (validateEditableProfile(edit).length > 0) return 'invalid';
  if (state.confirmedFingerprint === null) return 'unconfirmed';
  return state.confirmedFingerprint === routingFingerprint(edit) ? 'ready' : 'unconfirmed';
}

/** Confirm the profile as it stands. Pure — and it spends nothing. */
export function confirmProfile(edit: EditableProfile): ConfirmationState {
  return { confirmedFingerprint: routingFingerprint(edit) };
}

/** The compact summary the confirmation screen shows, in driver units. */
export type ProfileSummaryLine = { label: string; value: string; sent: boolean };

export function profileSummary(edit: EditableProfile): ProfileSummaryLine[] {
  const lines: ProfileSummaryLine[] = [
    { label: 'Height', value: formatFeetInches(edit.heightFt), sent: true },
    { label: 'Width', value: formatFeetInches(edit.widthFt), sent: true },
    { label: 'Length', value: formatFeetInches(edit.lengthFt), sent: true },
    {
      label: 'Gross weight',
      value: `${edit.grossWeightLbs.toLocaleString('en-US')} lb`,
      sent: true,
    },
    { label: 'Axles', value: `${edit.axles}`, sent: true },
    {
      label: 'Hazmat',
      value:
        edit.hazmatClass === null
          ? 'None'
          : (HAZMAT_CHOICES.find((h) => h.value === edit.hazmatClass)?.label ??
            `Class ${edit.hazmatClass}`),
      sent: true,
    },
    {
      label: 'Avoiding',
      value:
        sanitizeAvoidances(edit.avoid).length === 0
          ? 'Nothing'
          : sanitizeAvoidances(edit.avoid)
              .map((a) => AVOIDANCE_LABELS[a] ?? a)
              .join(', '),
      sent: true,
    },
    // Shown in the SAME summary, marked not-sent, because a fleet manager
    // reading a truck screen will otherwise assume every line on it
    // affected the route. See the audit memo §3 for why these are absent
    // from the request rather than guessed.
    { label: 'Trailers', value: 'Not used for routing', sent: false },
    { label: 'Weight per axle', value: 'Not used for routing', sent: false },
    { label: 'Tunnel category', value: 'Not used for routing', sent: false },
    { label: 'Vehicle type', value: 'Not used for routing', sent: false },
  ];
  return lines;
}

/** The one sentence that must accompany any "not used" disclosure. */
export const NOT_ROUTED_NOTICE = 'The route does not account for these. Watch for them yourself.';

/** The heading the driver taps to commit. */
export const CONFIRM_HEADING = 'Confirm this is your truck';
