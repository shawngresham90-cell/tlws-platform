import { loadPlannerAnchors } from '@/lib/trip-planner/directory-loader';
import { buildMetadata } from '@/lib/seo/metadata';
import { PlanMyDayApp } from '@/components/trip-planner/PlanMyDayApp';

export const metadata = buildMetadata({
  title: 'Plan My Day — HOS-Aware Truck Trip Planner | Trucking Life with Shawn',
  description:
    'Plan your day around your real clocks: traffic-aware truck route, where your driving time runs out, where the 30-minute break belongs, and parking you can safely reach before your buffer is gone.',
  path: '/trip-planner',
});

// Anchor list refreshes as the geocoded directory grows.
export const revalidate = 300;

/**
 * /trip-planner — Plan My Day (Trip Planner Phase 1).
 *
 * The one honest planning path: confirm the truck, say where you are and
 * where you are going, enter the clocks your ELD actually shows, pick a
 * safety buffer, and get back a traffic-aware plan that refuses to guess.
 *
 * The original cost planner was NOT deleted — it lives at
 * /trip-planner/classic and is linked from the screen below.
 */
export default async function TripPlannerPage() {
  const anchors = await loadPlannerAnchors();
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <h1 className="font-display text-3xl uppercase tracking-wide text-ink">Plan My Day</h1>
      <p className="mt-1 text-base text-muted">
        Where your driving time runs out, where the break belongs, and parking you can actually
        reach — planned around the clocks you enter.
      </p>
      <PlanMyDayApp anchors={anchors} />
    </div>
  );
}
