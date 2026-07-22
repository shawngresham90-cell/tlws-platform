import { createClient } from '@/lib/supabase/server';
import { TEST_CATALOG } from '@/lib/tests/catalog';

/**
 * Live proof bar (blueprint §4 S2). Standing rule: no number renders here
 * unless it is real and current — live figures come straight from the
 * database and individually drop out on failure instead of showing a stale
 * or invented value. Static figures are repo-verified brand facts.
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
      <div className="mx-auto grid max-w-content grid-cols-2 gap-px px-5 motion-safe:animate-fade-up sm:px-8 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="py-6 text-center">
            <p className="num-data font-display text-3xl uppercase text-signal sm:text-4xl">
              {s.value}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
