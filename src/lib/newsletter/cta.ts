import { isPending, resolveCopy, type Copy } from './approval';

/**
 * Call-to-action rules for an issue.
 *
 * ONE PRIMARY, AT MOST ONE SECONDARY. Not a style preference. An issue that
 * asks for three things gets none of them, and more concretely: this newsletter
 * can ask a reader to apply to the Academy, buy a guide, or claim a directory
 * listing, and those are different funnels with different money attached. If an
 * issue carries two of them at equal weight, neither the reader nor the
 * analytics can tell which one the issue was for.
 *
 * WHAT COUNTS AS CONFLICTING. Three distinct cases, because they fail in
 * different ways:
 *
 *   1. Two CTAs pointing at the SAME destination. Reads as a rendering bug and
 *      splits click attribution across two buttons for one action.
 *   2. Two CTAs both asking for money or a commitment. The secondary is meant
 *      to be a low-cost alternative for the reader who is not ready for the
 *      primary — a second ask is not an alternative, it is competition.
 *   3. A secondary that outranks its primary. If the softer action is the
 *      Academy application and the headline action is a $19 guide, the issue is
 *      pointed at the wrong thing regardless of which one is labelled primary.
 */

/**
 * What a CTA is asking for. The intent, not the URL, is what decides whether
 * two CTAs conflict — two links to different Stan products are still two
 * purchase asks.
 */
export const CTA_INTENTS = ['read', 'use-tool', 'watch', 'subscribe', 'purchase', 'apply'] as const;
export type CtaIntent = (typeof CTA_INTENTS)[number];

/**
 * Asks that cost the reader money or a real commitment. Two of these in one
 * issue is the conflict case that matters.
 */
const COMMITTING_INTENTS: readonly CtaIntent[] = ['purchase', 'apply'];

/** Rank for the outranking check. Higher means a bigger ask. */
const INTENT_WEIGHT: Record<CtaIntent, number> = {
  read: 1,
  watch: 1,
  'use-tool': 2,
  subscribe: 3,
  purchase: 4,
  apply: 5,
};

export type Cta = {
  label: Copy;
  href: Copy;
  intent: CtaIntent;
};

export type IssueCtas = {
  primary: Cta;
  secondary?: Cta;
};

export type CtaProblem = { code: string; detail: string };

/** Compare destinations ignoring case, trailing slash and tracking parameters. */
function canonicalHref(href: string): string {
  try {
    const url = new URL(href);
    // utm_* params are how the same destination ends up looking like two.
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key);
    }
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}`.toLowerCase();
  } catch {
    return href.trim().replace(/\/+$/, '').toLowerCase();
  }
}

function checkOne(cta: Cta, role: 'primary' | 'secondary'): CtaProblem[] {
  const problems: CtaProblem[] = [];
  const label = resolveCopy(cta.label);
  const href = resolveCopy(cta.href);

  if (!isPending(cta.label) && label.trim().length === 0) {
    problems.push({ code: 'cta_label_blank', detail: `The ${role} CTA has no label.` });
  }
  if (!isPending(cta.href)) {
    try {
      const url = new URL(href);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        problems.push({
          code: 'cta_href_not_web',
          detail: `The ${role} CTA link is not an http(s) URL: ${href}`,
        });
      }
    } catch {
      problems.push({
        code: 'cta_href_invalid',
        detail: `The ${role} CTA link is not an absolute URL: ${href}. Email clients cannot resolve a relative link — there is no page for it to be relative to.`,
      });
    }
  }
  if (!(CTA_INTENTS as readonly string[]).includes(cta.intent)) {
    problems.push({
      code: 'cta_intent_unknown',
      detail: `The ${role} CTA has an unrecognised intent ${JSON.stringify(cta.intent)}.`,
    });
  }
  return problems;
}

/**
 * Validate an issue's CTAs. Returns every problem, not the first.
 *
 * Takes `unknown` for the same reason `validateProvenance` does: the values
 * worth checking are the ones the type system did not already vouch for.
 */
export function validateCtas(value: unknown): CtaProblem[] {
  if (typeof value !== 'object' || value === null) {
    return [
      { code: 'cta_missing', detail: 'The issue has no CTAs. Every issue needs one primary.' },
    ];
  }
  const ctas = value as { primary?: Cta; secondary?: Cta };

  if (!ctas.primary || typeof ctas.primary !== 'object') {
    return [
      {
        code: 'cta_primary_missing',
        detail:
          'Every issue needs exactly one primary CTA. An issue that asks for nothing is a newsletter nobody acts on.',
      },
    ];
  }

  const problems = [...checkOne(ctas.primary, 'primary')];
  if (!ctas.secondary) return problems;

  problems.push(...checkOne(ctas.secondary, 'secondary'));

  const primaryHref = resolveCopy(ctas.primary.href);
  const secondaryHref = resolveCopy(ctas.secondary.href);

  // 1. Same destination twice.
  if (
    !isPending(ctas.primary.href) &&
    !isPending(ctas.secondary.href) &&
    canonicalHref(primaryHref) === canonicalHref(secondaryHref)
  ) {
    problems.push({
      code: 'cta_duplicate_destination',
      detail:
        'Both CTAs point at the same destination. Reads as a bug, and splits click attribution across two buttons for one action.',
    });
  }

  // 2. Two committing asks.
  if (
    COMMITTING_INTENTS.includes(ctas.primary.intent) &&
    COMMITTING_INTENTS.includes(ctas.secondary.intent)
  ) {
    problems.push({
      code: 'cta_competing_asks',
      detail: `Both CTAs ask for a commitment (${ctas.primary.intent} and ${ctas.secondary.intent}). The secondary is meant to be a lower-cost alternative, not a second ask competing with the first.`,
    });
  }

  // 3. Secondary outranks primary.
  const primaryWeight = INTENT_WEIGHT[ctas.primary.intent] ?? 0;
  const secondaryWeight = INTENT_WEIGHT[ctas.secondary.intent] ?? 0;
  if (secondaryWeight > primaryWeight) {
    problems.push({
      code: 'cta_secondary_outranks_primary',
      detail: `The secondary CTA (${ctas.secondary.intent}) is a bigger ask than the primary (${ctas.primary.intent}). Whichever is labelled primary, the issue is pointed at the wrong thing.`,
    });
  }

  return problems;
}
