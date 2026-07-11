import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import {
  getDuplicateCandidates,
  getIgnoredPairKeys,
  getPairDecisions,
  type ListingRow,
} from '@/lib/admin/directory';
import {
  findClassifiedPairs,
  classifiedPairsCsv,
  LEGITIMATE_CLASSES,
  type PairListing,
  type PairClass,
} from '@/lib/directory/colocation';
import { getCategory } from '@/lib/directory/categories';
import { ConfirmSubmit } from '@/components/admin/directory/ConfirmSubmit';
import { DirectoryToolsNav } from '@/components/admin/directory/DirectoryToolsNav';
import { DownloadCsvButton } from '@/components/admin/directory/DownloadCsvButton';
import {
  mergeDuplicateAction,
  ignoreDuplicateAction,
  deleteDuplicateAction,
  recordPairDecisionAction,
} from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Admin — Duplicates & Co-location',
  robots: { index: false, follow: false },
};

/**
 * Duplicate + co-location review (Milestone 21). Pairs are classified
 * deterministically (exact/probable duplicates vs legitimate co-locations,
 * shared-address sub-services, brand-at-multiple-exits) with per-signal
 * reasons. Nothing is ever auto-merged or auto-deleted; decisions persist
 * (migration 023) so resolved pairs stop resurfacing.
 */

const OK_MESSAGES: Record<string, string> = {
  merged: 'Pair merged — the kept listing absorbed the missing details.',
  ignored: 'Pair marked as not duplicates — it won’t be flagged again.',
  deleted: 'Duplicate deleted (soft delete — the row is kept in the database).',
  'decision-saved': 'Decision saved — the pair is recorded and won’t resurface.',
  'decision-fallback':
    'Decision recorded as an exclusion only: the decision table (migration 023) is not provisioned yet, so the reason could not be stored.',
};
const ERROR_MESSAGES: Record<string, string> = {
  merge: 'Merge failed — try again.',
  ignore: 'Could not save the ignore — try again.',
  delete: 'Delete failed — try again.',
  decision: 'Could not save the decision — try again.',
  'decision-table-missing':
    'Could not save: the decision table (migration 023) is not provisioned and the fallback also failed.',
};

const CLASS_LABELS: Record<PairClass, string> = {
  'exact-duplicate': 'Exact duplicate',
  'probable-duplicate': 'Probable duplicate',
  'shared-address-sub-service': 'Shared-address sub-service',
  'same-coords-diff-category': 'Same coordinates, different category',
  'co-located': 'Co-located businesses',
  'brand-multi-exit': 'Same brand, different exits',
  'similar-name-diff-address': 'Similar name, different address',
};

const smallBtn =
  'rounded-card border border-line px-2.5 py-1 text-xs font-semibold text-ink transition-colors ' +
  'hover:border-signal hover:text-signal';

function toPairListing(row: ListingRow): PairListing {
  return {
    id: row.id,
    name: row.name,
    category: row.category_slug,
    address: row.address,
    city: row.city,
    state: row.state,
    phone: row.phone,
    website: row.website,
    lat: row.lat,
    lng: row.lng,
    interstate: row.interstate,
    exitNumber: row.exit_number,
  };
}

function Card({ row }: { row: ListingRow }) {
  return (
    <div className="rounded-card border border-line bg-asphalt p-4">
      <p className="font-semibold text-ink">
        {row.name}{' '}
        {!row.is_published && <span className="text-xs font-normal text-muted">(unpublished)</span>}
      </p>
      <p className="mt-1 text-xs text-muted">
        {row.category_slug ? (getCategory(row.category_slug)?.title ?? row.category_slug) : '—'} ·{' '}
        {row.address ? `${row.address}, ` : ''}
        {row.city}, {row.state}
        {row.lat != null && row.lng != null ? ` · ${row.lat.toFixed(4)}, ${row.lng.toFixed(4)}` : ''}
        {row.phone ? ` · ${row.phone}` : ''}
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
  searchParams: { ok?: string; error?: string; class?: string };
}) {
  requireAdmin();

  const [{ rows, error }, ignored, pairDecisions] = await Promise.all([
    getDuplicateCandidates(),
    getIgnoredPairKeys(),
    getPairDecisions(),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const pairInputs = rows.map(toPairListing);
  const byIdPair = new Map(pairInputs.map((r) => [r.id, r]));

  // Decided pairs are excluded from re-warning (confirmed duplicates keep
  // showing until actually merged).
  const excluded = new Set(ignored);
  for (const [key, decision] of pairDecisions.decisions) {
    if (decision !== 'duplicate-confirmed') excluded.add(key);
  }

  const allPairs = findClassifiedPairs(pairInputs, excluded);
  const classFilter = searchParams.class ?? '';
  const pairs = classFilter ? allPairs.filter((p) => p.class === classFilter) : allPairs;
  const classCounts = new Map<PairClass, number>();
  for (const p of allPairs) classCounts.set(p.class, (classCounts.get(p.class) ?? 0) + 1);

  const ok = searchParams.ok ? OK_MESSAGES[searchParams.ok] : null;
  const err = searchParams.error ? ERROR_MESSAGES[searchParams.error] : null;

  return (
    <div>
      <DirectoryToolsNav />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display-section">
          Duplicates &amp; co-location <span className="text-lg text-muted">({allPairs.length})</span>
        </h1>
        <DownloadCsvButton
          csv={classifiedPairsCsv(pairs, byIdPair)}
          filename="duplicate-pairs.csv"
          label="Export pairs CSV"
        />
      </div>
      <p className="mb-4 max-w-2xl text-muted">
        Pairs matched on name, address, coordinates, phone, or website — then classified. Duplicates
        can be merged; legitimate arrangements (a scale inside a truck stop, the same brand at two
        exits) are recorded so they stop resurfacing. Nothing is merged or deleted automatically.
      </p>
      {!pairDecisions.tableAvailable && (
        <p className="mb-4 max-w-2xl rounded-card border border-line bg-asphalt-800 px-4 py-3 text-xs text-muted">
          Decision reasons need migration 023 (not applied yet) — until then, decisions fall back
          to exclusion-only records.
        </p>
      )}

      {/* Class filter chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/admin/directory/duplicates"
          className={`${smallBtn} ${classFilter === '' ? 'border-signal text-signal' : ''}`}
        >
          All ({allPairs.length})
        </Link>
        {[...classCounts.entries()].map(([cls, count]) => (
          <Link
            key={cls}
            href={`/admin/directory/duplicates?class=${cls}`}
            className={`${smallBtn} ${classFilter === cls ? 'border-signal text-signal' : ''}`}
          >
            {CLASS_LABELS[cls]} ({count})
          </Link>
        ))}
      </div>

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
          <p className="font-display text-2xl uppercase text-ink">Nothing to review</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            No unresolved pairs{classFilter ? ' in this class' : ''}. Run this again after big imports.
          </p>
        </div>
      )}

      <div className="grid gap-5">
        {pairs.map((p) => {
          const a = byId.get(p.aId)!;
          const b = byId.get(p.bId)!;
          const legitimate = LEGITIMATE_CLASSES.has(p.class);
          return (
            <div key={`${p.aId}|${p.bId}`} className="rounded-card border border-line bg-asphalt-800 p-5">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-card px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                    legitimate ? 'bg-line text-ink' : 'bg-signal text-asphalt'
                  }`}
                >
                  {CLASS_LABELS[p.class]}
                </span>
                <span className="text-xs font-semibold text-muted">match score {p.score}/100</span>
                <span className="text-xs text-muted">why: {p.reasons.join(' · ')}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Card row={a} />
                <Card row={b} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {!legitimate && (
                  <>
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
                  </>
                )}
                <form action={recordPairDecisionAction.bind(null, a.id, b.id, 'co-located')}>
                  <button type="submit" className={smallBtn}>
                    Legitimate co-location
                  </button>
                </form>
                <form action={recordPairDecisionAction.bind(null, a.id, b.id, 'not-duplicates')}>
                  <button type="submit" className={smallBtn}>
                    False positive
                  </button>
                </form>
                <form action={ignoreDuplicateAction.bind(null, a.id, b.id)}>
                  <button type="submit" className={smallBtn}>
                    Ignore (no reason)
                  </button>
                </form>
                {!legitimate && (
                  <form action={deleteDuplicateAction.bind(null, b.id)}>
                    <ConfirmSubmit
                      message={`Delete "${b.name}"? It disappears from the admin list and the public directory. (Soft delete — the row is kept.)`}
                      className="rounded-card border border-diesel px-2.5 py-1 text-xs font-semibold text-diesel transition-colors hover:bg-diesel hover:text-ink"
                    >
                      Delete “{b.name.slice(0, 24)}”
                    </ConfirmSubmit>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
