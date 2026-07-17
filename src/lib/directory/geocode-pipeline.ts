import { toCsv } from './csv';
import { GEOCODING_COLUMNS } from './geocoding';
import {
  verifyListingCoordinate,
  normalizeInterstate,
  type VerificationResult,
} from './coordinate-verification';
import {
  indexCalibrations,
  interpolateAlongCorridor,
  parseExitNumber,
  EXIT_NUMBERING,
  type CalibrationSet,
  type InterpolationFailure,
  type InterpolationResult,
} from './interpolation';
import { haversineMiles } from '@/lib/map/geo';

/**
 * Dry-run geocoding pipeline (Phase 2A). Pure: rows in, classified report
 * out. It NEVER writes — its only products are report objects and CSV text.
 * The candidates CSV it emits uses the exact 15-column contract of the
 * existing admin geocoding console, so the ONLY path from a pipeline result
 * to the database is the shipped human-review apply tool (per-row selection,
 * overwrite confirmation, history-before-mutation). Interpolated confidence
 * is capped at 'medium' and action is always 'manual-review', so nothing the
 * pipeline produces is ever auto-applicable.
 */

export type PipelineListing = {
  id: string;
  name: string;
  categorySlug: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  interstate: string;
  exitNumber: string;
};

export type RowClass =
  | 'already-geocoded' // has coordinates that pass every check
  | 'existing-suspect' // has coordinates flagged by state/corridor triage
  | 'existing-invalid' // has coordinates that fail the hard US gate
  | 'interpolated' // missing coords; mile-marker interpolation proposed
  | 'conflict' // has coords AND interpolation disagrees beyond threshold
  | 'needs-external-geocode' // missing coords; has a street address to geocode
  | 'unresolved'; // missing coords; no reliable path without research

export type ClassifiedRow = {
  listing: PipelineListing;
  klass: RowClass;
  /** Verification of the listing's EXISTING coordinates. */
  verification: VerificationResult;
  /** Interpolation attempt outcome (present when one was attempted). */
  interpolation?: InterpolationResult;
  /** Proposed coordinates (interpolated rows only). */
  proposed?: { lat: number; lng: number; confidence: 'medium' | 'low' };
  /** Miles between existing coords and interpolation (conflict metric). */
  conflictMiles?: number;
  /** Different listing whose verified coords sit implausibly close. */
  nearListingId?: string;
  notes: string[];
};

export type PipelineSummary = {
  total: number;
  alreadyGeocoded: number;
  existingSuspect: number;
  existingInvalid: number;
  interpolated: number;
  interpolatedMedium: number;
  interpolatedLow: number;
  conflicts: number;
  needsExternalGeocode: number;
  unresolved: number;
  unresolvedReasons: Record<string, number>;
  statesWithoutBounds: string[];
};

export type PipelineReport = {
  generatedAt: string;
  rows: ClassifiedRow[];
  summary: PipelineSummary;
};

export type PipelineOptions = {
  /** Existing-vs-interpolated disagreement that flags a conflict (miles). */
  conflictThresholdMiles?: number;
  /** Interpolated point this close to a DIFFERENT verified listing is noted. */
  nearDuplicateMiles?: number;
  /** Timestamp injected by the caller (scripts pass their own clock). */
  generatedAt?: string;
};

/**
 * External geocoder adapter seam (Phase 2B). Phase 2A ships the interface and
 * the null implementation ONLY — the pipeline itself never performs network
 * I/O, and no adapter with network access exists in this codebase yet.
 */
export type ExternalGeocoderAdapter = {
  name: string;
  /** Resolve a street address to coordinates, or null when it cannot. */
  geocode(query: {
    address: string;
    city: string;
    state: string;
    zip: string;
  }): Promise<{ lat: number; lng: number; confidence: 'high' | 'medium' | 'low' } | null>;
};

/** The default adapter: resolves nothing, proving the pipeline runs offline. */
export const nullGeocoder: ExternalGeocoderAdapter = {
  name: 'null',
  geocode: async () => null,
};

export function runGeocodePipeline(
  listings: PipelineListing[],
  calibrations: CalibrationSet,
  options: PipelineOptions = {},
): PipelineReport {
  const conflictThreshold = options.conflictThresholdMiles ?? 2;
  const nearDuplicateMiles = options.nearDuplicateMiles ?? 0.05;
  const calIndex = indexCalibrations(calibrations);

  const verifiedPoints = listings
    .filter((l) => l.lat != null && l.lng != null)
    .map((l) => ({ id: l.id, lat: l.lat as number, lng: l.lng as number }));

  const rows: ClassifiedRow[] = listings.map((listing) => {
    const verification = verifyListingCoordinate({
      id: listing.id,
      name: listing.name,
      city: listing.city,
      state: listing.state,
      interstate: listing.interstate,
      lat: listing.lat,
      lng: listing.lng,
    });
    const notes: string[] = [];
    const hasCoords = listing.lat != null && listing.lng != null;

    const interpolation = interpolateAlongCorridor(
      calIndex,
      listing.state,
      listing.interstate,
      listing.exitNumber,
    );

    if (hasCoords) {
      if (verification.severity === 'invalid') {
        return { listing, klass: 'existing-invalid', verification, interpolation, notes };
      }
      // Coordinates exist and are plausible — check they agree with the
      // corridor math when interpolation is possible.
      if (interpolation.ok) {
        const miles = haversineMiles(
          { lat: listing.lat as number, lng: listing.lng as number },
          { lat: interpolation.lat, lng: interpolation.lng },
        );
        if (miles > conflictThreshold + interpolation.gapMiles / 2) {
          notes.push(`existing coords are ${miles.toFixed(1)} mi from interpolated position`);
          return {
            listing,
            klass: 'conflict',
            verification,
            interpolation,
            conflictMiles: Number(miles.toFixed(1)),
            notes,
          };
        }
      }
      return {
        listing,
        klass: verification.severity === 'suspect' ? 'existing-suspect' : 'already-geocoded',
        verification,
        interpolation,
        notes,
      };
    }

    // Missing coordinates: interpolation first, address geocoding second.
    if (interpolation.ok) {
      let nearListingId: string | undefined;
      for (const v of verifiedPoints) {
        if (v.id === listing.id) continue;
        const d = haversineMiles(
          { lat: v.lat, lng: v.lng },
          {
            lat: interpolation.lat,
            lng: interpolation.lng,
          },
        );
        if (d <= nearDuplicateMiles) {
          nearListingId = v.id;
          notes.push(`interpolated point is within ${nearDuplicateMiles} mi of listing ${v.id}`);
          break;
        }
      }
      return {
        listing,
        klass: 'interpolated',
        verification,
        interpolation,
        proposed: {
          lat: interpolation.lat,
          lng: interpolation.lng,
          confidence: interpolation.confidence,
        },
        nearListingId,
        notes,
      };
    }

    notes.push(`interpolation: ${interpolation.reason}`);
    if (listing.address.trim() !== '') {
      return { listing, klass: 'needs-external-geocode', verification, interpolation, notes };
    }
    return { listing, klass: 'unresolved', verification, interpolation, notes };
  });

  return { generatedAt: options.generatedAt ?? '', rows, summary: summarize(rows) };
}

function summarize(rows: ClassifiedRow[]): PipelineSummary {
  const count = (k: RowClass) => rows.filter((r) => r.klass === k).length;
  const unresolvedReasons: Record<string, number> = {};
  const statesWithoutBounds = new Set<string>();
  for (const r of rows) {
    if (r.verification.findings.includes('state-unknown') && r.listing.state) {
      statesWithoutBounds.add(r.listing.state.trim().toUpperCase());
    }
    if (r.klass === 'unresolved' || r.klass === 'needs-external-geocode') {
      const reason = r.interpolation && !r.interpolation.ok ? r.interpolation.reason : 'unknown';
      unresolvedReasons[reason] = (unresolvedReasons[reason] ?? 0) + 1;
    }
  }
  const interpolatedRows = rows.filter((r) => r.klass === 'interpolated');
  return {
    total: rows.length,
    alreadyGeocoded: count('already-geocoded'),
    existingSuspect: count('existing-suspect'),
    existingInvalid: count('existing-invalid'),
    interpolated: interpolatedRows.length,
    interpolatedMedium: interpolatedRows.filter((r) => r.proposed?.confidence === 'medium').length,
    interpolatedLow: interpolatedRows.filter((r) => r.proposed?.confidence === 'low').length,
    conflicts: count('conflict'),
    needsExternalGeocode: count('needs-external-geocode'),
    unresolved: count('unresolved'),
    unresolvedReasons,
    statesWithoutBounds: [...statesWithoutBounds].sort(),
  };
}

/** Why a row could not be interpolated, for reporting. */
export function interpolationFailureLabel(reason: InterpolationFailure): string {
  return reason;
}

/**
 * Candidates CSV for the interpolated rows, in the admin geocoding console's
 * exact 15-column contract (plus evidence columns the console treats as
 * optional). Every row ships action='manual-review' — a human must inspect
 * and upgrade each one in the console before anything can be applied.
 */
export function dryRunCandidatesCsv(report: PipelineReport): string {
  const header = [...GEOCODING_COLUMNS, 'confidence_reason', 'reviewer_notes', 'priority'];
  const rows = report.rows
    .filter((r) => r.klass === 'interpolated' && r.proposed)
    .map((r) => {
      const interp = r.interpolation;
      const detail =
        interp && interp.ok
          ? `interpolated between mileposts ${interp.lower.milepost} and ${interp.upper.milepost} (gap ${interp.gapMiles} mi)`
          : 'interpolated';
      return [
        r.listing.id,
        r.listing.name,
        r.listing.categorySlug,
        r.listing.address,
        r.listing.city,
        r.listing.state,
        r.listing.zip,
        r.listing.lat ?? '',
        r.listing.lng ?? '',
        r.proposed!.lat.toFixed(6),
        r.proposed!.lng.toFixed(6),
        r.proposed!.confidence,
        '',
        `mile-marker interpolation; ${detail}${r.notes.length ? '; ' + r.notes.join('; ') : ''}`,
        'manual-review',
        `anchor gap based; capped at medium by design`,
        r.nearListingId ? `check near-duplicate against listing ${r.nearListingId}` : '',
        r.proposed!.confidence === 'medium' ? 'high' : 'normal',
      ];
    });
  return toCsv([header, ...rows]);
}

/** Machine-readable audit file for the whole run. */
export function dryRunReportJson(report: PipelineReport): string {
  return JSON.stringify(
    {
      generatedAt: report.generatedAt,
      summary: report.summary,
      rows: report.rows.map((r) => ({
        id: r.listing.id,
        name: r.listing.name,
        state: r.listing.state,
        interstate: normalizeInterstate(r.listing.interstate),
        exit: r.listing.exitNumber,
        milepost: parseExitNumber(r.listing.exitNumber),
        exitNumbering: EXIT_NUMBERING[r.listing.state?.trim().toUpperCase()] ?? 'unknown',
        class: r.klass,
        existing: r.listing.lat != null ? { lat: r.listing.lat, lng: r.listing.lng } : null,
        proposed: r.proposed ?? null,
        interpolation:
          r.interpolation && r.interpolation.ok
            ? {
                gapMiles: r.interpolation.gapMiles,
                anchorSpanMiles: r.interpolation.anchorSpanMiles,
                lowerMilepost: r.interpolation.lower.milepost,
                upperMilepost: r.interpolation.upper.milepost,
              }
            : r.interpolation
              ? { failed: r.interpolation.reason }
              : null,
        verification: {
          severity: r.verification.severity,
          findings: r.verification.findings,
          milesOutsideState: r.verification.milesOutsideState,
          milesOutsideCorridor: r.verification.milesOutsideCorridor,
        },
        conflictMiles: r.conflictMiles ?? null,
        nearListingId: r.nearListingId ?? null,
        notes: r.notes,
      })),
    },
    null,
    2,
  );
}
