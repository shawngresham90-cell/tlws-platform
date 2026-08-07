'use client';

import { MAP_STYLES, type MapStyleId } from '@/lib/navigator/map-style';

/**
 * Basemap style picker (map-first milestone). Every style the app knows
 * about is listed, including the ones it cannot currently draw: a disabled
 * button that SAYS why beats a missing feature the driver keeps looking
 * for. Nothing here fakes imagery it does not have.
 *
 * Rendered inside the screen's `change-map-style` LockGate, so it is a
 * stationary-only control; this component makes no motion decision.
 */
export function MapStyleControl({
  styleId,
  onChange,
}: {
  styleId: MapStyleId;
  onChange: (id: MapStyleId) => void;
}) {
  const blocked = MAP_STYLES.filter((s) => !s.enabled);
  return (
    <div className="space-y-2">
      <p className="text-lg font-semibold text-ink">Map style</p>
      <div role="group" aria-label="Map style" className="flex flex-wrap gap-2">
        {MAP_STYLES.map((style) => {
          const selected = style.id === styleId && style.enabled;
          return (
            <button
              key={style.id}
              type="button"
              disabled={!style.enabled}
              aria-pressed={selected}
              onClick={() => style.enabled && onChange(style.id)}
              className={
                'min-h-16 min-w-32 rounded-card border px-4 text-lg font-semibold ' +
                (selected ? 'border-ink text-ink underline' : 'border-line text-ink/80') +
                (style.enabled ? '' : ' cursor-not-allowed opacity-60')
              }
            >
              {style.label}
              {/* Never state-by-colour alone. */}
              {selected ? ' (on)' : style.enabled ? '' : ' (unavailable)'}
            </button>
          );
        })}
      </div>
      {blocked.map((style) => (
        <p key={style.id} className="text-base text-ink/70">
          <span className="font-semibold">{style.label}:</span> {style.blockedReason}
        </p>
      ))}
    </div>
  );
}
