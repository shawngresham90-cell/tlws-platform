'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseListingForm, toRow, slugify } from '@/lib/directory/admin';

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
