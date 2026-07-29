import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Section, Eyebrow } from '@/components/ui';
import { buildMetadata } from '@/lib/seo/metadata';
import { stateByCode } from '@/lib/directory/states';
import { directionsForInterstate, interstateFromSlug } from '@/lib/directory/corridor';

export const revalidate = 300;

type Params = { state: string; interstate: string };

const DIRECTION_ARROWS: Record<string, string> = {
  northbound: '↑',
  southbound: '↓',
  eastbound: '→',
  westbound: '←',
};

export async function generateMetadata({ params }: { params: Params }) {
  const designation = interstateFromSlug(params.interstate) ?? params.interstate.toUpperCase();
  const state = stateByCode(params.state.toUpperCase());
  return buildMetadata({
    title: `${designation} CAT Scales in ${state?.name ?? params.state.toUpperCase()} — Choose Direction | Trucking Life with Shawn`,
    description: `Choose your direction of travel on ${designation} in ${state?.name ?? params.state.toUpperCase()} to see certified CAT Scale locations in route order.`,
    path: `/directory/cat-scales/${params.state.toLowerCase()}/${params.interstate.toLowerCase()}`,
  });
}

/** Browse Route step 3: pick the direction (only the two real ones). */
export default async function CatScaleDirectionPickerPage({ params }: { params: Params }) {
  const code = params.state.toUpperCase();
  const state = stateByCode(code);
  const designation = interstateFromSlug(params.interstate);
  if (!state || !designation) notFound();
  const directions = directionsForInterstate(designation);

  return (
    <Section className="!py-10 sm:!py-14">
      <div className="mx-auto w-full max-w-xl">
        <Eyebrow>
          CAT Scales · {state.name} · {designation}
        </Eyebrow>
        <h1 className="display-section">Which direction are you headed?</h1>
        <p className="mt-3 text-muted">
          Direction sets the order of the list — the next scale ahead of you comes first.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {directions.map((direction) => (
            <Link
              key={direction}
              href={`/directory/cat-scales/${params.state.toLowerCase()}/${params.interstate.toLowerCase()}/${direction}`}
              className="placard flex min-h-[88px] items-center justify-center gap-3 p-4 transition-colors hover:border-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              <span aria-hidden="true" className="font-display text-3xl text-signal">
                {DIRECTION_ARROWS[direction]}
              </span>
              <span className="font-display text-2xl uppercase text-ink">{direction}</span>
            </Link>
          ))}
        </div>
        <p className="doc-caption mt-8">
          <Link
            className="text-muted hover:text-signal"
            href={`/directory/cat-scales/${params.state.toLowerCase()}`}
          >
            ← {state.name} interstates
          </Link>
        </p>
      </div>
    </Section>
  );
}
