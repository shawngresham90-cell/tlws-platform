'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PARKED_REMINDER, standardSetupDecision } from '@/lib/navigator/navigator-entry';
import { DISPLAY_MODE_CHOICES, type DisplayMode } from '@/lib/navigator/display-mode';
import {
  CANADA_HOS_NOTICE,
  defaultUnitsFor,
  type Region,
  type UnitSystem,
} from '@/lib/navigator/region';
import { CLOCKS_UNSET, type ClockEntryState } from '@/lib/navigator/hos-clocks';
import {
  confirmProfile,
  routingFingerprint,
  validateEditableProfile,
  DEFAULT_EDITABLE_PROFILE,
  type EditableProfile,
} from '@/lib/navigator/truck-profile';
import {
  DEFAULT_ROUTE_PREFERENCES,
  type RoutePreferences,
} from '@/lib/navigator/route-preferences';
import { parseTripSnapshot, TRIP_RESTORE_KEY } from '@/lib/navigator/trip-restore';
import { useAccountSync, type SyncTransport } from './account-sync';
import { useDisplayMode } from './DisplayModeProvider';
import { ClockSetup } from './ClockSetup';
import { DriverNameEntry } from './DriverNameEntry';
import { RegionPanel } from './RegionPanel';
import { RoutePreferencesPanel } from './RoutePreferencesPanel';
import { TruckProfileEditor } from './TruckProfileEditor';
import { TruckSummary } from './TruckSummary';
import { readClocks, writeClocks } from './clocks-storage';
import { clearDriverName, readDriverName, writeDriverName } from './driver-storage';
import { DEFAULT_REGION_PREFS, readRegionPrefs, writeRegionPrefs } from './region-storage';
import { readRoutePrefs, writeRoutePrefs } from './route-prefs-storage';
import { readTruck, writeTruck } from './truck-storage';
import { clearVoiceChoice, voiceEnabledByDefault, writeVoiceChoice } from './voice-storage';
import { clearDisplayMode } from './display-storage';

/**
 * The ONE Navigator settings surface (NAV-ENTRY-1).
 *
 * WHAT THIS REPLACED. Every panel below already existed — the truck editor,
 * the clock form, the region picker, the preference panel, the name entry.
 * They were stacked on the driving screen above the destination search, which
 * is how Start Route ended up 5,906 px down a phone. Nothing here is a new
 * model: each section mounts the SAME component against the SAME storage
 * authority the driving screen uses, so there is exactly one truck, one set of
 * clocks, one region, one preference record and one name in the app.
 *
 * THE MOTION LOCK IS GONE FROM THIS SCREEN, and that is an owner decision
 * rather than an oversight. Every control here used to disappear behind a
 * "locked while moving" card offering PASSENGER ACCESS — a press-and-hold
 * dialog asking whoever was holding the phone to declare they were not
 * driving. A parked driver under a truck-stop canopy with no GPS got the same
 * question, which has no honest answer. What stands in its place is the
 * sentence at the top of this file's render: it says the true thing and
 * disables nothing.
 *
 * THE ACTIVE TRIP IS NEVER TOUCHED HERE. There is no lifecycle on this route
 * — no map, no GPS provider, no route port — so a truck edit made mid-drive
 * CANNOT reach the route already being driven even by accident. It is written
 * for the next plan, and the driver is told so in as many words.
 *
 * ACCOUNT SYNC FOLLOWED THE EDITORS HERE, and had to. The truck, the route
 * preferences and the clocks are three of the four synced records, and the
 * driving screen used to nudge sync because that is where they were changed.
 * Moving the editors without moving the nudge would have left a driver's
 * second phone quietly out of date — a silent failure, the worst kind. The
 * ORDER is unchanged and is the point: every `notifySaved` below runs AFTER
 * the local write has already completed, so a dead network cannot delay a
 * save or stand between a driver and the road.
 */

/** What a driver is told when a routing-critical edit lands mid-trip. */
export const NEXT_ROUTE_NOTICE = 'Saved. This change applies to your next route.';

export function NavigatorSettings({
  /*
   * The SERVER's reading of the access mode, handed down exactly as the
   * driving screen receives it. False in pilot, public and closed — and false
   * is inert: no session is read and no account row is fetched.
   */
  accountMode = false,
  /** Injectable network edge, so a harness can observe real synchronisation. */
  syncTransport,
}: {
  accountMode?: boolean;
  syncTransport?: SyncTransport;
} = {}) {
  const { mode: displayMode, setMode: setDisplayMode } = useDisplayMode();
  const { restoreNonce, notifySaved } = useAccountSync({
    enabled: accountMode,
    transport: syncTransport,
  });

  /*
   * Every record starts at its documented default and is adopted in an
   * effect — storage is never read during render, so the server's paint and
   * the client's first paint agree. Same discipline as the driving screen.
   */
  const [firstName, setFirstName] = useState<string | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION_PREFS.region);
  const [units, setUnits] = useState<UnitSystem>(DEFAULT_REGION_PREFS.units);
  const [truckProfile, setTruckProfile] = useState<EditableProfile>(DEFAULT_EDITABLE_PROFILE);
  const [truckSaved, setTruckSaved] = useState(false);
  const [editingTruck, setEditingTruck] = useState(false);
  const [routePrefs, setRoutePrefs] = useState<RoutePreferences>(DEFAULT_ROUTE_PREFERENCES);
  const [clockEntry, setClockEntry] = useState<ClockEntryState>(CLOCKS_UNSET);
  const [voiceOn, setVoiceOn] = useState(true);
  /** True when a live trip snapshot exists — see NEXT_ROUTE_NOTICE. */
  const [tripActive, setTripActive] = useState(false);
  /** Which section last saved something that only affects the next route. */
  const [nextRouteNotice, setNextRouteNotice] = useState(false);

  useEffect(() => {
    setFirstName(readDriverName());
    const prefs = readRegionPrefs();
    setRegion(prefs.region);
    setUnits(prefs.units);
    /*
     * THE SAME STANDARD-SETUP RULE THE DRIVING SCREEN USES, from the same
     * authority. A driver who opens Settings before ever opening the map
     * has no saved truck yet — and showing them the full five-row editor
     * there would reintroduce, on this screen, exactly the setup wall this
     * milestone removed from the other one. They see the standard truck as
     * theirs, with one way in to change it.
     */
    const saved = readTruck();
    if (standardSetupDecision(saved) === 'keep-saved' && saved !== null) {
      setTruckProfile(saved.profile);
      setTruckSaved(true);
    } else {
      setTruckProfile(DEFAULT_EDITABLE_PROFILE);
      setTruckSaved(true);
      writeTruck(DEFAULT_EDITABLE_PROFILE, confirmProfile(DEFAULT_EDITABLE_PROFILE));
      notifySaved('truck');
    }
    setRoutePrefs(readRoutePrefs());
    setClockEntry(readClocks());
    setVoiceOn(voiceEnabledByDefault());
    /*
     * Is a trip running right now? Read from the SAME snapshot the driving
     * screen writes and restores, through the same parser — a second opinion
     * about "is there a trip" would be a second thing to keep in sync.
     * Read-only: this screen never writes or clears the snapshot.
     */
    try {
      if (typeof sessionStorage !== 'undefined') {
        setTripActive(
          parseTripSnapshot(sessionStorage.getItem(TRIP_RESTORE_KEY), Date.now()) !== null,
        );
      }
    } catch {
      /* unreadable storage just means no notice — never a crash */
    }
    /*
     * `restoreNonce` changes when a download from the account has been written
     * to device storage, so this effect re-reads its own records. Sync never
     * reaches into this screen's state, which is why a download cannot
     * half-apply.
     */
  }, [restoreNonce]);

  const metric = units === 'metric';

  /**
   * Save a truck edit.
   *
   * IT CONFIRMS AS IT SAVES, and that is the owner's decision about the
   * confirm tap. The fingerprint rule it replaces exists to stop a truck
   * arriving from STORAGE already confirmed — and that rule is untouched, in
   * `truck-storage`, where it belongs. What is dropped is asking the driver to
   * re-confirm numbers they just typed on this screen, one field at a time,
   * which was friction without a safety benefit: the person tapping is the
   * person who knows the truck.
   *
   * Invalid values are still refused downstream by the existing gate — the
   * editor shows the correction, and `profileGate` returns 'invalid' so Start
   * Route stays blocked. Nothing is silently clamped.
   */
  const saveTruck = (next: EditableProfile) => {
    setTruckProfile(next);
    setTruckSaved(true);
    const valid = validateEditableProfile(next).length === 0;
    writeTruck(next, valid ? confirmProfile(next) : { confirmedFingerprint: null });
    notifySaved('truck');
    if (tripActive) setNextRouteNotice(true);
  };

  const saveRoutePrefs = (next: RoutePreferences) => {
    setRoutePrefs(next);
    writeRoutePrefs(next);
    notifySaved('route_prefs');
    if (tripActive) setNextRouteNotice(true);
  };

  const saveClocks = (next: ClockEntryState) => {
    setClockEntry(next);
    writeClocks(next);
    notifySaved('hos_clocks');
  };

  const saveVoice = (enabled: boolean) => {
    setVoiceOn(enabled);
    writeVoiceChoice(enabled);
  };

  const truckConfirmed =
    truckSaved && validateEditableProfile(truckProfile).length === 0 && !editingTruck;

  return (
    <div className="space-y-8" data-navigator-settings="">
      {/*
        THE REMINDER. A sentence, in a status region, at the top — visible
        before any control and attached to none of them. It has no button, no
        timer and no acknowledgment, because the moment it acquires one of
        those it stops being a reminder and becomes the lock this milestone
        removed.
      */}
      <p
        role="status"
        data-parked-reminder=""
        className="rounded-cockpit border border-line border-l-4 border-l-nav-warn px-3 py-2 text-lg text-ink"
      >
        {PARKED_REMINDER}
      </p>

      {nextRouteNotice ? (
        <p
          role="status"
          data-next-route-notice=""
          className="rounded-cockpit border border-line px-3 py-2 text-lg font-semibold text-ink"
        >
          {NEXT_ROUTE_NOTICE}
        </p>
      ) : null}

      <Group id="truck" title="Truck" data-settings-section="truck">
        {truckConfirmed ? (
          <TruckSummary
            profile={truckProfile}
            metric={metric}
            onEdit={() => setEditingTruck(true)}
          />
        ) : (
          <TruckProfileEditor
            profile={truckProfile}
            confirmed={truckSaved && routingFingerprint(truckProfile) !== ''}
            isDefault={!truckSaved}
            metric={metric}
            onChange={saveTruck}
            onConfirm={() => setEditingTruck(false)}
          />
        )}
      </Group>

      <Group id="clocks" title="Current clocks" data-settings-section="clocks">
        <ClockSetup
          state={clockEntry}
          onSave={saveClocks}
          onClear={() => saveClocks(CLOCKS_UNSET)}
          unsupported={region === 'CA' ? CANADA_HOS_NOTICE : null}
          nowMs={Date.now()}
        />
      </Group>

      <Group id="voice" title="Voice" data-settings-section="voice">
        <p className="text-base text-ink/70">
          Spoken turn-by-turn guidance. On by default; your choice is remembered on this device.
        </p>
        <div className="flex gap-2">
          {[true, false].map((on) => (
            <button
              key={String(on)}
              type="button"
              aria-pressed={voiceOn === on}
              data-voice-choice={on ? 'on' : 'off'}
              onClick={() => saveVoice(on)}
              className={`min-h-16 flex-1 rounded-cockpit border px-4 text-xl font-semibold text-ink ${
                voiceOn === on ? 'border-ink bg-nav-surface-2' : 'border-line'
              }`}
            >
              {on ? 'On' : 'Off'}
            </button>
          ))}
        </div>
      </Group>

      <Group id="display" title="Display" data-settings-section="display">
        <div className="space-y-2">
          {DISPLAY_MODE_CHOICES.map((choice) => (
            <button
              key={choice.mode}
              type="button"
              aria-pressed={displayMode === choice.mode}
              data-display-choice={choice.mode}
              onClick={() => setDisplayMode(choice.mode as DisplayMode)}
              className={`min-h-16 w-full rounded-cockpit border px-4 py-2 text-left text-xl font-semibold text-ink ${
                displayMode === choice.mode ? 'border-ink bg-nav-surface-2' : 'border-line'
              }`}
            >
              {choice.label}
              <span className="block text-base font-normal text-ink/70">{choice.help}</span>
            </button>
          ))}
        </div>
      </Group>

      <Group id="region" title="Units and region" data-settings-section="units">
        <RegionPanel
          region={region}
          units={units}
          onRegion={(r) => {
            setRegion(r);
            const u = defaultUnitsFor(r);
            setUnits(u);
            writeRegionPrefs({ region: r, units: u });
          }}
          onUnits={(u) => {
            setUnits(u);
            writeRegionPrefs({ region, units: u });
          }}
        />
      </Group>

      <Group id="prefs" title="Route preferences" data-settings-section="prefs">
        <RoutePreferencesPanel prefs={routePrefs} onChange={saveRoutePrefs} />
      </Group>

      <Group id="name" title="Driver name (optional)" data-settings-section="name">
        <DriverNameEntry
          firstName={firstName}
          onAccept={(next) => {
            setFirstName(next);
            writeDriverName(next);
          }}
          onClear={() => {
            setFirstName(null);
            clearDriverName();
          }}
        />
      </Group>

      <ResetSection
        onReset={(what) => {
          if (what === 'display') {
            clearDisplayMode();
            setDisplayMode('automatic');
          }
          if (what === 'voice') {
            clearVoiceChoice();
            setVoiceOn(voiceEnabledByDefault());
          }
          if (what === 'clocks') saveClocks(CLOCKS_UNSET);
        }}
      />

      <Link
        href="/drive"
        data-settings-back=""
        className="flex min-h-16 w-full items-center justify-center rounded-cockpit border border-line bg-nav-surface px-4 text-xl font-semibold text-ink"
      >
        Done
      </Link>
    </div>
  );
}

function Group({
  id,
  title,
  children,
  ...rest
}: {
  id: string;
  title: string;
  children: React.ReactNode;
} & Record<string, unknown>) {
  return (
    <section aria-labelledby={`${id}-group`} className="space-y-3" {...rest}>
      <h2 id={`${id}-group`} className="font-display text-2xl uppercase text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Reset, SCOPED — three separate controls, each naming exactly what it
 * forgets, each confirming first.
 *
 * There is deliberately no "reset everything" button. A single control that
 * silently took the truck, the clocks, the name, the preferences, the display,
 * the voice choice and a trip in progress is one mis-tap away from a driver
 * standing in a truck stop rebuilding their setup — and the one thing they
 * would want back, the clocks, is the one thing this app cannot reconstruct
 * because the ELD is authoritative and the app never had them.
 *
 * The truck is not resettable here at all: "reset" for a truck means "route
 * for the wrong vehicle until you notice", and the editor above already
 * offers every value including the standard ones.
 */
function ResetSection({ onReset }: { onReset: (what: 'display' | 'voice' | 'clocks') => void }) {
  const [confirming, setConfirming] = useState<'display' | 'voice' | 'clocks' | null>(null);
  const items = [
    { key: 'display' as const, label: 'Reset display to Automatic', what: 'your display choice' },
    { key: 'voice' as const, label: 'Reset voice to default (On)', what: 'your voice choice' },
    { key: 'clocks' as const, label: 'Clear my entered clocks', what: 'the clocks you entered' },
  ];
  return (
    <section aria-labelledby="reset-group" className="space-y-3" data-settings-section="reset">
      <h2 id="reset-group" className="font-display text-2xl uppercase text-ink">
        Reset
      </h2>
      <p className="text-base text-ink/70">
        Each control forgets one thing and says which. Your truck, your name and your route
        preferences are not touched by any of them.
      </p>
      {items.map((item) => (
        <div key={item.key} className="space-y-2">
          {confirming === item.key ? (
            <div className="rounded-cockpit border border-line p-3">
              <p className="text-lg text-ink">This forgets {item.what}. Nothing else changes.</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  data-reset-confirm={item.key}
                  onClick={() => {
                    onReset(item.key);
                    setConfirming(null);
                  }}
                  className="min-h-16 flex-1 rounded-cockpit border border-line bg-nav-surface-2 px-3 text-lg font-semibold text-ink"
                >
                  Yes, forget it
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="min-h-16 flex-1 rounded-cockpit border border-line px-3 text-lg text-ink"
                >
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              data-reset={item.key}
              onClick={() => setConfirming(item.key)}
              className="min-h-16 w-full rounded-cockpit border border-line px-4 text-lg text-ink"
            >
              {item.label}
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
