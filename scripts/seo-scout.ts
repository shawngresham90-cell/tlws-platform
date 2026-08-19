/**
 * SEO-ENGINE-1 — Search Console Opportunity Scout (CLI entry).
 *
 * Read-only. Fetches the last 28 complete days of (query, page) performance
 * for the TLWS property plus the preceding 28 days, classifies opportunities
 * deterministically, and writes two local artifacts:
 *
 *   seo-scout-output/report.md   — the bounded, human-readable owner report
 *   seo-scout-output/data.json   — every qualifying opportunity with its
 *                                  full score decomposition
 *
 * It does NOT: write to the database, commit anything, open PRs, create
 * pages, or run on a schedule. The GitHub workflow that wraps it is
 * manual-dispatch only and uploads the output directory as a run artifact.
 *
 * Exit codes: 0 success (including an honest empty report), 2 credentials
 * missing/invalid (setup instructions printed), 1 any other failure.
 *
 *   npx esbuild scripts/seo-scout.ts --bundle --platform=node --format=cjs \
 *     --outfile=/tmp/scout.cjs && node /tmp/scout.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEFAULT_PROPERTY } from './seo-scout/config';
import { computeWindows, fetchBothWindows } from './seo-scout/gsc';
import { classifyAll } from './seo-scout/classify';
import { buildReport } from './seo-scout/report';
import { ScoutError } from './seo-scout/types';

const OUT_DIR = process.env.SCOUT_OUT_DIR ?? 'seo-scout-output';

async function main(): Promise<number> {
  const property = process.env.GSC_PROPERTY ?? DEFAULT_PROPERTY;
  const windows = computeWindows();
  console.log(
    `Scout: property=${property} window=${windows.current.startDate}..${windows.current.endDate} ` +
      `prior=${windows.prior.startDate}..${windows.prior.endDate}`,
  );

  const { current, prior } = await fetchBothWindows(property, windows);
  console.log(`Scout: fetched ${current.length} current rows, ${prior.length} prior rows.`);

  const opportunities = classifyAll(current, prior);
  const report = buildReport(opportunities, windows);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), report);
  fs.writeFileSync(
    path.join(OUT_DIR, 'data.json'),
    JSON.stringify({ property, windows, opportunities }, null, 2),
  );
  console.log(
    `Scout: ${opportunities.length} qualifying opportunities → ${OUT_DIR}/report.md + data.json`,
  );
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    if (err instanceof ScoutError) {
      console.error(`Scout ${err.code}: ${err.message}`);
      process.exit(err.code === 'MISSING_CREDENTIALS' || err.code === 'BAD_CREDENTIALS' ? 2 : 1);
    }
    console.error('Scout failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
