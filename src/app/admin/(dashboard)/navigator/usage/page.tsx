import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { readUsageConfig, usageMonthKey, USAGE_ENV } from '@/lib/navigator-api/usage-guard';
import {
  USAGE_REPORT_CAVEAT,
  buildUsageReport,
  type UsageRow,
} from '@/lib/navigator-account/usage-report';

export const dynamic = 'force-dynamic';

/**
 * Navigator provider usage — the month, by endpoint, against the threshold.
 *
 * WHY THIS PAGE EXISTS. Everything else about the spend guard is invisible
 * until it refuses someone. The whole argument for a threshold BELOW the
 * contracted allowance is that the margin leaves room to notice and react —
 * and nobody reacts to a number they cannot see. This is where the number is
 * knowable before it matters rather than after.
 *
 * `requireAdmin()` is called here as well as in the `(dashboard)` layout. That
 * is deliberate duplication, not an oversight: the layout gate is one edit
 * away from not covering this folder, and the cost of the second call is a
 * cookie comparison.
 */
export default async function NavigatorUsagePage({
  searchParams,
}: {
  searchParams?: { month?: string };
}) {
  requireAdmin();

  const requested = (searchParams?.month ?? '').trim();
  // An unparseable month means THIS month, never an empty window — a zeroed
  // table would read as "nothing was spent", which is the kind of false
  // statement that gets acted on.
  const month = /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(requested)
    ? requested
    : usageMonthKey(Date.now());

  const parsed = readUsageConfig(process.env);
  const configured = parsed.ok;

  let rows: UsageRow[] = [];
  let unavailable: string | null = null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('navigator_provider_usage_report')
      .select('month, endpoint, requests, units')
      .eq('month', month);
    if (error) {
      unavailable = 'Migration 051 does not appear to be applied on this project.';
    } else {
      rows = (data ?? []) as UsageRow[];
    }
  } catch {
    unavailable = 'The service-role key is not configured for this deploy context.';
  }

  const report = buildUsageReport({
    month,
    rows,
    threshold: parsed.ok ? parsed.config.threshold : null,
    allowance: parsed.ok ? parsed.config.allowance : null,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Navigator provider usage</h1>
        <p className="mt-1 text-sm text-ink/70">{month} (UTC)</p>
      </div>

      {!configured && (
        <p className="rounded border border-line p-4 text-sm text-ink/80">
          The usage guard is not configured on this deploy: {parsed.ok ? '' : parsed.problem}. Set{' '}
          <code>{USAGE_ENV.allowance}</code>, <code>{USAGE_ENV.threshold}</code> and{' '}
          <code>{USAGE_ENV.userLimit}</code> before enabling account mode — until then, metered
          endpoints in account mode refuse every request, which is the intended fail-closed
          behaviour.
        </p>
      )}

      {unavailable !== null && (
        <p className="rounded border border-line p-4 text-sm text-ink/80">
          Usage could not be read. {unavailable}
        </p>
      )}

      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="py-2">Endpoint</th>
            <th className="py-2">Provider product</th>
            <th className="py-2 text-right">Requests</th>
            <th className="py-2 text-right">Units</th>
          </tr>
        </thead>
        <tbody>
          {report.lines.map((line) => (
            <tr key={line.endpoint} className="border-b border-line/50">
              <td className="py-2">{line.endpoint}</td>
              <td className="py-2 text-ink/70">{line.product}</td>
              <td className="py-2 text-right tabular-nums">{line.requests}</td>
              <td className="py-2 text-right tabular-nums">{line.units}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-2">Total</td>
            <td className="py-2" />
            <td className="py-2 text-right tabular-nums">{report.totalRequests}</td>
            <td className="py-2 text-right tabular-nums">{report.totalUnits}</td>
          </tr>
        </tbody>
      </table>

      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-ink/70">Enforced threshold</dt>
          <dd className="tabular-nums">{report.threshold ?? 'not configured'}</dd>
        </div>
        <div>
          <dt className="text-ink/70">Contracted allowance</dt>
          <dd className="tabular-nums">{report.allowance ?? 'not configured'}</dd>
        </div>
        <div>
          <dt className="text-ink/70">Remaining before refusals</dt>
          <dd className="tabular-nums">{report.remaining ?? 'not configured'}</dd>
        </div>
      </dl>

      {report.refusing && (
        <p className="rounded border border-line p-4 text-sm font-semibold text-ink">
          The threshold for {month} is spent. Metered Navigator endpoints are refusing requests in
          account and public mode. Pilot mode is unaffected.
        </p>
      )}

      <p className="text-xs text-ink/60">{USAGE_REPORT_CAVEAT}</p>
    </div>
  );
}
