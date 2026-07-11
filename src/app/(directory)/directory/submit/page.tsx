import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { SubmitLocationForm } from '@/components/community/SubmitLocationForm';
import { getListingRefs } from '@/lib/community/data';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Submit a Location or Report a Change | Trucking Life with Shawn',
  description:
    'Drivers keep this directory honest. Submit a new truck stop, parking spot, or service — or report corrections, closures, and amenity changes. Every report is reviewed before it goes live.',
  path: '/directory/submit',
});

// Static with periodic refresh: the only data baked in is the published
// listing picker, which should track imports without a redeploy.
export const revalidate = 300;

export default async function SubmitPage() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  const listings = await getListingRefs();

  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Directory', path: '/directory' },
          { name: 'Submit a Location', path: '/directory/submit' },
        ])}
      />

      <Section className="border-b border-line">
        <div className="max-w-2xl">
          <Eyebrow>Driver Community</Eyebrow>
          <h1 className="display-section">You’re the eyes on the road</h1>
          <p className="mt-4 text-muted">
            Found a spot we don’t list? A wrong phone number? A truck stop that shut down? Send it
            in. Every report goes through human review before the directory changes — nothing
            publishes automatically, so bad data can’t sneak in.
          </p>
          <p className="mt-3 text-sm text-muted">
            Want to rate a stop instead?{' '}
            <Link href="/directory/reviews" className="font-semibold text-signal hover:underline">
              Leave a driver review →
            </Link>
          </p>
        </div>

        <div className="mt-10 max-w-3xl">
          <SubmitLocationForm siteKey={siteKey} listings={listings} />
        </div>
      </Section>
    </>
  );
}
