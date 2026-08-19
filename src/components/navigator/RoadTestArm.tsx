'use client';

import { useEffect, useState } from 'react';
import { readFieldTestArmed, writeFieldTestArmed } from './field-test-storage';

/**
 * The one switch that turns road-test mode on (TP-6).
 *
 * WHY IT LIVES HERE. This component renders only inside the Navigator,
 * and the Navigator sits behind the pilot middleware — reaching this
 * screen at all means the server verified a pilot session. That existing
 * rail IS the gate: the public Trip Planner has no control that can arm
 * field-test mode, so for everyone else the mode simply does not exist
 * (FT1). The flag itself is device-local; arming here enables the
 * evidence panel on this device's Trip Planner and nothing anywhere else.
 */

const BTN =
  'min-h-12 flex-1 rounded-cockpit border border-signal px-4 text-lg font-semibold text-ink';

export function RoadTestArm() {
  const [armed, setArmed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setArmed(readFieldTestArmed());
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <section
      className="rounded-cockpit border border-line bg-nav-surface p-4"
      aria-labelledby="road-test-arm-heading"
      data-road-test-arm=""
    >
      <h2 id="road-test-arm-heading" className="text-xl font-bold text-ink">
        Road test mode
      </h2>
      <p className="mt-1 text-base leading-snug text-ink/70">
        {armed
          ? 'Armed on this device. The Trip Planner shows the evidence panel; observations stay local and are scrubbed of anything private.'
          : 'Off. Arm it to record parked-only road-test observations in the Trip Planner on this device.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={BTN}
          data-road-test-arm-toggle=""
          aria-pressed={armed}
          onClick={() => {
            const next = !armed;
            writeFieldTestArmed(next);
            setArmed(next);
          }}
        >
          {armed ? 'Disarm road test mode' : 'Arm road test mode'}
        </button>
      </div>
    </section>
  );
}
