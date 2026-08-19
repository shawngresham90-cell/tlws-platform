import { CLUSTERS, REPORT_ABSOLUTE_CAP, REPORT_MAX_OPPORTUNITIES } from './config';
import { ScoutError, type Opportunity, type ScoutWindows } from './types';

/**
 * The human-readable Scout report. Owner-review-sized on purpose: a bounded
 * shortlist with every score explained, never a dump of hundreds of rows.
 * The Scout's entire output is this markdown plus a JSON twin — it commits
 * nothing, publishes nothing, and opens no PRs.
 */

const fmtRow = (o: Opportunity) =>
  `| ${escapeCell(o.query)} | ${escapeCell(shortPath(o.page))} | ${o.current.impressions} | ${
    o.current.clicks
  } | ${o.current.position.toFixed(1)} | ${o.types.join('+')} |`;

const shortPath = (page: string) => page.replace(/^https?:\/\/[^/]+/, '') || '/';
const escapeCell = (s: string) => s.replace(/\|/g, '\\|');

const TABLE_HEADER = `| query | page | impressions | clicks | position | opportunity |\n| --- | --- | --- | --- | --- | --- |`;

function section(title: string, items: Opportunity[], cap: number): string {
  if (items.length === 0) return `## ${title}\n\n_No qualifying rows in this period._\n`;
  const rows = items.slice(0, cap).map(fmtRow);
  const omitted = items.length - rows.length;
  return `## ${title}\n\n${TABLE_HEADER}\n${rows.join('\n')}\n${
    omitted > 0 ? `\n_${omitted} further row(s) below the cap — see the JSON artifact._\n` : ''
  }`;
}

/** Markers that must never appear in a report. Belt-and-suspenders: nothing
 *  feeds credentials into the pipeline, but if a key ever leaked into a
 *  query string or page URL upstream, refuse to write the report at all. */
const CREDENTIAL_MARKERS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /"private_key"/,
  /\bya29\.[\w-]+/,
];

export function buildReport(
  opportunities: Opportunity[],
  windows: ScoutWindows,
  maxOpportunities: number = REPORT_MAX_OPPORTUNITIES,
): string {
  const cap = Math.min(maxOpportunities, REPORT_ABSOLUTE_CAP);
  const byCluster = (key: string) => opportunities.filter((o) => o.cluster === key);
  const byType = (t: string) => opportunities.filter((o) => o.types.includes(t as never));
  const queue = opportunities.slice(0, cap);

  const lines: string[] = [];
  lines.push('# TLWS SEO Opportunity Report');
  lines.push('');
  lines.push(
    `Period:\n${windows.current.startDate} → ${windows.current.endDate} (compared with ${windows.prior.startDate} → ${windows.prior.endDate})`,
  );
  lines.push('');
  lines.push(
    "_Read-only evidence from Search Console. Scores are the Scout's own prioritization heuristic (documented in scripts/seo-scout/config.ts), not a Google metric. Nothing here has been created, changed, or published — every line is an owner decision._",
  );
  lines.push('');

  if (opportunities.length === 0) {
    lines.push('## No opportunities this period');
    lines.push('');
    lines.push(
      'Search Console returned no rows meeting the documented thresholds for this window. ' +
        'This is an honest empty report — no data was fabricated. If the property is new ' +
        'or credentials were just added, allow a few weeks of data to accumulate.',
    );
    return finish(lines);
  }

  for (const c of CLUSTERS) lines.push(section(c.label, byCluster(c.key), cap));
  lines.push(section('Striking Distance', byType('STRIKING_DISTANCE'), cap));
  lines.push(section('Decay', byType('DECAY'), cap));
  lines.push(section('Potential Gaps', byType('GAP'), cap));
  lines.push(section('Strengthen', byType('STRENGTHEN'), cap));

  lines.push(`## Recommended Owner Review Queue`);
  lines.push('');
  lines.push(
    `Top ${queue.length} of ${opportunities.length} qualifying opportunities (capped at ${cap}); every score decomposed so the ranking is arguable, not oracular.`,
  );
  lines.push('');
  for (const [i, o] of queue.entries()) {
    const c = o.scoreComponents;
    lines.push(
      `${i + 1}. **${escapeCell(o.query)}** → \`${o.targetUrl}\` — **${o.action}** (${o.types.join(
        '+',
      )}, ${o.cluster})`,
    );
    lines.push(`   - why: ${o.why}`);
    lines.push(
      `   - score ${o.score} = headroom ${c.headroomClicks} clicks/28d (impr ${c.impressions} × [expCTR@${c.targetPosition} ${c.expectedCtr} − CTR ${c.ctr.toFixed(3)}]) ` +
        `+ momentum ${c.clicksDelta}, × cluster ${c.clusterWeight} × type ${c.typeMultiplier}`,
    );
  }
  return finish(lines);
}

function finish(lines: string[]): string {
  const report = lines.join('\n') + '\n';
  for (const marker of CREDENTIAL_MARKERS) {
    if (marker.test(report)) {
      throw new ScoutError(
        'REPORT_SAFETY',
        'Report generation aborted: output matched a credential marker.',
      );
    }
  }
  return report;
}
