import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  isTpcCandidate,
  tpcWarnings,
  tpcCandidatesCsv,
  validateTpcUrl,
  type TpcListingRef,
} from '@/lib/directory/tpc';
import { detailHref } from '@/lib/directory/detail-slug';
import { DirectoryToolsNav } from '@/components/admin/directory/DirectoryToolsNav';
import { DownloadCsvButton } from '@/components/admin/directory/DownloadCsvButton';
import { TpcTool } from '@/components/admin/directory/TpcTool';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Admin — Truck Parking Club',
  robots: { index: false, follow: false },
};

/**
 * Truck Parking Club management (Milestone 21): coverage stats, candidate
 * worklist, stored-URL warnings, candidate-CSV export, and the correction-CSV
 * upload → preview → confirm → apply flow. URLs are never guessed — the only
 * write path is a validated uploaded file.
 */

async function getRows(): Promise<{ rows: TpcListingRef[]; error: string | null }> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('locations')
      .select('id, name, category_slug, address, city, state, tpc_url, is_published, detail_slug')
      .is('deleted_at', null)
      .order('state')
      .order('city')
      .order('name')
      .limit(5000);
    if (error || !data) return { rows: [], error: error?.message ?? 'No data' };
    return {
      rows: (
        data as unknown as {
          id: string;
          name: string;
          category_slug: string | null;
          address: string | null;
          city: string;
          state: string;
          tpc_url: string | null;
          is_published: boolean;
          detail_slug: string | null;
        }[]
      ).map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category_slug,
        address: r.address,
        city: r.city,
        state: r.state,
        tpcUrl: r.tpc_url,
        published: r.is_published,
        detailSlug: r.detail_slug,
      })),
      error: null,
    };
  } catch (e) {
    return { rows: [], error: (e as Error).message };
  }
}

export default async function AdminTpcPage() {
  requireAdmin();
  const { rows, error } = await getRows();

  const published = rows.filter((r) => r.published);
  const withUrl = rows.filter((r) => r.tpcUrl);
  const validUrl = withUrl.filter((r) => validateTpcUrl(r.tpcUrl!).ok);
  const malformed = withUrl.length - validUrl.length;
  const candidates = rows.filter((r) => isTpcCandidate(r));
  const warnings = tpcWarnings(rows);
  const candidatesCsv = tpcCandidatesCsv(rows);

  const stats: [string, number][] = [
    ['Published listings', published.length],
    ['With a valid TPC URL', validUrl.length],
    ['Missing a TPC URL', rows.length - withUrl.length],
    ['Malformed URLs', malformed],
    ['Candidates', candidates.length],
    ['Warnings', warnings.length],
  ];

  return (
    <div>
      <DirectoryToolsNav />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display-section">Truck Parking Club</h1>
        <DownloadCsvButton
          csv={candidatesCsv}
          filename="tpc-candidates.csv"
          label="Export candidates CSV"
        />
      </div>

      {error && (
        <p className="mb-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300">
          Couldn’t load listings: {error}
        </p>
      )}

      <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([label, n]) => (
          <div
            key={label}
            className="rounded-card border border-line bg-asphalt-800 p-4 text-center"
          >
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
            <dd className="mt-1 font-display text-3xl text-ink">{n}</dd>
          </div>
        ))}
      </dl>

      {warnings.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl uppercase text-ink">Warnings</h2>
          <ul className="mt-3 grid gap-2">
            {warnings.map((w, i) => (
              <li
                key={`${w.id}-${w.kind}-${i}`}
                className="rounded-card border border-diesel/50 bg-diesel/5 px-4 py-2.5 text-sm"
              >
                <span className="font-semibold text-ink">{w.name}</span>{' '}
                <span className="text-muted">— {w.detail}</span>{' '}
                <Link
                  href={`/admin/directory/${w.id}/edit`}
                  className="font-semibold text-signal hover:underline"
                >
                  Edit →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-display text-xl uppercase text-ink">
          Candidates <span className="text-base text-muted">({candidates.length})</span>
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Listings that likely belong on Truck Parking Club but have no URL yet — TPC-branded names
          and everything in the parking category. Export, research the real URLs, and upload the
          corrected file below. <strong className="text-ink">URLs are never guessed.</strong>
        </p>
        {candidates.length === 0 ? (
          <p className="mt-3 rounded-card border border-line bg-asphalt-800 p-5 text-sm text-muted">
            No candidates — every parking-related listing has a URL.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-card border border-line">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-asphalt-800 text-left text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Category</th>
                  <th className="px-3 py-2 font-semibold">Location</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Links</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {candidates.slice(0, 100).map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 font-semibold text-ink">{c.name}</td>
                    <td className="px-3 py-2 text-muted">{c.category ?? '—'}</td>
                    <td className="px-3 py-2 text-muted">
                      {c.city}, {c.state}
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {c.published ? 'Published' : 'Unpublished'}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/directory/${c.id}/edit`}
                        className="text-signal hover:underline"
                      >
                        Edit
                      </Link>
                      {c.published && c.detailSlug && (
                        <>
                          {' · '}
                          <a
                            href={detailHref(c.detailSlug)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-signal hover:underline"
                          >
                            Public page ↗
                          </a>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {candidates.length > 100 && (
              <p className="px-3 py-2 text-xs text-muted">
                Showing 100 of {candidates.length} — the CSV export contains all of them.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl uppercase text-ink">Upload correction CSV</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Columns: listing_id, business_name, category, address, city, state, current_tpc_url,
          proposed_tpc_url, action (set / clear / skip). Rows are matched by listing id and
          cross-checked against city/state and address — a matching name is never enough. Only
          https://truckparkingclub.com URLs are accepted.
        </p>
        <div className="mt-4">
          <TpcTool />
        </div>
      </section>
    </div>
  );
}
