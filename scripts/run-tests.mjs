/**
 * Offline test runner. Bundles and runs every `scripts/test-*.ts` harness with
 * the same esbuild invocation each file documents in its own header, then
 * reports one pass/fail summary.
 *
 * The harnesses were always runnable — one at a time, by hand. Nothing ran
 * them together and nothing ran them in CI, so a regression in any of them
 * stayed invisible until someone happened to run that one file. This is the
 * entry point `npm test` and the CI workflow use.
 *
 * Usage:
 *   node scripts/run-tests.mjs              # every harness
 *   node scripts/run-tests.mjs go-links     # only harnesses whose name matches
 *
 * A harness fails the run if esbuild cannot bundle it or if it exits non-zero
 * (every harness ends with `if (failed) process.exit(1)`).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const filters = process.argv.slice(2);
const scriptsDir = new URL('.', import.meta.url).pathname;

const harnesses = readdirSync(scriptsDir)
  .filter((f) => f.startsWith('test-') && f.endsWith('.ts'))
  .map((f) => f.slice('test-'.length, -'.ts'.length))
  .filter((name) => filters.length === 0 || filters.some((f) => name.includes(f)))
  .sort();

if (harnesses.length === 0) {
  console.error(`No harnesses matched: ${filters.join(', ')}`);
  process.exit(1);
}

const outDir = mkdtempSync(join(tmpdir(), 'tlws-tests-'));
const failures = [];
let ran = 0;

for (const name of harnesses) {
  const src = join('scripts', `test-${name}.ts`);
  const out = join(outDir, `test-${name}.cjs`);
  process.stdout.write(`▸ ${name} … `);
  try {
    execFileSync(
      'npx',
      [
        'esbuild',
        src,
        '--bundle',
        '--platform=node',
        '--format=cjs',
        '--jsx=automatic',
        '--alias:@=./src',
        '--alias:server-only=./scripts/shims/server-only.ts',
        // Components may import stylesheets (Leaflet ships its own). Next
        // handles CSS; these offline harnesses only exercise behavior, so
        // stylesheets bundle to nothing rather than failing on their
        // relative image URLs.
        '--loader:.css=empty',
        `--outfile=${out}`,
        '--log-level=error',
      ],
      { stdio: 'pipe' },
    );
  } catch (err) {
    failures.push({ name, stage: 'bundle', output: String(err.stderr ?? err.message) });
    console.log('BUNDLE FAILED');
    continue;
  }
  try {
    const stdout = execFileSync('node', [out], { stdio: 'pipe', encoding: 'utf8' });
    const summary = stdout.trim().split('\n').filter(Boolean).at(-1) ?? 'ok';
    console.log(summary);
    ran += 1;
  } catch (err) {
    failures.push({
      name,
      stage: 'run',
      output: `${err.stdout ?? ''}${err.stderr ?? ''}`.trim() || String(err.message),
    });
    console.log('FAILED');
  }
}

rmSync(outDir, { recursive: true, force: true });

if (failures.length > 0) {
  console.log(`\n${'='.repeat(60)}`);
  for (const f of failures) {
    console.log(`\nFAILED (${f.stage}): scripts/test-${f.name}.ts`);
    console.log(f.output);
  }
  console.log(`\n${ran} passed, ${failures.length} failed of ${harnesses.length} harnesses.`);
  process.exit(1);
}

console.log(`\nAll ${ran} harnesses passed.`);
