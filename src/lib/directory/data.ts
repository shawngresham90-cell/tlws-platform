import type { DirectoryEntry } from './types';

/**
 * Directory data layer — THE swap point for the database milestone.
 *
 * Today (Milestone 11): static, no database. Every category returns its
 * entries from the in-repo map below (currently empty — the UI's empty states
 * are the honest truth until real, verified locations are loaded).
 *
 * Later: replace the body of getEntries() with a Supabase read of
 * `public.locations` filtered by the category's dbType (see categories.ts) and
 * `is_indexable = true`. Components and pages don't change.
 */

const STATIC_ENTRIES: Record<string, DirectoryEntry[]> = {
  // 'truck-stops': [ { id: '…', category: 'truck-stops', name: '…', state: 'GA', city: 'Dalton', slug: '…' } ],
};

export async function getEntries(categorySlug: string): Promise<DirectoryEntry[]> {
  return STATIC_ENTRIES[categorySlug] ?? [];
}

/** Distinct two-letter states present in a set of entries, sorted. */
export function statesIn(entries: DirectoryEntry[]): string[] {
  return [...new Set(entries.map((e) => e.state))].sort();
}
