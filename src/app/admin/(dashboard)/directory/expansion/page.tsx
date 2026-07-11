import { requireAdmin } from '@/lib/admin/auth';
import { DIRECTORY_CATEGORIES } from '@/lib/directory/categories';
import { AMENITIES } from '@/lib/directory/amenities';
import { expansionTemplateCsv } from '@/lib/directory/expansion';
import { DirectoryToolsNav } from '@/components/admin/directory/DirectoryToolsNav';
import { DownloadCsvButton } from '@/components/admin/directory/DownloadCsvButton';
import { ExpansionTool } from '@/components/admin/directory/ExpansionTool';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Expansion Readiness', robots: { index: false, follow: false } };

/**
 * Expansion readiness (Milestone 21): everything the next interstate/state
 * batch needs before import — template, vocabularies, normalization rules,
 * and the read-only readiness report. No records are created here.
 */

export default function AdminExpansionPage() {
  requireAdmin();

  return (
    <div>
      <DirectoryToolsNav />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display-section">Expansion readiness</h1>
        <DownloadCsvButton
          csv={expansionTemplateCsv()}
          filename="import-template.csv"
          label="Download import template"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-card border border-line bg-asphalt-800 p-5 text-sm text-muted">
          <h2 className="font-display text-lg uppercase text-ink">Required fields &amp; normalization</h2>
          <ul className="mt-3 grid list-disc gap-1.5 pl-5">
            <li>
              <strong className="text-ink">Business Name</strong> and{' '}
              <strong className="text-ink">Category</strong> are mandatory; City + 2-letter State
              are required by validation.
            </li>
            <li>State: two-letter code, uppercased automatically (ga → GA).</li>
            <li>Interstate: store as the designation drivers know — “I-75” (page slugs derive automatically).</li>
            <li>Exit number: the posted exit, as text (“306”, “7B”) — mile-based numbering.</li>
            <li>Phone: digits and ()+-. only; Website: full http(s):// URL.</li>
            <li>
              Truck Parking Club URL: https://truckparkingclub.com only — anything else is rejected.
              Never guess one.
            </li>
            <li>Coordinates: decimal degrees, only when verified — the geocoding workflow adds them later otherwise.</li>
            <li>Booleans (Published/Featured/parking flags/amenities): yes / y / true / 1 / x.</li>
          </ul>
        </section>
        <section className="rounded-card border border-line bg-asphalt-800 p-5 text-sm text-muted">
          <h2 className="font-display text-lg uppercase text-ink">Vocabularies</h2>
          <p className="mt-3">
            <strong className="text-ink">Categories:</strong>{' '}
            {DIRECTORY_CATEGORIES.map((c) => c.slug).join(', ')}
          </p>
          <p className="mt-2">
            <strong className="text-ink">Amenity columns:</strong> Showers, Food, Fuel, Laundry,
            Restrooms, Repair, CAT Scale, WiFi, Security (full stored vocabulary:{' '}
            {AMENITIES.join(', ')})
          </p>
          <p className="mt-2">
            <strong className="text-ink">Parking types:</strong> Free Parking, Paid Parking,
            Reserved Parking, Overnight Parking (yes/no columns).
          </p>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl uppercase text-ink">Readiness report</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Runs the candidate file through the REAL import parser and previews slugs, duplicates
          against the live directory, completeness, geocoding readiness, and a publish verdict per
          row. Nothing is imported from this page — when the report is clean, run the batch through
          Import as usual.
        </p>
        <div className="mt-4">
          <ExpansionTool />
        </div>
      </section>
    </div>
  );
}
