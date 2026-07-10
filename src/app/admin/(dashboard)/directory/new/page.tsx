import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { ListingForm } from '@/components/admin/directory/ListingForm';
import { saveListingAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Admin — New Directory Listing',
  robots: { index: false, follow: false },
};

export default function AdminDirectoryNewPage() {
  requireAdmin();
  const createAction = saveListingAction.bind(null, null);

  return (
    <div>
      <p className="mb-2 text-sm text-muted">
        <Link href="/admin/directory" className="hover:text-signal">
          ← Directory
        </Link>
      </p>
      <h1 className="display-section mb-6">Add listing</h1>
      <ListingForm action={createAction} submitLabel="Create listing" />
    </div>
  );
}
