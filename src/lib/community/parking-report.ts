import { z } from 'zod';

/**
 * Driver parking reports (2026-07-30) — the fast, phone-first path for the
 * ~100 drivers testing the Truck Parking directory.
 *
 * SAFETY, non-negotiable: nothing here can modify, publish, unpublish,
 * enrich or overwrite a `public.locations` row. Every submission lands in
 * `public.location_submissions` with status 'pending' and is read by an
 * admin. There is no auto-apply path, and no code in this feature writes to
 * `locations` at all.
 *
 * WHY IT NEEDS NO MIGRATION: `location_submissions` already exists with the
 * columns we need for identity, free text and provenance. The report-specific
 * facts (issue type, evidence URL, route hints for a proposed location) are
 * serialized into a small labeled header at the top of `comments`, which the
 * admin queue parses back out. A proposed migration promoting those to
 * first-class columns ships alongside this feature for review — it is NOT
 * applied, and the feature does not depend on it.
 *
 * Mile markers are never derived here. A driver may tell us an exit; an exit
 * is not a mile marker and is never stored as one.
 */

/** Driver-facing issue types — plain language, no database vocabulary. */
export const ISSUE_TYPES = [
  { value: 'parking-count', label: 'Parking count is wrong' },
  { value: 'overnight', label: 'Overnight information is wrong' },
  { value: 'address', label: 'Address / location is wrong' },
  { value: 'access', label: 'Entrance or access info is wrong' },
  { value: 'closed', label: 'This place is closed' },
  { value: 'route-position', label: 'Exit / route info is wrong' },
  { value: 'other', label: 'Something else' },
] as const;

export type IssueType = (typeof ISSUE_TYPES)[number]['value'];

export const ISSUE_VALUES = ISSUE_TYPES.map((t) => t.value) as [IssueType, ...IssueType[]];

export function issueLabel(value: string): string {
  return ISSUE_TYPES.find((t) => t.value === value)?.label ?? 'Something else';
}

/** Only http(s), and only a bounded length — evidence is a link, not an essay. */
const evidenceUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https?:\/\//i.test(v), { message: 'Use a link starting with http.' });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/**
 * Two report modes in one contract. Both are `.strict()`: a payload carrying
 * any key we did not ask for — `status`, `kind`, `is_published`,
 * `overnight_status`, `reviewed_by`, a table name — is REJECTED with a 400
 * rather than silently stripped, so injection attempts fail loudly.
 *
 *  - `issue`: a correction about a listing the driver is already looking at,
 *    so the location id travels with the request and nothing is re-searched.
 *  - `missing`: a proposed truck-parking location that does not exist yet.
 */
export const parkingReportSchema = z.discriminatedUnion('mode', [
  z
    .object({
      mode: z.literal('issue'),
      locationId: z.string().uuid({ message: 'Missing the listing this report is about.' }),
      issueType: z.enum(ISSUE_VALUES),
      note: optionalText(1000),
      evidence: evidenceUrl.optional(),
      /** Hidden field only bots fill. */
      company_website: z.string().max(0).optional().or(z.literal('')),
    })
    .strict(),
  z
    .object({
      mode: z.literal('missing'),
      name: z.string().trim().min(2, 'Give the place a name.').max(120),
      state: z
        .string()
        .trim()
        .regex(/^[A-Za-z]{2}$/, 'Two-letter state, e.g. GA.')
        .transform((v) => v.toUpperCase()),
      interstate: optionalText(20),
      direction: z.enum(['northbound', 'southbound', 'eastbound', 'westbound']).optional(),
      exitNumber: optionalText(20),
      city: optionalText(80),
      address: optionalText(200),
      parkingDetails: optionalText(500),
      note: optionalText(1000),
      evidence: evidenceUrl.optional(),
      company_website: z.string().max(0).optional().or(z.literal('')),
    })
    .strict(),
]);

export type ParkingReportInput = z.infer<typeof parkingReportSchema>;

/* ------------------------------------------------------------- encoding */

const HEADER_PREFIX = 'tlws-report:';

/**
 * Serialize report facts into a labeled header the admin queue can parse.
 * Values are single-line and sanitized so a driver's text can never forge a
 * header line of its own.
 */
function headerLine(key: string, value: string): string {
  return `${HEADER_PREFIX}${key}=${value.replace(/[\r\n]+/g, ' ').trim()}`;
}

/** Strip any line that imitates our header, so free text cannot spoof fields. */
function sanitizeFreeText(text: string | undefined): string {
  if (!text) return '';
  return text
    .split('\n')
    .filter((l) => !l.trim().toLowerCase().startsWith(HEADER_PREFIX))
    .join('\n')
    .trim();
}

export function encodeReportComments(input: ParkingReportInput): string {
  const lines: string[] = [];
  if (input.mode === 'issue') {
    lines.push(headerLine('issue', input.issueType));
  } else {
    lines.push(headerLine('issue', 'missing-location'));
    if (input.interstate) lines.push(headerLine('interstate', input.interstate));
    if (input.direction) lines.push(headerLine('direction', input.direction));
    // An exit is an exit. It is never recorded as a mile marker.
    if (input.exitNumber) lines.push(headerLine('exit', input.exitNumber));
    if (input.parkingDetails) lines.push(headerLine('parking', input.parkingDetails));
  }
  if (input.evidence) lines.push(headerLine('evidence', input.evidence));
  const free = sanitizeFreeText(input.note);
  return free ? `${lines.join('\n')}\n\n${free}` : lines.join('\n');
}

export type DecodedReport = {
  issueType: string;
  issueLabel: string;
  interstate?: string;
  direction?: string;
  exitNumber?: string;
  parkingDetails?: string;
  evidence?: string;
  note: string;
};

export function decodeReportComments(comments: string | null | undefined): DecodedReport {
  const out: Record<string, string> = {};
  const free: string[] = [];
  for (const line of (comments ?? '').split('\n')) {
    const t = line.trim();
    if (t.toLowerCase().startsWith(HEADER_PREFIX)) {
      const [k, ...rest] = t.slice(HEADER_PREFIX.length).split('=');
      out[k.trim()] = rest.join('=').trim();
    } else {
      free.push(line);
    }
  }
  const issueType = out.issue ?? 'other';
  return {
    issueType,
    issueLabel: issueType === 'missing-location' ? 'Proposed new location' : issueLabel(issueType),
    interstate: out.interstate || undefined,
    direction: out.direction || undefined,
    exitNumber: out.exit || undefined,
    parkingDetails: out.parking || undefined,
    evidence: out.evidence || undefined,
    note: free.join('\n').trim(),
  };
}

/**
 * `kind` values the existing table already accepts. A closure is its own
 * kind so it stands out in triage; every other issue is a correction; a
 * proposed location is 'new' and stays quarantined as a submission row.
 */
export function submissionKindFor(input: ParkingReportInput): 'correction' | 'closure' | 'new' {
  if (input.mode === 'missing') return 'new';
  return input.issueType === 'closed' ? 'closure' : 'correction';
}

/* ------------------------------------------------------ duplicate grouping */

export type ReportRow = {
  id: string;
  location_id: string | null;
  status: string;
  created_at: string | null;
  comments: string | null;
  /** Present on proposed-location rows; absent on corrections. */
  name?: string | null;
  city?: string | null;
  state?: string | null;
};

export type ReportGroup = {
  key: string;
  locationId: string | null;
  issueType: string;
  issueLabel: string;
  count: number;
  latestAt: string | null;
  reports: (ReportRow & { decoded: DecodedReport })[];
};

/**
 * Group reports by (location, issue type) so repeat reports are visible and
 * can be prioritized. Volume is a signal for ATTENTION ONLY — it never
 * approves anything, and the admin still verifies each claim.
 */
export function groupReports(rows: ReportRow[]): ReportGroup[] {
  const map = new Map<string, ReportGroup>();
  for (const row of rows) {
    const decoded = decodeReportComments(row.comments);
    const key = `${row.location_id ?? 'new'}::${decoded.issueType}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.reports.push({ ...row, decoded });
      if ((row.created_at ?? '') > (existing.latestAt ?? '')) existing.latestAt = row.created_at;
    } else {
      map.set(key, {
        key,
        locationId: row.location_id,
        issueType: decoded.issueType,
        issueLabel: decoded.issueLabel,
        count: 1,
        latestAt: row.created_at,
        reports: [{ ...row, decoded }],
      });
    }
  }
  // Most-reported first, then most recent — triage order, not a verdict.
  return [...map.values()].sort(
    (a, b) => b.count - a.count || (b.latestAt ?? '').localeCompare(a.latestAt ?? ''),
  );
}
