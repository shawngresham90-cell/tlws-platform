import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { getCatScaleFacets } from '@/lib/directory/data';
import { stateByCode } from '@/lib/directory/states';

/**
 * "Find a scale fast" — the driver-first entry into the CAT Scale Browse
 * Route flow (State → Interstate → Direction → route-ordered list) plus the
 * Near Me mode. Server component, rendered only on /directory/cat-scales;
 * the hub page URL and its existing content/SEO are unchanged.
 */
export async function CatScaleFastFind() {
  const facets = await getCatScaleFacets();

  return (
    <Section className="border-b border-line">
      <div className="mx-auto w-full max-w-xl">
        <Eyebrow>Find a scale fast</Eyebrow>
        <h2 className="display-section">Where are you?</h2>
        <p className="mt-3 text-muted">
          Pick your state, then your interstate and direction — certified CAT Scales listed in route
          order. Or use your location to see the closest ones.
        </p>
        <div className="mt-5">
          <Link
            href="/directory/cat-scales/near-me"
            className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-card bg-signal px-4 font-display text-lg uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
          >
            <span aria-hidden="true">📍</span> Scales near me
          </Link>
        </div>
        {facets.states.length > 0 ? (
          <ul className="mt-6 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-5">
            {facets.states.map(({ code, count }) => (
              <li key={code}>
                <Link
                  href={`/directory/cat-scales/${code.toLowerCase()}`}
                  className="placard flex min-h-[64px] flex-col items-center justify-center p-2 text-center transition-colors hover:border-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                  title={stateByCode(code)?.name ?? code}
                >
                  <span className="font-display text-xl uppercase text-ink">{code}</span>
                  <span className="doc-caption text-muted">{count}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Section>
  );
}
