import { NextResponse, type NextRequest } from 'next/server';
import { isAdminAuthed } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { readUsageConfig, usageMonthKey } from '@/lib/navigator-api/usage-guard';
import {
  USAGE_REPORT_CAVEAT,
  buildUsageReport,
  type UsageRow,
} from '@/lib/navigator-account/usage-report';

export const dynamic = 'force-dynamic';

/**
 * GET /admin/navigator/usage/json[?month=YYYY-MM] — the month's provider usage.
 *
 * THIS HANDLER AUTHENTICATES ITSELF. Route handlers are NOT wrapped by the
 * `(dashboard)` layout gate — the layout only wraps pages — so relying on the
 * folder would leave the operator's remaining budget on an open URL. The
 * marketing export makes the same check for the same reason; this follows it
 * rather than inventing a second pattern.
 *
 * WHY THE REMAINING BUDGET IS WORTH GATING. It is not personal data, and it is
 * still the single most useful number an attacker could have: it says exactly
 * how many more requests are needed to push the deploy into refusing every
 * driver. A progress bar for a denial-of-service is not something to serve
 * anonymously.
 *
 * 401, not a redirect — a client following a redirect would parse the login
 * page as JSON.
 *
 * SERVICE ROLE, deliberately. The report view is granted to `service_role`
 * alone; the admin dashboard is a shared-password session with no Supabase
 * identity, so there is no principal an RLS policy could name, and the check
 * above is what stands in for one.
 *
 * NO PII IS REACHABLE FROM HERE. The view holds month, endpoint, requests and
 * units. There is no user id in it, and the per-user ledger — which does hold
 * one — is not read by this route at all.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ ok: false, error: 'admin-auth-required' }, { status: 401 });
  }

  /*
   * An unparseable or absent month means THIS month, never an empty window.
   * An empty result would read as "nothing was spent", which is a false
   * statement of exactly the kind that gets acted on.
   */
  const requested = (req.nextUrl.searchParams.get('month') ?? '').trim();
  const month = /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(requested)
    ? requested
    : usageMonthKey(Date.now());

  const parsed = readUsageConfig(process.env);
  const threshold = parsed.ok ? parsed.config.threshold : null;
  const allowance = parsed.ok ? parsed.config.allowance : null;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'supabase-service-role-not-configured' },
      { status: 503 },
    );
  }

  const { data, error } = await admin
    .from('navigator_provider_usage_report')
    .select('month, endpoint, requests, units')
    .eq('month', month);

  if (error) {
    /*
     * Distinct from an empty report, on purpose. The view depends on
     * migration 051 being applied; if it is missing, a zeroed report would
     * say "nothing has been spent this month" about a deploy that may have
     * been spending all week.
     */
    return NextResponse.json(
      {
        ok: false,
        error: 'usage-view-unavailable',
        detail: 'Could not read navigator_provider_usage_report. Migration 051 must be applied.',
      },
      { status: 503 },
    );
  }

  const report = buildUsageReport({
    month,
    rows: (data ?? []) as UsageRow[],
    threshold,
    allowance,
  });

  return NextResponse.json(
    {
      ok: true,
      report,
      configured: parsed.ok,
      caveat: USAGE_REPORT_CAVEAT,
    },
    { status: 200, headers: { 'cache-control': 'no-store' } },
  );
}
