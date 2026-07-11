'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import {
  previewGeocodingAction,
  applyGeocodingAction,
  type GeocodingPreviewState,
  type GeocodingApplyState,
} from '@/app/admin/(dashboard)/directory/geocoding/actions';
import {
  rejectedRowsCsv,
  batchSummary,
  stagingCsv,
  reviewQueueCsv,
  osmUrl,
  type ValidatedRow,
} from '@/lib/directory/geocoding';

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
const ACTION_FILTERS = ['all', 'ready', 'manual-review', 'skip'] as const;

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Row-level evidence drawer (Milestone 21): sources, confirmations, notes. */
function EvidenceDrawer({ row }: { row: ValidatedRow }) {
  const e = row.evidence;
  const hasEvidence =
    e.confidenceReason || e.sourceCount != null || e.sourceUrls.length > 0 || e.lastResearched ||
    e.reviewerNotes || e.sideOfRoadConfirmed != null || e.propertyConfirmed != null ||
    e.cityStateValidated != null || e.priority || e.concernFlag || e.status;
  if (!hasEvidence) return null;
  const yn = (v: boolean | null) => (v == null ? '—' : v ? 'yes' : 'no');
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-xs font-semibold text-signal">
        Evidence{e.concernFlag ? ' · ⚠ concern' : ''}{e.priority ? ` · ${e.priority} priority` : ''}
      </summary>
      <dl className="mt-1 grid gap-0.5 text-xs text-muted">
        {e.status && (
          <div>
            <dt className="inline font-semibold">Status:</dt> <dd className="inline">{e.status}</dd>
          </div>
        )}
        {e.confidenceReason && (
          <div>
            <dt className="inline font-semibold">Why this confidence:</dt>{' '}
            <dd className="inline">{e.confidenceReason}</dd>
          </div>
        )}
        {e.sourceCount != null && (
          <div>
            <dt className="inline font-semibold">Sources:</dt> <dd className="inline">{e.sourceCount}</dd>
          </div>
        )}
        {e.sourceUrls.length > 0 && (
          <div>
            <dt className="inline font-semibold">Source URLs:</dt>{' '}
            <dd className="inline">
              {e.sourceUrls.map((u, i) => (
                <a key={u} href={u} target="_blank" rel="noreferrer" className="mr-2 break-all text-signal hover:underline">
                  [{i + 1}]
                </a>
              ))}
            </dd>
          </div>
        )}
        {e.lastResearched && (
          <div>
            <dt className="inline font-semibold">Last researched:</dt>{' '}
            <dd className="inline">{e.lastResearched}</dd>
          </div>
        )}
        <div>
          <dt className="inline font-semibold">Side of road:</dt> <dd className="inline">{yn(e.sideOfRoadConfirmed)}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">On business property:</dt>{' '}
          <dd className="inline">{yn(e.propertyConfirmed)}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">City/state validated:</dt>{' '}
          <dd className="inline">{yn(e.cityStateValidated)}</dd>
        </div>
        {e.reviewerNotes && (
          <div>
            <dt className="inline font-semibold">Reviewer notes:</dt>{' '}
            <dd className="inline">{e.reviewerNotes}</dd>
          </div>
        )}
      </dl>
    </details>
  );
}

export function GeocodingTool() {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [concernsOnly, setConcernsOnly] = useState(false);
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
    return rows.filter(
      (r) =>
        (confidenceFilter === 'all' || r.confidence === confidenceFilter) &&
        (actionFilter === 'all' || r.action === actionFilter) &&
        (!concernsOnly || r.evidence.concernFlag),
    );
  }, [rows, confidenceFilter, actionFilter, concernsOnly]);

  const summary = useMemo(() => (rows ? batchSummary(rows) : null), [rows]);

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
    if (rows) downloadCsv(rejectedRowsCsv(rows), 'geocoding-manual-review.csv');
  }
  function downloadReviewQueue() {
    if (rows) downloadCsv(reviewQueueCsv(rows), 'geocoding-review-queue.csv');
  }
  function downloadStaging() {
    if (rows) downloadCsv(stagingCsv(rows, selected), 'geocoding-staging-batch.csv');
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
          {summary && (
            <dl className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {(
                [
                  ['Rows', summary.total],
                  ['Applicable', summary.applicable],
                  ['High confidence', summary.byConfidence.high ?? 0],
                  ['Manual review', summary.byAction['manual-review'] ?? 0],
                  ['Overwrites', summary.overwrites],
                  ['Concern flags', summary.concerns],
                ] as const
              ).map(([label, n]) => (
                <div key={label} className="rounded-card border border-line bg-asphalt-800 p-3 text-center">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
                  <dd className="mt-0.5 font-display text-2xl text-ink">{n}</dd>
                </div>
              ))}
            </dl>
          )}
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
              <label htmlFor="action-filter" className="text-xs font-semibold text-muted">
                Action
              </label>
              <select
                id="action-filter"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="rounded-card border border-line bg-asphalt px-3 py-1.5 text-sm text-ink focus:border-signal focus:outline-none"
              >
                {ACTION_FILTERS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <input
                  type="checkbox"
                  checked={concernsOnly}
                  onChange={(e) => setConcernsOnly(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                concerns only
              </label>
              <button type="button" onClick={downloadRejected} className={smallBtn}>
                Manual-review rows
              </button>
              <button type="button" onClick={downloadReviewQueue} className={smallBtn}>
                Review queue (priority)
              </button>
              <button type="button" onClick={downloadStaging} disabled={selected.size === 0} className={smallBtn}>
                Export selected as staging CSV
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
                      {r.live?.lat != null && r.live?.lng != null && (
                        <a
                          href={osmUrl(r.live.lat, r.live.lng)}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-1.5 text-xs text-signal hover:underline"
                          aria-label={`View existing coordinates for ${r.business_name} on OpenStreetMap`}
                        >
                          map↗
                        </a>
                      )}
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
                      {r.proposed_latitude != null && r.proposed_longitude != null && (
                        <a
                          href={osmUrl(r.proposed_latitude, r.proposed_longitude)}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-1.5 text-xs text-signal hover:underline"
                          aria-label={`View proposed coordinates for ${r.business_name} on OpenStreetMap`}
                        >
                          map↗
                        </a>
                      )}
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
                      <EvidenceDrawer row={r} />
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
