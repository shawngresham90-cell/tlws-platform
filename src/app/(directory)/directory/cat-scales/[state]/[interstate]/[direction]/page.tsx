import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Section, Eyebrow } from '@/components/ui';
import { buildMetadata } from '@/lib/seo/metadata';
import { stateByCode } from '@/lib/directory/states';
import { getCatScaleCorridorEntries } from '@/lib/directory/data';
import {
  interstateFromSlug,
  isCorridorDirection,
  directionsForInterstate,
} from '@/lib/directory/corridor';
import { CatScaleCorridorList } from '@/components/directory/CatScaleFlow';

export const revalidate = 300;

type Params = { state: string; interstate: string; direction: string };

export async function generateMetadata({ params }: { params: Params }) {
  const designation = interstateFromSlug(params.interstate) ?? params.interstate.toUpperCase();
  const state = stateByCode(params.state.toUpperCase());
  const dir = params.direction.charAt(0).toUpperCase() + params.direction.slice(1);
  return buildMetadata({
    title: `${designation} ${dir} CAT Scales in ${state?.name ?? params.state.toUpperCase()} | Trucking Life with Shawn`,
    description: `Certified CAT Scale locations on ${designation} ${params.direction} through ${state?.name ?? params.state.toUpperCase()}, listed in route order (verified mile marker where available, otherwise exit number).`,
    path: `/directory/cat-scales/${params.state.toLowerCase()}/${params.interstate.toLowerCase()}/${params.direction.toLowerCase()}`,
  });
}

/** Browse Route step 4: the ordered corridor list. */
export default async function CatScaleCorridorPage({ params }: { params: Params }) {
  const code = params.state.toUpperCase();
  const state = stateByCode(code);
  const designation = interstateFromSlug(params.interstate);
  const direction = params.direction.toLowerCase();
  if (!state || !designation || !isCorridorDirection(direction)) notFound();
  if (!directionsForInterstate(designation).includes(direction)) notFound();

  const entries = await getCatScaleCorridorEntries(code, designation);

  return (
    <Section className="!py-10 sm:!py-14">
      <div className="mx-auto w-full max-w-xl">
        <Eyebrow>
          CAT Scales · {state.name} · {designation} · {direction}
        </Eyebrow>
        <h1 className="display-section">Scales ahead</h1>
        <div className="mt-5">
          <CatScaleCorridorList entries={entries} direction={direction} />
        </div>
        <p className="doc-caption mt-8">
          <Link
            className="text-muted hover:text-signal"
            href={`/directory/cat-scales/${params.state.toLowerCase()}/${params.interstate.toLowerCase()}`}
          >
            ← Change direction
          </Link>{' '}
          ·{' '}
          <Link className="text-muted hover:text-signal" href="/directory/cat-scales">
            All states
          </Link>{' '}
          ·{' '}
          <Link className="text-muted hover:text-signal" href="/directory/cat-scales/near-me">
            Near me
          </Link>
        </p>
      </div>
    </Section>
  );
}
