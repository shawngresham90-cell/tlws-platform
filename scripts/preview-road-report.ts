/**
 * Render the Road Report templates to disk so a human can look at them.
 *
 * Writes one `.html` and one `.txt` per email into an output directory (default
 * `.road-report-preview/`, which is gitignored). Nothing is sent, and no
 * network or database is touched — this only calls the same pure renderer the
 * tests do.
 *
 *   npx esbuild scripts/preview-road-report.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/p.cjs && node /tmp/p.cjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { WELCOME_SERIES } from '@/lib/newsletter/campaigns/welcome';
import { renderEmail } from '@/lib/newsletter/render';
import { findPendingCopy } from '@/lib/newsletter/approval';

const outDir = process.argv[2] ?? '.road-report-preview';
mkdirSync(outDir, { recursive: true });

// A long name on purpose: the QA pass has to look at the case that breaks
// layouts, not the flattering one.
const LONG_NAME = 'Bartholomew Fitzwilliam-Featherstonehaugh III';

for (const email of WELCOME_SERIES) {
  for (const [variant, name] of [
    ['default', 'Marcus'],
    ['longname', LONG_NAME],
    ['noname', null],
  ] as const) {
    const rendered = renderEmail(email, {
      unsubscribeUrl: 'https://truckinglifewithshawn.com/unsubscribe?token=PREVIEW_TOKEN',
      recipientName: name,
    });
    const base = join(outDir, `${email.slug}--${variant}`);
    writeFileSync(`${base}.html`, rendered.html);
    writeFileSync(`${base}.txt`, rendered.text);

    if (variant === 'default') {
      const awaiting = findPendingCopy(rendered);
      console.log(
        `${email.slug}\n  subject: ${rendered.subject}\n  preview: ${rendered.previewText}\n  html: ${rendered.html.length}b  text: ${rendered.text.length}b\n  awaiting approval: ${awaiting.length}`,
      );
    }
  }
}

console.log(`\nWrote previews to ${outDir}/`);
