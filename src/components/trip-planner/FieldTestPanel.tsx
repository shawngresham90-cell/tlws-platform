'use client';

import { useEffect, useState } from 'react';
import {
  addFieldNote,
  buildFieldTestSummary,
  closeFieldTestSession,
  recordFieldOutcome,
  startFieldTestSession,
  BUFFER_OUTCOMES,
  ETA_VARIANCE_BUCKETS,
  PARKING_OUTCOMES,
  STEP_OUTCOMES,
  NOTE_MAX_CHARS,
  type FieldTestSession,
} from '@/lib/trip-planner/field-test';
import {
  clearAllFieldTestData,
  readActiveFieldTestSession,
  readFieldTestArmed,
  writeActiveFieldTestSession,
} from '@/components/navigator/field-test-storage';
import { trackEvent } from '@/lib/analytics';

/**
 * The road tester's evidence panel (TP-6). Renders ONLY when field-test
 * mode was armed from the pilot-gated Navigator — a public visitor never
 * sees it, and nothing here changes what the planner computes.
 *
 * COMPACT ON PURPOSE. This is not a dashboard: one live session, a chip
 * per question the road test exists to answer, a short note box, a
 * copyable scrubbed summary, and a delete-everything control. Every value
 * is a fixed category (the enums live in field-test.ts); every note is
 * scrubbed before it is stored; every write can be refused by the
 * privacy gate — refusals are shown, not swallowed.
 *
 * PARKED ONLY. The panel says so at the top, and the protocol repeats it:
 * observations are entered while safely parked, never while driving.
 */

const CARD = 'rounded-cockpit border border-line bg-nav-surface p-4';
const LABEL = 'block text-lg font-semibold text-ink';
const HELP = 'text-base leading-snug text-ink/70';
const CHIP_ON = 'border-nav-good bg-nav-good text-asphalt';
const CHIP_OFF = 'border-line text-ink';

/** The chip groups, one per road-test question. */
const GROUPS: {
  kind: 'parking-outcome' | 'buffer-outcome' | 'eta-variance' | 'handoff' | 'resume';
  heading: string;
  values: readonly string[];
}[] = [
  { kind: 'parking-outcome', heading: 'Parking outcome', values: PARKING_OUTCOMES },
  { kind: 'buffer-outcome', heading: '60-minute buffer felt', values: BUFFER_OUTCOMES },
  { kind: 'eta-variance', heading: 'ETA vs actual arrival', values: ETA_VARIANCE_BUCKETS },
  { kind: 'handoff', heading: 'Navigator handoff worked', values: STEP_OUTCOMES },
  { kind: 'resume', heading: 'Resume after stop worked', values: STEP_OUTCOMES },
];

export function FieldTestPanel() {
  const [armed, setArmed] = useState(false);
  const [session, setSession] = useState<FieldTestSession | null>(null);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const isArmed = readFieldTestArmed();
    setArmed(isArmed);
    if (isArmed) setSession(readActiveFieldTestSession(Date.now()));
  }, []);

  if (!armed) return null;

  /** Persist a session change; the privacy gate's refusal is surfaced. */
  function save(next: FieldTestSession, saidNo: string): void {
    if (writeActiveFieldTestSession(next, Date.now())) {
      setSession(next);
      setStatus(null);
    } else {
      setStatus(saidNo);
    }
  }

  const recorded = (kind: string): string | null =>
    session?.observations.find((o) => o.kind === kind)?.value ?? null;

  return (
    <section className={CARD} aria-labelledby="field-test-heading" data-field-test-panel="">
      <h2 id="field-test-heading" className="text-xl font-bold text-ink">
        Road test (pilot)
      </h2>
      <p className={`mt-1 ${HELP}`} data-field-test-parked-notice="">
        Record observations only while safely parked. Never interact with this screen while the
        vehicle is moving.
      </p>

      {session === null ? (
        <button
          type="button"
          data-field-test-start=""
          className="mt-3 min-h-14 w-full rounded-cockpit border border-signal bg-signal/10 px-4 text-lg font-semibold text-ink"
          onClick={() => {
            const started = startFieldTestSession(Date.now());
            save(started, 'Could not start the road-test session.');
            trackEvent('tp6_road_test_started');
          }}
        >
          Road Test Started
        </button>
      ) : (
        <>
          <p className={`mt-2 ${HELP}`} data-field-test-active="">
            Session in progress.{' '}
            {session.planEvidence === null
              ? 'Send a parking stop to the Navigator to capture the plan evidence.'
              : `Plan evidence captured for choice #${session.planEvidence.chosenRank}.`}
          </p>

          {GROUPS.map((group) => (
            <div className="mt-3" key={group.kind}>
              <h3 className={LABEL}>{group.heading}</h3>
              <div
                className="mt-1 flex flex-wrap gap-2"
                role="group"
                aria-label={group.heading}
                data-field-test-group={group.kind}
              >
                {group.values.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={recorded(group.kind) === value}
                    data-field-test-chip={`${group.kind}:${value}`}
                    onClick={() => {
                      const next = recordFieldOutcome(session, group.kind, value, Date.now());
                      if (next !== null) {
                        save(next, 'That observation was refused by the privacy check.');
                        trackEvent('tp6_field_outcome', { kind: group.kind, value });
                      }
                    }}
                    className={`min-h-12 rounded-cockpit border px-3 text-base font-semibold ${
                      recorded(group.kind) === value ? CHIP_ON : CHIP_OFF
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-3">
            <h3 className={LABEL}>Short observation</h3>
            <textarea
              value={note}
              maxLength={NOTE_MAX_CHARS}
              onChange={(e) => setNote(e.target.value)}
              aria-label="Short observation"
              data-field-test-note-input=""
              className="mt-1 min-h-20 w-full rounded-cockpit border border-line bg-nav-surface px-3 py-2 text-lg text-ink"
              placeholder="What happened? Coordinates and personal details are removed automatically."
            />
            <button
              type="button"
              data-field-test-note-add=""
              className="mt-2 min-h-12 rounded-cockpit border border-line px-4 text-lg text-ink"
              onClick={() => {
                const next = addFieldNote(session, note, Date.now());
                if (next === null) {
                  setStatus('Notes are limited — shorten it or delete older observations.');
                  return;
                }
                save(next, 'That note was refused by the privacy check.');
                setNote('');
              }}
            >
              Add observation
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              data-field-test-copy=""
              className="min-h-12 flex-1 rounded-cockpit border border-signal bg-signal/10 px-4 text-lg font-semibold text-ink"
              onClick={() => {
                const text = buildFieldTestSummary(session);
                try {
                  void navigator.clipboard.writeText(text);
                  setStatus('Evidence summary copied.');
                } catch {
                  setStatus('Could not copy — long-press the summary text instead.');
                }
              }}
            >
              Copy evidence summary
            </button>
            <button
              type="button"
              data-field-test-end=""
              className="min-h-12 rounded-cockpit border border-line px-4 text-lg text-ink"
              onClick={() => {
                save(closeFieldTestSession(session, 'ended'), 'Could not end the session.');
                setSession(null);
              }}
            >
              End road test
            </button>
          </div>
        </>
      )}

      {status === null ? null : (
        <p role="status" className={`mt-2 ${HELP}`} data-field-test-status="">
          {status}
        </p>
      )}

      <button
        type="button"
        data-field-test-delete-all=""
        className="mt-3 min-h-12 text-base underline decoration-line underline-offset-4 text-ink/70"
        onClick={() => {
          clearAllFieldTestData();
          setArmed(false);
          setSession(null);
        }}
      >
        Delete all field-test data from this device
      </button>
    </section>
  );
}
