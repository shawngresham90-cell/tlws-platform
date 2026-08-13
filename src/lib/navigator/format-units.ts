/**
 * Driver-facing unit formatting — THE one authority (Canada milestone).
 *
 * US drivers read "m" as miles, so US mode never shows meters: distances
 * under a tenth of a mile display as feet, everything else as miles.
 * Canadian drivers read the same screen in metres and kilometres. Both
 * live here, in one file, because the failure this prevents is a
 * component that converts for itself: two conversions drift, and a
 * driving screen showing 1.2 km beside 450 m of a different vintage is
 * worse than either unit alone.
 *
 * THE CANONICAL UNITS DO NOT CHANGE. Internally the app is still miles,
 * feet, pounds and mph — the same numbers the provider request has always
 * been built from (see here-truck-params.ts). Metric is a DISPLAY
 * conversion applied once, at the edge, by these functions. That is what
 * keeps an imperial truck and its metric twin producing the identical
 * request, and it is why nothing below is allowed to convert twice.
 *
 * Pure functions, no locale machinery, no clock.
 */

export const FEET_PER_MILE = 5280;
const FEET_PER_METER = 3.280839895;
export const KM_PER_MILE = 1.609344;
export const METERS_PER_MILE = 1609.344;
export const KG_PER_LB = 0.45359237;
export const METERS_PER_FOOT = 0.3048;

/**
 * "250 ft" / "800 ft" under 0.2 mi; "0.2 mi" / "1.4 mi" / "25.7 mi" at or
 * above. The feet cutover is 0.2 mi so every owner-approved example holds
 * (800 ft = 0.15 mi must display as feet); feet round to the nearest 50.
 */
export function formatDriverDistanceMi(mi: number | null | undefined): string {
  if (mi === null || mi === undefined || !Number.isFinite(mi) || mi < 0) return '—';
  if (mi < 0.2) {
    const ft = Math.max(50, Math.round((mi * FEET_PER_MILE) / 50) * 50);
    return `${ft} ft`;
  }
  return `${mi.toFixed(1)} mi`;
}

/** GPS accuracy for the status screen: meters in, feet out ("±80 ft"). */
export function formatAccuracyFt(accuracyM: number): string {
  if (!Number.isFinite(accuracyM) || accuracyM < 0) return '—';
  const ft = Math.max(10, Math.round((accuracyM * FEET_PER_METER) / 10) * 10);
  return `±${ft} ft`;
}

/**
 * Truck height the way a driver reads it off a bridge placard: 13.5 → "13′6″".
 * Inches round to the nearest whole inch and carry into feet at 12, so
 * 12.999 is "13′0″", never "12′12″". Prime marks, not quotes — the same
 * glyphs the placard uses.
 */
export function formatTruckHeightFtIn(heightFt: number): string {
  if (!Number.isFinite(heightFt) || heightFt < 0) return '—';
  let ft = Math.floor(heightFt);
  let inches = Math.round((heightFt - ft) * 12);
  if (inches === 12) {
    ft += 1;
    inches = 0;
  }
  return `${ft}′${inches}″`;
}

/* ============================ metric display ============================ */

/**
 * Distance the way a Canadian driver reads it: metres up close,
 * kilometres beyond. The cutover is 1 km, and metres round to the
 * nearest 10 — a maneuver announced to the metre would be false
 * precision from a consumer GPS.
 */
export function formatDriverDistanceKm(mi: number | null | undefined): string {
  if (mi === null || mi === undefined || !Number.isFinite(mi) || mi < 0) return '—';
  const km = mi * KM_PER_MILE;
  if (km < 1) {
    const m = Math.max(10, Math.round((km * 1000) / 10) * 10);
    return `${m} m`;
  }
  return `${km.toFixed(1)} km`;
}

/** GPS accuracy in metric: "±25 m", rounded to 5 m. */
export function formatAccuracyM(accuracyM: number): string {
  if (!Number.isFinite(accuracyM) || accuracyM < 0) return '—';
  return `±${Math.max(5, Math.round(accuracyM / 5) * 5)} m`;
}

/** Truck dimension in metres, two decimals: 13.5 ft → "4.11 m". */
export function formatMeters(ft: number): string {
  if (!Number.isFinite(ft) || ft < 0) return '—';
  return `${(ft * METERS_PER_FOOT).toFixed(2)} m`;
}

/** Gross weight in kilograms, grouped: 80,000 lb → "36,287 kg". */
export function formatKilograms(lb: number): string {
  if (!Number.isFinite(lb) || lb < 0) return '—';
  return `${Math.round(lb * KG_PER_LB).toLocaleString('en-CA')} kg`;
}

/** Speed in km/h, whole numbers: 60 mph → "97 km/h". */
export function formatSpeedKmh(mph: number | null | undefined): string {
  if (mph === null || mph === undefined || !Number.isFinite(mph) || mph < 0) return '—';
  return `${Math.round(mph * KM_PER_MILE)} km/h`;
}

/** Speed in mph, whole numbers — the US mode's existing wording. */
export function formatSpeedMph(mph: number | null | undefined): string {
  if (mph === null || mph === undefined || !Number.isFinite(mph) || mph < 0) return '—';
  return `${Math.round(mph)} mph`;
}

/* ===================== the unit-aware entry points ====================== */
/*
 * Every driver-facing surface calls THESE, never a raw converter, so a
 * screen cannot accidentally show one unit system's number with the
 * other's label. `metric` is a boolean rather than a region, because
 * display units are a display concern — the region decides the default,
 * the driver may override it, and this layer only renders what it is
 * told.
 */

export function formatDistance(mi: number | null | undefined, metric: boolean): string {
  return metric ? formatDriverDistanceKm(mi) : formatDriverDistanceMi(mi);
}

export function formatSpeed(mph: number | null | undefined, metric: boolean): string {
  return metric ? formatSpeedKmh(mph) : formatSpeedMph(mph);
}

export function formatAccuracy(accuracyM: number, metric: boolean): string {
  return metric ? formatAccuracyM(accuracyM) : formatAccuracyFt(accuracyM);
}

/** A truck dimension: feet-and-inches in US mode, metres in Canada. */
export function formatDimension(ft: number, metric: boolean): string {
  return metric ? formatMeters(ft) : formatTruckHeightFtIn(ft);
}

/** Gross weight: pounds in US mode, kilograms in Canada. */
export function formatWeight(lb: number, metric: boolean): string {
  if (!Number.isFinite(lb) || lb < 0) return '—';
  return metric ? formatKilograms(lb) : `${lb.toLocaleString('en-US')} lb`;
}

/* ======================= metric INPUT conversions ======================= */
/*
 * A Canadian driver types metres and kilograms; the canonical profile is
 * feet and pounds. These convert ONCE, on the way in, so the stored
 * truck is the same shape whichever units were typed — which is what
 * makes an imperial truck and its metric twin serialize identically.
 */

export function metersToFeet(m: number): number {
  return m / METERS_PER_FOOT;
}

export function kilogramsToPounds(kg: number): number {
  return kg / KG_PER_LB;
}

export function feetToMeters(ft: number): number {
  return ft * METERS_PER_FOOT;
}

export function poundsToKilograms(lb: number): number {
  return lb * KG_PER_LB;
}
