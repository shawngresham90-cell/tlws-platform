import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Admin data access. Uses the service-role client (bypasses RLS) so the
 * dashboard can read every row — only ever called from admin-gated server
 * components/actions. Every read fails soft to an empty set + error string so a
 * missing service-role key or a slow DB shows a message instead of a 500.
 */

export type ApplicationRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
};

export type FounderRow = {
  id: string;
  display_name: string;
  amount_cents: number;
  message: string | null;
  tier: string;
  status: string;
  created_at: string;
};

export type SponsorRow = {
  id: string;
  company: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  tier_interest: string | null;
  /** The inquiry message the prospect submitted (stored in sponsors.notes). */
  notes: string | null;
  /** Pipeline stage, distinct from the admin `status` toggle. */
  stage: string | null;
  next_action: string | null;
  next_action_date: string | null;
  status: string;
  created_at: string;
  /** Most recent sponsor_touches row, joined in below. Null when never touched. */
  last_touch_at?: string | null;
  last_touch_summary?: string | null;
};

type Result<T> = { rows: T[]; error: string | null };

async function fetchRows<T>(table: string, columns: string): Promise<Result<T>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order('created_at', { ascending: false });
    if (error) return { rows: [], error: error.message };
    return { rows: (data as T[]) ?? [], error: null };
  } catch (e) {
    return { rows: [], error: (e as Error).message };
  }
}

export function getApplications(): Promise<Result<ApplicationRow>> {
  return fetchRows<ApplicationRow>(
    'applications',
    'id, first_name, last_name, email, phone, status, created_at',
  );
}

export function getFounders(): Promise<Result<FounderRow>> {
  return fetchRows<FounderRow>(
    'founders',
    'id, display_name, amount_cents, message, tier, status, created_at',
  );
}

export type LeadRow = {
  id: string;
  email: string;
  first_name: string | null;
  phone: string | null;
  sms_consent: boolean | null;
  source: string | null;
  utm: Record<string, unknown> | null;
  created_at: string;
};

/** Read-only lead list for the admin funnel view. Never writes. */
export function getLeads(): Promise<Result<LeadRow>> {
  return fetchRows<LeadRow>(
    'leads',
    'id, email, first_name, phone, sms_consent, source, utm, created_at',
  );
}

/**
 * Sponsor inbox rows, with the most recent touch folded in.
 *
 * Every column here already exists — `stage`, `next_action`, `next_action_date`
 * were simply never surfaced, and `sponsor_touches` is read separately and
 * reduced to a latest-per-sponsor map in JS rather than with a join, because
 * PostgREST cannot express "newest child row" in a single embedded select. A
 * failed touch read degrades to no touch data rather than failing the page.
 */
export async function getSponsors(): Promise<Result<SponsorRow>> {
  const base = await fetchRows<SponsorRow>(
    'sponsors',
    'id, company, contact_name, email, phone, tier_interest, notes, stage, next_action, next_action_date, status, created_at',
  );
  if (base.error || base.rows.length === 0) return base;

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('sponsor_touches')
      .select('sponsor_id, summary, created_at')
      .order('created_at', { ascending: false });
    const latest = new Map<string, { created_at: string; summary: string | null }>();
    for (const t of (data as {
      sponsor_id: string;
      summary: string | null;
      created_at: string;
    }[]) ?? []) {
      if (!latest.has(t.sponsor_id)) latest.set(t.sponsor_id, t);
    }
    return {
      rows: base.rows.map((r) => ({
        ...r,
        last_touch_at: latest.get(r.id)?.created_at ?? null,
        last_touch_summary: latest.get(r.id)?.summary ?? null,
      })),
      error: null,
    };
  } catch {
    return base;
  }
}

export async function getCounts(): Promise<{
  applications: number;
  founders: number;
  sponsors: number;
  directory: number;
}> {
  const zero = { applications: 0, founders: 0, sponsors: 0, directory: 0 };
  try {
    const supabase = createAdminClient();
    const [a, f, s, d] = await Promise.all([
      supabase.from('applications').select('id', { count: 'exact', head: true }),
      supabase.from('founders').select('id', { count: 'exact', head: true }),
      supabase.from('sponsors').select('id', { count: 'exact', head: true }),
      supabase
        .from('locations')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null),
    ]);
    return {
      applications: a.count ?? 0,
      founders: f.count ?? 0,
      sponsors: s.count ?? 0,
      directory: d.count ?? 0,
    };
  } catch {
    return zero;
  }
}
