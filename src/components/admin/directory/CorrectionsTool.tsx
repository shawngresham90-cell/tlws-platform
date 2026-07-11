'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import {
  previewCorrectionsAction,
  applyCorrectionsAction,
  type CorrectionsPreviewState,
  type CorrectionsApplyState,
} from '@/app/admin/(dashboard)/directory/corrections/actions';
import { correctionFailuresCsv } from '@/lib/directory/corrections';

/**
 * Bulk-corrections tool (Milestone 21). Upload → dry-run preview showing the
 * exact per-field before/after diff → row selection (blanking rows need an
 * extra tick) → confirmation → apply. The raw CSV rides in a hidden field so
 * the apply step re-validates the same input server-side.
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

const show = (v: unknown): string => {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return v.length === 0 ? '—' : v.join(' | ');
  return String(v);
};

export function CorrectionsTool() {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [blankingOk, setBlankingOk] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  const previewInitial: CorrectionsPreviewState = { error: null, fileErrors: [], rows: null };
  const [preview, previewAction] = useFormState(previewCorrectionsAction, previewInitial);
  const applyInitial: CorrectionsApplyState = {
    error: null,
    applied: 0,
    skipped: 0,
    failures: [],
    done: false,
  };
  const [applyState, applyAction] = useFormState(applyCorrectionsAction, applyInitial);

  const rows = preview.rows;

  // Default selection: applicable rows WITHOUT destructive blanking.
  useEffect(() => {
    if (!rows) return;
    setSelected(new Set(rows.filter((r) => r.applicable && !r.hasBlanking).map((r) => r.listingId)));
    setBlankingOk(new Set());
    setConfirming(false);
  }, [rows]);

  const applicable = rows?.filter((r) => r.applicable) ?? [];
  const selectedRows = applicable.filter((r) => selected.has(r.listingId));
  const unconfirmedBlanking = selectedRows.filter((r) => r.hasBlanking && !blankingOk.has(r.listingId));

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

  function downloadFailures() {
    const csv = correctionFailuresCsv(applyState.failures);
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'correction-failures.csv';
    a.click();
    URL.revokeObjectURL(a.href);
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
          <>
            <ul className="mt-4 grid gap-1 text-sm text-diesel">
              {applyState.failures.slice(0, 20).map((f) => (
                <li key={f.id}>
                  {f.name}: {f.error}
                </li>
              ))}
            </ul>
            <button type="button" onClick={downloadFailures} className={`${smallBtn} mt-3`}>
              Download failure report CSV
            </button>
          </>
        )}
        <p className="mt-4 text-sm text-muted">Reload the page to run another batch.</p>
      </div>
    );
  }

  return (
    <div>
      <form action={previewAction} className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={onFileChange}
          className="text-sm text-muted file:mr-3 file:rounded-card file:border file:border-line file:bg-asphalt-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink"
          aria-label="Corrections CSV file"
        />
        <input type="hidden" name="csv_text" value={csvText} />
        <PendingButton label="Dry-run preview" pendingLabel="Validating…" />
        {fileName && <span className="text-xs text-muted">{fileName}</span>}
      </form>

      {preview.error && (
        <p className="mt-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel">
          {preview.error}
        </p>
      )}
      {preview.fileErrors.length > 0 && (
        <ul className="mt-3 grid gap-1 text-sm text-diesel">
          {preview.fileErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {rows && (
        <>
          <p className="mt-5 text-sm text-muted">
            {rows.length} row{rows.length === 1 ? '' : 's'} · {applicable.length} applicable ·{' '}
            {selectedRows.length} selected ·{' '}
            {applicable.filter((r) => r.hasBlanking).length} with destructive blanking
          </p>
          <div className="mt-3 grid gap-3">
            {rows.map((r) => (
              <div
                key={r.listingId + r.matchName}
                className={`rounded-card border p-4 ${r.applicable ? 'border-line bg-asphalt-800' : 'border-line bg-asphalt-800 opacity-60'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    {r.applicable && (
                      <input
                        type="checkbox"
                        checked={selected.has(r.listingId)}
                        onChange={() => toggle(r.listingId)}
                        className="mr-2"
                        aria-label={`Apply ${r.liveName ?? r.matchName}`}
                      />
                    )}
                    <span className="font-semibold text-ink">{r.liveName ?? r.matchName}</span>{' '}
                    <span className="text-xs text-muted">
                      {r.city}, {r.state}
                    </span>
                  </div>
                  {r.hasBlanking && r.applicable && (
                    <label className="text-xs font-semibold text-diesel">
                      <input
                        type="checkbox"
                        checked={blankingOk.has(r.listingId)}
                        onChange={() =>
                          setBlankingOk((prev) => {
                            const next = new Set(prev);
                            if (next.has(r.listingId)) next.delete(r.listingId);
                            else next.add(r.listingId);
                            return next;
                          })
                        }
                        className="mr-1"
                      />
                      Confirm blanking existing data
                    </label>
                  )}
                </div>
                {r.problemDetails.length > 0 && (
                  <p className="mt-2 text-xs text-diesel">{r.problemDetails.join('; ')}</p>
                )}
                {r.changes.length > 0 && (
                  <table className="mt-3 w-full text-xs">
                    <thead className="text-left text-muted">
                      <tr>
                        <th className="py-1 pr-3 font-semibold">Field</th>
                        <th className="py-1 pr-3 font-semibold">Current</th>
                        <th className="py-1 font-semibold">Proposed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {r.changes.map((c) => (
                        <tr key={c.column}>
                          <td className="py-1 pr-3 font-semibold text-ink">{c.label}</td>
                          <td className="max-w-[260px] break-words py-1 pr-3 text-muted">{show(c.from)}</td>
                          <td className={`max-w-[260px] break-words py-1 ${c.blanking ? 'font-semibold text-diesel' : 'text-ink'}`}>
                            {c.blanking ? '(cleared)' : show(c.to)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>

          {!confirming ? (
            <button
              type="button"
              disabled={selectedRows.length === 0 || unconfirmedBlanking.length > 0}
              onClick={() => setConfirming(true)}
              className={`${primaryBtn} mt-4`}
            >
              Continue to confirmation…
            </button>
          ) : (
            <form action={applyAction} className="mt-4 max-w-2xl rounded-card border border-signal bg-asphalt-800 p-5">
              <h3 className="font-display text-lg uppercase text-ink">Confirm corrections</h3>
              <p className="mt-2 text-sm text-muted">
                {selectedRows.length} listing{selectedRows.length === 1 ? '' : 's'} will be
                updated. Only the changed fields shown above are written; a history record is
                written first for every row.{' '}
                {selectedRows.filter((r) => r.hasBlanking).length} row
                {selectedRows.filter((r) => r.hasBlanking).length === 1 ? '' : 's'} blank existing data.
              </p>
              <input type="hidden" name="csv_text" value={csvText} />
              <input type="hidden" name="selected" value={JSON.stringify(selectedRows.map((r) => r.listingId))} />
              <input type="hidden" name="blanking_confirmed" value={JSON.stringify([...blankingOk])} />
              <div className="mt-4 flex gap-3">
                <PendingButton label="Apply selected corrections" pendingLabel="Applying…" />
                <button type="button" onClick={() => setConfirming(false)} className={smallBtn}>
                  Back
                </button>
              </div>
              {applyState.error && <p className="mt-3 text-sm font-medium text-diesel">{applyState.error}</p>}
            </form>
          )}
          {unconfirmedBlanking.length > 0 && !confirming && (
            <p className="mt-2 text-xs text-diesel">
              {unconfirmedBlanking.length} selected row{unconfirmedBlanking.length === 1 ? '' : 's'} blank
              existing data — confirm each first.
            </p>
          )}
        </>
      )}
    </div>
  );
}
