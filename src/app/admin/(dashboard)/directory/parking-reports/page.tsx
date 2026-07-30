import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { groupReports, type ReportRow } from '@/lib/community/parking-report';
import { overnightLabelFor } from '@/lib/directory/overnight';
import { setReportStatus } from './actions';

export const dynamic = 'force-dynamic';

/**
 * Driver parking-report review queue (2026-07-30).
 *
 * Read-only with respect to `public.locations`: this page shows what a driver
 * claims next to what the database currently says, and lets an admin move the
 * SUBMISSION through triage. It deliberately has NO "apply to listing"
 * button — changing authoritative data stays a separate, evidenced action.
 *
 * Repeat reports for the same listing + issue are grouped so they can be
 * prioritized. Volume is an attention signal only: three drivers saying the
 * same thing is a reason to look, never a reason to accept.
 */

type LocationFacts = {
  id: string;
  name: string;
  state: string | null;
  city: string | null;
  interstate: string | null;
  exit_number: string | null;
  parking_spaces: number | null;
  overnight_status: string | null;
  detail_slug: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  rejected: 'Rejected',
  duplicate: 'Duplicate',
  approved: 'Resolved',
  merged: 'Merged',
};

export default async function ParkingReportsPage() {
  const supabase = createAdminClient();

  const { data: rows } = await supabase
    .from('location_submissions')
    .select('id, location_id, status, created_at, comments, name, state, city, address, kind')
    .in('kind', ['correction', 'closure', 'new'])
    .order('created_at', { ascending: false })
    .limit(500);

  const reports = (rows ?? []) as (ReportRow & {
    name: string | null;
    state: string | null;
    city: string | null;
    address: string | null;
    kind: string;
  })[];

  // Current authoritative values for every reported listing, for side-by-side.
  const ids = [...new Set(reports.map((r) => r.location_id).filter(Boolean))] as string[];
  const facts = new Map<string, LocationFacts>();
  if (ids.length > 0) {
    const { data: locs } = await supabase
      .from('locations')
      .select(
        'id, name, state, city, interstate, exit_number, parking_spaces, overnight_status, detail_slug',
      )
      .in('id', ids);
    for (const l of (locs ?? []) as LocationFacts[]) facts.set(l.id, l);
  }

  const groups = groupReports(reports);
  const pending = groups.filter((g) => g.reports.some((r) => r.status === 'pending'));

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-3xl uppercase text-ink">Driver parking reports</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Grouped by listing and issue so repeats surface first. Reviewing a report never changes a
          listing — authoritative data only moves through a separate evidenced update. Several
          drivers reporting the same thing means look sooner, not accept.
        </p>
        <p className="mt-2 text-sm text-muted">
          {groups.length} group{groups.length === 1 ? '' : 's'} · {pending.length} with pending
          reports · {reports.length} report{reports.length === 1 ? '' : 's'} total
        </p>
      </header>

      {groups.length === 0 && (
        <p className="rounded-card border border-line bg-asphalt-800 p-6 text-sm text-muted">
          No driver reports yet.
        </p>
      )}

      {groups.map((group) => {
        const fact = group.locationId ? facts.get(group.locationId) : undefined;
        return (
          <section key={group.key} className="rounded-card border border-line bg-asphalt-800 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-xl uppercase text-ink">
                {group.issueLabel}
                {group.count > 1 && (
                  <span className="ml-3 rounded-card border border-signal px-2 py-0.5 text-sm text-signal">
                    {group.count} reports
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted">
                Latest {group.latestAt ? new Date(group.latestAt).toLocaleString() : '—'}
              </p>
            </div>

            {fact ? (
              <div className="mt-3 grid gap-1 rounded-card border border-line p-3 text-sm">
                <p className="font-semibold text-ink">
                  {fact.name}
                  {fact.detail_slug && (
                    <Link
                      href={`/directory/location/${fact.detail_slug}`}
                      className="ml-2 text-xs font-normal text-signal underline-offset-4 hover:underline"
                    >
                      view listing →
                    </Link>
                  )}
                </p>
                <p className="text-muted">
                  Currently: {[fact.city, fact.state].filter(Boolean).join(', ') || 'no city/state'}{' '}
                  · {fact.interstate ?? 'no route'}{' '}
                  {fact.exit_number ? `exit ${fact.exit_number}` : ''} ·{' '}
                  {typeof fact.parking_spaces === 'number'
                    ? `${fact.parking_spaces} spaces`
                    : 'spaces unknown'}{' '}
                  · {overnightLabelFor(fact.overnight_status)}
                </p>
              </div>
            ) : (
              <p className="mt-3 rounded-card border border-line p-3 text-sm text-muted">
                Proposed new location — not in the directory. Stays a pending submission until an
                admin creates it deliberately.
              </p>
            )}

            <ul className="mt-4 grid gap-3">
              {group.reports.map((r) => (
                <li key={r.id} className="rounded-card border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-widest text-muted">
                      {STATUS_LABEL[r.status] ?? r.status} ·{' '}
                      {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                    </span>
                    <form action={setReportStatus} className="flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      {(['rejected', 'duplicate'] as const).map((s) => (
                        <button
                          key={s}
                          name="status"
                          value={s}
                          disabled={r.status === s}
                          className="min-h-[36px] rounded-card border border-line px-3 text-xs uppercase tracking-wide text-ink hover:border-signal disabled:opacity-40"
                        >
                          {STATUS_LABEL[s]}
                        </button>
                      ))}
                      {r.status !== 'pending' && (
                        <button
                          name="status"
                          value="pending"
                          className="min-h-[36px] rounded-card border border-line px-3 text-xs uppercase tracking-wide text-muted hover:border-signal"
                        >
                          Reopen
                        </button>
                      )}
                    </form>
                  </div>

                  {r.name && r.name !== 'Driver report' && (
                    <p className="mt-2 text-ink">
                      Proposed: <span className="font-semibold">{r.name}</span>
                      {[r.city, r.state].filter(Boolean).length > 0 &&
                        ` — ${[r.city, r.state].filter(Boolean).join(', ')}`}
                    </p>
                  )}
                  {(r.decoded.interstate || r.decoded.exitNumber || r.decoded.direction) && (
                    <p className="mt-1 text-muted">
                      Route: {r.decoded.interstate ?? '—'} {r.decoded.direction ?? ''}{' '}
                      {r.decoded.exitNumber ? `exit ${r.decoded.exitNumber}` : ''}{' '}
                      <span className="text-xs">(exit only — never stored as a mile marker)</span>
                    </p>
                  )}
                  {r.decoded.parkingDetails && (
                    <p className="mt-1 text-muted">Parking: {r.decoded.parkingDetails}</p>
                  )}
                  {r.decoded.note && <p className="mt-2 whitespace-pre-wrap">{r.decoded.note}</p>}
                  {r.decoded.evidence && (
                    <p className="mt-2 break-all text-xs">
                      Source:{' '}
                      <a
                        href={r.decoded.evidence}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-signal underline-offset-4 hover:underline"
                      >
                        {r.decoded.evidence}
                      </a>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
