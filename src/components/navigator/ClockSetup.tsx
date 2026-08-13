'use client';

import { useState } from 'react';
import {
  clockCeilings,
  formatEnteredClock,
  freshShiftClocks,
  joinHoursMinutes,
  splitHoursMinutes,
  validateEnteredClocks,
  CLOCKS_NOT_SET,
  CLOCKS_NOT_SET_DETAIL,
  CLOCKS_REPLACE_CONFIRM,
  CLOCKS_UNSET_WARNING,
  CLOCK_FIELDS,
  CYCLE_LABEL,
  DRIVER_ENTERED_NOTICE,
  ELD_AUTHORITATIVE,
  FRESH_SHIFT_CONFIRM,
  type ClockEntryState,
  type DriverEnteredClocks,
} from '@/lib/navigator/hos-clocks';
import type { CycleRule } from '@/lib/trip-planner/types';

/**
 * Current clocks — what the driver actually has left, entered by them
 * (pre-trip setup milestone).
 *
 * WHAT THIS REPLACES. The driving screen used to mount every driver with
 * a fresh eleven hours and no way to say otherwise. A driver six hours
 * into their day was shown a full clock. This screen is the correction,
 * and its default is the important part: NOTHING. "Clocks not set" is
 * what a returning driver sees until they say otherwise, because the
 * alternative — a plausible-looking full clock — is a specific false
 * claim about their legal standing.
 *
 * THREE RULES IT KEEPS:
 *   - Full clocks are reachable, but only through a confirmed choice.
 *     Never preselected, never a default, never a side effect.
 *   - Replacing clocks the driver already entered asks first. The old
 *     values are not kept, and that is worth one tap to confirm.
 *   - The ELD line sits beside the fields, not in a footnote. So does
 *     the cycle's caveat: the balance is exact, the recap is not
 *     calculable from it, and the label says so wherever it appears.
 *
 * It renders inside the driving screen's existing `edit-destination`
 * LockGate — parked-only, through the shared authority, with no motion
 * rule of its own (doc 06 §1).
 */

const INPUT =
  'min-h-16 w-full rounded-cockpit border border-line bg-nav-surface px-3 text-xl text-ink';
const ACTION =
  'min-h-16 w-full rounded-cockpit border border-line bg-nav-surface px-4 text-xl font-semibold text-ink';

type Draft = Record<string, string>;

/** The editor's working copy, seeded from whatever is already set. */
function seedDraft(entered: DriverEnteredClocks | null): Draft {
  const draft: Draft = {};
  for (const field of CLOCK_FIELDS) {
    const { hours, minutes } = splitHoursMinutes(entered?.[field.key] ?? 0);
    draft[`${field.key}:h`] = String(hours);
    draft[`${field.key}:m`] = String(minutes);
  }
  return draft;
}

function readDraft(draft: Draft, cycleRule: CycleRule): DriverEnteredClocks {
  const value = (key: string) => {
    const raw = draft[key];
    if (raw === undefined || raw.trim() === '') return 0;
    return Number(raw);
  };
  return {
    drivingMin: joinHoursMinutes(value('drivingMin:h'), value('drivingMin:m')),
    windowMin: joinHoursMinutes(value('windowMin:h'), value('windowMin:m')),
    untilBreakMin: joinHoursMinutes(value('untilBreakMin:h'), value('untilBreakMin:m')),
    cycleMin: joinHoursMinutes(value('cycleMin:h'), value('cycleMin:m')),
    cycleRule,
  };
}

export function ClockSetup({
  state,
  onSave,
  onClear,
  /** Canada: the engine models US federal limits only, so entry is hidden. */
  unsupported = null,
  nowMs,
}: {
  state: ClockEntryState;
  onSave: (next: ClockEntryState) => void;
  onClear: () => void;
  unsupported?: string | null;
  /** The clock is the caller's to read — this component stays clock-free. */
  nowMs: number;
}) {
  const set = state.kind === 'set' ? state : null;
  const [editing, setEditing] = useState(false);
  const [cycleRule, setCycleRule] = useState<CycleRule>(set?.entered.cycleRule ?? '70/8');
  const [draft, setDraft] = useState<Draft>(() => seedDraft(set?.entered ?? null));
  const [confirming, setConfirming] = useState<'fresh' | 'replace' | 'clear' | null>(null);

  /*
   * CANADA. The shipped engine implements US federal property-carrying
   * limits. Canadian rules differ in almost every dimension and this
   * pilot does not calculate them, so the region says so and offers no
   * entry — an editor here would imply the numbers meant something.
   */
  if (unsupported !== null) {
    return (
      <section aria-labelledby="clocks-heading" className="space-y-2">
        <h3 id="clocks-heading" className="text-xl font-bold text-ink">
          Current clocks
        </h3>
        <div
          role="status"
          className="rounded-cockpit border border-line border-l-4 border-l-nav-warn p-3"
        >
          <p className="text-lg font-bold text-ink">{unsupported}</p>
        </div>
      </section>
    );
  }

  const pending = readDraft(draft, cycleRule);
  const errors = editing ? validateEnteredClocks(pending) : [];
  const caps = clockCeilings(cycleRule);

  const commit = (entered: DriverEnteredClocks, fromFreshShift: boolean) => {
    onSave({ kind: 'set', entered, enteredAtMs: nowMs, fromFreshShift });
    setEditing(false);
    setConfirming(null);
  };

  /* ------------------------------------------------ the settled view */
  if (!editing) {
    return (
      <section aria-labelledby="clocks-heading" className="space-y-3">
        <div>
          <h3 id="clocks-heading" className="text-xl font-bold text-ink">
            Current clocks
          </h3>
          <p className="text-base text-ink/70">{ELD_AUTHORITATIVE}</p>
        </div>

        {set === null ? (
          <div
            role="status"
            className="rounded-cockpit border border-line border-l-4 border-l-nav-warn p-3"
          >
            <p className="num-data text-xl font-bold text-ink">{CLOCKS_NOT_SET}</p>
            <p className="mt-1 text-base text-ink/70">{CLOCKS_NOT_SET_DETAIL}</p>
            <p className="mt-1 text-base text-ink/70">{CLOCKS_UNSET_WARNING}</p>
          </div>
        ) : (
          <div className="rounded-cockpit border border-line p-3">
            <dl className="space-y-1 text-lg">
              {CLOCK_FIELDS.map((f) => (
                <div key={f.key} className="flex justify-between gap-3">
                  <dt className="text-ink/70">{f.label}</dt>
                  <dd className="num-data font-semibold text-ink">
                    {formatEnteredClock(set.entered[f.key])}
                  </dd>
                </div>
              ))}
              <div className="flex justify-between gap-3">
                <dt className="text-ink/70">Cycle</dt>
                <dd className="text-ink">{set.entered.cycleRule}</dd>
              </div>
            </dl>
            {/* The caveat travels with the number, not in a footnote. */}
            <p className="mt-2 text-base text-ink/70">{CYCLE_LABEL}</p>
            <p className="mt-1 text-base text-ink/70">{DRIVER_ENTERED_NOTICE}</p>
          </div>
        )}

        {/* Replacing values the driver already entered asks first. */}
        {confirming === 'replace' ? (
          <ConfirmRow
            question={CLOCKS_REPLACE_CONFIRM}
            confirmLabel="Yes, edit them"
            onConfirm={() => {
              setDraft(seedDraft(set?.entered ?? null));
              setCycleRule(set?.entered.cycleRule ?? '70/8');
              setEditing(true);
              setConfirming(null);
            }}
            onCancel={() => setConfirming(null)}
          />
        ) : (
          <button
            type="button"
            className={ACTION}
            onClick={() => {
              if (set === null) {
                setDraft(seedDraft(null));
                setEditing(true);
              } else {
                setConfirming('replace');
              }
            }}
          >
            {set === null ? 'Enter my clocks' : 'Edit clocks'}
          </button>
        )}

        {/*
         * FULL CLOCKS ARE A SEPARATE, CONFIRMED ACTION. Not a preset in
         * the editor, not a default, not the first option — a driver who
         * is genuinely starting a fresh shift has to say so, twice.
         */}
        {confirming === 'fresh' ? (
          <ConfirmRow
            question={FRESH_SHIFT_CONFIRM}
            confirmLabel="Yes, I am starting fresh"
            onConfirm={() => commit(freshShiftClocks(cycleRule), true)}
            onCancel={() => setConfirming(null)}
          />
        ) : (
          <button type="button" className={ACTION} onClick={() => setConfirming('fresh')}>
            Start with full clocks
          </button>
        )}

        {set !== null && confirming !== 'clear' ? (
          <button type="button" className={ACTION} onClick={() => setConfirming('clear')}>
            Clear clocks
          </button>
        ) : null}
        {confirming === 'clear' ? (
          <ConfirmRow
            question={CLOCKS_REPLACE_CONFIRM}
            confirmLabel="Yes, clear them"
            onConfirm={() => {
              onClear();
              setConfirming(null);
            }}
            onCancel={() => setConfirming(null)}
          />
        ) : null}
      </section>
    );
  }

  /* -------------------------------------------------- the entry form */
  return (
    <section aria-labelledby="clocks-heading" className="space-y-3">
      <div>
        <h3 id="clocks-heading" className="text-xl font-bold text-ink">
          Current clocks
        </h3>
        <p className="text-base text-ink/70">
          What your ELD says is LEFT right now. {ELD_AUTHORITATIVE}
        </p>
      </div>

      {CLOCK_FIELDS.map((f) => {
        const { hours: capH } = splitHoursMinutes(caps[f.key]);
        return (
          <fieldset key={f.key} className="space-y-1 rounded-cockpit border border-line p-3">
            <legend className="text-lg font-semibold text-ink">{f.label}</legend>
            <p className="text-base text-ink/60">{f.why}</p>
            <div className="flex items-center gap-2">
              <label className="flex-1 text-base text-ink/70">
                Hours
                <input
                  className={INPUT}
                  inputMode="numeric"
                  aria-label={`${f.label} hours`}
                  value={draft[`${f.key}:h`] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [`${f.key}:h`]: e.target.value }))}
                />
              </label>
              <label className="flex-1 text-base text-ink/70">
                Minutes
                <input
                  className={INPUT}
                  inputMode="numeric"
                  aria-label={`${f.label} minutes`}
                  value={draft[`${f.key}:m`] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [`${f.key}:m`]: e.target.value }))}
                />
              </label>
            </div>
            <p className="text-base text-ink/60">Most: {capH}h</p>
          </fieldset>
        );
      })}

      <fieldset className="space-y-2 rounded-cockpit border border-line p-3">
        <legend className="text-lg font-semibold text-ink">Your cycle</legend>
        <div className="flex gap-2">
          {(['70/8', '60/7'] as const).map((rule) => (
            <button
              key={rule}
              type="button"
              aria-pressed={cycleRule === rule}
              onClick={() => setCycleRule(rule)}
              className={`min-h-16 flex-1 rounded-cockpit border px-4 text-xl font-semibold ${
                cycleRule === rule
                  ? 'border-nav-good bg-nav-good text-asphalt'
                  : 'border-line bg-nav-surface text-ink'
              }`}
            >
              {rule}
            </button>
          ))}
        </div>
        <p className="text-base text-ink/70">{CYCLE_LABEL}</p>
      </fieldset>

      {errors.length > 0 ? (
        <div
          role="alert"
          className="space-y-1 rounded-cockpit border border-line border-l-4 border-l-nav-danger p-3"
        >
          <p className="text-lg font-bold text-ink">Fix before saving</p>
          <ul className="space-y-1 text-lg text-ink">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-base text-ink/70">{DRIVER_ENTERED_NOTICE}</p>

      <button
        type="button"
        disabled={errors.length > 0}
        onClick={() => commit(pending, false)}
        className="min-h-[4.5rem] w-full rounded-cockpit bg-nav-good px-4 text-2xl font-bold text-asphalt disabled:opacity-60"
      >
        Save clocks
      </button>
      <button type="button" className={ACTION} onClick={() => setEditing(false)}>
        Cancel
      </button>
    </section>
  );
}

/** One question, two buttons. Used for every destructive or full-clock step. */
function ConfirmRow({
  question,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  question: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="alert"
      className="space-y-2 rounded-cockpit border border-line border-l-4 border-l-nav-warn p-3"
    >
      <p className="text-lg font-bold text-ink">{question}</p>
      <button
        type="button"
        className="min-h-16 w-full rounded-cockpit bg-nav-good px-4 text-xl font-bold text-asphalt"
        onClick={onConfirm}
      >
        {confirmLabel}
      </button>
      <button type="button" className={ACTION} onClick={onCancel}>
        Keep what I have
      </button>
    </div>
  );
}
