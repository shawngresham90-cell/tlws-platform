import { createStaticClient } from '@/lib/supabase/static';
import { activeSponsorsFor, type Sponsor, type SponsorContext, type SponsorPlacement } from './sponsors';

/**
 * Sponsor data reader (Milestone 25). Reads only ACTIVE rows via the cookieless
 * anon client (RLS also restricts anon to active rows). Fails soft to [] on any
 * error — crucially, that INCLUDES the table not existing yet: migration 024 is
 * committed but unapplied, so in production this returns [] and every sponsor
 * slot renders its graceful empty state. No writes, ever, from this path.
 */

type SponsorRow = {
  id: string;
  name: string;
  tagline: string | null;
  url: string;
  logo: string | null;
  placements: string[] | null;
  states: string[] | null;
  interstates: string[] | null;
  categories: string[] | null;
  active: boolean | null;
  starts_at: string | null;
  ends_at: string | null;
};

function toSponsor(row: SponsorRow): Sponsor {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline ?? undefined,
    url: row.url,
    logo: row.logo ?? undefined,
    placements: (row.placements ?? []) as SponsorPlacement[],
    states: row.states ?? undefined,
    interstates: row.interstates ?? undefined,
    categories: row.categories ?? undefined,
    active: row.active ?? false,
    startsAt: row.starts_at ?? undefined,
    endsAt: row.ends_at ?? undefined,
  };
}

export async function getSponsorsFor(ctx: SponsorContext): Promise<Sponsor[]> {
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('directory_sponsors')
      .select('id, name, tagline, url, logo, placements, states, interstates, categories, active, starts_at, ends_at')
      .eq('active', true)
      .limit(100);
    if (error || !data) return [];
    return activeSponsorsFor((data as unknown as SponsorRow[]).map(toSponsor), ctx);
  } catch {
    return [];
  }
}

/** Convenience for pages that only know their placement. */
export function sponsorContext(
  placement: SponsorPlacement,
  scope?: { state?: string; interstate?: string; category?: string },
): SponsorContext {
  return { placement, ...scope };
}
