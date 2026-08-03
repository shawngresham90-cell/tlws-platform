/**
 * Render every Road Report issue to disk for review, at each viewport.
 *
 * Writes into `.road-report-preview/issues/` (gitignored). Nothing is sent and
 * no network or database is touched — this calls the same pure compiler,
 * renderer and validator the tests do.
 *
 * WHY THE VIEWPORTS ARE IFRAMES IN ONE FILE. The email HTML is a complete
 * document with its own `<body>`; pasting three copies into one page would
 * produce invalid markup and let the widest copy's styles decide the layout.
 * Each viewport is a real iframe at a real width, so what you see is the email
 * rendering at that width rather than a scaled picture of it.
 *
 *   npx esbuild scripts/preview-road-report-issue.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/p.cjs && node /tmp/p.cjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ISSUES } from '@/lib/newsletter/issues';
import { ROAD_REPORT } from '@/lib/newsletter/brand';
import { describeIssue, renderIssue } from '@/lib/newsletter/issue-render';
import { validateIssue } from '@/lib/newsletter/issue-validate';
import { ISSUE_STATE_LABELS } from '@/lib/newsletter/workflow-state';

const outDir = join(process.argv[2] ?? '.road-report-preview', 'issues');
mkdirSync(outDir, { recursive: true });

/** Real device widths, not round numbers. 375 is the narrow end that matters. */
const VIEWPORTS = [
  { key: 'mobile', label: 'Mobile', width: 375 },
  { key: 'tablet', label: 'Tablet', width: 768 },
  { key: 'desktop', label: 'Desktop', width: 1024 },
] as const;

const UNSUBSCRIBE_URL = 'https://truckinglifewithshawn.com/unsubscribe?token=PREVIEW_TOKEN';

function shell(issue: (typeof ISSUES)[number], html: string, problems: string[]): string {
  const frames = VIEWPORTS.map(
    (v) => `
    <figure style="margin:0 0 32px 0;">
      <figcaption style="font:600 13px/1.4 ui-monospace,monospace;color:#555;margin:0 0 8px;">
        ${v.label} — ${v.width}px
      </figcaption>
      <iframe title="${v.label} preview" srcdoc="${html.replace(/"/g, '&quot;')}"
        style="width:${v.width}px;max-width:100%;height:720px;border:1px solid #ccc;background:#fff;"></iframe>
    </figure>`,
  ).join('');

  const problemList = problems.length
    ? `<ul style="margin:0;padding-left:20px;">${problems.map((p) => `<li>${p.replace(/</g, '&lt;')}</li>`).join('')}</ul>`
    : '<p style="margin:0;color:#137333;">No validation problems.</p>';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${ROAD_REPORT.name} #${issue.number} — preview</title></head>
<body style="margin:0;padding:24px;font:14px/1.5 system-ui,sans-serif;background:#f6f6f4;color:#222;">
  <h1 style="font-size:20px;margin:0 0 4px;">${ROAD_REPORT.name} #${issue.number}</h1>
  <p style="margin:0 0 4px;color:#555;">${issue.slug} · ${issue.date} · <strong>${ISSUE_STATE_LABELS[issue.state]}</strong></p>
  <section style="margin:16px 0 28px;padding:12px 16px;border-left:4px solid ${problems.length ? '#b91c1c' : '#137333'};background:#fff;">
    <h2 style="font-size:14px;margin:0 0 8px;">Validation — ${problems.length} problem(s)</h2>
    ${problemList}
  </section>
  ${frames}
  <p style="color:#555;">Dark-mode and plain-text renderings are written alongside this file.</p>
</body></html>`;
}

let anyBlocked = 0;

for (const issue of ISSUES) {
  const rendered = renderIssue(issue, { unsubscribeUrl: UNSUBSCRIBE_URL, recipientName: 'Marcus' });
  const validation = validateIssue(issue, rendered, {
    unsubscribeUrl: UNSUBSCRIBE_URL,
    publisher: ROAD_REPORT.publisher,
  });
  const problems = validation.problems.map(
    (p) => `${p.code}${p.section ? ` [${p.section}]` : ''}: ${p.detail}`,
  );

  const base = join(outDir, issue.slug);
  writeFileSync(`${base}.html`, shell(issue, rendered.html, problems));
  writeFileSync(`${base}--email.html`, rendered.html);
  writeFileSync(`${base}--plain.txt`, rendered.text);

  // Dark mode: the email already carries `prefers-color-scheme` rules, so this
  // wrapper just forces the surrounding page dark. It is a way to see the
  // media query fire, not a second rendering of the email.
  writeFileSync(
    `${base}--dark.html`,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="color-scheme" content="dark"><title>${issue.slug} — dark</title><style>:root{color-scheme:dark}body{margin:0;background:#0f0f10}</style></head><body><iframe title="Dark mode preview" srcdoc="${rendered.html.replace(/"/g, '&quot;')}" style="width:100%;height:100vh;border:0;"></iframe></body></html>`,
  );

  console.log(describeIssue(issue));
  console.log(
    `  html ${rendered.html.length}b · text ${rendered.text.length}b · problems ${problems.length}`,
  );
  for (const p of problems.slice(0, 6)) console.log(`    - ${p}`);
  if (problems.length > 6) console.log(`    … and ${problems.length - 6} more`);

  // An issue past `draft` that fails validation is a real problem worth a
  // non-zero exit; a draft that fails is simply a draft.
  if (issue.state !== 'draft' && problems.length > 0) anyBlocked++;
}

console.log(`\nWrote ${ISSUES.length} issue preview(s) to ${outDir}/`);
if (anyBlocked > 0) {
  console.error(`${anyBlocked} non-draft issue(s) fail validation.`);
  process.exit(1);
}
