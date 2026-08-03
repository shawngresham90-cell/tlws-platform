/**
 * The Road Report issue builder — validation, CTA rules, and the approval gate.
 *
 * Offline, like every harness here. Everything under test is a pure function,
 * which is the reason it was written that way: a publish gate nobody can
 * exercise is a publish gate nobody should trust.
 *
 * The load-bearing assertions are the refusals — that an unlabelled source
 * cannot publish, that a draft cannot skip to approved, that a placeholder
 * blocks. But the PASSING path is asserted too, and deliberately: a gate that
 * refuses everything is indistinguishable from a gate that is broken.
 *
 *   npx esbuild scripts/test-road-report-issue.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/t.cjs && node /tmp/t.cjs
 */
import { findPendingCopy, pending } from '@/lib/newsletter/approval';
import { ROAD_REPORT } from '@/lib/newsletter/brand';
import { CTA_INTENTS, validateCtas } from '@/lib/newsletter/cta';
import {
  SECTION_KINDS,
  SECTION_LABELS,
  SOURCE_REQUIRED_SECTIONS,
  sectionOrder,
  type Issue,
  type IssueSection,
} from '@/lib/newsletter/issue';
import { issueToEmail, renderIssue, describeIssue } from '@/lib/newsletter/issue-render';
import {
  validateIssue,
  validateIssueStructure,
  validateRenderedIssue,
} from '@/lib/newsletter/issue-validate';
import { PROVENANCE_KINDS, sourceCredit, validateProvenance } from '@/lib/newsletter/provenance';
import {
  ISSUE_STATES,
  REQUIRED_PATH_TO_SENT,
  isEditable,
  isSendable,
  transition,
  type IssueState,
} from '@/lib/newsletter/workflow-state';
import { BLANK_ISSUE, BLANK_ISSUE_SECTIONS } from '@/lib/newsletter/campaigns/issue-template';
import { ISSUES } from '@/lib/newsletter/issues';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const UNSUB = 'https://truckinglifewithshawn.com/unsubscribe?token=TEST';
const APPROVED_POSTAL = '1 Example Street, Dalton, GA 30720';
const CTX = { unsubscribeUrl: UNSUB, recipientName: 'Marcus', postalAddress: APPROVED_POSTAL };
const EXPECT = { unsubscribeUrl: UNSUB, publisher: ROAD_REPORT.publisher };

/* ── 1. A fully valid issue passes ───────────────────────────────────────── */

const validSection = (over: Partial<IssueSection> = {}): IssueSection => ({
  kind: 'driver-tip',
  heading: 'Check your slack adjusters',
  body: 'Two minutes at the start of a shift.\n\nIt is the check most likely to be skipped.',
  provenance: { kind: 'owner-written' },
  ...over,
});

const validIssue = (over: Partial<Issue> = {}): Issue => ({
  slug: '2026-w32',
  number: 32,
  date: '2026-08-03',
  state: 'draft',
  subject: 'This week on the road',
  previewText: 'Slack adjusters, and one parking spot worth knowing.',
  sections: [
    validSection({ kind: 'opening-note', heading: 'Before we start', body: 'Short week.' }),
    validSection(),
  ],
  ctas: {
    primary: {
      label: 'Take a practice test',
      href: 'https://truckinglifewithshawn.com/practice-tests',
      intent: 'use-tool',
    },
  },
  ...over,
});

{
  const issue = validIssue();
  const rendered = renderIssue(issue, CTX);
  const result = validateIssue(issue, rendered, EXPECT);
  check('a complete, sourced, approved issue passes validation', result.ok, result.problems);
  check('a passing issue reports no problems', result.problems.length === 0, result.problems);
}

/* ── 2. Provenance: unknown cannot publish ───────────────────────────────── */

check('there are exactly three source labels', PROVENANCE_KINDS.length === 3, PROVENANCE_KINDS);
check('owner-written is valid', validateProvenance({ kind: 'owner-written' }).length === 0);
check('placeholder is valid', validateProvenance({ kind: 'placeholder' }).length === 0);
check(
  'a complete official source is valid',
  validateProvenance({
    kind: 'official-source',
    publisher: 'FMCSA',
    url: 'https://www.fmcsa.dot.gov/notice',
    retrievedAt: '2026-08-01',
  }).length === 0,
);

for (const [label, value, code] of [
  ['absent provenance', undefined, 'provenance_missing'],
  ['null provenance', null, 'provenance_missing'],
  ['an unrecognised label', { kind: 'from-a-friend' }, 'provenance_unknown_kind'],
  ['an empty label', { kind: '' }, 'provenance_unknown_kind'],
  ['a non-string label', { kind: 7 }, 'provenance_unknown_kind'],
  ['a bare object', {}, 'provenance_unknown_kind'],
] as const) {
  const problems = validateProvenance(value);
  check(
    `${label} is rejected`,
    problems.some((p) => p.code === code),
    problems,
  );
}

for (const [label, over, code] of [
  ['no publisher', { publisher: '' }, 'provenance_publisher_missing'],
  ['a relative URL', { url: '/notice' }, 'provenance_url_invalid'],
  ['a non-web URL', { url: 'ftp://x/y' }, 'provenance_url_invalid'],
  ['no URL', { url: undefined }, 'provenance_url_invalid'],
  ['no retrieval date', { retrievedAt: undefined }, 'provenance_retrieved_at_invalid'],
  ['a nonsense date', { retrievedAt: 'last tuesday' }, 'provenance_retrieved_at_invalid'],
] as const) {
  const complete = {
    kind: 'official-source',
    publisher: 'FMCSA',
    url: 'https://www.fmcsa.dot.gov/notice',
    retrievedAt: '2026-08-01',
  };
  const problems = validateProvenance({ ...complete, ...over });
  check(
    `an official source with ${label} is rejected`,
    problems.some((p) => p.code === code),
    problems,
  );
}

check(
  'an official source is credited to the reader',
  Boolean(
    sourceCredit({
      kind: 'official-source',
      publisher: 'FMCSA',
      url: 'https://x.test/n',
      retrievedAt: '2026-08-01',
    })?.includes('FMCSA'),
  ),
);
check('owner-written needs no credit line', sourceCredit({ kind: 'owner-written' }) === null);
check('a placeholder needs no credit line', sourceCredit({ kind: 'placeholder' }) === null);

// Sections that state outside facts may not be written from memory.
check(
  'the source-required set is the outward-facing four',
  SOURCE_REQUIRED_SECTIONS.length === 4 &&
    ['industry-news', 'dot-fmcsa', 'fuel', 'weather'].every((k) =>
      (SOURCE_REQUIRED_SECTIONS as readonly string[]).includes(k),
    ),
  SOURCE_REQUIRED_SECTIONS,
);
for (const kind of SOURCE_REQUIRED_SECTIONS) {
  const issue = validIssue({
    sections: [validSection({ kind, heading: 'H', provenance: { kind: 'owner-written' } })],
  });
  check(
    `"${SECTION_LABELS[kind]}" cannot be written from memory`,
    validateIssueStructure(issue).some((p) => p.code === 'section_requires_official_source'),
  );
}
check(
  'a driver tip CAN be owner-written',
  !validateIssueStructure(validIssue()).some((p) => p.code === 'section_requires_official_source'),
);

/* ── 3. CTA rules ────────────────────────────────────────────────────────── */

const cta = (over: Record<string, unknown> = {}) => ({
  label: 'Go',
  href: 'https://truckinglifewithshawn.com/practice-tests',
  intent: 'use-tool' as const,
  ...over,
});

check('one primary CTA is valid', validateCtas({ primary: cta() }).length === 0);
check(
  'no CTAs at all is rejected',
  validateCtas(undefined).some((p) => p.code === 'cta_missing'),
);
check(
  'a missing primary is rejected',
  validateCtas({}).some((p) => p.code === 'cta_primary_missing'),
);
check(
  'a secondary alone is rejected',
  validateCtas({ secondary: cta() }).some((p) => p.code === 'cta_primary_missing'),
);
check(
  'a valid primary plus a softer secondary is allowed',
  validateCtas({
    primary: cta({ intent: 'purchase', href: 'https://stan.store/x/p/a' }),
    secondary: cta({ intent: 'read', href: 'https://truckinglifewithshawn.com/knowledge' }),
  }).length === 0,
);

// Conflict 1 — same destination.
check(
  'two CTAs to the same destination conflict',
  validateCtas({ primary: cta(), secondary: cta({ label: 'Also go' }) }).some(
    (p) => p.code === 'cta_duplicate_destination',
  ),
);
check(
  'the same destination is caught through a trailing slash and utm params',
  validateCtas({
    primary: cta({ href: 'https://truckinglifewithshawn.com/practice-tests' }),
    secondary: cta({ href: 'https://TruckingLifeWithShawn.com/practice-tests/?utm_source=email' }),
  }).some((p) => p.code === 'cta_duplicate_destination'),
);

// Conflict 2 — two committing asks.
check(
  'two purchase-type asks conflict',
  validateCtas({
    primary: cta({ intent: 'purchase', href: 'https://stan.store/x/p/a' }),
    secondary: cta({ intent: 'apply', href: 'https://truckinglifewithshawn.com/academy/apply' }),
  }).some((p) => p.code === 'cta_competing_asks'),
);

// Conflict 3 — secondary outranks primary.
check(
  'a secondary that outranks the primary conflicts',
  validateCtas({
    primary: cta({ intent: 'read', href: 'https://truckinglifewithshawn.com/knowledge' }),
    secondary: cta({ intent: 'apply', href: 'https://truckinglifewithshawn.com/academy/apply' }),
  }).some((p) => p.code === 'cta_secondary_outranks_primary'),
);

for (const [label, over, code] of [
  ['a relative href', { href: '/practice-tests' }, 'cta_href_invalid'],
  ['a non-web href', { href: 'mailto:a@b.test' }, 'cta_href_not_web'],
  ['a blank label', { label: '   ' }, 'cta_label_blank'],
  ['an unknown intent', { intent: 'vibe' }, 'cta_intent_unknown'],
] as const) {
  check(
    `a primary CTA with ${label} is rejected`,
    validateCtas({ primary: cta(over) }).some((p) => p.code === code),
    validateCtas({ primary: cta(over) }),
  );
}
check(
  'every declared intent is recognised',
  CTA_INTENTS.every((i) =>
    validateCtas({ primary: cta({ intent: i }) }).every((p) => p.code !== 'cta_intent_unknown'),
  ),
);

/* ── 4. The approval workflow ────────────────────────────────────────────── */

const move = (from: IssueState, to: IssueState, over: Record<string, unknown> = {}) =>
  transition({
    from,
    to,
    actor: 'shawn',
    at: '2026-08-03T00:00:00Z',
    validationPasses: true,
    ...over,
  });

check('the pipeline has six states', ISSUE_STATES.length === 6, ISSUE_STATES);
check('the path to sent is five steps', REQUIRED_PATH_TO_SENT.length === 5, REQUIRED_PATH_TO_SENT);

// The full legal path works, one step at a time.
for (let i = 0; i < REQUIRED_PATH_TO_SENT.length - 1; i++) {
  const from = REQUIRED_PATH_TO_SENT[i];
  const to = REQUIRED_PATH_TO_SENT[i + 1];
  const result = move(from, to);
  check(`${from} → ${to} is allowed`, result.ok, result.ok ? undefined : result.blockers);
}
check('sent → archived is allowed', move('sent', 'archived').ok);

// Nothing may skip a stage.
for (const [from, to] of [
  ['draft', 'approved'],
  ['draft', 'ready-to-send'],
  ['draft', 'sent'],
  ['owner-review', 'ready-to-send'],
  ['owner-review', 'sent'],
  ['approved', 'sent'],
] as const) {
  const result = move(from, to);
  check(
    `${from} → ${to} is refused`,
    !result.ok && result.blockers.some((b) => b.code === 'illegal_transition'),
  );
}

// Approved is not send. This is the separation the pipeline exists for.
check(
  'approved does not mean sent — ready-to-send is its own decision',
  !move('approved', 'sent').ok,
);

// Sent is effectively terminal; archived is fully terminal.
for (const to of ['draft', 'owner-review', 'approved', 'ready-to-send'] as const) {
  check(`sent → ${to} is refused — mail cannot be unsent`, !move('sent', to).ok);
}
for (const to of ISSUE_STATES) {
  check(`archived → ${to} is refused`, !move('archived', to).ok);
}

// Backwards to draft is always allowed from the working states.
for (const from of ['owner-review', 'approved', 'ready-to-send'] as const) {
  check(`${from} → draft is allowed`, move(from, 'draft').ok);
}
check(
  'moving backwards does not require passing validation',
  move('ready-to-send', 'draft', { validationPasses: false }).ok,
);
check(
  'moving forwards requires passing validation',
  !move('draft', 'owner-review', { validationPasses: false }).ok,
);
check(
  'the validation blocker is named',
  (() => {
    const r = move('draft', 'owner-review', { validationPasses: false });
    return !r.ok && r.blockers.some((b) => b.code === 'validation_failing');
  })(),
);

// Attribution.
for (const actor of ['', '   ', undefined]) {
  const r = move('draft', 'owner-review', { actor });
  check(`an unattributed transition (${JSON.stringify(actor)}) is refused`, !r.ok);
}
check(
  'a successful transition records who and when',
  (() => {
    const r = move('draft', 'owner-review');
    return r.ok && r.record.actor === 'shawn' && r.record.at === '2026-08-03T00:00:00Z';
  })(),
);

// Unknown states fail closed rather than falling through.
check('an unknown source state is refused', !move('published' as IssueState, 'sent').ok);
check('an unknown target state is refused', !move('draft', 'published' as IssueState).ok);

check(
  'only draft and owner-review are editable',
  ISSUE_STATES.filter(isEditable).join() === 'draft,owner-review',
);
check(
  'only ready-to-send may attempt a send',
  ISSUE_STATES.filter(isSendable).join() === 'ready-to-send',
);

/* ── 5. Structural validation ────────────────────────────────────────────── */

check(
  'duplicate sections are rejected',
  validateIssueStructure(validIssue({ sections: [validSection(), validSection()] })).some(
    (p) => p.code === 'section_duplicated',
  ),
);
check(
  'sections out of the running order are rejected',
  validateIssueStructure(
    validIssue({
      sections: [validSection({ kind: 'closing-note' }), validSection({ kind: 'opening-note' })],
    }),
  ).some((p) => p.code === 'section_out_of_order'),
);
check(
  'the canonical order is the declared order',
  SECTION_KINDS.every((k, i) => sectionOrder(k) === i),
);
check('there are twelve section kinds', SECTION_KINDS.length === 12, SECTION_KINDS.length);
check(
  'every section kind has a label',
  SECTION_KINDS.every((k) => Boolean(SECTION_LABELS[k])),
);

for (const [label, over, code] of [
  ['no sections', { sections: [] }, 'issue_no_sections'],
  ['no slug', { slug: '' }, 'issue_slug_missing'],
  ['a zero issue number', { number: 0 }, 'issue_number_invalid'],
  ['a fractional issue number', { number: 1.5 }, 'issue_number_invalid'],
  ['a nonsense date', { date: 'next week' }, 'issue_date_invalid'],
  ['a blank subject', { subject: '  ' }, 'issue_subject_blank'],
  ['blank preview text', { previewText: '' }, 'issue_preview_text_blank'],
] as const) {
  check(
    `an issue with ${label} is rejected`,
    validateIssueStructure(validIssue(over as Partial<Issue>)).some((p) => p.code === code),
    validateIssueStructure(validIssue(over as Partial<Issue>)),
  );
}

check(
  'an empty section is rejected',
  validateIssueStructure(validIssue({ sections: [validSection({ body: '', items: [] })] })).some(
    (p) => p.code === 'section_empty',
  ),
);
check(
  'a section with only list items is accepted',
  !validateIssueStructure(
    validIssue({ sections: [validSection({ body: '', items: ['one', 'two'] })] }),
  ).some((p) => p.code === 'section_empty'),
);
check(
  'a relative section link is rejected',
  validateIssueStructure(
    validIssue({ sections: [validSection({ link: { label: 'Here', href: '/parking' } })] }),
  ).some((p) => p.code === 'section_link_invalid'),
);

/* ── 6. Rendered-output validation ───────────────────────────────────────── */

{
  const rendered = renderIssue(validIssue(), CTX);
  check(
    'a rendered issue passes the output checks',
    validateRenderedIssue(rendered, EXPECT).length === 0,
  );

  // Each guarantee, broken deliberately, must be caught.
  for (const [label, mutate, code] of [
    [
      'the unsubscribe URL',
      (h: string) => h.split(UNSUB).join('https://elsewhere.test/x'),
      'rendered_unsubscribe_missing',
    ],
    [
      'the sender name',
      (h: string) => h.split(ROAD_REPORT.publisher).join('Someone Else'),
      'rendered_sender_missing',
    ],
    [
      'the footer explanation',
      (h: string) => h.split('receiving this because').join('just because'),
      'rendered_footer_missing',
    ],
  ] as const) {
    const broken = { ...rendered, html: mutate(rendered.html), text: mutate(rendered.text) };
    check(
      `removing ${label} is caught`,
      validateRenderedIssue(broken, EXPECT).some((p) => p.code === code),
    );
  }

  const noWord = {
    ...rendered,
    html: rendered.html.replace(/Unsubscribe/g, 'Opt out'),
    text: rendered.text.replace(/Unsubscribe/g, 'Opt out'),
  };
  check(
    'an unsubscribe link with no visible wording is caught',
    validateRenderedIssue(noWord, EXPECT).some((p) => p.code === 'rendered_unsubscribe_unlabelled'),
  );
}

// Placeholders left behind.
{
  const issue = validIssue({
    sections: [validSection({ body: pending('what the tip actually is') })],
  });
  const rendered = renderIssue(issue, CTX);
  const problems = validateIssue(issue, rendered, EXPECT).problems;
  check(
    'a placeholder left behind blocks publication',
    problems.some((p) => p.code === 'placeholder_left_behind'),
  );
}
// A section still labelled placeholder blocks even when its prose looks done.
{
  const issue = validIssue({ sections: [validSection({ provenance: { kind: 'placeholder' } })] });
  const rendered = renderIssue(issue, CTX);
  check(
    'a section still labelled placeholder blocks even with finished-looking copy',
    validateIssue(issue, rendered, EXPECT).problems.some(
      (p) => p.code === 'section_still_placeholder',
    ),
  );
}

/* ── 7. The compiler ─────────────────────────────────────────────────────── */

{
  const issue = validIssue({
    sections: [
      validSection({
        kind: 'opening-note',
        heading: 'Before we start',
        body: 'One.\n\nTwo.',
      }),
      validSection({
        kind: 'parking-spotlight',
        heading: 'Spot of the week',
        body: 'Body.',
        items: ['a', 'b'],
        link: {
          label: 'See the listing',
          href: 'https://truckinglifewithshawn.com/directory/parking',
        },
        correction: 'Last week I gave the wrong exit.',
        provenance: {
          kind: 'official-source',
          publisher: 'TLWS Directory',
          url: 'https://truckinglifewithshawn.com/directory',
          retrievedAt: '2026-08-01',
        },
      }),
    ],
    ctas: {
      primary: {
        label: 'Take a test',
        href: 'https://truckinglifewithshawn.com/practice-tests',
        intent: 'use-tool',
      },
      secondary: {
        label: 'Read the guides',
        href: 'https://truckinglifewithshawn.com/knowledge',
        intent: 'read',
      },
    },
  });
  const email = issueToEmail(issue);
  const kinds = email.blocks.map((b) => b.kind);

  check(
    'a blank-line split becomes two paragraphs',
    kinds.filter((k) => k === 'paragraph').length >= 3,
    kinds,
  );
  check('list items become a list block', kinds.includes('list'));
  check('a correction becomes a correction block', kinds.includes('correction'));
  check('an official source becomes a note block', kinds.includes('note'));

  // The heart of the CTA rule: exactly one button, whatever else is linked.
  check('exactly one cta block is emitted', kinds.filter((k) => k === 'cta').length === 1, kinds);
  check(
    'a section link is a link block, never a cta',
    kinds.filter((k) => k === 'link').length === 2,
    kinds,
  );

  // Order is preserved, never sorted — otherwise the validator could never
  // report section_out_of_order and an author's mistake would be invisible.
  const headings = email.blocks
    .filter((b) => b.kind === 'heading')
    .map((b) => (b as { text: string }).text);
  check(
    'section order is preserved, not sorted',
    headings[0] === 'Before we start' && headings[1] === 'Spot of the week',
    headings,
  );

  const rendered = renderIssue(issue, CTX);
  check('the source credit reaches the HTML', rendered.html.includes('TLWS Directory'));
  check('the source credit reaches the plain text', rendered.text.includes('TLWS Directory'));
  check(
    'the secondary CTA renders as a link, not a second button',
    (rendered.html.match(/border-radius:8px/g) ?? []).length === 1,
  );
  check(
    'the issue still validates with a full set of features',
    validateIssue(issue, rendered, EXPECT).ok,
    validateIssue(issue, rendered, EXPECT).problems,
  );
  check('describeIssue names no recipient', !describeIssue(issue).includes('@'));
}

/* ── 8. The shipped template and issues refuse ───────────────────────────── */

check('the blank template has all twelve sections', BLANK_ISSUE_SECTIONS.length === 12);
check(
  'every template section is labelled a placeholder',
  BLANK_ISSUE_SECTIONS.every((s) => s.provenance.kind === 'placeholder'),
);
check('the blank template starts in draft', BLANK_ISSUE.state === 'draft');
{
  const rendered = renderIssue(BLANK_ISSUE, CTX);
  const result = validateIssue(BLANK_ISSUE, rendered, EXPECT);
  check('the blank template cannot publish', !result.ok);
  check(
    'the blank template reports every placeholder section',
    result.problems.filter((p) => p.code === 'section_still_placeholder').length === 12,
    result.problems.length,
  );
}

check('at least one issue is registered', ISSUES.length >= 1);
for (const issue of ISSUES) {
  const rendered = renderIssue(issue, CTX);
  const result = validateIssue(issue, rendered, EXPECT);
  check(
    `${issue.slug}: a non-draft issue must pass validation`,
    issue.state === 'draft' || result.ok,
    result.problems,
  );
  check(
    `${issue.slug}: renders both parts`,
    rendered.html.length > 500 && rendered.text.length > 200,
  );
  check(
    `${issue.slug}: carries the unsubscribe link`,
    rendered.html.includes(UNSUB) && rendered.text.includes(UNSUB),
  );
}

// A pending heading is uppercased in plain text unless it is a marker — an
// uppercased marker is a different string, and the scan would count it twice.
{
  const issue = validIssue({ sections: [validSection({ heading: pending('the heading') })] });
  const rendered = renderIssue(issue, CTX);
  const found = findPendingCopy(rendered).filter((f) => f.toLowerCase() === 'the heading');
  check(
    'a pending heading is reported exactly once',
    found.length === 1,
    findPendingCopy(rendered),
  );
}

/* ── 9. Nothing here can send or reach a network ─────────────────────────── */

// The road-report harness already sweeps every file under src/lib/newsletter for
// fetch calls, provider endpoints and secrets, so this asserts the seam that
// sweep cannot: that the issue path never constructs a delivering transport.
{
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  for (const file of [
    'src/lib/newsletter/issue.ts',
    'src/lib/newsletter/issue-render.ts',
    'src/lib/newsletter/issue-validate.ts',
    'src/lib/newsletter/provenance.ts',
    'src/lib/newsletter/cta.ts',
    'src/lib/newsletter/workflow-state.ts',
    'src/lib/newsletter/issues/index.ts',
    'src/lib/newsletter/campaigns/issue-template.ts',
  ]) {
    const src = readFileSync(file, 'utf8');
    check(
      `${file} constructs no transport`,
      !/Transport|\.send\(/.test(src.replace(/\/\*[\s\S]*?\*\//g, ' ')),
    );
    check(`${file} touches no database`, !/supabase|createAdminClient/i.test(src));
  }
}

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
