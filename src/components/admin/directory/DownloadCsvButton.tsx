'use client';

/**
 * Client-side CSV download from server-computed content (Milestone 21).
 * The CSV text is rendered into the page as a prop, so no extra route or
 * query is needed and admin-gated pages stay the only source.
 */
export function DownloadCsvButton({
  csv,
  filename,
  label,
  className,
}: {
  csv: string;
  filename: string;
  label: string;
  className?: string;
}) {
  function download() {
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <button
      type="button"
      onClick={download}
      className={
        className ??
        'rounded-card border border-line px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-signal hover:text-signal'
      }
    >
      {label}
    </button>
  );
}
