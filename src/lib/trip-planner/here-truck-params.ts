import type { TruckProfile } from './types';

/**
 * THE ONE transformation from a verified truck profile to HERE request
 * parameters (truck-route confidence milestone).
 *
 * Before this module the conversions lived inline in the URL builder, and
 * the driver-facing screens described the request in their own words. Two
 * descriptions of one request is one description too many: the day a
 * conversion changes, the screen that tells a fleet manager "13′6″ was
 * sent" keeps saying it whether or not it is still true.
 *
 * So the mapping is written ONCE, here, and everything else reads it:
 *   - `buildHereRouteUrl` serializes exactly these pairs;
 *   - the driver's "Route planned for" summary lists exactly these pairs,
 *     in driver units, and can therefore never name a restriction the
 *     request did not carry.
 *
 * Pure: profile in, parameters out. No clock, no I/O, no key — the key is
 * appended by the builder and never passes through here, so nothing in
 * this module can leak it into a screen, a log, or a report.
 *
 * WHAT IS DELIBERATELY ABSENT: weight-per-axle, trailer count, hazmat
 * tunnel category and vehicle type. They are real restriction inputs, and
 * they are NOT here because the provider's own documentation could not be
 * reached from the build environment to confirm their spelling, units and
 * accepted values (see docs/operations/navigator-truck-routing-audit.md
 * §3). Guessing a truck-safety parameter risks a rejected request — "no
 * route at all" instead of "slightly wrong route" — so the app declares
 * the gap to the driver instead of inventing a parameter.
 */

export const CM_PER_FT = 30.48;
export const KG_PER_LB = 0.45359237;

/**
 * US hazmat class (placard, "1".."9" with optional subclass like "2.1") →
 * HERE `shippedHazardousGoods` value. Conservative: unknown input maps to
 * `other` so restricted roads are still avoided rather than ignored.
 */
export function hazmatToHereGoods(hazmatClass: string | null): string | null {
  if (!hazmatClass) return null;
  const cls = hazmatClass.trim().charAt(0);
  switch (cls) {
    case '1':
      return 'explosive';
    case '2':
      return 'gas';
    case '3':
      return 'flammable';
    case '4':
      return 'combustible';
    case '5':
      return 'organic';
    case '6':
      return 'poison';
    case '7':
      return 'radioactive';
    case '8':
      return 'corrosive';
    case '9':
      return 'other';
    default:
      return 'other';
  }
}

/**
 * Whitelisted HERE v8 `avoid[features]` values. Anything not in this set
 * is DROPPED (never forwarded) so arbitrary strings can't reach the
 * provider — and so a screen can never offer an avoidance that would not
 * actually change the request.
 */
export const HERE_AVOID_FEATURES = new Set(['tollRoad', 'ferry', 'tunnel', 'dirtRoad', 'uTurns']);

/** Filter avoidances to the provider-supported whitelist (pure, testable). */
export function sanitizeAvoidances(avoid: readonly string[] | undefined): string[] {
  if (!avoid) return [];
  return [...new Set(avoid.filter((a) => HERE_AVOID_FEATURES.has(a)))];
}

/** Driver-facing names for the avoidances that genuinely reach the wire. */
export const AVOIDANCE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  tollRoad: 'Avoid toll roads',
  ferry: 'Avoid ferries',
  tunnel: 'Avoid tunnels',
  dirtRoad: 'Avoid unpaved roads',
  uTurns: 'Avoid U-turns',
});

/**
 * One parameter as it will appear on the wire, paired with how to say it
 * to a driver. `driverValue` is in the units the driver reads on the
 * screen; `value` is exactly what is serialized.
 */
export type TruckWireParam = {
  /** The provider's parameter name, e.g. `truck[height]`. */
  param: string;
  /** The serialized value, exactly as sent. */
  value: string;
  /** Plain-language name, e.g. "Height". */
  driverLabel: string;
  /** Plain-language value in driver units, e.g. "13′6″". */
  driverValue: string;
};

/** Feet as a driver reads a bridge placard: 13.5 → 13′6″. */
export function formatFeetInches(ft: number): string {
  if (!Number.isFinite(ft)) return '—';
  const whole = Math.floor(ft);
  const inches = Math.round((ft - whole) * 12);
  // 12″ of rounding rolls into the next foot rather than printing 13′12″.
  return inches === 12 ? `${whole + 1}′0″` : `${whole}′${inches}″`;
}

/**
 * The truck parameters for a profile, in serialization order.
 *
 * Every entry here WILL be sent. Nothing that is not sent appears, which
 * is what lets the driver-facing summary be built by simply rendering
 * this list: a field that stops being sent disappears from the screen in
 * the same commit, and one that starts being sent appears there.
 */
export function truckWireParams(
  truck: TruckProfile,
  avoid: readonly string[] | undefined = undefined,
): TruckWireParam[] {
  const out: TruckWireParam[] = [
    {
      param: 'truck[height]',
      value: String(Math.round(truck.heightFt * CM_PER_FT)),
      driverLabel: 'Height',
      driverValue: formatFeetInches(truck.heightFt),
    },
    {
      param: 'truck[width]',
      value: String(Math.round(truck.widthFt * CM_PER_FT)),
      driverLabel: 'Width',
      driverValue: formatFeetInches(truck.widthFt),
    },
    {
      param: 'truck[length]',
      value: String(Math.round(truck.lengthFt * CM_PER_FT)),
      driverLabel: 'Length',
      driverValue: formatFeetInches(truck.lengthFt),
    },
    {
      param: 'truck[grossWeight]',
      value: String(Math.round(truck.grossWeightLbs * KG_PER_LB)),
      driverLabel: 'Gross weight',
      driverValue: `${truck.grossWeightLbs.toLocaleString('en-US')} lb`,
    },
    {
      param: 'truck[axleCount]',
      value: String(truck.axles),
      driverLabel: 'Axles',
      driverValue: `${truck.axles} axles`,
    },
  ];
  const goods = hazmatToHereGoods(truck.hazmatClass);
  if (goods !== null) {
    out.push({
      param: 'truck[shippedHazardousGoods]',
      value: goods,
      driverLabel: 'Hazmat',
      driverValue: `Class ${truck.hazmatClass} (${goods})`,
    });
  }
  const features = sanitizeAvoidances(avoid);
  if (features.length > 0) {
    out.push({
      param: 'avoid[features]',
      value: features.join(','),
      driverLabel: 'Avoiding',
      driverValue: features.map((f) => AVOIDANCE_LABELS[f] ?? f).join(', '),
    });
  }
  return out;
}

/**
 * The driver-facing lines for "Route planned for" — one per restriction
 * ACTUALLY SENT, plus the honest "Hazmat: none" line, which is a true
 * statement about a request that carried no hazmat parameter.
 */
export function sentRestrictionLines(
  truck: TruckProfile,
  avoid: readonly string[] | undefined = undefined,
  metric = false,
): string[] {
  const lines = truckWireParams(truck, avoid).map((p) => {
    if (p.driverLabel === 'Avoiding') return p.driverValue;
    // METRIC DISPLAY, same request. The wire value is unchanged — these
    // are the identical parameters, read in the units the driver chose.
    if (!metric) return p.driverValue;
    if (p.driverLabel === 'Height' || p.driverLabel === 'Width' || p.driverLabel === 'Length') {
      return `${(Number(p.value) / 100).toFixed(2)} m`;
    }
    if (p.driverLabel === 'Gross weight') {
      return `${Number(p.value).toLocaleString('en-CA')} kg`;
    }
    return p.driverValue;
  });
  if (hazmatToHereGoods(truck.hazmatClass) === null) lines.push('Hazmat: none');
  return lines;
}
