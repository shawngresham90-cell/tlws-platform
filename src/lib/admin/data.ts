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
  status: string;
  created_at: string;
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

export function getSponsors(): Promise<Result<SponsorRow>> {
  return fetchRows<SponsorRow>(
    'sponsors',
    'id, company, contact_name, email, phone, tier_interest, notes, status, created_at',
  );
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
