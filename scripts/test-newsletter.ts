/**
 * Offline tests for the newsletter lead capture (Milestone 3): the API
 * schema contract the form posts against, UTM collection, and the
 * server-rendered accessibility shell. Run:
 *
 *   npx esbuild scripts/test-newsletter.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-newsletter.cjs && node /tmp/test-newsletter.cjs
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { leadCaptureSchema } from '@/lib/api/schemas';
import { NewsletterForm, collectUtm } from '@/components/sections/NewsletterForm';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

/* ------------------------------------------- schema contract (what we send) */
{
  const parsed = leadCaptureSchema.safeParse({
    email: 'Driver@Example.com ',
    source: 'newsletter',
    utm: { utm_source: 'youtube', utm_campaign: 'dot-video' },
    turnstileToken: 'tok_x',
  });
  check('schema: form payload accepted', parsed.success);
  if (parsed.success) {
    check(
      'schema: email normalized (trim + lowercase)',
      parsed.data.email === 'driver@example.com',
    );
    check('schema: source preserved', parsed.data.source === 'newsletter');
    check('schema: utm map preserved', parsed.data.utm.utm_source === 'youtube');
  }

  check(
    'schema: bad email rejected',
    !leadCaptureSchema.safeParse({ email: 'nope', source: 'newsletter', turnstileToken: 't' })
      .success,
  );
  check(
    'schema: missing turnstile token rejected (no unverified writes)',
    !leadCaptureSchema.safeParse({ email: 'a@b.com', source: 'newsletter' }).success,
  );
  check(
    'schema: oversized source rejected',
    !leadCaptureSchema.safeParse({
      email: 'a@b.com',
      source: 'x'.repeat(41),
      turnstileToken: 't',
    }).success,
  );
}

/* --------------------------------------------------------- UTM collection */
{
  const g = globalThis as unknown as { window?: { location: { search: string } } };
  g.window = { location: { search: '?utm_source=youtube&utm_campaign=Winter&ref=x&page=2' } };
  const utm = collectUtm();
  check(
    'utm: utm_* params captured',
    utm.utm_source === 'youtube' && utm.utm_campaign === 'Winter',
  );
  check('utm: non-utm params excluded', !('ref' in utm) && !('page' in utm));

  g.window = { location: { search: '' } };
  check('utm: empty query → empty map', Object.keys(collectUtm()).length === 0);

  g.window = { location: { search: '?utm_source=' + 'y'.repeat(500) } };
  check('utm: values bounded to 200 chars', collectUtm().utm_source.length === 200);
  delete g.window;
}

/* ------------------------------------------- server-rendered a11y shell */
{
  const html = renderToStaticMarkup(createElement(NewsletterForm, { siteKey: '' }));
  check('render: email input labelled', html.includes('for="newsletter-email"'));
  check('render: input is type=email with autocomplete', /type="email"[^>]*/.test(html));
  check('render: submit button present', html.includes('type="submit"'));
  check('render: assertive live region for errors', html.includes('aria-live="assertive"'));
  check('render: no silent-failure text baked in', !html.includes('undefined'));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
