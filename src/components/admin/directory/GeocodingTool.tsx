'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import {
  previewGeocodingAction,
  applyGeocodingAction,
  type GeocodingPreviewState,
  type GeocodingApplyState,
} from '@/app/admin/(dashboard)/directory/geocoding/actions';
import { rejectedRowsCsv, type ValidatedRow } from '@/lib/directory/geocoding';

/**
 * Admin geocoding apply tool (Milestone 17). Flow: upload CSV → server
 * preview (validation against live listings) → select high-confidence ready
 * rows → confirmation screen → server apply. The raw CSV text rides along in
 * a hidden field so the apply step re-validates the same input server-side;
 * nothing about applicability is decided in the browser.
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

const fmtCoord = (v: number | null | undefined) => (v == null ? '—' : v.toFixed(6));

const CONFIDENCE_FILTERS = ['all', 'high', 'medium', 'low', 'unresolved'] as const;

export function GeocodingTool() {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overwriteOk, setOverwriteOk] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const previewInitial: GeocodingPreviewState = { error: null, fileErrors: [], rows: null };
  const [preview, previewAction] = useFormState(previewGeocodingAction, previewInitial);
  const applyInitial: GeocodingApplyState = {
    error: null,
    applied: 0,
    skipped: 0,
    failures: [],
    done: false,
  };
  const [applyState, applyAction] = useFormState(applyGeocodingAction, applyInitial);

  const rows = preview.rows;

  // Default selection: every applicable row that does NOT overwrite.
  useEffect(() => {
    if (!rows) return;
    setSelected(new Set(rows.filter((r) => r.applicable && !r.wouldOverwrite).map((r) => r.listing_id)));
    setOverwriteOk(new Set());
    setConfirming(false);
  }, [rows]);

  const visible = useMemo(() => {
    if (!rows) return [];
    if (confidenceFilter === 'all') return rows;
    return rows.filter((r) => r.confidence === confidenceFilter);
  }, [rows, confidenceFilter]);

  const applicable = rows?.filter((r) => r.applicable) ?? [];
  const selectedRows = applicable.filter((r) => selected.has(r.listing_id));
  const selectedOverwrites = selectedRows.filter((r) => r.wouldOverwrite);
  const unconfirmedOverwrites = selectedOverwrites.filter((r) => !overwriteOk.has(r.listing_id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function downloadRejected() {
    if (!rows) return;
    const csv = rejectedRowsCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'geocoding-manual-review.csv';
    a.click();
    URL.revokeObjectURL(a.href);
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
        <h2 className="font-display text-xl uppercase text-signal">Apply summary</h2>
        <dl className="mt-4 grid grid-cols-3 gap-3">
          {(
            [
              ['Applied', applyState.applied],
              ['Skipped', applyState.skipped],
              ['Failed', applyState.failures.length],
            ] as const
          ).map(([label, n]) => (
            <div key={label} className="rounded-card border border-line p-3 text-center">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
              <dd className="mt-1 font-display text-3xl text-ink">{n}</dd>
            </div>
          ))}
        </dl>
        {applyState.failures.length > 0 && (
          <ul className="mt-4 max-h-64 space-y-1 overflow-y-auto text-sm text-muted">
            {applyState.failures.map((f) => (
              <li key={f.id}>
                <span className="font-semibold text-diesel">{f.name}:</span> {f.error}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-muted">
          Every applied row wrote a location_history record before its coordinates changed.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Step 1: choose file + preview */}
      <form action={previewAction} className="max-w-2xl rounded-card border border-line bg-asphalt-800 p-6">
        <label htmlFor="geocoding-file" className="mb-1.5 block text-sm font-semibold text-ink">
          Geocoding batch CSV
        </label>
        <input
          id="geocoding-file"
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFileChange}
          className="block w-full rounded-card border border-line bg-asphalt px-3 py-2.5 text-sm text-ink file:mr-3 file:rounded-card file:border-0 file:bg-signal file:px-3 file:py-1.5 file:font-semibold file:text-asphalt"
        />
        <input type="hidden" name="csv_text" value={csvText} />
        <p className="mt-2 text-xs text-muted">
          Expected: data/geocoding/i75-ga-tn-geocoding-batch-001.csv format. Nothing is written at
          preview. Only rows with action=ready AND confidence=high can be applied; every other row
          stays untouched and is downloadable for manual review.
        </p>
        <div className="mt-5">
          <PendingButton label={fileName ? `Preview ${fileName}` : 'Preview'} pendingLabel="Validating…" />
        </div>
      </form>

      {preview.error && (
        <p role="alert" className="max-w-2xl rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel">
          {preview.error}
        </p>
      )}
      {preview.fileErrors.length > 0 && (
        <div className="max-w-2xl rounded-card border border-diesel/60 bg-diesel/5 px-4 py-3 text-sm text-muted">
          <p className="font-semibold text-diesel">Row-level file problems ({preview.fileErrors.length}):</p>
          <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
            {preview.fileErrors.slice(0, 50).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Step 2: preview table */}
      {rows && (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {rows.length} rows · <span className="font-semibold text-signal">{applicable.length} applicable</span> ·{' '}
              {rows.length - applicable.length} manual-review/skip · {selected.size} selected
              {selectedOverwrites.length > 0 && (
                <span className="font-semibold text-diesel"> · {selectedOverwrites.length} overwrite existing</span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="confidence-filter" className="text-xs font-semibold text-muted">
                Confidence
              </label>
              <select
                id="confidence-filter"
                value={confidenceFilter}
                onChange={(e) => setConfidenceFilter(e.target.value)}
                className="rounded-card border border-line bg-asphalt px-3 py-1.5 text-sm text-ink focus:border-signal focus:outline-none"
              >
                {CONFIDENCE_FILTERS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button type="button" onClick={downloadRejected} className={smallBtn}>
                Download manual-review rows
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-card border border-line">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-asphalt-800 text-left text-muted">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-3 py-2.5 font-semibold">Listing</th>
                  <th className="px-3 py-2.5 font-semibold">Existing</th>
                  <th className="px-3 py-2.5 font-semibold">Proposed</th>
                  <th className="px-3 py-2.5 font-semibold">Confidence</th>
                  <th className="px-3 py-2.5 font-semibold">Source</th>
                  <th className="px-3 py-2.5 font-semibold">Status / notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((r) => (
                  <tr key={`${r.listing_id}-${r.business_name}`} className={r.applicable ? '' : 'opacity-70'}>
                    <td className="px-3 py-2.5 align-top">
                      {r.applicable && (
                        <input
                          type="checkbox"
                          checked={selected.has(r.listing_id)}
                          onChange={() => toggle(r.listing_id)}
                          aria-label={`Select ${r.business_name}`}
                          className="h-4 w-4 rounded border-line bg-asphalt text-signal focus:ring-signal"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <span className="font-semibold text-ink">{r.business_name}</span>
                      <span className="block text-xs text-muted">
                        {r.city}, {r.state} · {r.category}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-top text-muted">
                      {fmtCoord(r.live?.lat)}, {fmtCoord(r.live?.lng)}
                      {r.wouldOverwrite && (
                        <label className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-diesel">
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
                            className="h-3.5 w-3.5 rounded border-diesel bg-asphalt text-diesel"
                          />
                          confirm overwrite
                        </label>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-top text-ink">
                      {fmtCoord(r.proposed_latitude)}, {fmtCoord(r.proposed_longitude)}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <span
                        className={
                          r.confidence === 'high'
                            ? 'font-semibold text-signal'
                            : r.confidence === 'unresolved'
                              ? 'text-diesel'
                              : 'text-muted'
                        }
                      >
                        {r.confidence}
                      </span>
                      <span className="block text-xs text-muted">{r.action}</span>
                    </td>
                    <td className="max-w-52 px-3 py-2.5 align-top text-xs text-muted">
                      {r.source_url ? (
                        <a href={r.source_url} target="_blank" rel="noreferrer" className="break-all text-signal hover:underline">
                          {r.source_url.replace(/^https?:\/\//, '').slice(0, 60)}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="max-w-72 px-3 py-2.5 align-top text-xs text-muted">
                      {r.problems.length > 0 && (
                        <span className="block font-semibold text-diesel">{r.problemDetails.join('; ')}</span>
                      )}
                      {r.verification_notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Step 3: confirm + apply */}
          <div className="mt-4 max-w-3xl rounded-card border border-line bg-asphalt-800 p-5">
            {!confirming ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  Applying updates <span className="font-semibold text-ink">{selectedRows.length}</span> listing
                  {selectedRows.length === 1 ? '' : 's'} (high confidence, ready only).
                  {unconfirmedOverwrites.length > 0 &&
                    ` ${unconfirmedOverwrites.length} selected overwrite(s) still need the per-row confirmation.`}
                </p>
                <button
                  type="button"
                  disabled={selectedRows.length === 0 || unconfirmedOverwrites.length > 0}
                  onClick={() => setConfirming(true)}
                  className={primaryBtn}
                >
                  Review &amp; apply…
                </button>
              </div>
            ) : (
              <div>
                <h3 className="font-display text-lg uppercase text-ink">Confirm apply</h3>
                <p className="mt-1 text-sm text-muted">
                  {selectedRows.length} listing{selectedRows.length === 1 ? '' : 's'} will get coordinates
                  {selectedOverwrites.length > 0
                    ? `, including ${selectedOverwrites.length} explicit overwrite(s) of existing coordinates`
                    : ''}
                  . A location_history record is written before each update; medium/low/unresolved rows are
                  never touched.
                </p>
                <ul className="mt-3 max-h-44 space-y-1 overflow-y-auto text-xs text-muted">
                  {selectedRows.map((r) => (
                    <li key={r.listing_id}>
                      <span className="font-semibold text-ink">{r.business_name}</span> →{' '}
                      {fmtCoord(r.proposed_latitude)}, {fmtCoord(r.proposed_longitude)}
                      {r.wouldOverwrite && <span className="text-diesel"> (overwrite)</span>}
                    </li>
                  ))}
                </ul>
                <form action={applyAction} className="mt-4 flex flex-wrap items-center gap-3">
                  <input type="hidden" name="csv_text" value={csvText} />
                  <input type="hidden" name="selected" value={JSON.stringify([...selected])} />
                  <input type="hidden" name="overwrite_confirmed" value={JSON.stringify([...overwriteOk])} />
                  <PendingButton label={`Apply ${selectedRows.length} update${selectedRows.length === 1 ? '' : 's'}`} pendingLabel="Applying…" />
                  <button type="button" onClick={() => setConfirming(false)} className={smallBtn}>
                    Back
                  </button>
                </form>
                {applyState.error && (
                  <p role="alert" className="mt-3 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel">
                    {applyState.error}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
