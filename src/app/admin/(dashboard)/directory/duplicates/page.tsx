import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { getDuplicateCandidates, getIgnoredPairKeys, type ListingRow } from '@/lib/admin/directory';
import { findDuplicatePairs } from '@/lib/directory/duplicates';
import { getCategory } from '@/lib/directory/categories';
import { ConfirmSubmit } from '@/components/admin/directory/ConfirmSubmit';
import { mergeDuplicateAction, ignoreDuplicateAction, deleteDuplicateAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Admin — Duplicate Finder',
  robots: { index: false, follow: false },
};

const OK_MESSAGES: Record<string, string> = {
  merged: 'Pair merged — the kept listing absorbed the missing details.',
  ignored: 'Pair marked as not duplicates — it won’t be flagged again.',
  deleted: 'Duplicate deleted (soft delete — the row is kept in the database).',
};
const ERROR_MESSAGES: Record<string, string> = {
  merge: 'Merge failed — try again.',
  ignore: 'Could not save the ignore — try again.',
  delete: 'Delete failed — try again.',
};

const smallBtn =
  'rounded-card border border-line px-2.5 py-1 text-xs font-semibold text-ink transition-colors ' +
  'hover:border-signal hover:text-signal';

function Card({ row }: { row: ListingRow }) {
  return (
    <div className="rounded-card border border-line bg-asphalt p-4">
      <p className="font-semibold text-ink">
        {row.name}{' '}
        {!row.is_published && (
          <span className="text-xs font-normal text-muted">(unpublished)</span>
        )}
      </p>
      <p className="mt-1 text-xs text-muted">
        {row.category_slug ? (getCategory(row.category_slug)?.title ?? row.category_slug) : '—'} ·{' '}
        {row.address ? `${row.address}, ` : ''}
        {row.city}, {row.state}
        {row.lat != null && row.lng != null ? ` · ${row.lat.toFixed(4)}, ${row.lng.toFixed(4)}` : ''}
      </p>
      <Link
        href={`/admin/directory/${row.id}/edit`}
        className="mt-2 inline-block text-xs font-semibold text-signal hover:underline"
      >
        Open listing →
      </Link>
    </div>
  );
}

export default async function AdminDirectoryDuplicatesPage({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string };
}) {
  requireAdmin();

  const [{ rows, error }, ignored] = await Promise.all([
    getDuplicateCandidates(),
    getIgnoredPairKeys(),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const pairs = findDuplicatePairs(rows, ignored).filter(
    (p) => byId.has(p.aId) && byId.has(p.bId),
  );

  const ok = searchParams.ok ? OK_MESSAGES[searchParams.ok] : null;
  const err = searchParams.error ? ERROR_MESSAGES[searchParams.error] : null;

  return (
    <div>
      <p className="mb-2 text-sm text-muted">
        <Link href="/admin/directory" className="hover:text-signal">
          ← Directory
        </Link>
      </p>
      <h1 className="display-section mb-2">
        Duplicate finder <span className="text-lg text-muted">({pairs.length})</span>
      </h1>
      <p className="mb-8 max-w-2xl text-muted">
        Pairs flagged by matching name (same state), matching address, or coordinates within
        ~100&nbsp;m. Merge keeps the first listing and fills its blank fields from the second;
        Ignore hides a pair for good; Delete soft-deletes the second listing.
      </p>

      {ok && (
        <p className="mb-4 rounded-card border border-signal/50 bg-signal/10 px-4 py-3 text-sm font-medium text-signal">
          {ok}
        </p>
      )}
      {(err || error) && (
        <p className="mb-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel">
          {err ?? `Couldn’t scan for duplicates: ${error}`}
        </p>
      )}

      {!error && pairs.length === 0 && (
        <div className="rounded-card border border-line bg-asphalt-800 p-10 text-center">
          <p className="font-display text-2xl uppercase text-ink">No duplicates found</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Every listing looks unique by name, address, and coordinates. Run this again after big
            imports.
          </p>
        </div>
      )}

      <div className="grid gap-5">
        {pairs.map((p) => {
          const a = byId.get(p.aId)!;
          const b = byId.get(p.bId)!;
          return (
            <div key={`${p.aId}|${p.bId}`} className="rounded-card border border-line bg-asphalt-800 p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Matched on: <span className="text-signal">{p.reasons.join(' + ')}</span>
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Card row={a} />
                <Card row={b} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <form action={mergeDuplicateAction.bind(null, a.id, b.id)}>
                  <ConfirmSubmit
                    message={`Merge "${b.name}" into "${a.name}"? The first listing keeps its values, fills blanks from the second, and the second is soft-deleted.`}
                    className={smallBtn}
                  >
                    Merge → keep “{a.name.slice(0, 24)}”
                  </ConfirmSubmit>
                </form>
                <form action={mergeDuplicateAction.bind(null, b.id, a.id)}>
                  <ConfirmSubmit
                    message={`Merge "${a.name}" into "${b.name}"? The second listing keeps its values, fills blanks from the first, and the first is soft-deleted.`}
                    className={smallBtn}
                  >
                    Merge → keep “{b.name.slice(0, 24)}”
                  </ConfirmSubmit>
                </form>
                <form action={ignoreDuplicateAction.bind(null, a.id, b.id)}>
                  <button type="submit" className={smallBtn}>
                    Not duplicates — ignore
                  </button>
                </form>
                <form action={deleteDuplicateAction.bind(null, b.id)}>
                  <ConfirmSubmit
                    message={`Delete "${b.name}"? It disappears from the admin list and the public directory. (Soft delete — the row is kept.)`}
                    className="rounded-card border border-diesel px-2.5 py-1 text-xs font-semibold text-diesel transition-colors hover:bg-diesel hover:text-ink"
                  >
                    Delete “{b.name.slice(0, 24)}”
                  </ConfirmSubmit>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
