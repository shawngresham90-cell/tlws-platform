/**
 * Pre-trip setup status — what is done, what is required, and the exact
 * sentence that says why Start is not available yet.
 *
 * THE SEAM THIS CLOSES. Start used to look enabled with an unconfirmed
 * truck. A driver tapped it, nothing visible happened, and the reason
 * printed roughly two hundred pixels further down the page — underneath
 * the truck editor they had just been told to scroll to. On a phone, in a
 * cab, that reads as a broken button.
 *
 * So the gate is computed HERE, once, and used for three things at the
 * same moment: whether the button is disabled, what sentence sits beside
 * it, and what the checklist at the top of the setup shows. They cannot
 * disagree, because they are the same value.
 *
 * Pure: state in, status out. No clock, no storage, no I/O.
 */

export type SetupItemState = 'done' | 'required' | 'optional' | 'unsupported';

export type SetupItem = {
  key: 'driver' | 'truck' | 'clocks' | 'destination';
  label: string;
  /** What the driver reads to the right of the label. */
  value: string;
  state: SetupItemState;
};

/** Required to start. Everything else is genuinely optional. */
export const REQUIRED_ITEMS: readonly SetupItem['key'][] = Object.freeze(['truck', 'destination']);

/*
 * The blocked-Start sentences, verbatim. They are constants because three
 * places must agree on them — the button, the checklist and the harness —
 * and because "state the exact missing item" means the same words every
 * time, not a phrasing that drifts.
 */
export const START_NEEDS_TRUCK = 'Confirm your truck first';
export const START_NEEDS_DESTINATION = 'Choose a destination.';
export const START_NEEDS_TRUCK_FIX = 'Fix the truck details first';

export type SetupInput = {
  /** null when the driver has not saved one. Never required. */
  driverName: string | null;
  /** The existing truck gate, unchanged. */
  truckGate: 'invalid' | 'unconfirmed' | 'ready';
  /** Whether the driver has entered clocks; unsupported in Canada. */
  clocks: 'set' | 'unset' | 'unsupported';
  /** Whether a destination has been picked. */
  destinationPicked: boolean;
};

export type SetupStatus = {
  items: SetupItem[];
  /** True only when every required item is done. */
  canStart: boolean;
  /**
   * The exact missing item, or null when Start is available. Never a
   * colour, never a vague "complete setup" — the sentence names the one
   * thing to do next.
   */
  blockedReason: string | null;
  /** Shown when Start IS available but the clocks are blank. */
  clocksWarning: string | null;
  /**
   * Everything the driver can settle IN ADVANCE is settled, so the only
   * thing left is where they are going.
   *
   * WHY IT IS SEPARATE FROM `canStart`. `canStart` also requires a
   * destination, which changes every single trip; this asks the
   * different question "is there any setup left to do?" — and the answer
   * is what lets the parked screen collapse the setup stack and put the
   * destination and Start Route at the top.
   *
   * IT IS NOT "everything is filled in". The driver's name and the
   * clocks are genuinely optional and never hold this back — otherwise a
   * driver who declines to enter clocks would be punished with the long
   * screen forever, which is the complaint this milestone exists to fix.
   * What the collapse must never do is HIDE the consequence: when the
   * clocks are unset, `clocksWarning` still says HOS guidance is
   * unavailable, and the compact summary is required to show it.
   */
  configured: boolean;
};

export const CLOCKS_UNAVAILABLE_WARNING = 'HOS guidance unavailable — clocks not set.';

export function setupStatus(input: SetupInput): SetupStatus {
  const items: SetupItem[] = [
    {
      key: 'driver',
      label: 'Driver',
      value: input.driverName === null ? 'Optional' : input.driverName,
      state: input.driverName === null ? 'optional' : 'done',
    },
    {
      key: 'truck',
      label: 'Truck',
      value:
        input.truckGate === 'ready'
          ? 'Confirmed'
          : input.truckGate === 'invalid'
            ? 'Fix details'
            : 'Required',
      state: input.truckGate === 'ready' ? 'done' : 'required',
    },
    {
      key: 'clocks',
      label: 'Clocks',
      value:
        input.clocks === 'set'
          ? 'Set'
          : input.clocks === 'unsupported'
            ? 'Not calculated in this region'
            : 'Not set',
      // Unset clocks do NOT block Start — they cost HOS guidance, and the
      // driver is told exactly that rather than being stopped.
      state:
        input.clocks === 'set'
          ? 'done'
          : input.clocks === 'unsupported'
            ? 'unsupported'
            : 'optional',
    },
    {
      key: 'destination',
      label: 'Destination',
      value: input.destinationPicked ? 'Selected' : 'Required',
      state: input.destinationPicked ? 'done' : 'required',
    },
  ];

  /*
   * ORDER MATTERS. The truck comes first because it is first in the setup
   * flow — naming the destination while the truck is still unconfirmed
   * would send a driver back up the page for the wrong thing.
   */
  const blockedReason =
    input.truckGate === 'invalid'
      ? START_NEEDS_TRUCK_FIX
      : input.truckGate === 'unconfirmed'
        ? START_NEEDS_TRUCK
        : !input.destinationPicked
          ? START_NEEDS_DESTINATION
          : null;

  /*
   * Configured means every REQUIRED item except the destination is done.
   * Derived from the same REQUIRED_ITEMS list the gate uses, so adding a
   * future required item cannot let the screen collapse over it.
   */
  const configured = REQUIRED_ITEMS.filter((k) => k !== 'destination').every(
    (k) => items.find((i) => i.key === k)?.state === 'done',
  );

  return {
    items,
    canStart: blockedReason === null,
    blockedReason,
    clocksWarning:
      /*
       * Tied to the CONFIGURED state, not to `canStart`. The warning used
       * to appear only once a destination was also chosen, which meant a
       * driver collapsing their setup could see the compact summary
       * before ever being told their clocks were blank. The consequence
       * has to be visible wherever the setup is, so it is computed from
       * the same fact that allows the collapse.
       */
      configured && input.clocks === 'unset' ? CLOCKS_UNAVAILABLE_WARNING : null,
    configured,
  };
}
