import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { getAdminTests } from '@/lib/admin/tests';

/**
 * Admin Tests overview (Milestone 7). Every catalog test with its live DB
 * state: published switch, seeded question count, threshold, timed limit.
 * Config comes from the TS catalog (read-only here); content and visibility
 * live in the DB and are managed from the per-test bank page.
 */
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Tests', robots: { index: false, follow: false } };

export default async function AdminTestsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  requireAdmin();

  const { rows, error } = await getAdminTests();
  const actionError =
    searchParams.error === 'unknown'
      ? 'That test is not in the catalog — nothing was changed.'
      : null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display-section">Practice Tests</h1>
        <p className="text-sm text-muted">
          Question edits and publish switches — test config lives in the code catalog.
        </p>
      </div>

      {(error || actionError) && (
        <p className="mb-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel">
          {actionError ?? `Couldn't load the test banks: ${error}`}
        </p>
      )}

      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-asphalt-800 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Test</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Published</th>
              <th className="px-4 py-3">Questions</th>
              <th className="px-4 py-3">Pass</th>
              <th className="px-4 py-3">Timed limit</th>
              <th className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ def, dbId, dbPublished, seededCount }) => (
              <tr key={def.slug} className="border-t border-line">
                <td className="px-4 py-3 font-semibold text-ink">{def.title}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{def.slug}</td>
                <td className="px-4 py-3">
                  {dbId === null ? (
                    <span className="text-muted">no DB row</span>
                  ) : dbPublished ? (
                    <span className="font-semibold text-signal">Published</span>
                  ) : (
                    <span className="text-muted">Unpublished</span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink">{seededCount}</td>
                <td className="px-4 py-3 text-ink">{def.passThresholdPct}%</td>
                <td className="px-4 py-3 text-ink">
                  {def.timeLimitSeconds ? `${Math.round(def.timeLimitSeconds / 60)} min` : '—'}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/tests/${def.slug}`}
                    className="font-semibold text-signal underline-offset-4 hover:underline"
                  >
                    Open bank →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted">
        Question creation and deletion stay in migrations (edit-only module) — question UUIDs are
        preserved so attempt history, miss counts, and students&apos; saved work survive every edit.
      </p>
    </div>
  );
}
