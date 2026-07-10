'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseListingForm, toRow, slugify } from '@/lib/directory/admin';
import { DIRECTORY_CATEGORIES } from '@/lib/directory/categories';
import { prepareImport, IMPORT_LIMITS, type ImportSummary } from '@/lib/directory/import';
import { orderPair } from '@/lib/directory/duplicates';
import { getExistingImportKeys } from '@/lib/admin/directory';

/**
 * Directory admin writes. Every action: admin gate → zod validation →
 * service-role write → revalidate the admin list and the affected public
 * category page. Anon users never reach these (requireAdmin redirects), and
 * RLS has no anon write policy as a second wall.
 */

export type FormState = { error: string | null };

function revalidateListing(categorySlug: string | null) {
  revalidatePath('/admin/directory');
  revalidatePath('/directory');
  if (categorySlug) revalidatePath(`/directory/${categorySlug}`);
}

/** Create (id === null) or update a listing from the admin form. */
export async function saveListingAction(
  id: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  requireAdmin();

  const parsed = parseListingForm(formData);
  if (!parsed.data) return { error: parsed.error ?? 'Invalid form input' };
  const row = toRow(parsed.data);

  const supabase = createAdminClient();

  if (id === null) {
    const { error } = await supabase
      .from('locations')
      .insert({ ...row, slug: slugify(row.name), source: 'admin' });
    if (error) {
      return {
        error:
          error.code === '23505'
            ? 'A listing with this name already exists in that city — rename it slightly.'
            : `Could not create listing: ${error.message}`,
      };
    }
    revalidateListing(row.category_slug);
    redirect('/admin/directory?ok=created');
  }

  const { error } = await supabase.from('locations').update(row).eq('id', id);
  if (error) return { error: `Could not save listing: ${error.message}` };

  revalidateListing(row.category_slug);
  redirect('/admin/directory?ok=saved');
}

/** Publish / unpublish. */
export async function setPublishedAction(
  id: string,
  categorySlug: string | null,
  publish: boolean,
): Promise<void> {
  requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('locations')
    .update({ is_published: publish })
    .eq('id', id);
  if (error) redirect('/admin/directory?error=update');
  revalidateListing(categorySlug);
  redirect(`/admin/directory?ok=${publish ? 'published' : 'unpublished'}`);
}

/** Feature / unfeature. */
export async function setFeaturedAction(
  id: string,
  categorySlug: string | null,
  feature: boolean,
): Promise<void> {
  requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('locations')
    .update({ is_featured: feature })
    .eq('id', id);
  if (error) redirect('/admin/directory?error=update');
  revalidateListing(categorySlug);
  redirect(`/admin/directory?ok=${feature ? 'featured' : 'unfeatured'}`);
}

/** Soft delete: row keeps its data, drops out of admin list and public reads. */
export async function softDeleteAction(id: string, categorySlug: string | null): Promise<void> {
  requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('locations')
    .update({ deleted_at: new Date().toISOString(), is_published: false })
    .eq('id', id);
  if (error) redirect('/admin/directory?error=delete');
  revalidateListing(categorySlug);
  redirect('/admin/directory?ok=deleted');
}

/* ============================================================
 * Milestone 13 — bulk import & duplicate management
 * ============================================================ */

export type ImportState = {
  error: string | null;
  summary: ImportSummary | null;
};

function revalidateAllDirectory() {
  revalidatePath('/admin/directory');
  revalidatePath('/directory');
  for (const c of DIRECTORY_CATEGORIES) revalidatePath(`/directory/${c.slug}`);
}

/** CSV bulk import: parse → validate every row → dedupe → chunked insert. */
export async function importCsvAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  requireAdmin();

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a CSV file first.', summary: null };
  }
  if (file.size > IMPORT_LIMITS.maxBytes) {
    return {
      error: `File is too large (max ${Math.round(IMPORT_LIMITS.maxBytes / 1024 / 1024)} MB). Split it and import in parts.`,
      summary: null,
    };
  }

  const text = await file.text();
  const { keys, error: keysError } = await getExistingImportKeys();
  if (keysError) return { error: `Could not read existing listings: ${keysError}`, summary: null };

  const { rows, summary } = prepareImport(text, keys);
  if (summary.totalRows > IMPORT_LIMITS.maxRows) {
    return {
      error: `Too many rows (${summary.totalRows}; max ${IMPORT_LIMITS.maxRows} per import). Split the file.`,
      summary: null,
    };
  }

  if (rows.length > 0) {
    const supabase = createAdminClient();
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from('locations').insert(chunk);
      if (error) {
        summary.imported = i; // rows before the failing chunk made it in
        return {
          error: `Insert failed after ${i} rows: ${error.message}`,
          summary,
        };
      }
    }
    revalidateAllDirectory();
  }

  return { error: null, summary };
}

/**
 * Merge duplicate pair: keep one row, fill its empty fields from the other,
 * then soft-delete the other. Never overwrites a kept value.
 */
export async function mergeDuplicateAction(keepId: string, dropId: string): Promise<void> {
  requireAdmin();
  if (keepId === dropId) redirect('/admin/directory/duplicates?error=merge');

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .in('id', [keepId, dropId])
    .is('deleted_at', null);
  if (error || !data || data.length !== 2) redirect('/admin/directory/duplicates?error=merge');

  const rows = data as Record<string, unknown>[];
  const keep = rows.find((r) => r.id === keepId)!;
  const drop = rows.find((r) => r.id === dropId)!;

  const FILLABLE = [
    'address', 'zip', 'lat', 'lng', 'phone', 'website', 'description', 'parking_spaces',
    'tpc_url', 'affiliate_code', 'image_url', 'interstate', 'exit_number', 'verified_at',
  ];
  const patch: Record<string, unknown> = {};
  for (const f of FILLABLE) {
    if ((keep[f] == null || keep[f] === '') && drop[f] != null && drop[f] !== '') {
      patch[f] = drop[f];
    }
  }
  // Union amenities; keep flags win, but true parking flags on the duplicate carry over.
  const amenities = new Set([
    ...((keep.amenities as string[]) ?? []),
    ...((drop.amenities as string[]) ?? []),
  ]);
  patch.amenities = [...amenities];
  for (const f of ['free_parking', 'paid_parking', 'reserved_parking', 'overnight_parking']) {
    if (drop[f] === true && keep[f] !== true) patch[f] = true;
  }

  const upd = await supabase.from('locations').update(patch).eq('id', keepId);
  if (upd.error) redirect('/admin/directory/duplicates?error=merge');
  const del = await supabase
    .from('locations')
    .update({ deleted_at: new Date().toISOString(), is_published: false })
    .eq('id', dropId);
  if (del.error) redirect('/admin/directory/duplicates?error=merge');

  revalidateAllDirectory();
  revalidatePath('/admin/directory/duplicates');
  redirect('/admin/directory/duplicates?ok=merged');
}

/** Remember a pair as "not duplicates" so the finder stops flagging it. */
export async function ignoreDuplicateAction(xId: string, yId: string): Promise<void> {
  requireAdmin();
  const { a, b } = orderPair(xId, yId);
  const supabase = createAdminClient();
  const { error } = await supabase.from('location_duplicate_ignores').upsert({ a, b });
  if (error) redirect('/admin/directory/duplicates?error=ignore');
  revalidatePath('/admin/directory/duplicates');
  redirect('/admin/directory/duplicates?ok=ignored');
}

/** Soft-delete the duplicate row (data kept, gone from admin + public). */
export async function deleteDuplicateAction(id: string): Promise<void> {
  requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('locations')
    .update({ deleted_at: new Date().toISOString(), is_published: false })
    .eq('id', id);
  if (error) redirect('/admin/directory/duplicates?error=delete');
  revalidateAllDirectory();
  revalidatePath('/admin/directory/duplicates');
  redirect('/admin/directory/duplicates?ok=deleted');
}
