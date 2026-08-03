/**
 * Directory write-route guard tests (offline).
 *
 * The defect this pins against returning: `guardedPost` verified a Turnstile
 * token only IF ONE ARRIVED, and the directory schemas mark the token
 * `.optional()`. A bot that simply omitted the field walked past verification
 * entirely — the widget-wired forms were protected against everyone except
 * the abusers. The fix is an explicit strict mode (`requireTurnstile: true`)
 * where a missing token is a failed verification, applied to the two routes
 * whose forms render the widget and always send a token.
 *
 * Coverage is source-level for the wiring (the real failure needs a live
 * Cloudflare round trip no offline harness can stage) plus a behavioral pin
 * on the one strict-mode path that must keep working offline: development
 * without a configured secret still skips, so `verifyTurnstile('')` cannot
 * brick local form work.
 *
 * Run:
 *   npx esbuild scripts/test-directory-write-guards.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-directory-write-guards.cjs && node /tmp/test-directory-write-guards.cjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { verifyTurnstile } from '@/lib/api/turnstile';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const handler = read('src/lib/api/handler.ts');
const turnstile = read('src/lib/api/turnstile.ts');
const review = read('src/app/api/directory/review/route.ts');
const submission = read('src/app/api/directory/submission/route.ts');
const parkingReport = read('src/app/api/directory/parking-report/route.ts');

async function main() {
  /* ------------------------------------------------ strict mode exists */
  check(
    'guard: strict mode treats a MISSING token as a failed verification',
    /requireTurnstile === true/.test(handler) &&
      /verifyTurnstile\(maybeToken \?\? ''/.test(handler),
  );
  check(
    'guard: verified-if-present mode is unchanged for widgetless routes',
    /opts\.requireTurnstile !== false && maybeToken/.test(handler),
  );
  check(
    'guard: both verification failures return the same 403',
    (
      handler.match(/fail\('Verification failed\. Reload and try again\.', 403, 'turnstile'\)/g) ??
      []
    ).length === 2,
  );

  /* --------------------------------------- routes with widget-wired forms */
  check(
    'review route is strict — its form always sends a token',
    /requireTurnstile: true/.test(review),
  );
  check(
    'submission route is strict — its form always sends a token',
    /requireTurnstile: true/.test(submission),
  );
  // Deliberate, documented exception: the parking-report sheet renders no
  // widget (friction tradeoff for the driver test cohort), so strict mode
  // there would break the feature outright. If a widget lands in
  // ReportParkingSheet, flip the route to strict and update this check.
  check(
    'parking-report stays verified-if-present until its sheet gains a widget',
    !/requireTurnstile: true/.test(parkingReport),
  );

  /* --------------------------------------------------- timeout + fail-closed */
  check(
    'siteverify fetch is bounded by a timeout (stalls fail closed, not hang)',
    /AbortSignal\.timeout\(/.test(turnstile),
  );
  check('siteverify errors fail closed', /catch[\s\S]{0,200}return false;/.test(turnstile));

  /* --------------------------------------------- dev-skip behavioral pin */
  // Strict mode calls verifyTurnstile('') when no token arrives. In a dev
  // environment with no TURNSTILE_SECRET_KEY that must still SKIP (return
  // true) — otherwise local form development is bricked by the hardening.
  delete process.env.TURNSTILE_SECRET_KEY;
  check(
    'dev without a secret still skips verification for an empty token',
    (await verifyTurnstile('')) === true,
  );

  console.log(`directory-write-guards: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
