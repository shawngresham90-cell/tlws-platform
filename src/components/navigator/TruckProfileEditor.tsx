'use client';

import { useState } from 'react';
import {
  AVOIDANCE_CHOICES,
  CONFIRM_HEADING,
  EDITABLE_FIELDS,
  HAZMAT_CHOICES,
  NOT_ROUTED_NOTICE,
  correctionsFor,
  profileSummary,
  validateEditableProfile,
  type EditableField,
  type EditableProfile,
} from '@/lib/navigator/truck-profile';
import {
  feetToMeters,
  kilogramsToPounds,
  metersToFeet,
  poundsToKilograms,
} from '@/lib/navigator/format-units';

/**
 * The truck the route is planned for — verified and adjusted, parked.
 *
 * A fleet manager watching a demonstration asks "what truck was that
 * routed for?", and until this screen existed the only honest answer was
 * "the app's defaults". Now the driver sets the values and CONFIRMS them,
 * once, before any route is requested.
 *
 * DESIGN RULES IT KEEPS:
 *   - every value carries its UNIT, beside the number, always;
 *   - the common answers are big preset BUTTONS (the numbers a driver
 *     reads off a cab card), so typing is the exception rather than the
 *     rule — no sliders, nothing that needs a fingertip smaller than a
 *     glove;
 *   - a bad value is REPORTED, never silently corrected: a quietly
 *     clamped height is a route planned for a truck that does not exist;
 *   - the fields this app cannot send are shown too, under a heading that
 *     says plainly that the route does not account for them. A truck
 *     screen that lists only the working fields reads as a guarantee of
 *     truck-legality, and this app cannot make that guarantee.
 *
 * It renders inside the driving screen's existing `edit-destination`
 * LockGate, so a moving truck never sees a text field — there is no
 * motion rule of its own here (doc 06 §1: one authority).
 */

const PRESET =
  'min-h-16 min-w-16 flex-1 rounded-cockpit border px-3 text-xl font-semibold ' +
  'motion-safe:transition-colors motion-safe:duration-150';
const INPUT =
  'min-h-16 w-full rounded-cockpit border border-line bg-nav-surface px-4 text-xl text-ink';

function fieldText(kind: string, value: number): string {
  if (kind === 'pounds') return value.toLocaleString('en-US');
  return String(value);
}

/** The same physical value, shown in the driver's units. */
function displayValue(kind: string, canonical: number, metric: boolean): string {
  if (!metric) return fieldText(kind, canonical);
  if (kind === 'pounds') return Math.round(poundsToKilograms(canonical)).toLocaleString('en-CA');
  if (kind === 'count') return String(canonical);
  return feetToMeters(canonical).toFixed(2);
}

/** The unit word beside the number, in the driver's units. */
function unitFor(field: { kind: string; unit: string }, metric: boolean): string {
  if (!metric) return field.unit;
  if (field.kind === 'pounds') return 'kg';
  if (field.kind === 'count') return field.unit;
  return 'm';
}

/** Typed text in the driver's units → the canonical (ft / lb) number. */
function toCanonical(kind: string, typed: number, metric: boolean): number {
  if (!metric) return typed;
  if (kind === 'pounds') return kilogramsToPounds(typed);
  if (kind === 'count') return typed;
  return metersToFeet(typed);
}

export function TruckProfileEditor({
  profile,
  onChange,
  onConfirm,
  /** True when the current values are already the confirmed ones. */
  confirmed,
  /** Defaults have never been verified by a human — say so. */
  isDefault,
  metric = false,
}: {
  profile: EditableProfile;
  onChange: (next: EditableProfile) => void;
  onConfirm: () => void;
  confirmed: boolean;
  isDefault: boolean;
  /** Metric entry (Canada milestone): the driver types metres and
   *  kilograms, converted ONCE here into the canonical feet/pounds
   *  profile — which is why an imperial truck and its metric twin
   *  produce the identical provider request. */
  metric?: boolean;
}) {
  // Raw text per field: a half-typed "1" must not become a validation
  // error the instant the driver's finger lands on the keypad.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const issues = validateEditableProfile(profile);
  const corrections = correctionsFor(issues);
  const summary = profileSummary(profile);

  const setField = (key: EditableField['key'], value: number) => {
    onChange({ ...profile, [key]: value });
  };

  return (
    <section aria-labelledby="truck-profile-heading" className="space-y-4">
      <div>
        <h3 id="truck-profile-heading" className="text-xl font-bold text-ink">
          {CONFIRM_HEADING}
        </h3>
        <p className="text-lg text-ink/70">
          {isDefault
            ? 'These are the app’s default numbers — not your truck until you check them.'
            : 'These are the numbers your route will be planned for.'}
        </p>
      </div>

      {EDITABLE_FIELDS.map((f) => {
        const current = profile[f.key];
        const raw = draft[f.key];
        return (
          <div key={f.key} className="space-y-2 rounded-cockpit border border-line p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-lg font-semibold text-ink">{f.label}</span>
              <span className="num-data text-xl font-bold text-ink">
                {displayValue(f.kind, current, metric)} {unitFor(f, metric)}
              </span>
            </div>
            <p className="text-base text-ink/60">{f.why}</p>
            <div className="flex gap-2">
              {f.presets.map((p) => {
                const on = Math.abs(current - p) < 1e-9;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setDraft((d) => ({ ...d, [f.key]: '' }));
                      setField(f.key, p);
                    }}
                    aria-pressed={on}
                    aria-label={`${f.label} ${displayValue(f.kind, p, metric)} ${unitFor(f, metric)}`}
                    className={`${PRESET} ${
                      on
                        ? 'border-nav-good bg-nav-good text-asphalt'
                        : 'border-line bg-nav-surface text-ink'
                    }`}
                  >
                    {displayValue(f.kind, p, metric)}
                  </button>
                );
              })}
            </div>
            <label className="block text-base text-ink/70">
              Or enter {f.label.toLowerCase()} ({unitFor(f, metric)})
              <input
                className={INPUT}
                inputMode="decimal"
                value={raw ?? ''}
                placeholder={displayValue(f.kind, current, metric)}
                aria-label={`${f.label} in ${unitFor(f, metric)}`}
                onChange={(e) => {
                  const text = e.target.value;
                  setDraft((d) => ({ ...d, [f.key]: text }));
                  const n = Number(text.replace(/,/g, ''));
                  // An empty box is not a zero-height truck: it is a
                  // driver mid-edit, so the confirmed value stands until
                  // they type something that parses.
                  // Converted ONCE, here, on the way in.
                  if (text.trim() !== '' && Number.isFinite(n)) {
                    setField(f.key, toCanonical(f.kind, n, metric));
                  }
                }}
              />
            </label>
          </div>
        );
      })}

      <div className="space-y-2 rounded-cockpit border border-line p-3">
        <span className="text-lg font-semibold text-ink">Hazmat placard</span>
        <p className="text-base text-ink/60">Roads and crossings closed to placarded loads.</p>
        <label className="block text-base text-ink/70">
          Placarded class
          <select
            className={INPUT}
            aria-label="Hazmat placard class"
            value={profile.hazmatClass ?? ''}
            onChange={(e) =>
              onChange({ ...profile, hazmatClass: e.target.value === '' ? null : e.target.value })
            }
          >
            {HAZMAT_CHOICES.map((h) => (
              <option key={h.label} value={h.value ?? ''}>
                {h.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2 rounded-cockpit border border-line p-3">
        <span className="text-lg font-semibold text-ink">Avoid</span>
        <p className="text-base text-ink/60">
          Each of these changes the route request. Nothing else is offered, because nothing else
          would.
        </p>
        <div className="space-y-2">
          {AVOIDANCE_CHOICES.map((a) => {
            const on = profile.avoid.includes(a.value);
            return (
              <button
                key={a.value}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange({
                    ...profile,
                    avoid: on
                      ? profile.avoid.filter((v) => v !== a.value)
                      : [...profile.avoid, a.value],
                  })
                }
                className={`min-h-16 w-full rounded-cockpit border px-4 text-left text-xl ${
                  on
                    ? 'border-nav-good bg-nav-good font-semibold text-asphalt'
                    : 'border-line bg-nav-surface text-ink'
                }`}
              >
                <span aria-hidden="true">{on ? '✓ ' : '  '}</span>
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* The honest half of the screen. */}
      <div className="space-y-2 rounded-cockpit border border-line border-l-4 border-l-nav-warn p-3">
        <h4 className="text-lg font-bold text-ink">Not used for routing</h4>
        <ul className="space-y-1 text-lg text-ink/80">
          {summary
            .filter((l) => !l.sent)
            .map((l) => (
              <li key={l.label}>{l.label}</li>
            ))}
        </ul>
        <p className="text-base text-ink/70">{NOT_ROUTED_NOTICE}</p>
      </div>

      {corrections.length > 0 ? (
        <div
          role="alert"
          className="space-y-1 rounded-cockpit border border-line border-l-4 border-l-nav-danger p-3"
        >
          <p className="text-lg font-bold text-ink">Fix before planning a route</p>
          <ul className="space-y-1 text-lg text-ink">
            {corrections.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onConfirm}
        disabled={corrections.length > 0 || confirmed}
        className="min-h-[4.5rem] w-full rounded-cockpit bg-nav-good px-4 text-2xl font-bold text-asphalt disabled:opacity-60"
      >
        {confirmed ? 'Truck confirmed' : 'This is my truck'}
      </button>
    </section>
  );
}
