import { requireAdmin } from '@/lib/admin/auth';
import { getModerationState } from '@/lib/admin/preschool';
import { FOUNDING_STUDENT_CAPACITY } from '@/lib/preschool/constants';
import { ConfirmSubmit } from '@/components/admin/directory/ConfirmSubmit';
import {
  approveClaimAction,
  rejectClaimAction,
  setPublishedAction,
  updateStudentAction,
  verifyPurchaseAction,
} from './actions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Admin — CDL Pre-School Founding Students',
  robots: { index: false, follow: false },
};

const OK_MESSAGES: Record<string, string> = {
  verified: 'Purchase marked verified.',
  approved: 'Claim approved and published to the wall.',
  rejected: 'Claim rejected.',
  published: 'Wall entry published.',
  unpublished: 'Wall entry hidden.',
  saved: 'Wall entry saved.',
};

const btn =
  'rounded-card border border-line px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-signal hover:text-signal';

export default async function PreschoolAdminPage({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string };
}) {
  requireAdmin();
  const { claims, students, tablesMissing } = await getModerationState();

  const pending = claims.filter((c) => c.status === 'pending');
  const decided = claims.filter((c) => c.status !== 'pending');

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-2xl uppercase text-ink">
          CDL Pre-School — Founding Students
        </h1>
        <p className="mt-1 text-sm text-muted">
          {students.length} of {FOUNDING_STUDENT_CAPACITY} spots approved ·{' '}
          {students.filter((s) => s.is_published).length} published · {pending.length} claim
          {pending.length === 1 ? '' : 's'} pending. Verify each purchase against Stan Store records
          by hand before approving — approval assigns the next open spot and publishes.
        </p>
      </header>

      {searchParams.ok && (
        <p className="rounded-card border border-signal/50 bg-signal/10 px-4 py-3 text-sm font-medium text-signal">
          {OK_MESSAGES[searchParams.ok] ?? 'Done.'}
        </p>
      )}
      {searchParams.error && (
        <p className="rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300">
          {searchParams.error}
        </p>
      )}
      {tablesMissing && (
        <p className="rounded-card border border-line bg-asphalt-800 px-4 py-3 text-sm text-muted">
          Migration <code>028_cdl_preschool.sql</code> has not been applied yet — the Founding
          Student tables don&apos;t exist. This dashboard activates once the migration is applied.
        </p>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg uppercase text-ink">Pending claims</h2>
        {pending.length === 0 ? (
          <p className="rounded-card border border-line bg-asphalt-800 p-6 text-sm text-muted">
            No pending claims.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-asphalt-800 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">Received</th>
                  <th className="px-3 py-2">Checkout email (private)</th>
                  <th className="px-3 py-2">Public display</th>
                  <th className="px-3 py-2">Purchase</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((c) => (
                  <tr key={c.id} className="border-t border-line align-top">
                    <td className="px-3 py-3 text-muted">
                      {new Date(c.created_at).toLocaleDateString('en-US')}
                    </td>
                    <td className="px-3 py-3 text-ink">{c.purchaser_email}</td>
                    <td className="px-3 py-3">
                      <p className="text-ink">
                        {c.is_anonymous ? 'Anonymous Founding Student' : c.display_name}
                        {c.is_anonymous && (
                          <span className="ml-2 text-xs text-muted">({c.display_name})</span>
                        )}
                      </p>
                      {c.business_name && <p className="text-xs text-muted">{c.business_name}</p>}
                      {c.website_url && <p className="text-xs text-muted">{c.website_url}</p>}
                      {!c.consent_public_display && (
                        <p className="text-xs font-semibold text-diesel-300">No display consent!</p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {c.verified_purchase ? (
                        <span className="text-signal">Verified</span>
                      ) : (
                        <span className="text-muted">Unverified</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        {!c.verified_purchase && (
                          <form action={verifyPurchaseAction.bind(null, c.id)}>
                            <ConfirmSubmit
                              className={btn}
                              message="Confirm you checked this email against the Stan Store order list and found a completed CDL Pre-School purchase?"
                            >
                              Mark verified
                            </ConfirmSubmit>
                          </form>
                        )}
                        <form action={approveClaimAction.bind(null, c.id)}>
                          <ConfirmSubmit
                            className={btn}
                            message="Approve this claim? It takes the next open founding spot and publishes to the wall."
                          >
                            Approve + publish
                          </ConfirmSubmit>
                        </form>
                        <form action={rejectClaimAction.bind(null, c.id)}>
                          <ConfirmSubmit className={btn} message="Reject this claim?">
                            Reject
                          </ConfirmSubmit>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg uppercase text-ink">
          Wall entries ({students.length}/{FOUNDING_STUDENT_CAPACITY})
        </h2>
        {students.length === 0 ? (
          <p className="rounded-card border border-line bg-asphalt-800 p-6 text-sm text-muted">
            No approved Founding Students yet. The public wall shows its clean empty state.
          </p>
        ) : (
          <div className="space-y-4">
            {students.map((s) => (
              <div key={s.id} className="rounded-card border border-line bg-asphalt-800 p-4">
                <form
                  action={updateStudentAction.bind(null, s.id)}
                  className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
                >
                  <label className="text-xs text-muted lg:col-span-2">
                    Display name
                    <input
                      name="display_name"
                      defaultValue={s.display_name}
                      className="mt-1 w-full rounded-card border border-line bg-asphalt px-3 py-2 text-sm text-ink"
                    />
                  </label>
                  <label className="text-xs text-muted">
                    Spot #
                    <input
                      name="spot_number"
                      type="number"
                      min={1}
                      max={20}
                      defaultValue={s.spot_number ?? ''}
                      className="mt-1 w-full rounded-card border border-line bg-asphalt px-3 py-2 text-sm text-ink"
                    />
                  </label>
                  <label className="text-xs text-muted">
                    Business
                    <input
                      name="business_name"
                      defaultValue={s.business_name ?? ''}
                      className="mt-1 w-full rounded-card border border-line bg-asphalt px-3 py-2 text-sm text-ink"
                    />
                  </label>
                  <label className="text-xs text-muted lg:col-span-2">
                    Website (https://)
                    <input
                      name="website_url"
                      defaultValue={s.website_url ?? ''}
                      className="mt-1 w-full rounded-card border border-line bg-asphalt px-3 py-2 text-sm text-ink"
                    />
                  </label>
                  <div className="flex items-end gap-3 lg:col-span-6">
                    <label className="flex items-center gap-2 text-xs text-muted">
                      <input type="checkbox" name="is_anonymous" defaultChecked={s.is_anonymous} />
                      Anonymous
                    </label>
                    <button type="submit" className={btn}>
                      Save
                    </button>
                    <span className={s.is_published ? 'text-xs text-signal' : 'text-xs text-muted'}>
                      {s.is_published ? 'Published' : 'Hidden'}
                    </span>
                  </div>
                </form>
                <form
                  action={setPublishedAction.bind(null, s.id, !s.is_published)}
                  className="mt-2"
                >
                  <ConfirmSubmit
                    className={btn}
                    message={
                      s.is_published
                        ? 'Hide this Founding Student from the public wall?'
                        : 'Publish this Founding Student to the public wall?'
                    }
                  >
                    {s.is_published ? 'Unpublish' : 'Publish'}
                  </ConfirmSubmit>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg uppercase text-ink">Decided claims</h2>
        {decided.length === 0 ? (
          <p className="text-sm text-muted">None yet.</p>
        ) : (
          <ul className="space-y-1 text-sm text-muted">
            {decided.map((c) => (
              <li key={c.id}>
                <span className={c.status === 'approved' ? 'text-signal' : 'text-diesel-300'}>
                  {c.status}
                </span>{' '}
                — {c.purchaser_email} ({c.is_anonymous ? 'anonymous' : c.display_name})
                {c.reviewed_at ? ` · ${new Date(c.reviewed_at).toLocaleDateString('en-US')}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
