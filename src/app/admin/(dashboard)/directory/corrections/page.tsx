import { requireAdmin } from '@/lib/admin/auth';
import { CORRECTION_FIELDS, correctionsTemplateCsv, CLEAR_TOKEN } from '@/lib/directory/corrections';
import { DirectoryToolsNav } from '@/components/admin/directory/DirectoryToolsNav';
import { DownloadCsvButton } from '@/components/admin/directory/DownloadCsvButton';
import { CorrectionsTool } from '@/components/admin/directory/CorrectionsTool';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Bulk Corrections', robots: { index: false, follow: false } };

/**
 * Bulk-correction workflow (Milestone 21): CSV in, dry-run diff preview,
 * explicit selection + confirmation, history-first atomic-per-row apply.
 * Only the documented safe directory fields can be corrected — publication
 * status, moderation, and internal fields have no path through this tool.
 */

export default function AdminCorrectionsPage() {
  requireAdmin();

  return (
    <div>
      <DirectoryToolsNav />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display-section">Bulk corrections</h1>
        <DownloadCsvButton
          csv={correctionsTemplateCsv()}
          filename="corrections-template.csv"
          label="Download template CSV"
        />
      </div>

      <section className="max-w-3xl rounded-card border border-line bg-asphalt-800 p-5 text-sm text-muted">
        <h2 className="font-display text-lg uppercase text-ink">How it works</h2>
        <ul className="mt-3 grid list-disc gap-1.5 pl-5">
          <li>
            Identity columns are required: <code className="text-ink">listing_id</code>,{' '}
            <code className="text-ink">match_name</code>, <code className="text-ink">match_city</code>,{' '}
            <code className="text-ink">match_state</code> — the match columns must equal the
            listing’s CURRENT values or the row is rejected.
          </li>
          <li>An empty cell means “no change”. Fields not in the file are never touched.</li>
          <li>
            The literal <code className="text-ink">{CLEAR_TOKEN}</code> blanks a field — flagged as
            destructive and requires per-row confirmation.
          </li>
          <li>Unknown columns are rejected outright. Publication status can never be changed here.</li>
          <li>Every applied row writes a change-history record before the update.</li>
        </ul>
        <h3 className="mt-4 font-display text-base uppercase text-ink">Editable fields</h3>
        <p className="mt-2">
          {CORRECTION_FIELDS.map((f) => `${f.column}${f.clearable ? '' : '*'}`).join(', ')}{' '}
          <span className="text-xs">(* cannot be cleared)</span>
        </p>
        <p className="mt-2 text-xs">
          amenities are pipe-separated (<code className="text-ink">Showers|Fuel</code>); parking
          flags take yes/no; verified_on takes YYYY-MM-DD; tpc_url must be an approved
          https://truckparkingclub.com URL.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl uppercase text-ink">Upload corrections</h2>
        <div className="mt-4">
          <CorrectionsTool />
        </div>
      </section>
    </div>
  );
}
