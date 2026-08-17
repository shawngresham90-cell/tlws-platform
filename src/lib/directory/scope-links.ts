import type { DirectoryEntry } from './types';
import type { DirectoryFacets, ParkingFacets } from './data';
import { DIRECTORY_CATEGORIES, categoryHref } from './categories';
import { stateByCode } from './states';
import { interstateSlug, exitSlug } from './interstates';
import { interstateToSlug } from './corridor';
import { interstatesIn, adjacentExits, groupByCategory } from './related';
import type { RelatedLinkGroup } from '@/components/directory/RelatedLinks';
import { COMMUNITY_LINKS } from '@/components/directory/RelatedLinks';

/**
 * Per-scope "Keep exploring" link groups (Milestone 18 SEO). Pure functions:
 * pages hand in what they already fetched (entries + facets) and get back the
 * cross-links that make state ⇄ interstate ⇄ exit ⇄ category ⇄ community
 * pages one connected graph. Only links with real data behind them are
 * emitted — no links to empty pages.
 */

function stateLinks(facets: DirectoryFacets, excludeCode?: string) {
  return facets.states
    .filter((code) => code !== excludeCode?.toUpperCase())
    .map((code) => {
      const state = stateByCode(code);
      return state
        ? {
            href: `/directory/${state.slug}`,
            label: `${state.name} (${facets.countsByState[code] ?? 0})`,
          }
        : null;
    })
    .filter((l): l is { href: string; label: string } => Boolean(l));
}

function interstateLinks(designations: string[], facets: DirectoryFacets, exclude?: string) {
  return designations
    .filter((d) => d !== exclude)
    .map((d) => {
      const slug = interstateSlug(d);
      return slug
        ? {
            href: `/directory/${slug}`,
            label: `${d} corridor (${facets.countsByInterstate[d] ?? 0})`,
          }
        : null;
    })
    .filter((l): l is { href: string; label: string } => Boolean(l));
}

/** Categories present in this entry set, linked with in-scope counts. */
function categoryLinksFor(entries: DirectoryEntry[], scopeLabel: string) {
  const byCategory = groupByCategory(entries);
  return DIRECTORY_CATEGORIES.filter((c) => (byCategory[c.slug] ?? []).length > 0).map((c) => ({
    href: categoryHref(c),
    label: `${c.title} (${byCategory[c.slug].length} ${scopeLabel})`,
  }));
}

export function stateScopeLinks(
  stateName: string,
  stateCode: string,
  entries: DirectoryEntry[],
  facets: DirectoryFacets,
): RelatedLinkGroup[] {
  return [
    {
      heading: `Corridors through ${stateName}`,
      links: interstateLinks(interstatesIn(entries), facets),
    },
    { heading: `What's in ${stateName}`, links: categoryLinksFor(entries, `in ${stateName}`) },
    { heading: 'Other states with coverage', links: stateLinks(facets, stateCode) },
    COMMUNITY_LINKS,
  ];
}

export function interstateScopeLinks(
  designation: string,
  stateOrder: string[],
  entries: DirectoryEntry[],
  facets: DirectoryFacets,
): RelatedLinkGroup[] {
  const statesOnCorridor = new Set(entries.map((e) => e.state.toUpperCase()));
  const ordered = [
    ...stateOrder.filter((c) => statesOnCorridor.has(c)),
    ...[...statesOnCorridor].filter((c) => !stateOrder.includes(c)).sort(),
  ];
  return [
    {
      heading: `${designation} state by state`,
      links: ordered
        .map((code) => {
          const state = stateByCode(code);
          return state
            ? { href: `/directory/${state.slug}`, label: `${state.name} on ${designation}` }
            : null;
        })
        .filter((l): l is { href: string; label: string } => Boolean(l)),
    },
    {
      heading: `What's on ${designation}`,
      links: categoryLinksFor(entries, `on ${designation}`),
    },
    {
      heading: 'Other corridors',
      links: interstateLinks(facets.interstates, facets, designation),
    },
    COMMUNITY_LINKS,
  ];
}

export function exitScopeLinks(
  designation: string,
  islug: string,
  exit: string,
  allExits: string[],
  statesAtExit: string[],
  facets: DirectoryFacets,
): RelatedLinkGroup[] {
  const { previous, next } = adjacentExits(allExits, exit, 2);
  return [
    {
      heading: `Neighboring ${designation} exits`,
      links: [
        ...previous.map((e) => ({
          href: `/directory/${islug}/${exitSlug(e)}`,
          label: `← Exit ${e}`,
        })),
        ...next.map((e) => ({
          href: `/directory/${islug}/${exitSlug(e)}`,
          label: `Exit ${e} →`,
        })),
      ],
    },
    {
      heading: 'Zoom out',
      links: [
        { href: `/directory/${islug}`, label: `All of ${designation}` },
        ...statesAtExit
          .map((code) => {
            const state = stateByCode(code);
            return state
              ? { href: `/directory/${state.slug}`, label: `All of ${state.name}` }
              : null;
          })
          .filter((l): l is { href: string; label: string } => Boolean(l)),
      ],
    },
    COMMUNITY_LINKS,
  ];
}

export function categoryScopeLinks(facets: DirectoryFacets): RelatedLinkGroup[] {
  return [
    { heading: 'Browse by state', links: stateLinks(facets) },
    { heading: 'Browse by corridor', links: interstateLinks(facets.interstates, facets) },
    COMMUNITY_LINKS,
  ];
}

/* ----------------------------------------------------------------------
 * Engine ⇄ corridor-flow cross-links (SEO blueprint PR-C, 2026-08-17).
 *
 * The parking and CAT-scale flow trees used to hang off their two hub
 * blocks with no links to or from the engine pages. These helpers connect
 * them — and, like everything else in this module, a link renders ONLY when
 * the destination has real facet data behind it. An empty facet read (DB
 * hiccup, no coverage) simply renders no links; RelatedLinks drops empty
 * groups.
 * -------------------------------------------------------------------- */

/**
 * Flow-tree entry points for one state's engine page: the state's parking
 * and CAT-scale route flows, each only when that state actually appears in
 * the flow's facets.
 */
export function stateFlowLinks(
  stateName: string,
  stateCode: string,
  parkingFlow: ParkingFacets,
  catScaleFlow: ParkingFacets,
): RelatedLinkGroup {
  const code = stateCode.toUpperCase();
  const links: { href: string; label: string }[] = [];
  if (stateByCode(code)) {
    const parking = parkingFlow.states.find((s) => s.code === code);
    if (parking && parking.count > 0) {
      links.push({
        href: `/directory/parking/${code.toLowerCase()}`,
        label: `Truck parking by route (${parking.count})`,
      });
    }
    const scales = catScaleFlow.states.find((s) => s.code === code);
    if (scales && scales.count > 0) {
      links.push({
        href: `/directory/cat-scales/${code.toLowerCase()}`,
        label: `CAT Scales by route (${scales.count})`,
      });
    }
  }
  return { heading: `Plan a ${stateName} run`, links };
}

/**
 * Flow corridor steps for a corridor engine page: every state whose flow
 * facets carry this designation, for both flow trees. Nothing is emitted
 * for states or corridors the facets don't back.
 */
export function interstateFlowLinks(
  designation: string,
  parkingFlow: ParkingFacets,
  catScaleFlow: ParkingFacets,
): RelatedLinkGroup {
  const links: { href: string; label: string }[] = [];
  const collect = (base: string, flow: ParkingFacets, kind: string) => {
    for (const { code } of flow.states) {
      const state = stateByCode(code);
      if (!state) continue;
      const onCorridor = (flow.interstatesByState[code] ?? []).some(
        (i) => i.designation === designation,
      );
      if (onCorridor) {
        links.push({
          href: `${base}/${code.toLowerCase()}/${interstateToSlug(designation)}`,
          label: `${kind} through ${state.name}`,
        });
      }
    }
  };
  collect('/directory/parking', parkingFlow, 'Parking');
  collect('/directory/cat-scales', catScaleFlow, 'CAT Scales');
  return { heading: `${designation} by route & direction`, links };
}

/**
 * Return links from a flow page back to the engine pages that cover the
 * same listings. Validated through the state registry and the interstate
 * slug parser — an unknown code or non-I-nnn designation emits nothing.
 */
export function flowEngineReturnLinks(
  stateCode: string,
  designation?: string,
): { href: string; label: string }[] {
  const links: { href: string; label: string }[] = [];
  const state = stateByCode(stateCode.toUpperCase());
  if (state) {
    links.push({ href: `/directory/${state.slug}`, label: `All ${state.name} listings` });
  }
  if (designation) {
    const islug = interstateSlug(designation);
    if (islug) {
      links.push({ href: `/directory/${islug}`, label: `All of ${designation}` });
    }
  }
  return links;
}
