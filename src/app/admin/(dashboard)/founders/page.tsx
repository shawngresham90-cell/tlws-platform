import { requireAdmin } from '@/lib/admin/auth';
import { getFoundersAdminState, FOUNDER_TIER_VALUES } from '@/lib/admin/founders';
import { dollars, pctToGoal, remainingCents, tierRemaining, tierUsage } from '@/lib/community/campaign';
import { TIER_CAPACITY, TIER_LABEL, TIER_ORDER } from '@/components/community/tiers';
import { CampaignThermometer } from '@/components/community/CampaignThermometer';
import { ConfirmSubmit } from '@/components/admin/directory/ConfirmSubmit';
import type { AdminFounderRow } from '@/lib/admin/founders';
import {
  addFounderAction,
  deleteFounderAction,
  setFounderPublishedAction,
  setRaisedOverrideAction,
  updateFounderAction,
  updateGoalAction,
} from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Founders Wall', robots: { index: false, follow: false } };

const OK_MESSAGES: Record<string, string> = {
  added: 'Founder added.',
  saved: 'Founder saved.',
  deleted: 'Founder deleted.',
  published: 'Founder published to the wall.',
  unpublished: 'Founder hidden from the wall.',
  goal: 'Campaign goal updated.',
  raised: 'Raised total updated.',
  'live-sum': 'Raised total now follows the live sum of published founder amounts.',
};

const btn =
  'rounded-card border border-line px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-signal hover:text-signal';
const input =
  'mt-1 w-full rounded-card border border-line bg-asphalt px-3 py-2 text-sm text-ink';

function FounderFields({ f }: { f?: AdminFounderRow }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs text-muted lg:col-span-2">
        Display name
        <input name="display_name" defaultValue={f?.display_name ?? ''} className={input} />
      </label>
      <label className="text-xs text-muted">
        Tier
        <select name="tier" defaultValue={f?.tier ?? 'brick'} className={input}>
          {FOUNDER_TIER_VALUES.map((t) => (
            <option key={t} value={t}>
              {TIER_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-muted">
        Amount donated ($, private)
        <input
          name="amount"
          inputMode="decimal"
          defaultValue={f?.amount_cents != null ? String(Math.round(f.amount_cents / 100)) : ''}
          className={input}
          placeholder="500"
        />
      </label>
      <label className="text-xs text-muted lg:col-span-2">
        Business name
        <input name="business_name" defaultValue={f?.business_name ?? ''} className={input} />
      </label>
      <label className="text-xs text-muted lg:col-span-2">
        Website (https://)
        <input name="business_url" defaultValue={f?.business_url ?? ''} className={input} />
      </label>
      <label className="text-xs text-muted">
        Wall position
        <input name="position" inputMode="numeric" defaultValue={f?.position ?? ''} className={input} />
      </label>
      <label className="text-xs text-muted lg:col-span-3">
        Message
        <input name="message" defaultValue={f?.message ?? ''} className={input} />
      </label>
      <div className="flex items-center gap-6 lg:col-span-4">
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" name="is_anonymous" defaultChecked={f?.display_name === 'Anonymous Founder'} />
          Anonymous (shows “Anonymous Founder”, hides business + site)
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" name="is_public" defaultChecked={f ? f.is_public : true} />
          Published on the wall
        </label>
      </div>
    </div>
  );
}

export default async function AdminFoundersPage({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string };
}) {
  requireAdmin();
  const { founders, settings, progress, error } = await getFoundersAdminState();

  const publicFounders = founders.filter((f) => f.is_public);
  const usage = tierUsage(publicFounders);
  const goal = progress?.goal_cents ?? settings?.goal_cents ?? 0;
  const raised = progress?.raised_cents ?? 0;
  const remaining = remainingCents(goal, raised);
  const pct = pctToGoal(goal, raised);
  const overrideActive = settings?.raised_cents_override != null;
  const liveSum = founders
    .filter((f) => f.is_public)
    .reduce((n, f) => n + (f.amount_cents ?? 0), 0);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-2xl uppercase text-ink">Academy Founders Wall</h1>
        <p className="mt-1 text-sm text-muted">
          {publicFounders.length} spot{publicFounders.length === 1 ? '' : 's'} sold ·{' '}
          {founders.length} total record{founders.length === 1 ? '' : 's'}. Every public number
          comes from the campaign_progress view — publishing, editing, or deleting a founder
          updates the homepage, /founders, and /academy thermometers automatically.
        </p>
      </header>

      {searchParams.ok && (
        <p className="rounded-card border border-signal/50 bg-signal/10 px-4 py-3 text-sm font-medium text-signal">
          {OK_MESSAGES[searchParams.ok] ?? 'Done.'}
        </p>
      )}
      {searchParams.error && (
        <p className="rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel">
          {searchParams.error}
        </p>
      )}
      {error && (
        <p className="rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel">
          Couldn’t load: {error}
        </p>
      )}

      {/* Campaign panel */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="font-display text-lg uppercase text-ink">Campaign</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-card border border-line bg-asphalt-800 p-4">
              <dt className="text-xs uppercase tracking-wide text-muted">Goal</dt>
              <dd className="mt-1 font-display text-2xl text-ink">{dollars(goal)}</dd>
            </div>
            <div className="rounded-card border border-line bg-asphalt-800 p-4">
              <dt className="text-xs uppercase tracking-wide text-muted">Raised</dt>
              <dd className="mt-1 font-display text-2xl text-signal">{dollars(raised)}</dd>
            </div>
            <div className="rounded-card border border-line bg-asphalt-800 p-4">
              <dt className="text-xs uppercase tracking-wide text-muted">Remaining</dt>
              <dd className="mt-1 font-display text-2xl text-ink">{dollars(remaining)}</dd>
            </div>
            <div className="rounded-card border border-line bg-asphalt-800 p-4">
              <dt className="text-xs uppercase tracking-wide text-muted">Funded</dt>
              <dd className="mt-1 font-display text-2xl text-ink">{pct}%</dd>
            </div>
          </dl>

          <div className="rounded-card border border-line bg-asphalt-800 p-4 text-sm text-muted">
            <p className="font-semibold text-ink">Spots by tier (published)</p>
            <ul className="mt-2 space-y-1">
              {TIER_ORDER.map((t) => {
                const cap = TIER_CAPACITY[t];
                const left = tierRemaining(cap, usage[t]);
                return (
                  <li key={t}>
                    {TIER_LABEL[t]}: {usage[t]} sold
                    {cap !== null ? ` · ${left} of ${cap} remaining` : ' · open'}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-card border border-line bg-asphalt-800 p-4 text-sm">
            <p className="font-semibold text-ink">Raised-total source</p>
            <p className="mt-1 text-muted">
              {overrideActive
                ? `Manual aggregate (override): ${dollars(settings?.raised_cents_override ?? 0)}. Per-founder amounts currently sum to ${dollars(liveSum)} — enter every founder's amount, then switch to the live sum.`
                : `Live sum of published founders' amounts: ${dollars(liveSum)}. Adding, editing, unpublishing, or deleting a founder recalculates it automatically.`}
            </p>
            <form action={setRaisedOverrideAction} className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-xs text-muted">
                Set raised override ($)
                <input name="raised" inputMode="decimal" className={input} />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" name="clear_override" />
                Clear override (follow live sum)
              </label>
              <ConfirmSubmit
                className={btn}
                message="Change the PUBLIC raised total's source? This immediately changes what every visitor sees on the thermometer."
              >
                Apply
              </ConfirmSubmit>
            </form>
            <form action={updateGoalAction} className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-xs text-muted">
                Campaign goal ($)
                <input
                  name="goal"
                  inputMode="decimal"
                  defaultValue={goal ? String(Math.round(goal / 100)) : ''}
                  className={input}
                />
              </label>
              <ConfirmSubmit
                className={btn}
                message="Change the PUBLIC campaign goal? The thermometer, remaining amount, and percentage change everywhere immediately."
              >
                Update goal
              </ConfirmSubmit>
            </form>
          </div>
        </div>

        <div>
          <h2 className="mb-4 font-display text-lg uppercase text-ink">Public thermometer preview</h2>
          <CampaignThermometer
            progress={{
              raised_cents: raised,
              goal_cents: goal,
              remaining_cents: remaining,
              pct_to_goal: pct,
              founder_count: publicFounders.length,
            }}
          />
          <p className="mt-2 text-xs text-muted">
            Rendered by the exact component the homepage, /founders, and /academy use.
          </p>
        </div>
      </section>

      {/* Add founder */}
      <details className="rounded-card border border-line bg-asphalt-800">
        <summary className="cursor-pointer list-none px-5 py-4 font-display text-lg uppercase text-ink hover:text-signal [&::-webkit-details-marker]:hidden">
          + Add founder
        </summary>
        <form action={addFounderAction} className="border-t border-line p-5">
          <FounderFields />
          <ConfirmSubmit
            className={`${btn} mt-4`}
            message="Add this founder? If Published is checked they appear on the public wall immediately."
          >
            Add founder
          </ConfirmSubmit>
        </form>
      </details>

      {/* Founder list */}
      <section className="space-y-4">
        <h2 className="font-display text-lg uppercase text-ink">
          Founders ({founders.length})
        </h2>
        {founders.map((f) => (
          <div key={f.id} className="rounded-card border border-line bg-asphalt-800 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-display uppercase text-ink">{f.display_name}</span>
              <span className="text-muted">{TIER_LABEL[f.tier]}</span>
              <span className={f.is_public ? 'text-signal' : 'text-muted'}>
                {f.is_public ? 'Published' : 'Hidden'}
              </span>
              <span className="text-xs text-muted">status: {f.status}</span>
            </div>
            <form action={updateFounderAction.bind(null, f.id)}>
              <FounderFields f={f} />
              <div className="mt-4 flex flex-wrap gap-2">
                <ConfirmSubmit className={btn} message="Save changes to this founder? Public numbers update immediately.">
                  Save
                </ConfirmSubmit>
              </div>
            </form>
            <div className="mt-2 flex flex-wrap gap-2">
              <form action={setFounderPublishedAction.bind(null, f.id, !f.is_public)}>
                <ConfirmSubmit
                  className={btn}
                  message={
                    f.is_public
                      ? 'Hide this founder from the public wall? Totals recalculate automatically.'
                      : 'Publish this founder to the public wall? Totals recalculate automatically.'
                  }
                >
                  {f.is_public ? 'Unpublish' : 'Publish'}
                </ConfirmSubmit>
              </form>
              <form action={deleteFounderAction.bind(null, f.id)}>
                <ConfirmSubmit
                  className={`${btn} border-diesel text-diesel hover:border-diesel hover:text-diesel`}
                  message="PERMANENTLY delete this founder record? This cannot be undone. Consider Unpublish instead."
                >
                  Delete
                </ConfirmSubmit>
              </form>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
