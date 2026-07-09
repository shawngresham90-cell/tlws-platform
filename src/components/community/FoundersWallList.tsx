import type { PublicFounder, FounderTier } from '@/lib/community/founders';
import { Button } from '@/components/ui';
import { FounderCard } from './FounderCard';
import { FOUNDER_TIERS, TIER_ORDER } from './tiers';

/**
 * The wall itself: founders grouped by tier (recognition order), newest first
 * within each tier. Renders an inviting empty state when no one has joined yet
 * so a fresh launch never shows a blank void.
 */
export function FoundersWallList({ founders }: { founders: PublicFounder[] }) {
  if (founders.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-asphalt-800 p-10 text-center">
        <p className="font-display text-2xl text-ink">The wall is waiting.</p>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Be the first founder. Your name goes right at the top — the driver who helped build this
          before anyone else did.
        </p>
        <div className="mt-6 flex justify-center">
          <Button href="#join">Become the first founder</Button>
        </div>
      </div>
    );
  }

  const byTier = new Map<FounderTier, PublicFounder[]>();
  for (const f of founders) {
    const list = byTier.get(f.tier) ?? [];
    list.push(f);
    byTier.set(f.tier, list);
  }

  const labelFor = new Map(FOUNDER_TIERS.map((t) => [t.value, t.label]));

  return (
    <div className="space-y-12">
      {TIER_ORDER.filter((tier) => byTier.has(tier)).map((tier) => (
        <div key={tier}>
          <h3 className="display-section mb-5 text-2xl">{labelFor.get(tier)}</h3>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(byTier.get(tier) ?? []).map((f) => (
              <FounderCard key={f.id} founder={f} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
