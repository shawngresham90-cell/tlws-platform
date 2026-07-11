import type { DirectoryEntry } from './types';
import type { DirectoryFacets } from './data';
import { DIRECTORY_CATEGORIES, categoryHref } from './categories';
import { stateByCode } from './states';
import { interstateSlug, exitSlug } from './interstates';
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
