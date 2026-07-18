import { loadPlannerAnchors } from '@/lib/trip-planner/directory-loader';
import { buildMetadata } from '@/lib/seo/metadata';
import { TripPlannerApp } from '@/components/trip-planner/TripPlannerApp';

export const metadata = buildMetadata({
  title: 'Truck Trip Planner — HOS-Aware Route & Stop Planning | Trucking Life with Shawn',
  description:
    'Plan a truck trip around your Hours of Service: legal driving window, required breaks, overnight parking from the driver-built directory, route weather, and diesel price estimates.',
  path: '/trip-planner',
});

// Anchor list refreshes as the geocoded directory grows.
export const revalidate = 300;

/**
 * /trip-planner (Phase 4) — mobile-first, driver-in-the-truck UI over the
 * planning engine. Server component only loads the origin/destination
 * anchors; everything else happens through POST /api/trip-planner/quote.
 */
export default async function TripPlannerPage() {
  const anchors = await loadPlannerAnchors();
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <h1 className="font-display text-3xl uppercase tracking-wide text-ink">Trip Planner</h1>
      <p className="mt-1 text-sm text-muted">
        HOS-aware planning: where your clocks run out, where to take the break, and where to park —
        anchored to verified directory locations.
      </p>
      <TripPlannerApp anchors={anchors} />
    </main>
  );
}
