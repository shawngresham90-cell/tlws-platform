import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { GeocodingTool } from '@/components/admin/directory/GeocodingTool';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Geocoding', robots: { index: false, follow: false } };

export default function AdminGeocodingPage() {
  requireAdmin();

  return (
    <div>
      <Link href="/admin/directory" className="text-sm font-semibold text-muted hover:text-signal">
        ← Back to directory
      </Link>
      <div className="mb-6 mt-3">
        <h1 className="display-section">Geocoding</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Apply a verified coordinate batch to the directory. Rows are matched by listing ID and
          cross-checked against address/city/state — only high-confidence, ready rows can be
          applied, existing coordinates are never overwritten without an explicit per-row
          confirmation, and every change writes a location history record first.
        </p>
      </div>
      <GeocodingTool />
    </div>
  );
}
