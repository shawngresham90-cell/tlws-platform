/**
 * Guards the founder-story section on /academy.
 *
 * The story is the owner's own account, supplied verbatim and rewritten only
 * for clarity and flow. That makes it the single highest-risk block of copy on
 * the site: every name, figure, and claim in it is a real-world fact about real
 * people and businesses, and none of it can drift into marketing.
 *
 * So these checks are mostly about what must NOT happen:
 *   1. every required beat of the story is actually on the page — no beat gets
 *      quietly dropped in a future edit;
 *   2. the people and businesses named are EXACTLY the four the owner supplied,
 *      and no fifth name appears;
 *   3. the owner's figures appear as given, and no bigger number is invented;
 *   4. no date is stated beyond the single year the owner gave (2008);
 *   5. the three closing lines survive verbatim;
 *   6. the health line stays first-person personal experience, not a claim
 *      about what the school or anything else will do for a reader;
 *   7. the Mission section above it is untouched.
 *
 * Filesystem only. No database, no network, CI-safe.
 *
 *   npx esbuild scripts/test-academy-founder-story.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --outfile=/tmp/t.cjs && node /tmp/t.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const ACADEMY = 'src/app/(academy)/academy/page.tsx';
const academy = read(ACADEMY);

/** Source with comments stripped — what actually ships. */
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const academyCode = codeOnly(academy);

/**
 * Whitespace-collapsed source. Prettier wraps JSX prose at 100 columns, so a
 * sentence in the file is broken by newline + indent at unpredictable points;
 * matching phrases against the raw source would pass or fail on reformatting
 * rather than on content. Every content assertion below runs against this.
 */
const flat = academyCode.replace(/\s+/g, ' ');

/* 1. the section exists, with the agreed heading ----------------------- */

check(
  'the founder story heading is on the page',
  flat.includes('From a $400 Pathfinder to building a CDL school'),
);
check('the story carries its own eyebrow', flat.includes('The founder’s story'));
check('the story is signed by the founder', /founder &amp; lead instructor/.test(flat));
check(
  'the signature uses the shared SITE founder name, not a retyped string',
  /\{SITE\.founder\.name\}/.test(academyCode),
);
check(
  'the page imports SITE',
  /import\s*\{\s*SITE\s*\}\s*from\s*'@\/lib\/seo\/site'/.test(academyCode),
);

/* 2. every required beat is present ------------------------------------ */

const BEATS: Array<[string, RegExp]> = [
  [
    '2008 / trailer / three girls / $6 an hour',
    /single-wide trailer, three little girls, and a dish-washing job that paid \$6/,
  ],
  ['the $400 Pathfinder', /\$400 Pathfinder/],
  ['the alternator and the missing $100', /alternator went out[\s\S]{0,80}\$100/],
  ['Grandpa’s six batteries and charger', /Grandpa had six batteries and a battery charger/],
  ['the broken shifter and the emergency brake', /shifter was broke[\s\S]{0,300}emergency\s+brake/],
  [
    'batteries: twice there, three times back',
    /twice on the way to CDL school[\s\S]{0,60}three\s+more times on the way home/,
  ],
  ['the teacher’s $15 a day', /\$15 a day to clean up after class/],
  ['eight weeks of school', /eight weeks of school/],
  [
    'the background and probation',
    /background from something stupid I did as a kid[\s\S]{0,60}probation/,
  ],
  ['Billy Kay at Rosedale Transport', /Billy Kay at Rosedale Transport/],
  ['the probation officer killing it', /probation officer killed it/],
  ['calling every day for a week', /every day for a week, at different times/],
  ['Billy Kay’s answer, quoted', /as good a driver as you are determined/],
  ['orientation the following Tuesday', /following Tuesday I was in orientation/],
  ['trainer in three months', /Three months later, I became a trainer/],
  ['books, YouTube channel, and this school', /my books, my YouTube channel, and this school/],
  ['the diabetes turnaround', /reversed my own diabetes and got off the meds/],
  ['the misspelled bestseller cover', /misspelled word on the front cover/],
  ['walking away from the investor', /run it like every other diploma mill[\s\S]{0,40}walked away/],
  [
    'curriculum, channels, needed a foundation',
    /I had the curriculum[\s\S]{0,120}right foundation/,
  ],
  ['the lot, two days after', /Two days after I turned down the money, we got the lot/],
  ['Jose Cotto sending a truck', /Jose Cotto[\s\S]{0,90}sent a truck to the lot/],
  ['Brown’s Diesel Repair and the day cab', /Brown’s Diesel Repair[\s\S]{0,90}day cab/],
  [
    'Jennifer Blount / Idle Leasing sending a trailer',
    /Jennifer Blount from Idle Leasing[\s\S]{0,40}sent a trailer/,
  ],
  ['50+ drivers funded the school', /More than 50 drivers stepped up and funded the school/],
];
for (const [name, re] of BEATS) check(`story beat present: ${name}`, re.test(flat), name);

/* 3. exactly the supplied names — no fifth party invented -------------- */

const ALLOWED_NAMES = [
  'Billy Kay',
  'Rosedale Transport',
  'Jose Cotto',
  'Brown’s Diesel Repair',
  'Jennifer Blount',
  'Idle Leasing',
  'Shawn Gresham',
];
for (const n of ALLOWED_NAMES) {
  if (n === 'Shawn Gresham') continue; // comes from SITE, not typed into the story
  check(`supplied name present: ${n}`, academyCode.includes(n));
}
// Any Capitalised Full Name in the story that is not on the allow-list is a
// fabricated attribution — the failure mode that matters most here.
const storyStart = flat.indexOf('The founder’s story');
const storyEnd = flat.indexOf('The program journey');
const storyBlock = storyStart > -1 && storyEnd > storyStart ? flat.slice(storyStart, storyEnd) : '';
check('the story block was located', storyBlock.length > 500, storyBlock.length);
const KNOWN_OK = new Set([
  'Billy Kay',
  'Rosedale Transport',
  'Jose Cotto',
  'Brown Diesel',
  'Jennifer Blount',
  'Idle Leasing',
  'Trucking Life',
  'Life Academy',
  'Trucking Life Academy',
  'Diesel Repair',
  'Miss Jennifer',
  'Never Have',
  'Never Will',
]);
// A capital at the start of a sentence is grammar, not a name ("On Friday",
// "Then Miss"). Only a capitalised word followed by another capitalised word,
// where the first isn't an ordinary sentence opener, looks like an attribution.
const SENTENCE_OPENERS = new Set([
  'On',
  'Then',
  'The',
  'So',
  'But',
  'And',
  'If',
  'My',
  'He',
  'We',
  'It',
  'At',
  'In',
  'A',
  'I',
  'One',
  'Two',
  'Three',
  'More',
  'Life',
  'Never',
  'Now',
  'Just',
  'Sometimes',
  'Finally',
  'People',
  'Gas',
  'Drivers',
  'This',
  'That',
  'Every',
  'Real',
  'Read',
  'See',
  'Apply',
  'Free',
  'Join',
]);
const nameLike = (
  storyBlock.replace(/<[^>]+>/g, ' ').match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) ?? []
).filter((m) => !KNOWN_OK.has(m) && !SENTENCE_OPENERS.has(m.split(' ')[0]));
check('no unapproved person or company name appears in the story', nameLike.length === 0, nameLike);

/* 4. the owner's figures, and no inflation ----------------------------- */

for (const fig of ['17 yrs', '84K+', 'Books on Amazon', 'Violations']) {
  check(`milestone strip carries: ${fig}`, flat.includes(fig));
}
check(
  'the milestone strip is a real definition list, not styled divs',
  /<dl[^>]*>.*STORY_MILESTONES/.test(flat),
);
check('each milestone label is available to screen readers', /<dt className="sr-only">/.test(flat));
check(
  'the story does not restate the four Mission credential chips',
  !/STORY_MILESTONES.{0,400}CDL instructor/.test(flat),
);
// No placement, salary, graduate, or pass-rate number may appear anywhere.
for (const claim of [
  /\b\d+\s*%\s*(placement|pass|job|hire)/i,
  /\b\d+\s+(graduates|students placed)/i,
  /placement rate/i,
  /guaranteed (job|placement|hire)/i,
  /\$\d[\d,]*\s*(a year|per year|salary|starting pay)/i,
]) {
  check(`no invented outcome claim: ${claim}`, !claim.test(academy), claim.source);
}

/* 5. no date beyond the single supplied year --------------------------- */

check('the story states 2008, the one year the owner gave', /\b2008\b/.test(flat));
const otherYears = (storyBlock.match(/\b(19|20)\d{2}\b/g) ?? []).filter((y) => y !== '2008');
check('no other year is stated anywhere in the story', otherYears.length === 0, otherYears);
check(
  'no month-and-day date was invented',
  !/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\b/.test(
    storyBlock,
  ),
);

/* 6. the closing lines, verbatim --------------------------------------- */

check(
  'closing line 1: not for the businessman',
  flat.includes('This school isn’t for the businessman. It’s for the people.'),
);
check(
  'closing line 2: drivers helping drivers',
  /Drivers helping drivers<\/strong> built Trucking Life/.test(flat),
);
check('closing line 3: I don’t give up', flat.includes('I don’t give up. Never have. Never will.'));
check(
  'the mission-to-help-drivers close survives',
  flat.includes('It’s a mission to help drivers succeed.'),
);

/* 7. the health line stays personal, not a promise ---------------------- */

check(
  'the diabetes line is first person about himself',
  /I also reversed my own diabetes/.test(flat),
);
check(
  'the page makes no health claim on the reader’s behalf',
  !/(cure|treat|reverse) your (diabetes|condition)/i.test(academy) &&
    !/will reverse your/i.test(academy),
);
check('the page gives no medical advice', !/stop taking your (meds|medication)/i.test(academy));

/* 8. the Mission section above is untouched ---------------------------- */

for (const copy of [
  'The mission',
  'Drivers helping drivers',
  'The trucking industry is full of schools that treat students like a number',
  'Shawn Gresham has spent 17 years in the seat with zero violations',
  '17 years driving',
  'Zero violations',
]) {
  check(`mission copy intact: “${copy.slice(0, 44)}”`, academy.includes(copy));
}
check(
  'the mission portrait is still rendered',
  flat.includes('/images/journey/academy-instructor-portrait.webp'),
);
check('the mission instructors CTA is still present', flat.includes('href="/academy/instructors"'));
check('tuition copy is untouched', academy.includes('Being finalized'));
check('licensing copy is untouched', academy.includes('Details published when finalized'));
check(
  'academy keeps its 60s revalidate window',
  /^export const revalidate = 60;$/m.test(academyCode),
);
check(
  'academy keeps its course + breadcrumb schema',
  /courseSchema\(\)/.test(academyCode) && /breadcrumbSchema\(/.test(academyCode),
);

/* 9. structure: readable, not a wall of text --------------------------- */

const storyParas = (storyBlock.match(/<p[ >]/g) ?? []).length;
check('the story is broken into many short paragraphs', storyParas >= 18, storyParas);
check(
  'the story uses pull quotes',
  (storyBlock.match(/<blockquote/g) ?? []).length >= 3,
  (storyBlock.match(/<blockquote/g) ?? []).length,
);
check(
  'the Billy Kay quote is attributed with a footer',
  /<footer[^>]*>[\s\S]{0,120}Billy Kay/.test(storyBlock),
);
check('the story column is width-limited for reading', /max-w-3xl/.test(storyBlock));
check(
  'the story heading is an h2, keeping the hierarchy flat',
  /<h2 className="display-section">From a \$400 Pathfinder/.test(flat),
);
check('no h1 was introduced on the page body', !/<h1/.test(flat));

console.log(`academy-founder-story: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
