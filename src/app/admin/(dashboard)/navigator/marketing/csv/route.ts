import { NextResponse, type NextRequest } from 'next/server';
import { isAdminAuthed } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildStanCsv,
  parseSince,
  stanExportFilename,
  type MarketingContactRow,
} from '@/lib/navigator-account/stan-export';

export const dynamic = 'force-dynamic';

/**
 * Marketing-consent CSV for manual Stan Store import.
 *
 * THIS HANDLER AUTHENTICATES ITSELF. Route handlers are NOT wrapped by the
 * `(dashboard)` layout gate — the layout only wraps pages — so relying on the
 * folder it sits in would leave a file of drivers' email addresses and phone
 * numbers on an open URL. The existing directory export makes the same check
 * for the same reason; this follows it deliberately rather than inventing a
 * second pattern.
 *
 * 401, not a redirect: this is a download, and a browser following a redirect
 * to a login page would save the HTML as a .csv.
 *
 * WHO IS IN THE FILE is decided by `navigator_marketing_contacts`, which joins
 * identity to append-only consent evidence and filters to `is_subscribed`. A
 * driver who withdrew consent disappears from that view on the next read, with
 * no UPDATE anywhere — which is exactly why consent is not a boolean on the
 * profile. This route does not re-derive the rule; it reads the view.
 *
 * SERVICE ROLE, deliberately. The view is granted to `service_role` and to
 * nobody else — not to `anon`, not to `authenticated`. The admin dashboard is
 * a shared-password session with no Supabase identity attached, so there is no
 * principal an RLS policy could name; the gate above is what stands in for it.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ ok: false, error: 'admin-auth-required' }, { status: 401 });
  }

  const since = parseSince(req.nextUrl.searchParams.get('since'));

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'supabase-service-role-not-configured' },
      { status: 503 },
    );
  }

  // Oldest first, so de-duplication keeps the earliest signup — the row whose
  // consent evidence has been standing longest.
  let query = admin
    .from('navigator_marketing_contacts')
    .select('first_name, email, phone, phone_e164, created_at')
    .order('created_at', { ascending: true });
  if (since !== null) query = query.gte('created_at', since);

  const { data, error } = await query;
  if (error) {
    /*
     * Distinct from an empty export on purpose. The view depends on migration
     * 049 AND 050 being applied; if either is missing this fails, and an empty
     * CSV would read as "nobody consented" — which would be a false statement
     * about real people, and the kind that gets acted on.
     */
    return NextResponse.json(
      {
        ok: false,
        error: 'marketing-view-unavailable',
        detail:
          'Could not read navigator_marketing_contacts. Both migration 049 (consent evidence) and 050 (profiles) must be applied.',
      },
      { status: 503 },
    );
  }

  const result = buildStanCsv((data ?? []) as MarketingContactRow[]);
  const filename = stanExportFilename(since, new Date().toISOString());

  return new NextResponse(result.csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      // Counts in headers rather than in the file: a note row inside the CSV
      // would be imported as a contact.
      'x-tlws-included': String(result.included),
      'x-tlws-dropped-no-email': String(result.droppedNoEmail),
      'x-tlws-dropped-duplicate': String(result.droppedDuplicate),
      'x-tlws-over-stan-limit': String(result.overStanLimit),
      'cache-control': 'no-store',
    },
  });
}
