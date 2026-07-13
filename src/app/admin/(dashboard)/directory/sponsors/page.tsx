import { createAdminClient } from '@/lib/supabase/admin';
import { SPONSOR_PLACEMENTS } from '@/lib/directory/sponsors';
import { createSponsorAction, setSponsorActiveAction, deleteSponsorAction } from './actions';

/**
 * Admin sponsor manager (Milestone 25). Create, activate/deactivate, and delete
 * sponsor placements. Reads via the service role and fails soft: if migration
 * 024 is unapplied it shows a clear "not enabled" notice and the form still
 * validates. URL safety is enforced server-side in the actions.
 */

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  name: string;
  tagline: string | null;
  url: string;
  placements: string[] | null;
  states: string[] | null;
  interstates: string[] | null;
  categories: string[] | null;
  active: boolean;
};

async function load(): Promise<{ enabled: boolean; rows: Row[] }> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('directory_sponsors')
      .select('id, name, tagline, url, placements, states, interstates, categories, active')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return { enabled: false, rows: [] };
    return { enabled: true, rows: (data ?? []) as Row[] };
  } catch {
    return { enabled: false, rows: [] };
  }
}

const input = 'w-full rounded-card border border-line bg-asphalt px-3 py-2 text-sm text-ink';

export default async function SponsorsAdminPage() {
  const { enabled, rows } = await load();

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl uppercase text-ink">Sponsors</h1>
      <p className="mt-2 text-sm text-muted">
        Admin-configurable sponsor placements. Blocks are clearly labeled “Sponsored”, use
        <code className="mx-1">rel=&quot;sponsored noopener noreferrer&quot;</code>, and only render where
        a matching active sponsor exists. Leave a targeting field blank to match everywhere.
      </p>

      {!enabled && (
        <div className="mt-4 rounded-card border border-dashed border-line bg-asphalt-800 p-4 text-sm text-muted">
          <span className="font-semibold text-ink">Not enabled yet.</span> Migration{' '}
          <code>024_directory_sponsors.sql</code> is committed but not applied — saving is a no-op
          until it is applied. The public sponsor slots show nothing in the meantime.
        </div>
      )}

      <form action={createSponsorAction} className="mt-6 space-y-3 rounded-card border border-line bg-asphalt-800 p-5">
        <h2 className="font-display text-lg uppercase text-ink">Add a sponsor</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-muted">Name *<input name="name" required className={input} /></label>
          <label className="text-sm text-muted">Logo (emoji)<input name="logo" maxLength={4} className={input} /></label>
        </div>
        <label className="block text-sm text-muted">Tagline<input name="tagline" className={input} /></label>
        <label className="block text-sm text-muted">
          URL * (https://…)<input name="url" type="url" required className={input} />
        </label>
        <fieldset className="text-sm text-muted">
          <legend className="mb-1">Placements</legend>
          <div className="flex flex-wrap gap-3">
            {SPONSOR_PLACEMENTS.map((p) => (
              <label key={p.value} className="flex items-center gap-1.5 text-ink">
                <input type="checkbox" name={`placement:${p.value}`} /> {p.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-muted">States (e.g. GA, TN)<input name="states" className={input} /></label>
          <label className="text-sm text-muted">Interstates (e.g. I-75)<input name="interstates" className={input} /></label>
          <label className="text-sm text-muted">Categories<input name="categories" className={input} /></label>
        </div>
        <button
          type="submit"
          className="rounded-card bg-signal px-4 py-2 font-display text-sm uppercase tracking-wide text-asphalt hover:bg-signal-600"
        >
          Add sponsor
        </button>
      </form>

      <h2 className="mt-10 font-display text-lg uppercase text-ink">Current sponsors ({rows.length})</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">None yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((s) => (
            <li key={s.id} className="rounded-card border border-line bg-asphalt-800 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-base uppercase text-ink">
                    {s.name} {!s.active && <span className="text-xs text-muted">(inactive)</span>}
                  </p>
                  {s.tagline && <p className="text-sm text-muted">{s.tagline}</p>}
                  <p className="mt-1 break-all text-xs text-muted">{s.url}</p>
                  <p className="mt-1 text-xs text-muted">
                    Placements: {(s.placements ?? []).join(', ') || '—'} · States:{' '}
                    {(s.states ?? []).join(', ') || 'all'} · Interstates:{' '}
                    {(s.interstates ?? []).join(', ') || 'all'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <form action={setSponsorActiveAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="active" value={String(!s.active)} />
                    <button className="rounded-card border border-line px-3 py-1 text-xs text-ink hover:border-signal">
                      {s.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </form>
                  <form action={deleteSponsorAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="rounded-card border border-red-500/50 px-3 py-1 text-xs text-red-400 hover:border-red-500">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
