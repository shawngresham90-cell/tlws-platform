import { createClient } from '@/lib/supabase/server';
import { TEST_CATALOG } from '@/lib/tests/catalog';
import { MileMarker } from '@/components/ui';

/**
 * Live proof bar (blueprint §4 S2). Standing rule: no number renders here
 * unless it is real and current — live figures come straight from the
 * database and individually drop out on failure instead of showing a stale
 * or invented value. Static figures are repo-verified brand facts.
 *
 * Rendered as mile-marker posts (Night Haul §1.3): green roadside posts, the
 * road's own idiom for "distance covered." Green, not amber — proof is
 * wayfinding, not a money action, and this row used to spend 2–4 amber
 * numerals of the one-amber-per-viewport budget on it. The flex-wrap row
 * also ends the ragged orphan cell the old 2/4-column grid produced when a
 * live stat dropped out and three cells remained.
 */
type Stat = { value: string; label: string };

async function getLiveStats(): Promise<Stat[]> {
  const stats: Stat[] = [];
  try {
    const supabase = createClient();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const [kc, campaign] = await Promise.all([
      supabase
        .from('kc_articles')
        .select('id', { count: 'exact', head: true })
        .abortSignal(controller.signal),
      supabase
        .from('campaign_progress')
        .select('founder_count')
        .abortSignal(controller.signal)
        .single(),
    ]);
    clearTimeout(timer);

    if (kc.count && kc.count > 0) {
      stats.push({ value: String(kc.count), label: 'Free guides' });
    }
    const founders = Number(campaign.data?.founder_count) || 0;
    if (founders > 0) {
      stats.push({ value: String(founders), label: 'Founders backing the school' });
    }
  } catch {
    /* fail-soft: live numbers simply don't render */
  }
  return stats;
}

export async function ProofBar() {
  const live = await getLiveStats();
  const stats: Stat[] = [
    // Repo-verified brand facts (see FeaturedVideos + tests catalog).
    { value: '84K+', label: 'YouTube family' },
    { value: String(TEST_CATALOG.length), label: 'Free practice tests' },
    ...live,
  ];

  return (
    <section aria-label="Platform numbers" className="border-b border-line bg-asphalt-800">
      <div className="mx-auto flex max-w-content flex-wrap justify-center gap-3 px-5 py-6 motion-safe:animate-fade-up sm:gap-4 sm:px-8">
        {stats.map((s) => (
          <MileMarker
            key={s.label}
            value={s.value}
            label={s.label}
            className="min-w-[9.5rem] flex-1 sm:max-w-[14rem]"
          />
        ))}
      </div>
    </section>
  );
}
