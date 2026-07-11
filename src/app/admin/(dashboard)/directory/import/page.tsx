import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { DirectoryToolsNav } from '@/components/admin/directory/DirectoryToolsNav';
import { ImportForm } from '@/components/admin/directory/ImportForm';
import { AMENITIES } from '@/lib/directory/amenities';
import { DIRECTORY_CATEGORIES } from '@/lib/directory/categories';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Admin — Bulk Import Directory Listings',
  robots: { index: false, follow: false },
};

const COLUMNS = [
  'Business Name*',
  'Category*',
  'Address',
  'City*',
  'State*',
  'ZIP',
  'Latitude',
  'Longitude',
  'Phone',
  'Website',
  'Description',
  'Truck Spaces',
  'Free Parking',
  'Paid Parking',
  'Reserved Parking',
  'Overnight Parking',
  ...AMENITIES.map((a) => (a === 'Food' ? 'Restaurant (or Food)' : a === 'Wi-Fi' ? 'WiFi' : a)),
  'TruckParkingClub URL',
  'Affiliate Code',
  'Image URL',
  'Interstate',
  'Exit Number',
  'Published',
  'Featured',
];

export default function AdminDirectoryImportPage() {
  requireAdmin();
  return (
    <div>
      <DirectoryToolsNav />
      <p className="mb-2 text-sm text-muted">
        <Link href="/admin/directory" className="hover:text-signal">
          ← Directory
        </Link>
      </p>
      <h1 className="display-section mb-2">Bulk import</h1>
      <p className="mb-8 max-w-2xl text-muted">
        Upload a CSV of listings. Yes/no columns accept yes, true, 1, or x. Category accepts the
        name (“Truck Parking”) or the slug (“parking”):{' '}
        {DIRECTORY_CATEGORIES.map((c) => c.title).join(' · ')}.
      </p>

      <ImportForm />

      <div className="mt-8 max-w-2xl rounded-card border border-line bg-asphalt-800 p-6">
        <h2 className="font-display text-lg uppercase text-signal">Supported columns</h2>
        <p className="mt-1 text-xs text-muted">
          Header matching ignores case, spaces, and punctuation. * = required.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">{COLUMNS.join(' · ')}</p>
        <p className="mt-3 text-xs text-muted">
          Imported rows arrive with “Include in SEO” off — publishing makes them visible, but SEO
          inclusion stays a deliberate per-listing decision after review.
        </p>
      </div>
    </div>
  );
}
