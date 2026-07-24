/**
 * /go tracked short-link tests.
 *
 * Covers: every approved slug resolves to an internal destination; UTM
 * params are appended (source/medium/campaign); existing destination query
 * params are preserved; unknown/malformed slugs return null (route falls
 * back to homepage); prototype-chain names never resolve; encoded attempts
 * miss safely; no target is ever external.
 *
 * Run:
 *   npx esbuild scripts/test-go-links.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-go-links.cjs && node /tmp/test-go-links.cjs
 */
import { GO_LINKS, resolveGoLink } from '@/lib/go-links';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

/* ── 1. Every approved slug resolves to an internal, UTM-tagged URL ─────── */
for (const slug of Object.keys(GO_LINKS)) {
  const out = resolveGoLink(slug);
  check(`${slug}: resolves`, out !== null, out);
  if (!out) continue;
  check(`${slug}: internal (starts with /)`, out.startsWith('/'), out);
  check(`${slug}: not protocol-relative`, !out.startsWith('//'), out);
  check(`${slug}: no scheme`, !/^[a-z]+:/i.test(out), out);
  const qs = new URL(out, 'https://x.test').searchParams;
  check(`${slug}: utm_source=youtube`, qs.get('utm_source') === 'youtube', out);
  check(`${slug}: utm_medium=video`, qs.get('utm_medium') === 'video', out);
  check(`${slug}: utm_campaign=${slug}`, qs.get('utm_campaign') === slug, out);
}

/* ── 2. Destination path is preserved ──────────────────────────────────── */
check(
  'directory → /directory path',
  resolveGoLink('directory')?.startsWith('/directory?') === true,
);
check(
  'truck-parking → /directory/parking path',
  resolveGoLink('truck-parking')?.startsWith('/directory/parking?') === true,
  resolveGoLink('truck-parking'),
);

/* ── 3. Existing destination query params are preserved (synthetic) ────── */
// Inject a temporary target with a pre-existing query to prove preservation.
(GO_LINKS as Record<string, string>)['__q_test'] = '/x?a=1&b=2';
{
  const out = resolveGoLink('__q_test');
  const qs = new URL(out!, 'https://x.test').searchParams;
  check('preserves existing a=1', qs.get('a') === '1', out);
  check('preserves existing b=2', qs.get('b') === '2', out);
  check('still tags campaign', qs.get('utm_campaign') === '__q_test', out);
}
// Hash preservation.
(GO_LINKS as Record<string, string>)['__h_test'] = '/x#frag';
{
  const out = resolveGoLink('__h_test');
  check(
    'hash preserved + placed last',
    out === '/x?utm_source=youtube&utm_medium=video&utm_campaign=__h_test#frag',
    out,
  );
}
delete (GO_LINKS as Record<string, string>)['__q_test'];
delete (GO_LINKS as Record<string, string>)['__h_test'];

/* ── 4. Unknown + malformed slugs miss ─────────────────────────────────── */
check('unknown slug → null', resolveGoLink('nope-not-real') === null);
check('empty slug → null', resolveGoLink('') === null);
check('whitespace slug → null', resolveGoLink('   ') === null);

/* ── 5. Prototype-chain attacks never resolve ──────────────────────────── */
for (const evil of [
  'constructor',
  'prototype',
  '__proto__',
  'hasOwnProperty',
  'toString',
  'valueOf',
]) {
  check(`prototype-chain "${evil}" → null`, resolveGoLink(evil) === null, resolveGoLink(evil));
}

/* ── 6. Encoded path / traversal attempts miss (never external) ────────── */
for (const evil of [
  '..%2f..',
  'http%3a%2f%2fevil.com',
  '%2e%2e',
  'evil.com',
  '//evil.com',
  'https://evil.com',
]) {
  const out = resolveGoLink(evil.toLowerCase());
  check(`encoded/external "${evil}" does not resolve`, out === null, out);
}

/* ── 7. No target in the allowlist is external ─────────────────────────── */
for (const [slug, target] of Object.entries(GO_LINKS)) {
  check(`allowlist ${slug} internal`, target.startsWith('/') && !target.startsWith('//'), target);
}

console.log(`\ngo-links: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
