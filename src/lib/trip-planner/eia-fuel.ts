import type { FuelPricePort } from './providers';

/**
 * EIA diesel-price adapter (Phase 4). FREE federal open-data API — requires
 * a free registered key (env EIA_API_KEY, server-side only, never sent to
 * the client). FAIL-SOFT everywhere: no key, network failure, or malformed
 * data → null, and the cost engine reports fuel as unknown instead of
 * inventing a price. Successful lookups carry source + period so the UI can
 * attribute the figure ("EIA weekly retail diesel, week of …").
 */

export type EiaFetch = (url: string) => Promise<{ status: number; json(): Promise<unknown> }>;

/**
 * PADD region per state (EIA publishes weekly on-highway diesel by PADD).
 * States absent from this map fall back to the US average series.
 */
export const STATE_TO_PADD: Record<string, string> = {
  // PADD 1A/1B/1C — East Coast (EIA splits 1 into subdistricts)
  CT: 'R1X',
  MA: 'R1X',
  ME: 'R1X',
  NH: 'R1X',
  RI: 'R1X',
  VT: 'R1X',
  DE: 'R1Y',
  DC: 'R1Y',
  MD: 'R1Y',
  NJ: 'R1Y',
  NY: 'R1Y',
  PA: 'R1Y',
  FL: 'R1Z',
  GA: 'R1Z',
  NC: 'R1Z',
  SC: 'R1Z',
  VA: 'R1Z',
  WV: 'R1Z',
  // PADD 2 — Midwest
  IA: 'R20',
  IL: 'R20',
  IN: 'R20',
  KS: 'R20',
  KY: 'R20',
  MI: 'R20',
  MN: 'R20',
  MO: 'R20',
  ND: 'R20',
  NE: 'R20',
  OH: 'R20',
  OK: 'R20',
  SD: 'R20',
  TN: 'R20',
  WI: 'R20',
  // PADD 3 — Gulf Coast
  AL: 'R30',
  AR: 'R30',
  LA: 'R30',
  MS: 'R30',
  NM: 'R30',
  TX: 'R30',
  // PADD 4 — Rocky Mountain
  CO: 'R40',
  ID: 'R40',
  MT: 'R40',
  UT: 'R40',
  WY: 'R40',
  // PADD 5 — West Coast
  AK: 'R50',
  AZ: 'R50',
  CA: 'R50',
  HI: 'R50',
  NV: 'R50',
  OR: 'R50',
  WA: 'R50',
};
const US_SERIES = 'NUS';

export type FuelPriceResult = {
  centsPerGallon: number;
  /** e.g. "2026-07-14" — the EIA weekly period the price belongs to. */
  period: string;
  region: string;
  source: string;
};

type EiaResponse = {
  response?: { data?: { period?: string; value?: number | string; duoarea?: string }[] };
};

/** Parse + validate one EIA weekly diesel row (pure, testable). */
export function parseEiaResponse(body: unknown, region: string): FuelPriceResult | null {
  const rows = (body as EiaResponse)?.response?.data ?? [];
  const row = rows.find((r) => r.period && r.value != null);
  if (!row) return null;
  const dollars = Number(row.value);
  if (!Number.isFinite(dollars) || dollars <= 0 || dollars > 20) return null;
  return {
    centsPerGallon: Math.round(dollars * 100),
    period: String(row.period),
    region,
    source: 'EIA weekly U.S. on-highway diesel retail price',
  };
}

export function eiaSeriesUrl(region: string, apiKey: string): string {
  return (
    'https://api.eia.gov/v2/petroleum/pri/gnd/data/' +
    `?api_key=${encodeURIComponent(apiKey)}` +
    '&frequency=weekly&data[0]=value&facets[product][]=EPD2D' +
    `&facets[duoarea][]=${encodeURIComponent(region)}` +
    '&sort[0][column]=period&sort[0][direction]=desc&length=1'
  );
}

/** Detailed lookup used by the API layer (adds period/source attribution). */
export async function eiaDieselPrice(
  state: string,
  fetchFn: EiaFetch,
  apiKey: string | undefined,
): Promise<FuelPriceResult | null> {
  if (!apiKey) return null;
  const region = STATE_TO_PADD[state.trim().toUpperCase()] ?? US_SERIES;
  try {
    const res = await fetchFn(eiaSeriesUrl(region, apiKey));
    if (res.status !== 200) return null;
    return parseEiaResponse(await res.json(), region);
  } catch {
    return null;
  }
}

/** FuelPricePort implementation over the detailed lookup. */
export function createEiaFuelPort(fetchFn: EiaFetch, apiKey: string | undefined): FuelPricePort {
  return {
    name: 'eia',
    dieselCentsPerGallon: async (state) => {
      const r = await eiaDieselPrice(state, fetchFn, apiKey);
      return r?.centsPerGallon ?? null;
    },
  };
}
