import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { detailHref } from '@/lib/directory/detail-slug';

/**
 * Admin-only most-viewed report (Milestone 25). Reads the aggregate
 * directory_view_daily counters over a trailing window via the service role and
 * shows the top listings. Fails soft: if migration 025 is unapplied (the normal
 * case in this milestone) it shows a clear "not enabled yet" state. Counts are
 * never exposed publicly — this page lives behind the admin auth gate.
 */

export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 30;
const TOP_N = 50;

type DailyRow = { location_id: string; views: number };

async function loadTop(): Promise<{ enabled: boolean; rows: { id: string; views: number }[] }> {
  try {
    const supabase = createAdminClient();
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('directory_view_daily')
      .select('location_id, views')
      .gte('day', since)
      .limit(10_000);
    if (error) return { enabled: false, rows: [] };
    const totals = new Map<string, number>();
    for (const r of (data ?? []) as DailyRow[]) {
      totals.set(r.location_id, (totals.get(r.location_id) ?? 0) + (r.views ?? 0));
    }
    const rows = [...totals.entries()]
      .map(([id, views]) => ({ id, views }))
      .sort((a, b) => b.views - a.views || a.id.localeCompare(b.id))
      .slice(0, TOP_N);
    return { enabled: true, rows };
  } catch {
    return { enabled: false, rows: [] };
  }
}

async function namesFor(ids: string[]): Promise<Map<string, { name: string; detailSlug: string | null }>> {
  const out = new Map<string, { name: string; detailSlug: string | null }>();
  if (!ids.length) return out;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('locations')
      .select('id, name, detail_slug')
      .in('id', ids);
    for (const r of (data ?? []) as { id: string; name: string; detail_slug: string | null }[]) {
      out.set(r.id, { name: r.name, detailSlug: r.detail_slug });
    }
  } catch {
    /* fall through — ids render without names */
  }
  return out;
}

export default async function PopularAdminPage() {
  const { enabled, rows } = await loadTop();
  const names = await namesFor(rows.map((r) => r.id));

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl uppercase text-ink">Most viewed (last {WINDOW_DAYS} days)</h1>
      <p className="mt-2 text-sm text-muted">
        Aggregate view counts from the privacy-preserving foundation (no personal data). Admin-only —
        no public ranking ships until the data is sufficient and that call is made deliberately.
      </p>

      {!enabled ? (
        <div className="mt-6 rounded-card border border-dashed border-line bg-asphalt-800 p-6 text-sm text-muted">
          <p className="font-semibold text-ink">Most-viewed is not enabled yet.</p>
          <p className="mt-2">
            Migration <code>025_directory_view_events.sql</code> is committed but not applied. Once
            it is applied and the ingestion route starts recording, counts appear here. See{' '}
            <code>docs/most-viewed-privacy.md</code>.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-6 rounded-card border border-line bg-asphalt-800 p-6 text-sm text-muted">
          No views recorded in the window yet.
        </p>
      ) : (
        <ol className="mt-6 space-y-2">
          {rows.map((r, i) => {
            const meta = names.get(r.id);
            return (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-card border border-line bg-asphalt-800 px-4 py-2 text-sm"
              >
                <span className="text-ink">
                  <span className="mr-2 text-muted">{i + 1}.</span>
                  {meta?.detailSlug ? (
                    <Link href={detailHref(meta.detailSlug)} className="text-signal hover:underline">
                      {meta.name}
                    </Link>
                  ) : (
                    meta?.name ?? r.id
                  )}
                </span>
                <span className="font-semibold text-ink">{r.views}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
