import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { getParkingQualityQueue } from '@/lib/admin/parking-quality';
import {
  REASON_TEXT,
  ownerActionFor,
  type ParkingQualityResult,
  type PublicationVerdict,
  type CoordinateVerdict,
  type FacilityVerdict,
  type ProvenanceClass,
} from '@/lib/directory/parking-quality';
import { overnightLabelFor } from '@/lib/directory/overnight';
import { DirectoryToolsNav } from '@/components/admin/directory/DirectoryToolsNav';

export const dynamic = 'force-dynamic';
/**
 * An always-live read. supabase-js goes through `fetch`, and Next's Data Cache
 * can otherwise answer a dynamic page's query from a build-time entry — which
 * on this page would mean rendering a stale count as current fact.
 */
export const fetchCache = 'force-no-store';
export const metadata = {
  title: 'Admin — Parking Quality',
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

/**
 * Parking publication evidence queue (PARKING-QUALITY-1).
 *
 * READ-ONLY, deliberately and visibly. There is no Publish button, no Apply
 * button and no form on this page — not because publishing is unimportant
 * but because the queue's job is to say what is still unknown, and a screen
 * that can act on its own verdict invites acting on a verdict nobody
 * checked. Publication stays an owner decision executed from the reviewed
 * package, and `scripts/test-parking-quality.ts` fails if a write control
 * appears here.
 *
 * The page explains rather than colour-codes: every blocked row lists its
 * reason codes with the sentence behind each one, so an admin can tell
 * "we have not looked yet" apart from "we looked and it is not parking".
 */

const VERDICT_LABEL: Record<PublicationVerdict, string> = {
  'ready-for-owner-review': 'Ready for owner review',
  'needs-official-parking-evidence': 'Needs official parking evidence',
  'needs-coordinate-verification': 'Needs coordinate verification',
  'needs-identity-enrichment': 'Needs identity enrichment',
  'needs-duplicate-review': 'Needs duplicate review',
  'needs-direction-review': 'Needs direction review',
  'needs-source-provenance': 'Needs source provenance',
  'held-network-review': 'Held network',
  'non-parking': 'Not parking',
  reject: 'Reject',
  unverifiable: 'Unverifiable',
};

const COORD_LABEL: Record<CoordinateVerdict, string> = {
  verified: 'Verified',
  missing: 'Missing',
  invalid: 'Invalid',
  zero: 'Zero (0,0)',
  'duplicate-coordinate': 'Duplicate coordinate',
  'proximity-collision': 'Proximity collision',
  'direction-conflict': 'Direction conflict',
  unverifiable: 'No provenance',
};

const FACILITY_LABEL: Record<FacilityVerdict, string> = {
  'confirmed-truck-parking': 'Confirmed truck parking',
  'rest-area-with-truck-evidence': 'Rest area (truck evidence)',
  'service-plaza-with-truck-evidence': 'Service plaza (truck evidence)',
  'converted-weigh-site-with-evidence': 'Converted weigh site (evidence)',
  'weigh-or-inspection-only': 'Weigh / inspection only',
  'car-only': 'Car only',
  'non-parking-business': 'Non-parking business',
  unknown: 'Unknown',
};

const PROVENANCE_LABEL: Record<ProvenanceClass, string> = {
  'official-government': 'Official government',
  'official-operator': 'Official operator',
  'owner-reviewed': 'Owner reviewed',
  'published-listing-relationship': 'Published-listing relationship',
  'driver-report-only': 'Driver report only',
  'third-party-directory': 'Third-party directory',
  'legacy-import': 'Legacy import',
  unknown: 'Unknown',
};

type Search = {
  verdict?: string;
  state?: string;
  coord?: string;
  overnight?: string;
  facility?: string;
  provenance?: string;
};

function matches(r: ParkingQualityResult, s: Search): boolean {
  if (s.verdict && r.publication !== s.verdict) return false;
  if (s.state && r.state !== s.state.toUpperCase()) return false;
  if (s.coord && r.coordinate !== s.coord) return false;
  if (s.overnight && r.overnight !== s.overnight) return false;
  if (s.facility && r.facility !== s.facility) return false;
  if (s.provenance && r.provenance !== s.provenance) return false;
  return true;
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1 rounded border border-line px-2 py-0.5 text-xs text-muted">
      <span className="uppercase tracking-wide text-[10px] text-muted/70">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </span>
  );
}

function FilterLink({
  param,
  value,
  active,
  children,
  search,
}: {
  param: keyof Search;
  value: string;
  active: boolean;
  children: React.ReactNode;
  search: Search;
}) {
  const next = new URLSearchParams(
    Object.entries(search).filter(([, v]) => Boolean(v)) as [string, string][],
  );
  if (active) next.delete(param);
  else next.set(param, value);
  const qs = next.toString();
  return (
    <Link
      href={`/admin/directory/parking-quality${qs ? `?${qs}` : ''}`}
      className={`inline-flex min-h-[44px] items-center rounded border px-3 py-2 text-sm transition-colors ${
        active
          ? 'border-signal bg-signal/10 font-semibold text-signal'
          : 'border-line text-muted hover:border-signal hover:text-signal'
      }`}
    >
      {children}
    </Link>
  );
}

export default async function ParkingQualityPage({ searchParams }: { searchParams: Search }) {
  requireAdmin();
  const { results, summary, publishedParkingCount, error } = await getParkingQualityQueue();
  const search: Search = {
    verdict: searchParams.verdict,
    state: searchParams.state,
    coord: searchParams.coord,
    overnight: searchParams.overnight,
    facility: searchParams.facility,
    provenance: searchParams.provenance,
  };
  const shown = results.filter((r) => matches(r, search));
  const states = [...new Set(results.map((r) => r.state))].sort();

  return (
    /* An explicit region for this page's own content. The admin shell has no
       <main>, so anything checking "does this screen contain a write control"
       otherwise falls back to <body> and finds the shell's Sign out form. */
    <div data-testid="pq-queue">
      <DirectoryToolsNav />

      <header className="mt-6">
        <h1 className="font-display text-2xl uppercase text-ink">Parking quality</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Every unpublished parking row, classified against the evidence on record. A row reaches{' '}
          <strong className="text-ink">Ready for owner review</strong> only when the mandatory
          identity, truck-parking, coordinate and duplicate gates all pass — that is a queue
          position, not a decision to publish. Publication happens from the reviewed package, never
          from this screen.
        </p>
      </header>

      {error ? (
        <p
          role="status"
          className="mt-6 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-semibold text-diesel-300"
        >
          The parking-quality read failed ({error}). This is not an empty queue — the rows could not
          be read. Retry, or check the admin database connection.
        </p>
      ) : (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Published parking" value={publishedParkingCount} />
            <Stat label="Unpublished (this queue)" value={summary.total} />
            <Stat label="Ready for owner review" value={summary.readyForOwnerReview} />
            <Stat label="Blocked" value={summary.total - summary.readyForOwnerReview} />
          </section>

          <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Needs source" value={summary.publication['needs-source-provenance']} />
            <Stat
              label="Needs coordinate"
              value={summary.publication['needs-coordinate-verification']}
            />
            <Stat label="Duplicate review" value={summary.publication['needs-duplicate-review']} />
            <Stat
              label="Not parking / reject"
              value={summary.publication['non-parking'] + summary.publication.reject}
            />
          </section>

          <section className="mt-4 rounded-card border border-line bg-asphalt-800 p-4">
            <h2 className="font-display text-sm uppercase text-ink">Overnight (evidence-backed)</h2>
            <p className="mt-1 text-xs text-muted">
              What the evidence supports — independent of publication eligibility, and never derived
              from the legacy <code>overnight_parking</code> boolean. The driver-facing value stays{' '}
              <code>locations.overnight_status</code>; where the two disagree the row is flagged,
              not rewritten.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip label="confirmed" value={String(summary.overnight.confirmed)} />
              <Chip label="prohibited" value={String(summary.overnight.prohibited)} />
              <Chip label="unknown" value={String(summary.overnight.unknown)} />
            </div>
          </section>

          {/* ------------------------------------------------------ filters */}
          <section className="mt-6 space-y-3" aria-label="Filters">
            <FilterRow label="Publication verdict">
              {(Object.keys(VERDICT_LABEL) as PublicationVerdict[])
                .filter((v) => summary.publication[v] > 0)
                .map((v) => (
                  <FilterLink
                    key={v}
                    param="verdict"
                    value={v}
                    active={search.verdict === v}
                    search={search}
                  >
                    {VERDICT_LABEL[v]} ({summary.publication[v]})
                  </FilterLink>
                ))}
            </FilterRow>

            <FilterRow label="State">
              {states.map((st) => (
                <FilterLink
                  key={st}
                  param="state"
                  value={st}
                  active={search.state?.toUpperCase() === st}
                  search={search}
                >
                  {st} ({summary.byState[st]})
                </FilterLink>
              ))}
            </FilterRow>

            <FilterRow label="Coordinate">
              {(Object.keys(COORD_LABEL) as CoordinateVerdict[])
                .filter((v) => summary.coordinate[v] > 0)
                .map((v) => (
                  <FilterLink
                    key={v}
                    param="coord"
                    value={v}
                    active={search.coord === v}
                    search={search}
                  >
                    {COORD_LABEL[v]} ({summary.coordinate[v]})
                  </FilterLink>
                ))}
            </FilterRow>

            <FilterRow label="Overnight">
              {(['confirmed', 'prohibited', 'unknown'] as const).map((v) => (
                <FilterLink
                  key={v}
                  param="overnight"
                  value={v}
                  active={search.overnight === v}
                  search={search}
                >
                  {overnightLabelFor(v)} ({summary.overnight[v]})
                </FilterLink>
              ))}
            </FilterRow>

            <FilterRow label="Facility">
              {(Object.keys(FACILITY_LABEL) as FacilityVerdict[])
                .filter((v) => summary.facility[v] > 0)
                .map((v) => (
                  <FilterLink
                    key={v}
                    param="facility"
                    value={v}
                    active={search.facility === v}
                    search={search}
                  >
                    {FACILITY_LABEL[v]} ({summary.facility[v]})
                  </FilterLink>
                ))}
            </FilterRow>

            <FilterRow label="Source class">
              {(Object.keys(PROVENANCE_LABEL) as ProvenanceClass[])
                .filter((v) => summary.provenance[v] > 0)
                .map((v) => (
                  <FilterLink
                    key={v}
                    param="provenance"
                    value={v}
                    active={search.provenance === v}
                    search={search}
                  >
                    {PROVENANCE_LABEL[v]} ({summary.provenance[v]})
                  </FilterLink>
                ))}
            </FilterRow>
          </section>

          <p className="mt-6 text-sm text-muted" data-testid="pq-count">
            Showing {shown.length} of {results.length} unpublished parking rows
          </p>

          {/* --------------------------------------------------------- rows */}
          <ul className="mt-4 space-y-4">
            {shown.map((r) => (
              <li
                key={r.id}
                data-testid="pq-row"
                data-verdict={r.publication}
                className="rounded-card border border-line bg-asphalt-800 p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-base uppercase text-ink">{r.name}</h3>
                  <span className="rounded border border-signal/40 bg-signal/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-signal">
                    {VERDICT_LABEL[r.publication]}
                  </span>
                </div>

                <p className="mt-1 text-sm text-muted">
                  {r.city}, {r.state}
                  {r.coordinateDetail.interstate ? ` · ${r.coordinateDetail.interstate}` : ''} ·
                  unpublished
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Chip label="coordinate" value={COORD_LABEL[r.coordinate]} />
                  <Chip label="overnight" value={overnightLabelFor(r.overnight)} />
                  <Chip label="facility" value={FACILITY_LABEL[r.facility]} />
                  <Chip label="source" value={PROVENANCE_LABEL[r.provenance]} />
                  {/* Secondary signal. Never a publication input — labelled so
                      nobody reads a high number as permission. */}
                  <Chip label="completeness (secondary)" value={`${r.completenessScore}`} />
                  {r.reportCount > 0 && (
                    <Chip label="pending reports (attention only)" value={String(r.reportCount)} />
                  )}
                </div>

                {r.overnightStoredDiffers && (
                  <p className="mt-3 rounded border border-diesel/40 bg-diesel/10 px-3 py-2 text-xs text-diesel-300">
                    Stored overnight status differs from what the evidence supports. The stored
                    value is unchanged; this is a review flag.
                  </p>
                )}

                <div className="mt-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Why it is blocked
                  </h4>
                  <ul className="mt-1 space-y-1">
                    {r.reasons.map((code) => (
                      <li key={code} className="break-words text-sm text-muted">
                        <code className="text-xs font-semibold text-ink">{code}</code>{' '}
                        {REASON_TEXT[code]}
                      </li>
                    ))}
                  </ul>
                </div>

                {r.duplicateCandidates.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Duplicate candidates
                    </h4>
                    <ul className="mt-1 space-y-1">
                      {r.duplicateCandidates.map((d) => (
                        <li key={d.id} className="break-words text-sm text-muted">
                          {d.name} — {d.why}
                          {d.distanceMiles != null ? ` (${d.distanceMiles} mi)` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 break-words text-sm">
                  {/* The raw URL is dropped here: it is a single unbreakable
                      345px token that pushed the page 22px wide at 360, and
                      the same link renders as "Candidate source" alongside. */}
                  <span className="font-semibold text-ink">
                    Next: {ownerActionFor(r).replace(/:\s*https?:\/\/\S+$/, '')}
                  </span>
                  <Link
                    href={`/admin/directory/${r.id}/edit`}
                    className="min-h-[44px] items-center font-semibold text-signal hover:underline"
                  >
                    Open editor
                  </Link>
                  {r.candidateSourceUrl && (
                    <a
                      href={r.candidateSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="min-h-[44px] items-center font-semibold text-signal hover:underline"
                      title="Candidate source to verify — not evidence until retrieved and recorded"
                    >
                      Candidate source ({r.candidateAgencyKind})
                    </a>
                  )}
                  {r.coordinateDetail.id && r.coordinate === 'verified' && (
                    <span className="text-muted">
                      {r.coordinateDetail.lat}, {r.coordinateDetail.lng}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {shown.length === 0 && (
            <p className="mt-4 rounded-card border border-line bg-asphalt-800 px-4 py-6 text-center text-sm text-muted">
              No unpublished parking rows match these filters.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-line bg-asphalt-800 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl text-ink">{value}</p>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</h3>
      <div className="mt-1.5 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
