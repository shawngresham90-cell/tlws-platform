'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import {
  previewExpansionAction,
  type ExpansionPreviewState,
} from '@/app/admin/(dashboard)/directory/expansion/actions';
import { expansionReportCsv } from '@/lib/directory/expansion';

/**
 * Expansion readiness tool (Milestone 21). Upload a candidate import CSV →
 * read-only report: parser verdicts, slug previews, duplicate hits against
 * the live directory, completeness, geocoding readiness, publish verdicts.
 * Nothing is imported from this page.
 */

const primaryBtn =
  'rounded-card bg-signal px-5 py-2.5 font-display text-base uppercase tracking-wide ' +
  'text-asphalt transition-colors hover:bg-signal-600 disabled:opacity-60';
const smallBtn =
  'rounded-card border border-line px-3 py-1.5 text-xs font-semibold text-ink transition-colors ' +
  'hover:border-signal hover:text-signal';

function PendingButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={primaryBtn}>
      {pending ? pendingLabel : label}
    </button>
  );
}

const VERDICT_STYLES: Record<string, string> = {
  'ready-to-publish': 'text-signal font-semibold',
  'import-unpublished': 'text-ink',
  'manual-review': 'text-diesel-300 font-semibold',
};

export function ExpansionTool() {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const initial: ExpansionPreviewState = { error: null, report: null };
  const [state, action] = useFormState(previewExpansionAction, initial);
  const report = state.report;

  async function onFileChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCsvText(await file.text());
  }

  function downloadReport() {
    if (!report) return;
    const blob = new Blob([expansionReportCsv(report)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'expansion-readiness-report.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <form action={action} className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={onFileChange}
          className="text-sm text-muted file:mr-3 file:rounded-card file:border file:border-line file:bg-asphalt-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink"
          aria-label="Candidate import CSV file"
        />
        <input type="hidden" name="csv_text" value={csvText} />
        <PendingButton label="Assess readiness" pendingLabel="Assessing…" />
        {fileName && <span className="text-xs text-muted">{fileName}</span>}
      </form>

      {state.error && (
        <p className="mt-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300">
          {state.error}
        </p>
      )}

      {report && (
        <>
          <dl className="mt-5 grid gap-3 sm:grid-cols-4">
            {(
              [
                ['Ready to publish', report.verdictCounts['ready-to-publish']],
                ['Import unpublished', report.verdictCounts['import-unpublished']],
                ['Manual review', report.verdictCounts['manual-review']],
                ['Rejected by parser', report.verdictCounts.reject],
              ] as const
            ).map(([label, n]) => (
              <div
                key={label}
                className="rounded-card border border-line bg-asphalt-800 p-4 text-center"
              >
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {label}
                </dt>
                <dd className="mt-1 font-display text-3xl text-ink">{n}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={downloadReport} className={smallBtn}>
              Download full report CSV
            </button>
            <span className="text-xs text-muted">
              {report.summary.totalRows} rows · {report.summary.duplicates} duplicates vs live/file
              · {report.summary.errors.length} parser error
              {report.summary.errors.length === 1 ? '' : 's'}
            </span>
          </div>

          {report.summary.errors.length > 0 && (
            <details className="mt-3 text-sm text-muted">
              <summary className="cursor-pointer font-semibold text-diesel-300">
                Parser errors
              </summary>
              <ul className="mt-2 grid gap-1">
                {report.summary.errors.map((e) => (
                  <li key={`${e.row}-${e.message}`}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="mt-4 overflow-x-auto rounded-card border border-line">
            <table className="w-full min-w-[1020px] text-sm">
              <thead className="bg-asphalt-800 text-left text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Listing</th>
                  <th className="px-3 py-2 font-semibold">Slug preview</th>
                  <th className="px-3 py-2 font-semibold">Completeness</th>
                  <th className="px-3 py-2 font-semibold">Geocoding</th>
                  <th className="px-3 py-2 font-semibold">Duplicates</th>
                  <th className="px-3 py-2 font-semibold">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.rows.slice(0, 200).map((r, i) => (
                  <tr key={`${r.slugPreview}-${i}`}>
                    <td className="px-3 py-2">
                      <span className="font-semibold text-ink">{r.name}</span>
                      <span className="block text-xs text-muted">
                        {r.category} · {r.city}, {r.state}
                      </span>
                    </td>
                    <td className="max-w-[220px] break-all px-3 py-2 font-mono text-xs text-muted">
                      {r.slugPreview}
                      {r.slugCollision && (
                        <span className="block text-diesel-300">collision suffix</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {r.completeness} · {r.completenessLabel}
                      {r.missing.length > 0 && (
                        <details>
                          <summary className="cursor-pointer text-xs text-signal">missing</summary>
                          <span className="text-xs">{r.missing.join(', ')}</span>
                        </details>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{r.geocoding}</td>
                    <td className="max-w-[220px] px-3 py-2 text-xs text-muted">
                      {r.duplicateHits.length === 0
                        ? '—'
                        : r.duplicateHits.map((h) => `${h.liveName} (${h.class})`).join('; ')}
                    </td>
                    <td className={`px-3 py-2 text-xs ${VERDICT_STYLES[r.verdict]}`}>
                      {r.verdict}
                      <span className="block font-normal text-muted">{r.verdictReason}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.rows.length > 200 && (
              <p className="px-3 py-2 text-xs text-muted">
                Showing 200 of {report.rows.length} — the CSV report contains all of them.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
