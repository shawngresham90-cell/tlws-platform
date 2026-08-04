'use client';

import { Button } from '@/components/ui';
import { useGps } from './GpsProvider';
import type { PositionHealth, PositionState } from '@/lib/navigator/types';

/**
 * Position display only (milestone N2's objective) — the first and, in
 * Phase 1, only Navigator surface. No guidance, no map, no maneuvers:
 * those arrive with N4/N5 behind the same flag. Health is always shown as
 * TEXT (never color alone), the display updates live via an aria-live
 * region, and coordinates are shown to the driver but never persisted,
 * logged, or transmitted (AD-7).
 *
 * Split presentational/container so the offline harness can render every
 * state (all five healths, unsupported, idle) without a browser.
 */

const HEALTH_LABEL: Record<PositionHealth, string> = {
  good: 'Good fix',
  degraded: 'Position approximate (accuracy worse than 50 m)',
  lost: 'Position unknown (no fix for more than 10 seconds)',
  denied: 'Location permission denied',
  unavailable: 'Location unavailable',
};

export type NavigatorStatusViewProps = {
  position: PositionState;
  watching: boolean;
  supported: boolean;
  /**
   * Provider-supplied: true only until the platform's FIRST response. The
   * session alone cannot distinguish "never asked" from a genuine
   * POSITION_UNAVAILABLE (both are health 'unavailable'), and rendering a
   * real failure as "waiting…" would hide it forever.
   */
  acquiring: boolean;
  onStart: () => void;
  onStop: () => void;
};

export function NavigatorStatusView({
  position,
  watching,
  supported,
  acquiring,
  onStart,
  onStop,
}: NavigatorStatusViewProps) {
  if (!supported) {
    return (
      <p role="status" className="text-ink/80">
        This device does not expose location services to the browser, so the position preview cannot
        run here.
      </p>
    );
  }

  if (!watching) {
    // Denial tears the watch down (the browser will not deliver again), so
    // the denied explanation lives here — next to the Enable button the
    // recovery instructions refer to.
    const denied = position.health === 'denied';
    return (
      <div className="space-y-4">
        {denied ? (
          <p aria-live="polite" role="status" className="font-semibold text-ink">
            Status: {HEALTH_LABEL.denied}
          </p>
        ) : null}
        {denied ? (
          <p className="text-ink/80">
            The preview cannot run without location. Re-allow location for this site in your browser
            settings, then press Enable location below.
          </p>
        ) : null}
        <p className="text-ink/80">
          The position preview shows your live GPS fix, speed, and heading exactly as the future
          Navigator will read them. Location stays on this device: it is never saved, never logged,
          and never sent anywhere. Starting the preview asks your browser for location permission.
        </p>
        <Button onClick={onStart} aria-label="Enable location and start the position preview">
          Enable location
        </Button>
      </div>
    );
  }

  const { fix, health } = position;
  const lastKnown = health === 'lost' || health === 'unavailable';
  return (
    <div className="space-y-4">
      <p aria-live="polite" role="status" className="font-semibold text-ink">
        Status:{' '}
        {acquiring ? 'Waiting for location permission and first fix…' : HEALTH_LABEL[health]}
      </p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-ink/90">
        <dt className="font-semibold">Position</dt>
        <dd>
          {fix
            ? `${fix.lat.toFixed(4)}, ${fix.lng.toFixed(4)}${lastKnown ? ' (last known)' : ''}`
            : 'Waiting for first fix…'}
        </dd>
        <dt className="font-semibold">Accuracy</dt>
        <dd>{fix ? `±${Math.round(fix.accuracyM)} m` : '—'}</dd>
        <dt className="font-semibold">Speed</dt>
        <dd>
          {position.speedMph !== null ? `${Math.round(position.speedMph)} mph` : 'Needs two fixes'}
        </dd>
        <dt className="font-semibold">Heading</dt>
        <dd>{position.headingDeg !== null ? `${Math.round(position.headingDeg)}°` : '—'}</dd>
      </dl>
      <Button variant="ghost" onClick={onStop} aria-label="Stop preview and discard position">
        Stop preview
      </Button>
    </div>
  );
}

export function NavigatorStatus() {
  const { position, watching, supported, acquiring, start, stop } = useGps();
  return (
    <NavigatorStatusView
      position={position}
      watching={watching}
      supported={supported}
      acquiring={acquiring}
      onStart={start}
      onStop={stop}
    />
  );
}
