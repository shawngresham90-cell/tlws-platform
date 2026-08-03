/**
 * The Road Report — template rendering, send gating, and the safety properties.
 *
 * Offline by contract, like every harness here: no network, no database, no
 * provider. That is not a limitation for this module — the renderer and the
 * send gate are both pure functions, which is the reason they were written that
 * way. A send gate nobody can test is a send gate nobody should trust.
 *
 * The load-bearing assertions are the negative ones: that a draft cannot be
 * sent, that unapproved copy blocks a send, that no code path reaches a
 * transport capable of delivery. Those are the ones that would matter at 11pm
 * before a real send.
 *
 *   npx esbuild scripts/test-road-report.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/t.cjs && node /tmp/t.cjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import {
  OWNER_APPROVAL_MARKER,
  findPendingCopy,
  hasPendingCopy,
  isPending,
  pending,
  resolveCopy,
} from '@/lib/newsletter/approval';
import { ROAD_REPORT, SENDER } from '@/lib/newsletter/brand';
import { renderEmail, type NewsletterEmail } from '@/lib/newsletter/render';
import { WELCOME_SERIES } from '@/lib/newsletter/campaigns/welcome';
import { dryRunTransport, listHeaders } from '@/lib/newsletter/transport';
import {
  PRODUCTION_CONFIRMATION_PHRASE,
  buildAuditEntry,
  evaluateSendReadiness,
  type SendReadinessInput,
} from '@/lib/newsletter/send-workflow';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const CTX = {
  unsubscribeUrl: 'https://truckinglifewithshawn.com/unsubscribe?token=TEST',
  recipientName: 'Marcus',
};
const rendered = WELCOME_SERIES.map((e) => renderEmail(e, CTX));

/* ── 1. Every template renders, in both parts ────────────────────────────── */

check('the welcome series has four emails', WELCOME_SERIES.length === 4, WELCOME_SERIES.length);
check(
  'every slug is unique',
  new Set(WELCOME_SERIES.map((e) => e.slug)).size === WELCOME_SERIES.length,
);

for (const r of rendered) {
  check(`${r.slug} renders HTML`, r.html.length > 500, r.html.length);
  check(`${r.slug} renders a plain-text part`, r.text.length > 300, r.text.length);
  check(`${r.slug} has a subject`, r.subject.trim().length > 0);
  check(`${r.slug} has preview text`, r.previewText.trim().length > 0);
  check(`${r.slug} is a complete document`, r.html.startsWith('<!doctype html>'));
  check(`${r.slug} declares a language`, r.html.includes('<html lang="en"'));

  // The plain-text part must be genuine prose, not the HTML with tags removed.
  check(
    `${r.slug} plain text carries no markup`,
    !/<[a-z][^>]*>/i.test(r.text),
    r.text.slice(0, 80),
  );
  check(`${r.slug} plain text carries no HTML entities`, !/&[a-z]+;|&#\d+;/i.test(r.text));
}

/* ── 2. The footer and unsubscribe link cannot be omitted ────────────────── */

// Structural, not per-template: renderEmail appends them, so a new template
// cannot forget. Asserted for every email in both parts.
for (const r of rendered) {
  check(`${r.slug} HTML contains the unsubscribe link`, r.html.includes(CTX.unsubscribeUrl));
  check(`${r.slug} text contains the unsubscribe link`, r.text.includes(CTX.unsubscribeUrl));
  check(`${r.slug} HTML says the word Unsubscribe`, /Unsubscribe/i.test(r.html));
  check(`${r.slug} text says the word Unsubscribe`, /Unsubscribe/i.test(r.text));
  check(`${r.slug} HTML names the sender`, r.html.includes(ROAD_REPORT.publisher));
  check(`${r.slug} text names the sender`, r.text.includes(ROAD_REPORT.publisher));
  check(`${r.slug} HTML carries the masthead`, r.html.includes(ROAD_REPORT.name));
  check(`${r.slug} text carries the masthead`, r.text.includes(ROAD_REPORT.name.toUpperCase()));
  check(
    `${r.slug} explains why the recipient is receiving it`,
    /receiving this because/i.test(r.html) && /receiving this because/i.test(r.text),
  );
}

// An email built with no blocks at all still gets a footer and an opt-out.
{
  const bare: NewsletterEmail = { slug: 'bare', subject: 'S', previewText: 'P', blocks: [] };
  const r = renderEmail(bare, CTX);
  check('an empty template still renders an unsubscribe link', r.html.includes(CTX.unsubscribeUrl));
  check('an empty template still renders a footer', r.html.includes(ROAD_REPORT.publisher));
  check('an empty template still renders a text opt-out', r.text.includes(CTX.unsubscribeUrl));
}

/* ── 3. Owner approval cannot be bypassed ────────────────────────────────── */

check('the marker is the agreed string', OWNER_APPROVAL_MARKER === 'OWNER_APPROVAL_REQUIRED');
check('pending copy is detected as pending', isPending(pending('x')));
check('a plain string is not pending', !isPending('x'));
check(
  'pending copy resolves to a visible marker',
  resolveCopy(pending('a thing')).includes(OWNER_APPROVAL_MARKER),
);
check('approved copy resolves to itself', resolveCopy('real copy') === 'real copy');

// The marker must reach the RENDERED OUTPUT, not just live in the source. A
// placeholder that renders invisibly is the failure this design exists to stop.
{
  const email: NewsletterEmail = {
    slug: 'p',
    subject: pending('a subject'),
    previewText: pending('preview text'),
    blocks: [{ kind: 'paragraph', text: pending('a paragraph') }],
  };
  const r = renderEmail(email, CTX);
  check('a pending subject is visibly marked', r.subject.includes(OWNER_APPROVAL_MARKER));
  check('pending preview text is visibly marked', r.previewText.includes(OWNER_APPROVAL_MARKER));
  check('a pending paragraph reaches the HTML', r.html.includes(OWNER_APPROVAL_MARKER));
  check('a pending paragraph reaches the plain text', r.text.includes(OWNER_APPROVAL_MARKER));
  check('hasPendingCopy sees it', hasPendingCopy(r));
  // Four, not three: the structural footer contributes the postal address,
  // which is itself awaiting approval. Counting only the template's own
  // placeholders would under-report what is blocking a send.
  const items = findPendingCopy(r);
  check(
    'every template placeholder is listed',
    ['a subject', 'preview text', 'a paragraph'].every((n) => items.includes(n)),
    items,
  );
  check(
    'the footer placeholder is listed too',
    items.some((n) => n.includes('postal mailing address')),
    items,
  );
  check(
    'each item is listed exactly once',
    items.length === new Set(items).size && items.length === 4,
    items,
  );
}

// Line wrapping in the plain-text part must not defeat the scan. The text
// renderer wraps at 72 columns, which puts newlines inside a long marker.
{
  const longNeed =
    'a very long description of the approval needed that will certainly be wrapped by the plain text renderer because it runs well past seventy-two columns';
  const r = renderEmail(
    {
      slug: 'w',
      subject: 'S',
      previewText: 'P',
      blocks: [{ kind: 'paragraph', text: pending(longNeed) }],
    },
    CTX,
  );
  check('a wrapped marker is still detected', hasPendingCopy(r));
  check(
    'a wrapped marker is not double-counted',
    findPendingCopy(r).filter((f) => f.startsWith('a very long description')).length === 1,
    findPendingCopy(r),
  );
}

// The series as it stands is deliberately unfinished.
const totalPending = rendered.reduce((n, r) => n + findPendingCopy(r).length, 0);
check('the welcome series still has copy awaiting approval', totalPending > 0, totalPending);
check('sender identity is not invented', Object.values(SENDER).every(isPending));

/* ── 4. No fabricated content ────────────────────────────────────────────── */

const WELCOME_SRC = readFileSync('src/lib/newsletter/campaigns/welcome.ts', 'utf8');
// Strip comments: the file's own docblock discusses these very words, and a
// naive scan would match the explanation instead of the content.
// Also strips the contents of every `pending(...)` call. Those strings are
// requests TO Shawn — several of them say, in words, that earnings and
// job-placement claims are regulated and must not be made. A scan for those
// phrases would match the guardrail and report the safety note as the hazard.
// They cannot ship regardless: they render as markers and the gate blocks them.
const welcomeContent = WELCOME_SRC.replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')
  .replace(/pending\(\s*(['"`])[\s\S]*?\1\s*,?\s*\)/g, 'pending()');

// Links must point at routes that exist. Taken from the filesystem, not memory.
{
  const routes = new Set<string>();
  const walk = (dir: string, prefix = '') => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      // Route groups like (learn) do not appear in the URL.
      const seg = entry.name.startsWith('(') ? '' : `/${entry.name}`;
      walk(`${dir}/${entry.name}`, prefix + seg);
      routes.add(prefix + seg || '/');
    }
  };
  walk('src/app');

  const linked = [
    ...welcomeContent.matchAll(/https:\/\/truckinglifewithshawn\.com(\/[^\s'"`]*)/g),
  ].map((m) => m[1].replace(/[.,)]+$/, ''));
  check('the templates link somewhere', linked.length > 0, linked.length);
  for (const path of new Set(linked)) {
    check(`the linked route ${path} exists in src/app`, routes.has(path), [...routes].length);
  }
}

// No invented news, regulatory change, or promotion.
for (const [label, pattern] of [
  [
    'a fabricated DOT or FMCSA update',
    /\b(FMCSA|DOT)\b[^.]{0,60}\b(announced|has (?:issued|updated|changed)|new rule|effective \w+ \d)/i,
  ],
  [
    'a fabricated news claim',
    /\b(breaking|just announced|this week the \w+ (?:announced|ruled))\b/i,
  ],
  ['a fabricated discount', /\b\d{1,3}% off\b|\bcoupon code\b|\blimited time offer\b/i],
  ['a fabricated deadline', /\boffer ends\b|\bexpires (?:today|tomorrow|in \d)/i],
  [
    'an earnings claim',
    /\bmake \$[\d,]+|\bearn \$[\d,]+|\b\$[\d,]+ (?:a|per) (?:week|month|year)\b/i,
  ],
  ['a guarantee', /\bguaranteed?\b/i],
  ['a job-placement claim', /\bjob placement\b|\bplacement rate\b|\bhired\b/i],
] as const) {
  check(`the welcome series contains no ${label}`, !pattern.test(welcomeContent), pattern.source);
}

/* ── 5. Rendering QA ─────────────────────────────────────────────────────── */

for (const r of rendered) {
  // Images-disabled: there are none, so the two renderings are the same one.
  check(`${r.slug} contains no images`, !/<img\b/i.test(r.html));
  check(`${r.slug} contains no background-image`, !/background-image/i.test(r.html));
  // A tracking pixel is an image; this catches one arriving later.
  check(
    `${r.slug} contains no remote asset`,
    !/(src|url\()\s*=?\s*["']?https?:/i.test(r.html.replace(/href="[^"]*"/g, '')),
  );

  // Dark mode and small screens, plus inline fallbacks for clients that strip
  // the <style> block entirely.
  check(`${r.slug} handles dark mode`, r.html.includes('prefers-color-scheme: dark'));
  check(`${r.slug} declares supported colour schemes`, r.html.includes('supported-color-schemes'));
  check(`${r.slug} is responsive`, r.html.includes('max-width: 480px'));
  check(`${r.slug} sets a viewport`, r.html.includes('width=device-width'));
  check(`${r.slug} styles inline, not only in a style block`, r.html.includes('style="margin:0'));

  // Layout tables must be hidden from assistive technology.
  const htmlNoComments = r.html.replace(/<!--[\s\S]*?-->/g, '');
  const tableCount = (htmlNoComments.match(/<table\b/g) ?? []).length;
  const presentationCount = (htmlNoComments.match(/role="presentation"/g) ?? []).length;
  check(`${r.slug} marks every layout table as presentational`, tableCount === presentationCount, {
    tableCount,
    presentationCount,
  });

  // Long unbroken words (a pasted URL, a long surname) must not force
  // horizontal scrolling.
  check(`${r.slug} allows long words to wrap`, r.html.includes('word-break:break-word'));
}

// Valid table nesting. Comments are stripped first — this file and the renderer
// both discuss `<table>` in prose, and a scan that reads its own documentation
// reports a bug that is not there.
for (const r of rendered) {
  const html = r.html.replace(/<!--[\s\S]*?-->/g, '');
  const stack: string[] = [];
  let problem = '';
  for (const m of html.matchAll(/<(\/?)(table|tr|td)\b/g)) {
    const [, close, tag] = m;
    if (close) {
      if (stack[stack.length - 1] !== tag)
        problem ||= `closed <${tag}> inside <${stack[stack.length - 1]}>`;
      stack.pop();
    } else {
      if (tag === 'table' && stack.length && stack[stack.length - 1] !== 'td') {
        problem ||= `<table> directly inside <${stack[stack.length - 1]}>`;
      }
      if (tag === 'tr' && stack[stack.length - 1] !== 'table') problem ||= '<tr> outside a table';
      if (tag === 'td' && stack[stack.length - 1] !== 'tr') problem ||= '<td> outside a row';
      stack.push(tag);
    }
  }
  check(
    `${r.slug} has valid table nesting`,
    problem === '' && stack.length === 0,
    problem || stack,
  );
}

// Long names and long subjects.
{
  const longName = 'Bartholomew Fitzwilliam-Featherstonehaugh III'.repeat(3);
  const r = renderEmail(WELCOME_SERIES[0], { ...CTX, recipientName: longName });
  check('a very long name still renders', r.html.includes('Bartholomew'));
  check('a very long name is allowed to wrap', r.html.includes('word-break:break-word'));
  check('a very long name does not break the text part', r.text.includes(longName));

  for (const name of [null, undefined, '', '   ']) {
    const fallback = renderEmail(WELCOME_SERIES[0], { ...CTX, recipientName: name });
    check(
      `a missing name (${JSON.stringify(name)}) falls back gracefully`,
      fallback.text.includes('Hey driver,'),
    );
  }

  const longTitle = 'A subject line that goes on and on '.repeat(6);
  const rt = renderEmail(
    {
      slug: 't',
      subject: longTitle,
      previewText: 'p',
      blocks: [{ kind: 'heading', text: longTitle }],
    },
    CTX,
  );
  check('a very long subject survives rendering', rt.subject === longTitle);
  check(
    'a very long heading is escaped and present',
    rt.html.includes('A subject line that goes on'),
  );
}

// Escaping. Copy is author-supplied and names are user-supplied.
{
  const nasty = '<script>alert("x")</script> & "quotes" \'apostrophes\'';
  const r = renderEmail(
    { slug: 'x', subject: nasty, previewText: nasty, blocks: [{ kind: 'paragraph', text: nasty }] },
    { ...CTX, recipientName: nasty },
  );
  check('markup in copy is escaped', !r.html.includes('<script>'));
  check('markup in a recipient name is escaped', !/<script>/.test(r.html));
  check('ampersands are escaped', r.html.includes('&amp;'));
  check('the plain-text part keeps the raw characters', r.text.includes('& "quotes"'));
}

// The correction section.
{
  const r = renderEmail(
    {
      slug: 'c',
      subject: 'S',
      previewText: 'P',
      blocks: [{ kind: 'correction', text: 'Last week I said the wrong exit number.' }],
    },
    CTX,
  );
  check('a correction renders in HTML', r.html.includes('Last week I said the wrong exit number.'));
  check('a correction is labelled in HTML', /Correction:/.test(r.html));
  check('a correction renders in plain text', r.text.includes('CORRECTION: Last week I said'));
  // Colour alone must not carry the meaning.
  check('a correction is not signalled by colour alone', /<strong[^>]*>Correction:/.test(r.html));
}

// Every block kind renders in both parts.
{
  const all = renderEmail(
    {
      slug: 'all',
      subject: 'S',
      previewText: 'P',
      blocks: [
        { kind: 'heading', text: 'H' },
        { kind: 'paragraph', text: 'P' },
        { kind: 'list', items: ['one', 'two'] },
        { kind: 'cta', label: 'Go', href: 'https://truckinglifewithshawn.com/', caption: 'cap' },
        { kind: 'correction', text: 'fix' },
        { kind: 'divider' },
      ],
    },
    CTX,
  );
  for (const token of ['H', 'one', 'two', 'Go', 'cap', 'fix']) {
    check(`block content "${token}" reaches the HTML`, all.html.includes(token));
    check(`block content "${token}" reaches the plain text`, all.text.includes(token));
  }
  check(
    'a CTA renders as a real link',
    all.html.includes('<a href="https://truckinglifewithshawn.com/"'),
  );
  check(
    'a CTA URL is visible in plain text',
    all.text.includes('https://truckinglifewithshawn.com/'),
  );
}

/* ── 6. Nothing here can send ────────────────────────────────────────────── */

check('the only transport cannot deliver', dryRunTransport.canDeliver === false);
check('the dry-run transport is named honestly', dryRunTransport.name === 'dry-run');
check(
  'unsubscribe headers are built for one-click',
  listHeaders('https://x/u')['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click',
);
check(
  'the unsubscribe header carries the URL',
  listHeaders('https://x/u')['List-Unsubscribe'] === '<https://x/u>',
);

// No module in the newsletter directory may reach a network or the dormant
// Resend helper. This is the assertion that keeps "no production email is sent"
// true as the module grows.
{
  const dir = 'src/lib/newsletter';
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${d}/${e.name}`);
      else if (e.name.endsWith('.ts')) files.push(`${d}/${e.name}`);
    }
  };
  walk(dir);
  check('the newsletter module has files to check', files.length >= 5, files.length);
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ');
    check(`${file} makes no network call`, !/\bfetch\s*\(|XMLHttpRequest|axios/.test(src));
    check(`${file} does not import the Resend helper`, !/from '@\/lib\/api\/email'/.test(src));
    check(
      `${file} references no provider endpoint`,
      !/api\.resend\.com|sendgrid|postmark|mailgun/i.test(src),
    );
    check(`${file} reads no secret`, !/process\.env\.[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD)/.test(src));
  }
}

/* ── 7. The send gate ────────────────────────────────────────────────────── */

const DIGEST = 'digest-abc';
function baseInput(overrides: Partial<SendReadinessInput> = {}): SendReadinessInput {
  return {
    metadata: {
      campaignId: 'c1',
      emailSlug: 'welcome-1-road-report',
      mode: 'production',
      preparedBy: 'shawn',
    },
    // An APPROVED identity, so the everything-is-satisfied path is reachable.
    // The real SENDER is entirely pending; asserted separately below.
    sender: {
      fromAddress: 'road@example.test',
      fromName: 'The Road Report',
      replyTo: 'shawn@example.test',
      postalAddress: '1 Example Street, Dalton, GA',
    },
    // A fully approved email: no markers anywhere.
    rendered: { slug: 's', subject: 'S', previewText: 'P', html: '<p>hi</p>', text: 'hi' },
    contentDigest: DIGEST,
    approval: { approvedBy: 'shawn', approvedAt: '2026-08-03T00:00:00Z', contentDigest: DIGEST },
    testSend: {
      sentAt: '2026-08-03T00:00:00Z',
      toAddress: 'shawn@example.test',
      contentDigest: DIGEST,
    },
    recipients: [{ email: 'a@example.test', isSubscribed: true }],
    suppressionList: [],
    transportCanDeliver: true,
    productionConfirmation: PRODUCTION_CONFIRMATION_PHRASE,
    ...overrides,
  };
}

const codes = (i: SendReadinessInput) => evaluateSendReadiness(i).blockers.map((b) => b.code);

// The baseline must be allowed, or every negative test below proves nothing.
{
  const r = evaluateSendReadiness(baseInput());
  check('a fully satisfied send is allowed', r.allowed, r.blockers);
  check(
    'an allowed send lists its recipients',
    r.eligibleRecipients.length === 1,
    r.eligibleRecipients,
  );
}

// Draft protection — the headline property.
{
  const draft = baseInput({ metadata: { ...baseInput().metadata, mode: 'draft' } });
  const r = evaluateSendReadiness(draft);
  check('a draft cannot be sent', !r.allowed);
  check(
    'a draft is blocked for being a draft',
    r.blockers.some((b) => b.code === 'draft_mode'),
  );
  check('a blocked send releases no recipients', r.eligibleRecipients.length === 0);
}
// Including to a test address: "just test it quickly" is how drafts escape.
{
  const draftTest = baseInput({
    metadata: { ...baseInput().metadata, mode: 'draft' },
    recipients: [{ email: 'shawn@example.test', isSubscribed: true }],
  });
  check('a draft cannot even be test-sent', !evaluateSendReadiness(draftTest).allowed);
}
// An unrecognised mode fails closed rather than falling through.
{
  const weird = baseInput({
    metadata: { ...baseInput().metadata, mode: 'scheduled' as unknown as 'test' },
  });
  check('an unknown mode is refused', codes(weird).includes('unknown_mode'));
}

// Unapproved copy blocks the send, end to end from template to gate.
{
  const withMarker = baseInput({
    rendered: renderEmail(
      {
        slug: 'p',
        subject: 'S',
        previewText: 'P',
        blocks: [{ kind: 'paragraph', text: pending('a claim') }],
      },
      CTX,
    ),
  });
  check('unapproved copy blocks the send', codes(withMarker).includes('copy_pending_approval'));
}
// And the real series cannot be sent as it stands.
{
  const real = baseInput({ rendered: rendered[2] });
  check('the unfinished Academy email cannot be sent', !evaluateSendReadiness(real).allowed);
}

// The real sender identity is entirely unapproved, so a send using it is
// blocked today — and will unblock only when Shawn fills it in.
{
  const withRealSender = baseInput({ sender: SENDER });
  const r = evaluateSendReadiness(withRealSender);
  check('the real, unapproved sender identity blocks the send', !r.allowed);
  check(
    'the blocker names the sender identity',
    r.blockers.some((b) => b.code === 'sender_identity_unset'),
    r.blockers,
  );
  check(
    'the blocker names every unset field',
    ['fromAddress', 'fromName', 'replyTo', 'postalAddress'].every((f) =>
      r.blockers.some((b) => b.detail.includes(f)),
    ),
    r.blockers,
  );
}
// One unset field out of four is still a blocker.
{
  const partial = baseInput({
    sender: { ...baseInput().sender, replyTo: pending('the reply-to address') },
  });
  check(
    'a partially approved sender still blocks',
    codes(partial).includes('sender_identity_unset'),
  );
}

for (const [label, override, expected] of [
  ['missing owner approval', { approval: undefined }, 'owner_approval_missing'],
  [
    'approval for different content',
    { approval: { approvedBy: 'shawn', approvedAt: 'x', contentDigest: 'other' } },
    'owner_approval_stale',
  ],
  ['no test send', { testSend: undefined }, 'test_send_missing'],
  [
    'test send of different content',
    { testSend: { sentAt: 'x', toAddress: 'y', contentDigest: 'other' } },
    'test_send_stale',
  ],
  [
    'no production confirmation',
    { productionConfirmation: undefined },
    'production_confirmation_missing',
  ],
  [
    'a wrong confirmation phrase',
    { productionConfirmation: 'send it' },
    'production_confirmation_missing',
  ],
  ['no delivering transport', { transportCanDeliver: false }, 'no_delivering_transport'],
  [
    'every recipient excluded',
    { recipients: [{ email: 'a@example.test', isSubscribed: false }] },
    'no_eligible_recipients',
  ],
] as const) {
  check(
    `${label} blocks the send`,
    codes(baseInput(override as Partial<SendReadinessInput>)).includes(expected),
    codes(baseInput(override as Partial<SendReadinessInput>)),
  );
}

// Consent and suppression, per recipient.
{
  const r = evaluateSendReadiness(
    baseInput({
      recipients: [
        { email: 'yes@example.test', isSubscribed: true },
        { email: 'no@example.test', isSubscribed: false },
        { email: 'unknown@example.test', isSubscribed: null },
        { email: 'YES@example.test', isSubscribed: true },
        { email: '  ', isSubscribed: true },
        { email: 'gone@example.test', isSubscribed: false },
      ],
      suppressionList: ['GONE@example.test'],
    }),
  );
  check(
    'only the consenting recipient is eligible',
    r.eligibleRecipients.length === 1,
    r.eligibleRecipients,
  );
  check(
    'addresses are normalised before comparison',
    r.eligibleRecipients[0] === 'yes@example.test',
  );
  const reasons = Object.fromEntries(r.excluded.map((e) => [e.email, e.reason]));
  check('a non-subscriber is excluded', reasons['no@example.test'] === 'not currently subscribed');
  check(
    'no evidence is not consent',
    reasons['unknown@example.test'] === 'no consent evidence on record',
  );
  check(
    'a duplicate is excluded, not sent twice',
    reasons['yes@example.test'] === 'duplicate in recipient list',
  );
  check('a suppressed address is excluded', reasons['gone@example.test'] !== undefined);
  check(
    'a blank address is excluded',
    r.excluded.some((e) => e.reason === 'blank address'),
  );
  check('exclusions are never silent', r.excluded.length === 5, r.excluded);
}

// Suppression and consent disagreeing stops the send rather than picking one.
{
  const r = evaluateSendReadiness(
    baseInput({
      recipients: [{ email: 'x@example.test', isSubscribed: true }],
      suppressionList: ['x@example.test'],
    }),
  );
  check(
    'a suppression/consent contradiction blocks the send',
    r.blockers.some((b) => b.code === 'consent_contradiction'),
  );
}

// Every blocker is reported at once, not one per run.
{
  const r = evaluateSendReadiness(
    baseInput({
      metadata: { ...baseInput().metadata, mode: 'draft' },
      approval: undefined,
      testSend: undefined,
      transportCanDeliver: false,
    }),
  );
  // Named rather than counted. A count silently passes when the set changes,
  // and it hides the fact that test-send and confirmation blockers correctly
  // do NOT apply in draft mode — only production reaches those checks.
  const found = r.blockers.map((b) => b.code);
  check(
    'all applicable blockers are reported in one pass',
    ['draft_mode', 'owner_approval_missing', 'no_delivering_transport'].every((c) =>
      found.includes(c),
    ),
    found,
  );
  check(
    'production-only blockers do not fire for a draft',
    !found.includes('test_send_missing') && !found.includes('production_confirmation_missing'),
    found,
  );
}

/* ── 8. Audit log ────────────────────────────────────────────────────────── */

{
  const input = baseInput({ metadata: { ...baseInput().metadata, mode: 'draft' } });
  const readiness = evaluateSendReadiness(input);
  const entry = buildAuditEntry(input, readiness, 'refused', '2026-08-03T01:00:00Z');
  check('a refused attempt is auditable', entry.outcome === 'refused');
  check('the audit entry records why', entry.blockerCodes.includes('draft_mode'));
  check('the audit entry records who', entry.attemptedBy === 'shawn');
  check('the audit entry records the content digest', entry.contentDigest === DIGEST);
  // Counts, never addresses — the log should survive being read by the wrong person.
  const serialized = JSON.stringify(entry);
  check('the audit entry lists no recipient addresses', !serialized.includes('@'), serialized);
  check('the audit entry counts recipients', typeof entry.recipientCount === 'number');
}

/* ── 9. No secrets ───────────────────────────────────────────────────────── */

{
  const sources = [
    'src/lib/newsletter/approval.ts',
    'src/lib/newsletter/brand.ts',
    'src/lib/newsletter/render.ts',
    'src/lib/newsletter/transport.ts',
    'src/lib/newsletter/send-workflow.ts',
    'src/lib/newsletter/campaigns/welcome.ts',
    'scripts/preview-road-report.ts',
  ];
  for (const file of sources) {
    const src = readFileSync(file, 'utf8');
    for (const token of [
      'RESEND_API_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'ADMIN_PASSWORD',
      'ADMIN_SESSION_SECRET',
      'TURNSTILE_SECRET',
      'HERE_API_KEY',
      'TWILIO_AUTH_TOKEN',
    ]) {
      check(`${file} references no ${token}`, !src.includes(token));
    }
    // A long base64-ish or key-shaped literal would be a pasted credential.
    check(
      `${file} embeds no key-shaped literal`,
      !/['"](?:sk|re|pk)_[A-Za-z0-9]{16,}['"]/.test(src),
    );
  }
  // Rendered output must not leak anything either.
  for (const r of rendered) {
    check(`${r.slug} output contains no env reference`, !/process\.env/.test(r.html + r.text));
  }
}

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
