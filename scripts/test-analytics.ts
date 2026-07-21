/**
 * Offline tests for the analytics activation (Milestone 1). No network:
 * exercises the trackEvent dispatcher against stubbed vendor globals and the
 * PlausibleAnalytics loader's env gating. Run:
 *
 *   npx esbuild scripts/test-analytics.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-analytics.cjs && node /tmp/test-analytics.cjs
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { trackEvent } from '@/lib/analytics';
import { PlausibleAnalytics } from '@/components/analytics/PlausibleAnalytics';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

type AnyWindow = Record<string, unknown>;
const g = globalThis as unknown as { window?: AnyWindow };

/* ------------------------------------------------ no vendor: silent no-op */
{
  g.window = {};
  let threw = false;
  try {
    trackEvent('application_started', { step: 1 });
  } catch {
    threw = true;
  }
  check('dispatcher: no vendor present → no throw, no side effects', !threw);
}

/* --------------------------------------------- plausible receives events */
{
  const calls: Array<{ name: string; opts?: { props?: Record<string, unknown> } }> = [];
  g.window = {
    plausible: (name: string, opts?: { props?: Record<string, unknown> }) =>
      calls.push({ name, opts }),
  };
  trackEvent('practice_test_completed', { bank: 'general-knowledge', score: 88 });
  trackEvent('newsletter_lead_captured');
  check('dispatcher: event name delivered verbatim', calls[0]?.name === 'practice_test_completed');
  check(
    'dispatcher: payload delivered under props (unchanged shape)',
    calls[0]?.opts?.props?.bank === 'general-knowledge' && calls[0]?.opts?.props?.score === 88,
  );
  check('dispatcher: prop-less event omits opts', calls[1]?.opts === undefined);
}

/* -------------------------------------- queue shim: pre-load events kept */
{
  // Hand-written equivalent of the shipped QUEUE_SHIM string (same logic,
  // same property names) — fire an event before the "vendor" would load.
  const w = {} as AnyWindow & {
    plausible?: ((...a: unknown[]) => void) & { q?: unknown[][] };
  };
  g.window = w;
  w.plausible =
    w.plausible ||
    function (...args: unknown[]) {
      const p = w.plausible as { q?: unknown[][] };
      (p.q = p.q || []).push(args);
    };
  trackEvent('application_submitted', { program: 'academy' });
  const q = (w.plausible as { q?: IArguments[] }).q;
  check(
    'queue shim: event queued before vendor script arrives',
    Array.isArray(q) && q.length === 1,
  );
  check(
    'queue shim: queued call preserves name + props',
    q?.[0]?.[0] === 'application_submitted' &&
      (q?.[0]?.[1] as { props?: { program?: string } })?.props?.program === 'academy',
  );
}

/* ----------------------------------------- dataLayer fan-out (unchanged) */
{
  const layer: Record<string, unknown>[] = [];
  g.window = { dataLayer: layer };
  trackEvent('store_amazon_cta_click', { slug: 'x' });
  check(
    'dispatcher: dataLayer fan-out intact (GTM-compatible, unused by default)',
    layer.length === 1 && layer[0].event === 'store_amazon_cta_click' && layer[0].slug === 'x',
  );
}

/* ---------------------------------------------- loader: env gating (SSR) */
{
  delete (g as { window?: unknown }).window;
  // The component reads the env var on every call, so one static import
  // covers both states — flip the env between invocations.
  delete process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  check('loader: env unset → renders null (zero bytes)', PlausibleAnalytics() === null);

  process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = 'truckinglifewithshawn.com';
  const el = PlausibleAnalytics();
  const html = el === null ? '' : renderToStaticMarkup(el);
  check(
    'loader: env set → emits the shim + plausible script',
    el !== null && html.includes('plausible.io/js/script.js'),
  );
  check(
    'loader: data-domain carries the configured domain',
    html.includes('truckinglifewithshawn.com'),
  );
  check(
    'loader: no secret-looking values in output',
    !/key|token|secret/i.test(html.replace(/plausible/gi, '')),
  );

  // Restore the pre-test state so later suites see an unset env.
  delete process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
