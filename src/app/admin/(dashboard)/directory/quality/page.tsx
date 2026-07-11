import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getListingsForExport, type ListingRow } from '@/lib/admin/directory';
import { getReviewAggregates } from '@/lib/community/data';
import {
  scoreCompleteness,
  completenessDistribution,
  type CompletenessInput,
} from '@/lib/directory/completeness';
import { detectIssues, sortIssues, issuesCsv, type QualityListing, type IssueSeverity } from '@/lib/directory/issues';
import { trustStatus, TRUST_LABELS, TRUST_STATUSES, type TrustStatus } from '@/lib/directory/trust';
import { detailHref } from '@/lib/directory/detail-slug';
import { DirectoryToolsNav } from '@/components/admin/directory/DirectoryToolsNav';
import { DownloadCsvButton } from '@/components/admin/directory/DownloadCsvButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Directory Quality', robots: { index: false, follow: false } };

/**
 * Data-quality dashboard (Milestone 21): whole-directory counts, completeness
 * distribution, verification statuses, and the full issue report with
 * severity/type filters and a formula-safe CSV export. Read-only — every fix
 * happens through the linked editors and tools.
 */

const TABLE_CAP = 200;

function toQuality(row: ListingRow): QualityListing {
  return {
    id: row.id,
    name: row.name,
    categorySlug: row.category_slug,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    phone: row.phone,
    website: row.website,
    description: row.description,
    amenities: row.amenities ?? [],
    interstate: row.interstate,
    exitNumber: row.exit_number,
    lat: row.lat,
    lng: row.lng,
    tpcUrl: row.tpc_url,
    detailSlug: row.detail_slug,
    published: row.is_published,
    deleted: false,
    verifiedAt: row.verified_at,
    parkingSpaces: row.parking_spaces,
    freeParking: row.free_parking,
    paidParking: row.paid_parking,
    reservedParking: row.reserved_parking,
    overnightParking: row.overnight_parking,
  };
}

function toCompleteness(row: ListingRow, approvedReviews: number): CompletenessInput {
  const chips: string[] = [];
  if (row.free_parking) chips.push('Free parking');
  if (row.paid_parking) chips.push('Paid parking');
  if (row.reserved_parking) chips.push('Reserved');
  if (row.overnight_parking) chips.push('Overnight OK');
  chips.push(...(row.amenities ?? []));
  return {
    name: row.name,
    category: row.category_slug ?? 'other',
    address: row.address ?? undefined,
    city: row.city,
    state: row.state,
    zip: row.zip ?? undefined,
    interstate: row.interstate ?? undefined,
    exitNumber: row.exit_number ?? undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    phone: row.phone ?? undefined,
    website: row.website ?? undefined,
    amenities: chips,
    parkingSpaces: row.parking_spaces ?? undefined,
    description: row.description ?? undefined,
    tpcUrl: row.tpc_url ?? undefined,
    verifiedAt: row.verified_at ?? undefined,
    approvedReviews,
  };
}

async function getDeletedCount(): Promise<number> {
  try {
    const supabase = createAdminClient();
    const { count } = await supabase
      .from('locations')
      .select('id', { count: 'exact', head: true })
      .not('deleted_at', 'is', null);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export default async function AdminQualityPage({
  searchParams,
}: {
  searchParams: { severity?: string; type?: string; trust?: string };
}) {
  requireAdmin();
  const now = new Date();

  const [{ rows, error }, deletedCount, aggregates] = await Promise.all([
    getListingsForExport({}),
    getDeletedCount(),
    getReviewAggregates(),
  ]);

  const quality = rows.map(toQuality);
  const completeness = rows.map((r) => ({
    row: r,
    result: scoreCompleteness(toCompleteness(r, aggregates[r.id]?.count ?? 0)),
  }));
  const avgScore =
    completeness.length === 0
      ? 0
      : Math.round(completeness.reduce((sum, c) => sum + c.result.score, 0) / completeness.length);
  const distribution = completenessDistribution(completeness.map((c) => c.result.score));

  const trust = new Map<string, TrustStatus>(
    rows.map((r) => [
      r.id,
      trustStatus({ verifiedAt: r.verified_at, approvedReviews: aggregates[r.id]?.count ?? 0 }, now),
    ]),
  );
  const trustCounts = Object.fromEntries(TRUST_STATUSES.map((s) => [s, 0])) as Record<TrustStatus, number>;
  for (const status of trust.values()) trustCounts[status] += 1;

  const allIssues = sortIssues(detectIssues(quality, now));
  const issueTypes = [...new Set(allIssues.map((i) => i.type))].sort();
  const severityFilter = (searchParams.severity ?? '') as IssueSeverity | '';
  const typeFilter = searchParams.type ?? '';
  const trustFilter = (searchParams.trust ?? '') as TrustStatus | '';
  const filtered = allIssues.filter(
    (i) =>
      (!severityFilter || i.severity === severityFilter) &&
      (!typeFilter || i.type === typeFilter) &&
      (!trustFilter || trust.get(i.listingId) === trustFilter),
  );

  const counts: [string, number][] = [
    ['Total (non-deleted)', rows.length],
    ['Published', rows.filter((r) => r.is_published).length],
    ['Unpublished', rows.filter((r) => !r.is_published).length],
    ['Soft-deleted', deletedCount],
    ['With coordinates', rows.filter((r) => r.lat != null && r.lng != null).length],
    ['Without coordinates', rows.filter((r) => r.lat == null || r.lng == null).length],
    ['Average completeness', avgScore],
    ['Open issues', allIssues.length],
  ];

  const detailSlugById = new Map(rows.map((r) => [r.id, r.detail_slug]));
  const publishedById = new Map(rows.map((r) => [r.id, r.is_published]));

  return (
    <div>
      <DirectoryToolsNav />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display-section">Directory quality</h1>
        <DownloadCsvButton csv={issuesCsv(filtered)} filename="directory-quality-issues.csv" label="Export filtered issues CSV" />
      </div>

      {error && (
        <p className="mb-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel">
          Couldn’t load listings: {error}
        </p>
      )}

      <dl className="grid gap-3 sm:grid-cols-4">
        {counts.map(([label, n]) => (
          <div key={label} className="rounded-card border border-line bg-asphalt-800 p-4 text-center">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
            <dd className="mt-1 font-display text-3xl text-ink">{n}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-card border border-line bg-asphalt-800 p-5">
          <h2 className="font-display text-lg uppercase text-ink">Completeness distribution</h2>
          <dl className="mt-3 grid grid-cols-4 gap-3 text-center">
            {Object.entries(distribution).map(([label, n]) => (
              <div key={label}>
                <dt className="text-xs font-semibold text-muted">{label}</dt>
                <dd className="mt-1 font-display text-2xl text-ink">{n}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">
            Deterministic 0–100 score (weights documented in lib/directory/completeness.ts).
            Admin-only — never shown publicly.
          </p>
        </section>
        <section className="rounded-card border border-line bg-asphalt-800 p-5">
          <h2 className="font-display text-lg uppercase text-ink">Verification status</h2>
          <dl className="mt-3 grid grid-cols-5 gap-2 text-center">
            {TRUST_STATUSES.map((s) => (
              <div key={s}>
                <dt className="text-[11px] font-semibold text-muted">{TRUST_LABELS[s]}</dt>
                <dd className="mt-1 font-display text-2xl text-ink">{trustCounts[s]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">
            Derived only from stored evidence (verified dates, approved community activity).
          </p>
        </section>
      </div>

      {/* Filters (GET form — shareable URLs, server-side filtering) */}
      <form method="GET" className="mt-8 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="severity" className="mb-1 block text-xs font-semibold text-muted">
            Severity
          </label>
          <select id="severity" name="severity" defaultValue={severityFilter} className="rounded-card border border-line bg-asphalt px-3 py-2 text-sm text-ink">
            <option value="">All</option>
            {(['high', 'medium', 'low', 'info'] as const).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="type" className="mb-1 block text-xs font-semibold text-muted">
            Issue type
          </label>
          <select id="type" name="type" defaultValue={typeFilter} className="rounded-card border border-line bg-asphalt px-3 py-2 text-sm text-ink">
            <option value="">All</option>
            {issueTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="trust" className="mb-1 block text-xs font-semibold text-muted">
            Verification
          </label>
          <select id="trust" name="trust" defaultValue={trustFilter} className="rounded-card border border-line bg-asphalt px-3 py-2 text-sm text-ink">
            <option value="">All</option>
            {TRUST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TRUST_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-card border border-line px-3 py-2 text-xs font-semibold text-ink hover:border-signal hover:text-signal">
          Apply
        </button>
        {(severityFilter || typeFilter || trustFilter) && (
          <Link href="/admin/directory/quality" className="py-2 text-xs font-semibold text-muted hover:text-signal">
            Clear filters
          </Link>
        )}
      </form>

      <p className="mt-4 text-sm text-muted">
        {filtered.length} issue{filtered.length === 1 ? '' : 's'}
        {filtered.length > TABLE_CAP ? ` — showing the first ${TABLE_CAP}; the CSV export contains all of them` : ''}
      </p>

      {filtered.length === 0 ? (
        <p className="mt-3 rounded-card border border-line bg-asphalt-800 p-6 text-sm text-muted">
          No issues match these filters.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-asphalt-800 text-left text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Listing</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Issue</th>
                <th className="px-3 py-2 font-semibold">Severity</th>
                <th className="px-3 py-2 font-semibold">Detail</th>
                <th className="px-3 py-2 font-semibold">Suggested action</th>
                <th className="px-3 py-2 font-semibold">Links</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.slice(0, TABLE_CAP).map((i, n) => (
                <tr key={`${i.listingId}-${i.type}-${n}`}>
                  <td className="px-3 py-2">
                    <span className="font-semibold text-ink">{i.name}</span>
                    <span className="block text-xs text-muted">
                      {i.category ?? '—'} · {i.city}, {i.state}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted">{i.published ? 'Published' : 'Unpublished'}</td>
                  <td className="px-3 py-2 font-mono text-xs text-ink">{i.type}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        i.severity === 'high'
                          ? 'font-semibold text-diesel'
                          : i.severity === 'medium'
                            ? 'font-semibold text-signal'
                            : 'text-muted'
                      }
                    >
                      {i.severity}
                    </span>
                  </td>
                  <td className="max-w-[280px] px-3 py-2 text-xs text-muted">{i.detail}</td>
                  <td className="max-w-[220px] px-3 py-2 text-xs text-muted">{i.suggestedAction}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    <Link href={`/admin/directory/${i.listingId}/edit`} className="text-signal hover:underline">
                      Edit
                    </Link>
                    {publishedById.get(i.listingId) && detailSlugById.get(i.listingId) && (
                      <>
                        {' · '}
                        <a
                          href={detailHref(detailSlugById.get(i.listingId)!)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-signal hover:underline"
                        >
                          Public ↗
                        </a>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
