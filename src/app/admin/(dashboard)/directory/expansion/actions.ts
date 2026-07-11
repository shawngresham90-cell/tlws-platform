'use server';

import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getExistingImportKeys } from '@/lib/admin/directory';
import { IMPORT_LIMITS } from '@/lib/directory/import';
import { assessExpansion, type ExpansionReport } from '@/lib/directory/expansion';
import type { PairListing } from '@/lib/directory/colocation';

/**
 * Expansion readiness preview (Milestone 21). STRICTLY read-only: the
 * candidate CSV runs through the real import parser and is assessed against
 * live keys/slugs/listings, but no row is ever inserted from here — actual
 * imports still go through /admin/directory/import after this report says
 * the batch is ready.
 */

export type ExpansionPreviewState = {
  error: string | null;
  report: ExpansionReport | null;
};

export async function previewExpansionAction(
  _prev: ExpansionPreviewState,
  formData: FormData,
): Promise<ExpansionPreviewState> {
  requireAdmin();
  const text = formData.get('csv_text');
  if (typeof text !== 'string' || text.trim() === '') {
    return { error: 'Choose a candidate import CSV first.', report: null };
  }
  if (text.length > IMPORT_LIMITS.maxBytes) {
    return { error: 'File too large (max 4 MB).', report: null };
  }

  try {
    const supabase = createAdminClient();
    const [{ keys, error: keysError }, liveResult] = await Promise.all([
      getExistingImportKeys(),
      supabase
        .from('locations')
        .select('id, name, category_slug, address, city, state, phone, website, lat, lng, interstate, exit_number, detail_slug')
        .is('deleted_at', null)
        .limit(5000),
    ]);
    if (keysError) return { error: `Could not read existing listings: ${keysError}`, report: null };
    if (liveResult.error || !liveResult.data) {
      return { error: liveResult.error?.message ?? 'Could not read live listings.', report: null };
    }
    const liveRows = liveResult.data as unknown as {
      id: string;
      name: string;
      category_slug: string | null;
      address: string | null;
      city: string;
      state: string;
      phone: string | null;
      website: string | null;
      lat: number | null;
      lng: number | null;
      interstate: string | null;
      exit_number: string | null;
      detail_slug: string | null;
    }[];
    const live: PairListing[] = liveRows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category_slug,
      address: r.address,
      city: r.city,
      state: r.state,
      phone: r.phone,
      website: r.website,
      lat: r.lat,
      lng: r.lng,
      interstate: r.interstate,
      exitNumber: r.exit_number,
    }));
    const slugs = new Set(
      liveRows.map((r) => r.detail_slug).filter((s): s is string => Boolean(s)),
    );
    return { error: null, report: assessExpansion(text, keys, slugs, live) };
  } catch (e) {
    return { error: (e as Error).message, report: null };
  }
}
