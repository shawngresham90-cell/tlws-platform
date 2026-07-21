'use client';

import { useState } from 'react';
import type {
  FavoriteRoute,
  PlannerStore,
  TruckPreset,
} from '@/lib/trip-planner/saved-trips-store';

/**
 * Saved Trips & Recent Searches panel (local-device MVP). Renders the user's
 * favorites, truck presets, and recent-search controls from the device store.
 * Everything here is private to this browser — the panel carries an explicit
 * private-device notice and never talks to a server. Mobile-first, keyboard
 * accessible (all actions are real <button>s; inline rename is a labeled form).
 */

const card = 'rounded-card border border-line bg-asphalt-800 p-4';
const btn =
  'rounded-card px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors disabled:opacity-50';
const btnPrimary = `${btn} bg-signal text-asphalt hover:bg-signal-600`;
const btnGhost = `${btn} border border-line text-ink hover:bg-asphalt-700`;
const btnDanger = `${btn} border border-diesel text-diesel-300 hover:bg-diesel/10`;

export function SavedTripsPanel({
  store,
  status,
  storageAvailable,
  onReplan,
  onRename,
  onDelete,
  onApplyPreset,
  onDeletePreset,
  onClearRecents,
  onClearAll,
}: {
  store: PlannerStore;
  status: 'loading' | 'ready' | 'error';
  storageAvailable: boolean;
  onReplan: (fav: FavoriteRoute) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onApplyPreset: (preset: TruckPreset) => void;
  onDeletePreset: (id: string) => void;
  onClearRecents: () => void;
  onClearAll: () => void;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  if (status === 'loading') {
    return (
      <section className={`mt-6 ${card}`} aria-busy="true">
        <p className="text-sm text-muted">Loading your saved trips…</p>
      </section>
    );
  }

  const { favorites, truckPresets, recentPlaces, plannedTrips } = store;
  const hasAnything =
    favorites.length + truckPresets.length + recentPlaces.length + plannedTrips.length > 0;

  return (
    <section className="mt-6 space-y-4" aria-label="Saved trips and recent searches">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg uppercase text-ink">Saved trips</h2>
        {hasAnything && (
          <>
            {confirmAll ? (
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  className={btnDanger}
                  onClick={() => {
                    onClearAll();
                    setConfirmAll(false);
                  }}
                >
                  Confirm clear all
                </button>
                <button type="button" className={btnGhost} onClick={() => setConfirmAll(false)}>
                  Cancel
                </button>
              </span>
            ) : (
              <button type="button" className={btnGhost} onClick={() => setConfirmAll(true)}>
                Clear all
              </button>
            )}
          </>
        )}
      </div>

      {!storageAvailable && (
        <p className="rounded-card border border-diesel/50 bg-diesel/5 p-3 text-xs text-muted">
          Device storage is unavailable (private-browsing mode or disabled), so trips saved this
          session won’t persist after you close the tab.
        </p>
      )}

      {/* Favorites */}
      {favorites.length === 0 ? (
        <div className={card}>
          <p className="text-sm text-muted">
            No saved trips yet. Plan a route, then tap{' '}
            <span className="text-ink">Save this trip</span> to keep it here for one-tap
            re-planning.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {favorites.map((f) => (
            <li key={f.id} className={card}>
              {renamingId === f.id ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onRename(f.id, renameText);
                    setRenamingId(null);
                  }}
                >
                  <label className="sr-only" htmlFor={`rename-${f.id}`}>
                    Rename saved trip
                  </label>
                  <input
                    id={`rename-${f.id}`}
                    autoFocus
                    value={renameText}
                    onChange={(e) => setRenameText(e.target.value)}
                    className="w-full rounded-card border border-line bg-asphalt-900 px-3 py-2 text-sm text-ink focus:border-signal focus:outline-none"
                  />
                  <button type="submit" className={btnPrimary}>
                    Save
                  </button>
                  <button type="button" className={btnGhost} onClick={() => setRenamingId(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <p className="text-sm font-semibold text-ink">{f.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {f.origin.label} → {f.destination.label}
                    {f.truck.hazmatClass ? ` · hazmat ${f.truck.hazmatClass}` : ''}
                    {f.lastPlannedAt ? ' · re-planned before' : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className={btnPrimary} onClick={() => onReplan(f)}>
                      Re-plan
                    </button>
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => {
                        setRenamingId(f.id);
                        setRenameText(f.name);
                      }}
                    >
                      Rename
                    </button>
                    {confirmId === f.id ? (
                      <>
                        <button
                          type="button"
                          className={btnDanger}
                          onClick={() => {
                            onDelete(f.id);
                            setConfirmId(null);
                          }}
                        >
                          Confirm delete
                        </button>
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() => setConfirmId(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className={btnDanger}
                        onClick={() => setConfirmId(f.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Truck presets */}
      {truckPresets.length > 0 && (
        <div className={card}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Truck presets
          </h3>
          <ul className="mt-2 space-y-2">
            {truckPresets.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="text-sm text-ink">
                  {p.name}
                  <span className="ml-2 text-xs text-muted">
                    {p.heightFt}′ · {p.grossWeightLbs.toLocaleString()} lb · {p.axles} axles
                    {p.hazmatClass ? ` · hazmat ${p.hazmatClass}` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <button type="button" className={btnGhost} onClick={() => onApplyPreset(p)}>
                    Apply
                  </button>
                  <button type="button" className={btnDanger} onClick={() => onDeletePreset(p.id)}>
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent searches */}
      {(recentPlaces.length > 0 || plannedTrips.length > 0) && (
        <div className={`${card} flex items-center justify-between`}>
          <p className="text-xs text-muted">
            {recentPlaces.length} recent {recentPlaces.length === 1 ? 'search' : 'searches'}
            {plannedTrips.length > 0 ? ` · ${plannedTrips.length} recent plans` : ''} (this device)
          </p>
          <button type="button" className={btnGhost} onClick={onClearRecents}>
            Clear recents
          </button>
        </div>
      )}

      <p className="text-[11px] text-muted">
        🔒 Saved trips, presets, and recent searches are stored only on this device — they are
        private to you, never uploaded, and not tied to any account. Clearing your browser data
        removes them. Avoid saving trips on a shared or public device.
      </p>
    </section>
  );
}
