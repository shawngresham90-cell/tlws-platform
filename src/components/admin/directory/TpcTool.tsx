'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import {
  previewTpcAction,
  applyTpcAction,
  type TpcPreviewState,
  type TpcApplyState,
} from '@/app/admin/(dashboard)/directory/tpc/actions';

/**
 * TPC correction-CSV tool (Milestone 21). Upload → server-validated preview
 * (live vs proposed URL, per-row problems) → explicit row selection →
 * confirmation screen → server apply. The raw CSV rides along in a hidden
 * field so the apply step re-validates the same input; nothing about
 * applicability is decided in the browser.
 */

const smallBtn =
  'rounded-card border border-line px-3 py-1.5 text-xs font-semibold text-ink transition-colors ' +
  'hover:border-signal hover:text-signal disabled:opacity-50';
const primaryBtn =
  'rounded-card bg-signal px-5 py-2.5 font-display text-base uppercase tracking-wide ' +
  'text-asphalt transition-colors hover:bg-signal-600 disabled:opacity-60';

function PendingButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={primaryBtn}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function TpcTool() {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overwriteOk, setOverwriteOk] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const previewInitial: TpcPreviewState = { error: null, fileErrors: [], rows: null };
  const [preview, previewAction] = useFormState(previewTpcAction, previewInitial);
  const applyInitial: TpcApplyState = {
    error: null,
    applied: 0,
    skipped: 0,
    failures: [],
    done: false,
  };
  const [applyState, applyAction] = useFormState(applyTpcAction, applyInitial);

  const rows = preview.rows;

  // Default selection: applicable rows that do NOT replace an existing URL.
  useEffect(() => {
    if (!rows) return;
    setSelected(
      new Set(rows.filter((r) => r.applicable && !r.wouldOverwrite).map((r) => r.listing_id)),
    );
    setOverwriteOk(new Set());
    setConfirming(false);
  }, [rows]);

  const applicable = rows?.filter((r) => r.applicable) ?? [];
  const selectedRows = applicable.filter((r) => selected.has(r.listing_id));
  const unconfirmedOverwrites = selectedRows.filter(
    (r) => r.wouldOverwrite && !overwriteOk.has(r.listing_id),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onFileChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCsvText(await file.text());
  }

  if (applyState.done) {
    return (
      <div className="max-w-2xl rounded-card border border-line bg-asphalt-800 p-6">
        <h3 className="font-display text-xl uppercase text-signal">Apply summary</h3>
        <dl className="mt-4 grid grid-cols-3 gap-3">
          {(
            [
              ['Applied', applyState.applied],
              ['Skipped', applyState.skipped],
              ['Failed', applyState.failures.length],
            ] as const
          ).map(([label, n]) => (
            <div key={label} className="rounded-card border border-line bg-asphalt p-3 text-center">
              <dt className="text-xs font-semibold uppercase text-muted">{label}</dt>
              <dd className="mt-1 font-display text-2xl text-ink">{n}</dd>
            </div>
          ))}
        </dl>
        {applyState.failures.length > 0 && (
          <ul className="mt-4 grid gap-1 text-sm text-diesel-300">
            {applyState.failures.map((f) => (
              <li key={f.id}>
                {f.name}: {f.error}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-muted">Reload the page to run another batch.</p>
      </div>
    );
  }

  return (
    <div>
      <form action={previewAction} className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFileChange}
          className="text-sm text-muted file:mr-3 file:rounded-card file:border file:border-line file:bg-asphalt-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink"
          aria-label="TPC correction CSV file"
        />
        <input type="hidden" name="csv_text" value={csvText} />
        <PendingButton label="Preview batch" pendingLabel="Validating…" />
        {fileName && <span className="text-xs text-muted">{fileName}</span>}
      </form>

      {preview.error && (
        <p className="mt-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300">
          {preview.error}
        </p>
      )}
      {preview.fileErrors.length > 0 && (
        <details className="mt-3 text-sm text-muted">
          <summary className="cursor-pointer font-semibold text-diesel-300">
            {preview.fileErrors.length} row error{preview.fileErrors.length === 1 ? '' : 's'} in the
            file
          </summary>
          <ul className="mt-2 grid gap-1">
            {preview.fileErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
      )}

      {rows && (
        <>
          <p className="mt-5 text-sm text-muted">
            {rows.length} row{rows.length === 1 ? '' : 's'} · {applicable.length} applicable ·{' '}
            {selectedRows.length} selected
          </p>
          <div className="mt-3 overflow-x-auto rounded-card border border-line">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-asphalt-800 text-left text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Apply</th>
                  <th className="px-3 py-2 font-semibold">Listing</th>
                  <th className="px-3 py-2 font-semibold">Action</th>
                  <th className="px-3 py-2 font-semibold">Current URL</th>
                  <th className="px-3 py-2 font-semibold">Proposed URL</th>
                  <th className="px-3 py-2 font-semibold">Problems</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr
                    key={`${r.listing_id}-${r.action}-${r.proposed_tpc_url}`}
                    className={r.applicable ? '' : 'opacity-60'}
                  >
                    <td className="px-3 py-2">
                      {r.applicable ? (
                        <input
                          type="checkbox"
                          checked={selected.has(r.listing_id)}
                          onChange={() => toggle(r.listing_id)}
                          aria-label={`Apply ${r.business_name}`}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-semibold text-ink">{r.business_name}</span>
                      <span className="block text-xs text-muted">
                        {r.city}, {r.state}
                        {r.live ? ` · live: ${r.live.name}` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted">{r.action}</td>
                    <td className="max-w-[220px] break-all px-3 py-2 text-xs text-muted">
                      {r.live?.tpcUrl ?? '—'}
                    </td>
                    <td className="max-w-[220px] break-all px-3 py-2 text-xs text-ink">
                      {r.nextValue ?? (r.action === 'clear' ? '(cleared)' : '—')}
                      {r.wouldOverwrite && (
                        <label className="mt-1 block text-diesel-300">
                          <input
                            type="checkbox"
                            checked={overwriteOk.has(r.listing_id)}
                            onChange={() =>
                              setOverwriteOk((prev) => {
                                const next = new Set(prev);
                                if (next.has(r.listing_id)) next.delete(r.listing_id);
                                else next.add(r.listing_id);
                                return next;
                              })
                            }
                            className="mr-1"
                          />
                          Replace existing URL
                        </label>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-diesel-300">
                      {r.problemDetails.join('; ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!confirming ? (
            <button
              type="button"
              disabled={selectedRows.length === 0 || unconfirmedOverwrites.length > 0}
              onClick={() => setConfirming(true)}
              className={`${primaryBtn} mt-4`}
            >
              Continue to confirmation…
            </button>
          ) : (
            <form
              action={applyAction}
              className="mt-4 max-w-2xl rounded-card border border-signal bg-asphalt-800 p-5"
            >
              <h3 className="font-display text-lg uppercase text-ink">Confirm TPC update</h3>
              <p className="mt-2 text-sm text-muted">
                {selectedRows.length} listing{selectedRows.length === 1 ? '' : 's'} will be updated
                (only the Truck Parking Club URL changes; a history record is written first).{' '}
                {selectedRows.filter((r) => r.wouldOverwrite).length} replace an existing URL.
              </p>
              <input type="hidden" name="csv_text" value={csvText} />
              <input
                type="hidden"
                name="selected"
                value={JSON.stringify(selectedRows.map((r) => r.listing_id))}
              />
              <input
                type="hidden"
                name="overwrite_confirmed"
                value={JSON.stringify([...overwriteOk])}
              />
              <div className="mt-4 flex gap-3">
                <PendingButton label="Apply selected rows" pendingLabel="Applying…" />
                <button type="button" onClick={() => setConfirming(false)} className={smallBtn}>
                  Back
                </button>
              </div>
              {applyState.error && (
                <p className="mt-3 text-sm font-medium text-diesel-300">{applyState.error}</p>
              )}
            </form>
          )}
          {unconfirmedOverwrites.length > 0 && !confirming && (
            <p className="mt-2 text-xs text-diesel-300">
              {unconfirmedOverwrites.length} selected row
              {unconfirmedOverwrites.length === 1 ? '' : 's'} would replace an existing URL — tick
              “Replace existing URL” on each first.
            </p>
          )}
        </>
      )}
    </div>
  );
}
