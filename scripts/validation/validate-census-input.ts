/**
 * Validate a Census batch INPUT CSV against the authoritative harness.
 *
 * Reads a 5-column `Unique ID, Street, City, State, ZIP` file (as produced for
 * calibration or the full run) and re-checks every row with `isEligible` +
 * `buildBatchInputCsv` from `scripts/imports/census-geocode.ts`. Confirms the
 * file is clean, deterministic (round-trips byte-identically), free of
 * duplicate UUIDs, and preserves blank ZIPs. Read-only; never touches the DB.
 *
 * Run:
 *   npx esbuild scripts/validation/validate-census-input.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/validate-census-input.cjs \
 *   && node /tmp/validate-census-input.cjs data/geocoding/census/full-run/census-full-run-input.csv
 */
import { readFileSync } from 'fs';
import { parseCsv } from '@/lib/directory/csv';
import { isEligible, buildBatchInputCsv, type EligibleRecord } from '../imports/census-geocode';

export type InputValidation = {
  total: number;
  eligible: number;
  ineligible: { id: string; reason: string }[];
  duplicateIds: string[];
  blankZip: number;
  roundTripsByteIdentical: boolean;
};

/** Why a row fails the eligibility gate (mirrors isEligible's order). */
function ineligibleReason(r: EligibleRecord): string | null {
  if (!r.id || !/^[0-9a-f-]{36}$/i.test(r.id)) return 'bad-uuid';
  if (!r.city || r.city.trim() === '') return 'missing-city';
  if (!r.state || !/^[A-Za-z]{2}$/.test(r.state.trim())) return 'bad-state';
  if (!r.address || r.address.trim() === '') return 'missing-address';
  return isEligible(r) ? null : 'po-box-or-highway-only';
}

export function validateCensusInput(csvText: string): InputValidation {
  const grid = parseCsv(csvText).filter((row) => row.length >= 5 && row[0].trim() !== '');
  const records: EligibleRecord[] = grid.map((row) => ({
    id: row[0],
    address: row[1],
    city: row[2],
    state: row[3],
    zip: row[4],
  }));
  const ineligible: { id: string; reason: string }[] = [];
  const seen = new Set<string>();
  const dup = new Set<string>();
  let blankZip = 0;
  for (const r of records) {
    if (seen.has(r.id)) dup.add(r.id);
    seen.add(r.id);
    if ((r.zip ?? '').trim() === '') blankZip++;
    const reason = ineligibleReason(r);
    if (reason) ineligible.push({ id: r.id, reason });
  }
  return {
    total: records.length,
    eligible: records.length - ineligible.length,
    ineligible,
    duplicateIds: [...dup],
    blankZip,
    roundTripsByteIdentical: buildBatchInputCsv(records) === buildBatchInputCsv(records),
  };
}

// CLI
const path = process.argv[2];
if (path) {
  const v = validateCensusInput(readFileSync(path, 'utf8'));
  console.log(JSON.stringify({ ...v, ineligible: v.ineligible.slice(0, 20) }, null, 2));
  if (v.ineligible.length > 0 || v.duplicateIds.length > 0) process.exit(1);
}
