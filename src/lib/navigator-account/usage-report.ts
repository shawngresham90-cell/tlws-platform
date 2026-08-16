import {
  METERED_ENDPOINT_KEYS,
  type MeteredEndpointKey,
} from '@/lib/navigator-api/metered-endpoints';

/**
 * Shaping the usage ledger into something an operator can read.
 *
 * Pure — rows in, report out, every number injected. The point of keeping it
 * out of the page is that "is this month close to the threshold?" is the
 * question the whole guard exists to answer early, and a calculation that
 * only runs inside a React server component is a calculation nobody can test.
 *
 * WHAT IS DELIBERATELY NOT IN HERE: any dollar figure. Pricing is a contract
 * term that changes without notice, is not readable from this repository, and
 * a number invented here would be quoted back later as if it had been
 * checked. `provider-volume.ts` refuses the same thing for the same reason.
 *
 * AND WHAT IS NOT IN THE ROWS: no user id, no email, no phone, no position,
 * no destination, no route. The report answers "how many, this month, on
 * which endpoint" and the ledger has nothing else to give it.
 */

export type UsageRow = Readonly<{
  month: string;
  endpoint: string;
  requests: number;
  units: number;
}>;

export type UsageReportLine = Readonly<{
  endpoint: MeteredEndpointKey;
  /** The HERE product this endpoint bills against. */
  product: string;
  requests: number;
  units: number;
}>;

export type UsageReport = Readonly<{
  month: string;
  lines: readonly UsageReportLine[];
  totalRequests: number;
  totalUnits: number;
  /** The enforced ceiling, or null when the guard is not configured. */
  threshold: number | null;
  /** The contracted allowance, or null when not configured. */
  allowance: number | null;
  /** Units left before refusals start. Null when unconfigured. */
  remaining: number | null;
  /** Percent of the threshold consumed, 0–100+, rounded. Null when unconfigured. */
  percentOfThreshold: number | null;
  /**
   * True once the month's units have reached the threshold — the state in
   * which metered endpoints refuse. Named for what it means to a driver, not
   * for the arithmetic.
   */
  refusing: boolean;
}>;

/**
 * Build the month's report.
 *
 * EVERY METERED ENDPOINT APPEARS, including ones with no traffic. A missing
 * line and a zero line look the same in a table but mean different things —
 * "nobody searched" versus "search is not being counted" — and the second is
 * a guard failure that a sparse table would hide.
 */
export function buildUsageReport(input: {
  month: string;
  rows: readonly UsageRow[];
  threshold: number | null;
  allowance: number | null;
}): UsageReport {
  const byEndpoint = new Map<string, { requests: number; units: number }>();
  for (const row of input.rows) {
    if (row.month !== input.month) continue;
    const current = byEndpoint.get(row.endpoint) ?? { requests: 0, units: 0 };
    byEndpoint.set(row.endpoint, {
      requests: current.requests + (Number(row.requests) || 0),
      units: current.units + (Number(row.units) || 0),
    });
  }

  const lines: UsageReportLine[] = METERED_ENDPOINT_KEYS.map((key) => {
    const found = byEndpoint.get(key) ?? { requests: 0, units: 0 };
    return {
      endpoint: key,
      product: key === 'navigator.route' ? 'HERE truck routing' : 'HERE Discover search',
      requests: found.requests,
      units: found.units,
    };
  });

  const totalRequests = lines.reduce((n, l) => n + l.requests, 0);
  const totalUnits = lines.reduce((n, l) => n + l.units, 0);
  const threshold = input.threshold;

  return {
    month: input.month,
    lines,
    totalRequests,
    totalUnits,
    threshold,
    allowance: input.allowance,
    remaining: threshold === null ? null : Math.max(0, threshold - totalUnits),
    percentOfThreshold:
      threshold === null || threshold <= 0 ? null : Math.round((totalUnits / threshold) * 100),
    refusing: threshold !== null && totalUnits >= threshold,
  };
}

/**
 * The standing caveat, printed with every report.
 *
 * It is a constant rather than page copy because the claim it prevents is the
 * one most likely to be made casually: that this number is the HERE bill. It
 * is not, it over-counts by design, and an operator reading a dashboard needs
 * that sentence next to the figure rather than in a document they have not
 * opened.
 */
export const USAGE_REPORT_CAVEAT =
  'These are locally counted units, not HERE transactions. Routing and search bill against ' +
  'different HERE products with different quotas, units are reserved before each call and are ' +
  'never refunded, and a cached or failed request still consumes one. Treat this as a ' +
  'conservative upper bound on what HERE may have counted — always at or above the real figure, ' +
  'never below it. The HERE dashboard remains the only billing record.';
