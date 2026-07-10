import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/admin/auth';
import { getListingsForExport } from '@/lib/admin/directory';
import { getCategory } from '@/lib/directory/categories';
import { AMENITIES } from '@/lib/directory/amenities';
import { toCsv } from '@/lib/directory/csv';
import type { ListingRow } from '@/lib/admin/directory';

export const dynamic = 'force-dynamic';

/**
 * CSV export download. Route handlers are NOT wrapped by the (dashboard)
 * layout gate, so this handler enforces the admin session itself and returns
 * 401 (not a redirect) for anything unauthenticated.
 */

const HEADER = [
  'Business Name',
  'Category',
  'Address',
  'City',
  'State',
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
  ...AMENITIES.map((a) => (a === 'Wi-Fi' ? 'WiFi' : a)),
  'TruckParkingClub URL',
  'Affiliate Code',
  'Image URL',
  'Interstate',
  'Exit Number',
  'Published',
  'Featured',
];

const yn = (v: boolean | null | undefined) => (v ? 'yes' : 'no');

function rowToCells(r: ListingRow): (string | number | null)[] {
  const amenities = new Set(r.amenities ?? []);
  return [
    r.name,
    r.category_slug ? (getCategory(r.category_slug)?.title ?? r.category_slug) : '',
    r.address,
    r.city,
    r.state,
    r.zip,
    r.lat,
    r.lng,
    r.phone,
    r.website,
    r.description,
    r.parking_spaces,
    yn(r.free_parking),
    yn(r.paid_parking),
    yn(r.reserved_parking),
    yn(r.overnight_parking),
    ...AMENITIES.map((a) => yn(amenities.has(a))),
    r.tpc_url,
    r.affiliate_code,
    r.image_url,
    r.interstate,
    r.exit_number,
    yn(r.is_published),
    yn(r.is_featured),
  ];
}

export async function GET(request: NextRequest) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const { rows, error } = await getListingsForExport({
    category: params.get('category') || undefined,
    state: params.get('state') || undefined,
    published: params.get('published') || undefined,
    featured: params.get('featured') === '1' || undefined,
  });
  if (error) {
    return NextResponse.json({ error: `Export failed: ${error}` }, { status: 500 });
  }

  const csv = toCsv([HEADER, ...rows.map(rowToCells)]);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tlws-directory-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
