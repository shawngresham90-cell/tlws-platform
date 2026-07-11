import Link from 'next/link';
import { Suspense } from 'react';
import { Section, Eyebrow } from '@/components/ui';
import { ReviewForm } from '@/components/community/ReviewForm';
import { ReviewList } from '@/components/community/ReviewList';
import { getListingRefs, getRecentApprovedReviews } from '@/lib/community/data';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Driver Reviews — Rate Truck Stops, Parking & Services | Trucking Life with Shawn',
  description:
    'Real reviews from real drivers: rate truck stops, parking, scales, washes, and services in the directory. Every review is human-moderated before it goes live.',
  path: '/directory/reviews',
});

// Static with periodic refresh — newly APPROVED reviews surface within
// minutes; pending reviews are filtered out at the query and never render.
export const revalidate = 300;

export default async function ReviewsPage() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  const [listings, reviews] = await Promise.all([getListingRefs(), getRecentApprovedReviews(20)]);

  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Directory', path: '/directory' },
          { name: 'Driver Reviews', path: '/directory/reviews' },
        ])}
      />

      <Section className="border-b border-line">
        <div className="max-w-2xl">
          <Eyebrow>Driver Community</Eyebrow>
          <h1 className="display-section">Drivers rate the road</h1>
          <p className="mt-4 text-muted">
            The fuel desk doesn’t write these — drivers do. Rate the stops in the directory so the
            next driver knows what’s really at the exit. Every review is read by a human before it
            goes live.
          </p>
          <p className="mt-3 text-sm text-muted">
            Spot a wrong listing or a closed business?{' '}
            <Link href="/directory/submit" className="font-semibold text-signal hover:underline">
              Report it here →
            </Link>
          </p>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div>
            <h2 className="font-display text-2xl uppercase text-ink">Write a review</h2>
            <div className="mt-4">
              {/* Suspense: the form reads ?listing= via useSearchParams to
                  preselect the listing a detail page linked from. */}
              <Suspense fallback={null}>
                <ReviewForm siteKey={siteKey} listings={listings} />
              </Suspense>
            </div>
          </div>
          <div>
            <h2 className="font-display text-2xl uppercase text-ink">Latest driver reviews</h2>
            <div className="mt-4">
              <ReviewList reviews={reviews} />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
