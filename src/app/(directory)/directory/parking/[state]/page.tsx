import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Section, Eyebrow } from '@/components/ui';
import { buildMetadata } from '@/lib/seo/metadata';
import { getParkingFacets } from '@/lib/directory/data';
import { stateByCode } from '@/lib/directory/states';
import { interstateToSlug } from '@/lib/directory/corridor';

export const revalidate = 300;

type Params = { state: string };

export async function generateMetadata({ params }: { params: Params }) {
  const state = stateByCode(params.state.toUpperCase());
  return buildMetadata({
    title: `Truck Parking in ${state?.name ?? params.state.toUpperCase()} by Interstate | Trucking Life with Shawn`,
    description: `Pick your interstate to see truck parking in ${state?.name ?? params.state.toUpperCase()} listed by exit number in your direction of travel.`,
    path: `/directory/parking/${params.state.toLowerCase()}`,
  });
}

/** Step 2 of Parking → State → Interstate → Direction: pick the interstate. */
export default async function ParkingStatePage({ params }: { params: Params }) {
  const code = params.state.toUpperCase();
  const state = stateByCode(code);
  if (!state) notFound();
  const facets = await getParkingFacets();
  const interstates = facets.interstatesByState[code] ?? [];

  return (
    <Section className="!py-10 sm:!py-14">
      <div className="mx-auto w-full max-w-xl">
        <Eyebrow>Find parking · {state.name}</Eyebrow>
        <h1 className="display-section">Which interstate?</h1>
        <p className="mt-3 text-muted">
          Pick the road you&rsquo;re on. Next you&rsquo;ll choose your direction of travel.
        </p>
        {interstates.length > 0 ? (
          <ul className="mt-6 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3">
            {interstates.map(({ designation, count }) => (
              <li key={designation}>
                <Link
                  href={`/directory/parking/${params.state.toLowerCase()}/${interstateToSlug(designation)}`}
                  className="placard flex min-h-[72px] flex-col items-center justify-center p-3 text-center transition-colors hover:border-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                >
                  <span className="font-display text-2xl uppercase text-ink">{designation}</span>
                  <span className="doc-caption text-muted">
                    {count} location{count === 1 ? '' : 's'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="placard mt-6 p-4 text-sm text-muted">
            No interstate-tagged truck parking in {state.name} yet. Try the full{' '}
            <Link
              className="text-signal underline-offset-4 hover:underline"
              href="/directory/parking"
            >
              parking directory
            </Link>
            .
          </p>
        )}
        <p className="doc-caption mt-8">
          <Link className="text-muted hover:text-signal" href="/directory/parking">
            ← All states
          </Link>
        </p>
      </div>
    </Section>
  );
}
