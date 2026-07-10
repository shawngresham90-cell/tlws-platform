'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { importCsvAction, type ImportState } from '@/app/admin/(dashboard)/directory/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-card bg-signal px-6 py-3 font-display text-lg uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600 disabled:opacity-60"
    >
      {pending ? 'Importing…' : 'Import CSV'}
    </button>
  );
}

/** Upload form + post-import summary. All parsing/validation runs server-side. */
export function ImportForm() {
  const initial: ImportState = { error: null, summary: null };
  const [state, formAction] = useFormState(importCsvAction, initial);
  const s = state.summary;

  return (
    <div className="grid max-w-2xl gap-6">
      <form action={formAction} className="rounded-card border border-line bg-asphalt-800 p-6">
        <label htmlFor="import-file" className="mb-1.5 block text-sm font-semibold text-ink">
          CSV file
        </label>
        <input
          id="import-file"
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="block w-full rounded-card border border-line bg-asphalt px-3 py-2.5 text-sm text-ink file:mr-3 file:rounded-card file:border-0 file:bg-signal file:px-3 file:py-1.5 file:font-semibold file:text-asphalt"
        />
        <p className="mt-2 text-xs text-muted">
          Max 4 MB / 10,000 rows per import. Every row is validated; invalid rows are skipped and
          reported. Duplicates (same name + city + state as an existing or earlier row) are not
          imported.
        </p>
        <div className="mt-5">
          <SubmitButton />
        </div>
      </form>

      {state.error && (
        <p
          role="alert"
          className="rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel"
        >
          {state.error}
        </p>
      )}

      {s && (
        <div className="rounded-card border border-line bg-asphalt-800 p-6">
          <h2 className="font-display text-xl uppercase text-signal">Import summary</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ['Imported', s.imported],
                ['Skipped', s.skipped],
                ['Duplicates', s.duplicates],
                ['Errors', s.errors.length],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="rounded-card border border-line p-3 text-center">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {label}
                </dt>
                <dd className="mt-1 font-display text-3xl text-ink">{n}</dd>
              </div>
            ))}
          </dl>
          {s.errors.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-ink">Row problems (first 50)</h3>
              <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-sm text-muted">
                {s.errors.map((e, i) => (
                  <li key={i}>
                    <span className="font-semibold text-diesel">Row {e.row}:</span> {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
