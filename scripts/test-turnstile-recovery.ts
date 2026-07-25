/**
 * Turnstile retry-recovery tests (offline, source-level).
 *
 * The defect: a Turnstile token is single-use. `guardedPost` verifies it
 * *before* the handler runs, so once a submit reaches the handler the token is
 * spent — and if the handler then fails (500, database error, anything
 * post-verification), the widget still holds the dead token. In "managed" mode
 * it has already auto-solved and will not re-issue on its own, so every retry
 * answers 403 "Verification failed. Reload and try again." The driver is stuck
 * until they manually reload, losing whatever they typed.
 *
 * Three forms handled this (NewsletterForm, SponsorInquiryForm, TestResults):
 * clear the token and bump a React `key` on the widget so the retry gets a
 * fresh challenge. Five did not — including the Academy application and the
 * CDL Pre-School Founding Student claim, the two highest-value conversions on
 * the site. This asserts every Turnstile-guarded form recovers.
 *
 * Source-level on purpose: the failure only appears across a real Cloudflare
 * round trip, which no offline harness can stage. What *is* checkable offline
 * is the contract — a failure path that clears the token and remounts the
 * widget — and that is what regressed.
 *
 * Run:
 *   npx esbuild scripts/test-turnstile-recovery.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-turnstile-recovery.cjs && node /tmp/test-turnstile-recovery.cjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** Bodies of every block whose opening brace matches `opener`, brace-balanced. */
function blocksAfter(src: string, opener: RegExp): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(opener)) {
    let depth = 0;
    const start = src.indexOf('{', m.index);
    if (start < 0) continue;
    for (let i = start; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) {
          out.push(src.slice(start + 1, i));
          break;
        }
      }
    }
  }
  return out;
}

const ROOT = process.cwd();
const WIDGET = 'src/components/apply/TurnstileWidget.tsx';

/** Every component that renders the challenge, minus the widget itself. */
const forms = walk(join(ROOT, 'src'))
  .filter((f) => relative(ROOT, f) !== WIDGET)
  .filter((f) => /<TurnstileWidget\b/.test(readFileSync(f, 'utf8')));

check('scan: found the Turnstile-guarded forms', forms.length >= 6, forms.length);

for (const file of forms) {
  const rel = relative(ROOT, file);
  const src = readFileSync(file, 'utf8');
  const widget = /<TurnstileWidget\b[\s\S]*?\/>/.exec(src)?.[0] ?? '';

  check(
    `${rel}: widget is remountable (carries a key)`,
    /\bkey=\{/.test(widget),
    widget.slice(0, 120),
  );
  check(
    `${rel}: the key is React state, not a constant`,
    /const \[[A-Za-z]*(challengeKey|widgetKey)[^\]]*\] = useState/.test(src),
  );
  check(`${rel}: a failure path clears the spent token`, /setToken\(''\)/.test(src));
  check(
    `${rel}: a failure path bumps the widget key`,
    /set(ChallengeKey|WidgetKey)\(\(?\w+\)? =>/.test(src),
    src.match(/set(ChallengeKey|WidgetKey)[^\n]*/)?.[0],
  );

  // Both legs matter: a non-ok response AND a thrown fetch. Recovering from one
  // but not the other still strands the driver. A non-ok branch may instead
  // `throw` into a catch that resets (TestResults does exactly that), which is
  // equally correct — so check each block's own body.
  //
  // Only submits that actually SEND a token need to recover one. The Academy
  // application's step 2 posts no `turnstileToken` (the server owns that leg),
  // so requiring a reset there would be noise.
  // Submit handlers appear both as `async function submit(...)` and as
  // `const submit = async (...) => {`; cover both shapes.
  const tokenSubmits = [
    ...blocksAfter(src, /(?:async )?function \w+\s*\([^)]*\)\s*\{/g),
    ...blocksAfter(src, /const \w+\s*=\s*async\s*\([^)]*\)\s*(?::[^=]*)?=>\s*\{/g),
  ].filter((body) => body.includes('await fetch(') && body.includes('turnstileToken'));
  check(`${rel}: found the token-carrying submit`, tokenSubmits.length > 0, tokenSubmits.length);

  for (const submit of tokenSubmits) {
    for (const branch of blocksAfter(submit, /if \([^)]*!\s*res\.ok[^)]*\)\s*\{/g)) {
      check(
        `${rel}: the error-response branch resets or rethrows`,
        /setToken\(''\)/.test(branch) || /\bthrow\b/.test(branch),
        branch.slice(0, 160),
      );
    }
    const catches = blocksAfter(submit, /\}\s*catch\s*(?:\([^)]*\))?\s*\{/g);
    check(`${rel}: the token-carrying submit has a catch`, catches.length > 0);
    for (const block of catches) {
      check(
        `${rel}: the catch leg resets the spent token`,
        /setToken\(''\)/.test(block),
        block.slice(0, 160),
      );
    }
  }
}

/* --------- the widget itself still handles the expiry case on its own -- */
{
  const widget = readFileSync(join(ROOT, WIDGET), 'utf8');
  check(
    'widget: an expired token resets the challenge automatically',
    /'expired-callback'[\s\S]{0,320}turnstile\.reset/.test(widget),
  );
  check(
    'widget: an error clears the token so the form cannot submit a dead one',
    /'error-callback'[\s\S]{0,600}onTokenRef\.current\(''\)/.test(widget),
  );
  check(
    'widget: it is torn down on unmount (no stranded iframe or stale token)',
    /turnstile\.remove\(widgetId\.current\)/.test(widget),
  );
}

console.log(`\nturnstile-recovery: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
