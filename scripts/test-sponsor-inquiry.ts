/**
 * Offline tests for the /sponsors front door (Milestone 7): the inquiry
 * schema contract the form posts against, and the server-rendered
 * accessibility shell. No network, no database. Run:
 *
 *   npx esbuild scripts/test-sponsor-inquiry.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-sponsor-inquiry.cjs && node /tmp/test-sponsor-inquiry.cjs
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sponsorInquirySchema } from '@/lib/api/schemas';
import { SponsorInquiryForm } from '@/components/sponsors/SponsorInquiryForm';
import { SPONSOR_PLACEMENTS } from '@/lib/directory/sponsors';

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
  const parsed = sponsorInquirySchema.safeParse({
    company: 'Big Rig Supply Co',
    contact_name: 'Pat',
    email: 'Pat@BigRig.com',
    phone: '(555) 555-5555',
    tier_interest: 'founding-sponsor',
    message: 'Interested in the directory.',
    turnstileToken: 'tok_x',
  });
  check('schema: full payload accepted', parsed.success);
  if (parsed.success) {
    check('schema: email normalized', parsed.data.email === 'pat@bigrig.com');
  }

  const minimal = sponsorInquirySchema.safeParse({
    company: 'Solo LLC',
    email: 'a@b.com',
    turnstileToken: 't',
  });
  check('schema: minimal payload (company + email) accepted', minimal.success);

  check(
    'schema: missing company rejected',
    !sponsorInquirySchema.safeParse({ email: 'a@b.com', turnstileToken: 't' }).success,
  );
  check(
    'schema: missing turnstile token rejected (no unverified writes)',
    !sponsorInquirySchema.safeParse({ company: 'X', email: 'a@b.com' }).success,
  );
  check(
    'schema: oversized message rejected',
    !sponsorInquirySchema.safeParse({
      company: 'X',
      email: 'a@b.com',
      message: 'm'.repeat(2001),
      turnstileToken: 't',
    }).success,
  );
}

/* ------------------------------------------- server-rendered a11y shell */
{
  const html = renderToStaticMarkup(createElement(SponsorInquiryForm, { siteKey: '' }));
  check('render: company field labelled', html.includes('sponsor_company'));
  check('render: email field labelled', html.includes('sponsor_email'));
  check('render: message textarea labelled', html.includes('for="sponsor_message"'));
  check('render: submit button present', html.includes('type="submit"'));
  check('render: assertive live region for errors', html.includes('aria-live="assertive"'));
  check(
    'render: no committed pricing anywhere',
    !/\$\d/.test(html) && html.includes('no rate is committed'),
  );
}

/* ------------------------------------------------- placement inventory */
{
  check('placements: all six defined slots present', SPONSOR_PLACEMENTS.length === 6);
  check(
    'placements: every slot has a label',
    SPONSOR_PLACEMENTS.every((p) => p.label.length > 0),
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
