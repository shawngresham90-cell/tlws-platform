'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_REGION,
  defaultUnitsFor,
  type Region,
  type UnitSystem,
} from '@/lib/navigator/region';

/**
 * THE ONE place that knows where the region preference is stored.
 *
 * Two screens read it — the driving screen, which owns the setting, and
 * the position preview, which only reads the units it should print — and
 * a preference that two screens each parse for themselves is a preference
 * that will one day disagree with itself. So the key, the envelope, the
 * validation and the "storage is unavailable" fallback are written once
 * here.
 *
 * SESSION storage, deliberately: the region is a per-session choice, so a
 * driver who hands the phone to the next driver does not hand over an
 * assumption about which country's units they read.
 *
 * It is never inferred from GPS. A parked truck in Windsor is not
 * evidence about whose paperwork the driver carries.
 */

/** A third versioned key beside the trip and the truck. */
export const REGION_KEY = 'tlws-navigator-region-v1';

export type RegionPrefs = { region: Region; units: UnitSystem };

export const DEFAULT_REGION_PREFS: RegionPrefs = {
  region: DEFAULT_REGION,
  units: defaultUnitsFor(DEFAULT_REGION),
};

/** Parse a stored envelope; anything unrecognised falls back to the US default. */
export function parseRegionPrefs(raw: string | null): RegionPrefs | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as { v?: unknown; region?: unknown; units?: unknown };
    if (parsed.v !== 1) return null;
    const region: Region = parsed.region === 'CA' ? 'CA' : 'US';
    const units: UnitSystem =
      parsed.units === 'metric'
        ? 'metric'
        : parsed.units === 'imperial'
          ? 'imperial'
          : defaultUnitsFor(region);
    return { region, units };
  } catch {
    return null;
  }
}

export function readRegionPrefs(): RegionPrefs {
  if (typeof window === 'undefined') return DEFAULT_REGION_PREFS;
  try {
    return parseRegionPrefs(sessionStorage.getItem(REGION_KEY)) ?? DEFAULT_REGION_PREFS;
  } catch {
    return DEFAULT_REGION_PREFS;
  }
}

export function writeRegionPrefs(prefs: RegionPrefs): void {
  try {
    sessionStorage.setItem(
      REGION_KEY,
      JSON.stringify({ v: 1, region: prefs.region, units: prefs.units }),
    );
  } catch {
    /* a preference that cannot be stored is still usable this session */
  }
}

/**
 * Read-only view of the preference for screens that display units but do
 * not own the setting. Starts at the US default so the server and the
 * first client paint agree, then adopts the stored choice.
 */
export function useRegionPrefs(): RegionPrefs {
  const [prefs, setPrefs] = useState<RegionPrefs>(DEFAULT_REGION_PREFS);
  useEffect(() => {
    setPrefs(readRegionPrefs());
  }, []);
  return prefs;
}
