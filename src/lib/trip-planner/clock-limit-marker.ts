import type { LatLng } from '@/lib/map/bounds';
import {
  buildTimeAxis,
  projectAtSeconds,
  type TimeAxis,
  type TimeAxisRefusal,
} from './route-time-axis';
import type { HereManeuver } from './here-routing';

/**
 * What the results map is allowed to draw for "your clock runs out here".
 *
 * Pure. No clock, no I/O, no React.
 *
 * THREE OUTCOMES AND NO FOURTH. A driver looking at this marker decides
 * where to spend the night, so the difference between a point and a
 * region has to survive all the way to the pixel:
 *
 *   PIN    the provider's timing at that moment is fine-grained enough
 *          that a point means something.
 *   ZONE   the containing action is long; the truth is "somewhere along
 *          this stretch", and a pin would claim precision we do not have.
 *   NONE   geometry or timing is missing. The map says so rather than
 *          drawing something.
 *
 * There is deliberately no "best guess" outcome. A guessed pin is worse
 * than no pin: it is equally confident and occasionally 40 miles wrong,
 * and it is wrong in the direction that strands a driver — assumed speed
 * always places the marker further along than heavy traffic will allow.
 */

export const CANNOT_MAP = 'Clock-limit location cannot be mapped safely.';

/** Shown under a zone so its width is never mistaken for a margin of error. */
export const ZONE_EXPLANATION =
  'Your provider’s timing for this stretch is coarse, so this is the range your clock runs out in — not a single point.';

export type ClockLimitMarker =
  | {
      kind: 'pin';
      position: LatLng;
      /** Seconds of driving this marker represents. */
      atSeconds: number;
    }
  | {
      kind: 'zone';
      /** Both ends of the provider action containing the limit. */
      from: LatLng;
      to: LatLng;
      atSeconds: number;
      /** How wide the uncertainty is, in minutes, for the caption. */
      spanMinutes: number;
    }
  | {
      kind: 'none';
      /** The exact sentence the map shows. */
      notice: string;
      /** Diagnosable reason, for the ops doc and the bench — not the driver. */
      detail: string;
    };

/**
 * Place the clock-limit marker.
 *
 * `targetSeconds` is the driving time the marker represents — the clock
 * limit for the hard marker, or the buffered stop target for the
 * recommended one. The same function serves both, and the break marker,
 * because the rule about precision does not change with the label.
 */
export function clockLimitMarker(input: {
  maneuvers: readonly HereManeuver[];
  positions: readonly LatLng[];
  totalSeconds: number;
  totalMeters: number;
  targetSeconds: number;
}): ClockLimitMarker {
  const { maneuvers, positions, totalSeconds, totalMeters, targetSeconds } = input;

  const axis = buildTimeAxis({ maneuvers, positions, totalSeconds, totalMeters });
  if (!axis.ok) return refuse(axis);

  // An axis without geometry can time a point but not place one, and
  // `projectAtSeconds` says so itself — this keeps the reason specific.
  if (!(axis as TimeAxis).hasGeometry) {
    return {
      kind: 'none',
      notice: CANNOT_MAP,
      detail: 'the provider returned travel times but no route geometry to place them on.',
    };
  }

  const projected = projectAtSeconds(axis, positions, targetSeconds);
  if (!projected.ok) return refuse(projected);

  if (projected.precision === 'tight') {
    return { kind: 'pin', position: projected.position, atSeconds: targetSeconds };
  }

  return {
    kind: 'zone',
    from: projected.window.startPosition,
    to: projected.window.endPosition,
    atSeconds: targetSeconds,
    spanMinutes: Math.round((projected.window.endS - projected.window.startS) / 60),
  };
}

function refuse(r: TimeAxisRefusal): ClockLimitMarker {
  return { kind: 'none', notice: CANNOT_MAP, detail: r.detail };
}

/** True when the marker may be drawn on a map at all. */
export function isMappable(m: ClockLimitMarker): m is Exclude<ClockLimitMarker, { kind: 'none' }> {
  return m.kind !== 'none';
}
