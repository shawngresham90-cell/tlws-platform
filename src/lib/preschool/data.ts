import { createStaticClient } from '@/lib/supabase/static';
import {
  sortWall,
  spotsFilled,
  spotsRemaining,
  type PublicFoundingStudent,
} from './founding-students';

/**
 * Founding Student Wall reader. Mirrors the founders-wall privacy pattern:
 * cookieless anon client (ISR-safe), selects ONLY the public columns, and
 * fails soft — any DB error (including migration 028 not being applied yet)
 * renders the clean "spots available" empty state instead of an error page.
 */

export type FoundingWall = {
  students: PublicFoundingStudent[];
  filled: number;
  remaining: number;
};

export const EMPTY_WALL: FoundingWall = {
  students: [],
  filled: spotsFilled(0),
  remaining: spotsRemaining(0),
};

export async function getFoundingWall(): Promise<FoundingWall> {
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('preschool_founding_students')
      .select('spot_number, display_name, is_anonymous, business_name, website_url')
      .eq('is_published', true);
    if (error || !data) return EMPTY_WALL;

    const students = sortWall(
      data.map((r) => ({
        spotNumber: r.spot_number,
        displayName: r.display_name ?? '',
        isAnonymous: Boolean(r.is_anonymous),
        businessName: r.business_name,
        websiteUrl: r.website_url,
      })),
    );
    return {
      students,
      filled: spotsFilled(students.length),
      remaining: spotsRemaining(students.length),
    };
  } catch {
    return EMPTY_WALL;
  }
}
