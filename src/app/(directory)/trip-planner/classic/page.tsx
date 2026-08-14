import { loadPlannerAnchors } from '@/lib/trip-planner/directory-loader';
import { buildMetadata } from '@/lib/seo/metadata';
import { TripPlannerApp } from '@/components/trip-planner/TripPlannerApp';

export const metadata = buildMetadata({
  title: 'Classic Cost Planner — Trip Cost & Stop Estimates | Trucking Life with Shawn',
  description:
    'The original trip cost planner: distance and fuel estimates, directory stops, route weather and diesel prices. Plan My Day, the HOS-aware planner, is at /trip-planner.',
  path: '/trip-planner/classic',
});

// Anchor list refreshes as the geocoded directory grows.
export const revalidate = 300;

/**
 * /trip-planner/classic — the original Phase 4 cost planner, preserved.
 *
 * Plan My Day took over /trip-planner in Phase 1 of the Trip Planner
 * rebuild. This screen was NOT deleted: it still answers questions Plan My
 * Day does not (fuel cost, saved trips, the cloud sync), and drivers who
 * had it bookmarked keep it. Which of the two survives long-term is a
 * Phase 2 decision, deliberately not made by this milestone.
 */
export default async function TripPlannerPage() {
  const anchors = await loadPlannerAnchors();
  return (
    // The root layout already provides the page's main landmark; nesting a
    // second one here gave the document two mains and no unique name for
    // either. A plain wrapper is all this needs.
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <h1 className="font-display text-3xl uppercase tracking-wide text-ink">
        Classic Cost Planner
      </h1>
      <p className="mt-1 text-base text-muted">
        Trip cost and stop estimates. For the HOS-aware plan — where your clock runs out, where to
        break, and three parking options you can safely reach —{' '}
        <a className="underline decoration-line underline-offset-4" href="/trip-planner">
          open Plan My Day
        </a>
        .
      </p>
      <TripPlannerApp anchors={anchors} />
    </div>
  );
}
