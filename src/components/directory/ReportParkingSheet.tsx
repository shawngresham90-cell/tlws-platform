'use client';

import { useEffect, useRef, useState } from 'react';
import { ISSUE_TYPES } from '@/lib/community/parking-report';

/**
 * Driver parking report — a phone-first bottom sheet (2026-07-30).
 *
 * Speed is the feature: for an issue report the listing is already known, so
 * the driver taps the issue and taps Send. Everything else is optional. Target
 * is 10–20 seconds with gloves on, which is why the issue buttons are full
 * width and 48px+ and nothing is required beyond the one choice.
 *
 * Nothing here changes the directory. The copy says so, because a driver
 * should know their report goes to a human, not straight onto the map.
 */

type Mode = 'issue' | 'missing';

const btn =
  'inline-flex min-h-[48px] w-full items-center justify-center rounded-card px-4 font-display ' +
  'uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt';
const field =
  'w-full rounded-card border border-line bg-asphalt px-3 py-2.5 text-ink ' +
  'placeholder:text-muted/60 focus:border-signal focus:outline-none';
const labelCls = 'mb-1 block text-sm font-semibold text-ink';

/**
 * Route context the app already knows from the corridor URL. ONLY these three
 * are ever prefilled. Exit number, parking count, overnight status and mile
 * marker are NEVER guessed — an exit is not a mile marker, and a count or an
 * overnight claim must come from the driver or from evidence, not from us.
 * Every prefilled value stays editable so a driver can correct it.
 */
export type RouteContext = {
  state?: string;
  interstate?: string;
  direction?: string;
};

export function ReportParkingSheet({
  mode,
  locationId,
  locationName,
  routeContext,
  open,
  onClose,
}: {
  mode: Mode;
  locationId?: string;
  locationName?: string;
  routeContext?: RouteContext;
  open: boolean;
  onClose: () => void;
}) {
  const [issueType, setIssueType] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingId = 'report-parking-heading';

  // Escape closes; focus lands in the sheet so a keyboard user is not stranded.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setIssueType(null);
      setDone(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function submit(form: HTMLFormElement) {
    setSending(true);
    setError(null);
    const fd = new FormData(form);
    const payload =
      mode === 'issue'
        ? {
            mode: 'issue' as const,
            locationId,
            issueType,
            note: String(fd.get('note') ?? '') || undefined,
            evidence: String(fd.get('evidence') ?? '') || undefined,
            company_website: String(fd.get('company_website') ?? ''),
          }
        : {
            mode: 'missing' as const,
            name: String(fd.get('name') ?? ''),
            state: String(fd.get('state') ?? ''),
            interstate: String(fd.get('interstate') ?? '') || undefined,
            direction: (String(fd.get('direction') ?? '') || undefined) as never,
            exitNumber: String(fd.get('exitNumber') ?? '') || undefined,
            city: String(fd.get('city') ?? '') || undefined,
            parkingDetails: String(fd.get('parkingDetails') ?? '') || undefined,
            note: String(fd.get('note') ?? '') || undefined,
            evidence: String(fd.get('evidence') ?? '') || undefined,
            company_website: String(fd.get('company_website') ?? ''),
          };
    try {
      const res = await fetch('/api/directory/parking-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? 'Could not send that. Try again.');
        return;
      }
      setDone(true);
    } catch {
      setError('No connection. Try again when you have signal.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-asphalt/80"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-card border border-line bg-asphalt-800 p-5 sm:rounded-card"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={headingId} className="font-display text-xl uppercase text-ink">
            {mode === 'issue' ? 'Report parking info' : 'Add missing parking'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-card px-2 text-2xl leading-none text-muted hover:text-ink"
            aria-label="Close report form"
          >
            ×
          </button>
        </div>

        {mode === 'issue' && locationName && (
          <p className="mt-1 truncate text-sm text-muted">{locationName}</p>
        )}

        {done ? (
          <div className="py-8 text-center">
            <p className="font-display text-lg uppercase text-signal">Thanks — sent</p>
            <p className="mt-2 text-sm text-muted">
              A human reviews every report before the directory changes.
            </p>
            <button
              type="button"
              onClick={onClose}
              className={`${btn} mt-6 bg-signal text-asphalt`}
            >
              Done
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(e.currentTarget);
            }}
            className="mt-4 grid gap-4"
          >
            {/* Honeypot — visually hidden, never shown to a real driver. */}
            <input
              type="text"
              name="company_website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
            />

            {mode === 'issue' ? (
              <fieldset>
                <legend className={labelCls}>What&rsquo;s wrong?</legend>
                <div className="grid gap-2">
                  {ISSUE_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      aria-pressed={issueType === t.value}
                      onClick={() => setIssueType(t.value)}
                      className={`${btn} border text-sm ${
                        issueType === t.value
                          ? 'border-signal bg-signal text-asphalt'
                          : 'border-line text-ink hover:border-signal'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : (
              <>
                <div>
                  <label htmlFor="rp-name" className={labelCls}>
                    Place name *
                  </label>
                  <input id="rp-name" name="name" required maxLength={120} className={field} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="rp-state" className={labelCls}>
                      State *
                    </label>
                    <input
                      id="rp-state"
                      name="state"
                      required
                      maxLength={2}
                      placeholder="GA"
                      defaultValue={routeContext?.state ?? ''}
                      className={field}
                    />
                  </div>
                  <div>
                    <label htmlFor="rp-interstate" className={labelCls}>
                      Interstate
                    </label>
                    <input
                      id="rp-interstate"
                      name="interstate"
                      maxLength={20}
                      placeholder="I-75"
                      defaultValue={routeContext?.interstate ?? ''}
                      className={field}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="rp-direction" className={labelCls}>
                      Direction
                    </label>
                    <select
                      id="rp-direction"
                      name="direction"
                      className={field}
                      defaultValue={routeContext?.direction ?? ''}
                    >
                      <option value="">Not sure</option>
                      <option value="northbound">Northbound</option>
                      <option value="southbound">Southbound</option>
                      <option value="eastbound">Eastbound</option>
                      <option value="westbound">Westbound</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="rp-exit" className={labelCls}>
                      Exit number
                    </label>
                    <input id="rp-exit" name="exitNumber" maxLength={20} className={field} />
                  </div>
                </div>
                {(routeContext?.state || routeContext?.interstate || routeContext?.direction) && (
                  <p className="-mt-2 text-xs text-muted">
                    Route filled in from the list you were browsing — change it if it&rsquo;s wrong.
                    We don&rsquo;t guess the exit or how many trucks fit.
                  </p>
                )}
                <div>
                  <label htmlFor="rp-city" className={labelCls}>
                    City
                  </label>
                  <input id="rp-city" name="city" maxLength={80} className={field} />
                </div>
                <div>
                  <label htmlFor="rp-parking" className={labelCls}>
                    Parking details
                  </label>
                  <input
                    id="rp-parking"
                    name="parkingDetails"
                    maxLength={500}
                    placeholder="About 20 truck spaces, gravel lot"
                    className={field}
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="rp-note" className={labelCls}>
                Anything else? <span className="font-normal text-muted">(optional)</span>
              </label>
              <textarea id="rp-note" name="note" rows={3} maxLength={1000} className={field} />
            </div>
            <div>
              <label htmlFor="rp-evidence" className={labelCls}>
                Link to a source <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="rp-evidence"
                name="evidence"
                type="url"
                maxLength={500}
                placeholder="https://"
                className={field}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm font-medium text-diesel-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={sending || (mode === 'issue' && !issueType)}
              className={`${btn} bg-signal text-asphalt disabled:opacity-50`}
            >
              {sending ? 'Sending…' : 'Send report'}
            </button>
            <p className="text-xs text-muted">
              Goes to a review queue — nothing on the map changes automatically. We don&rsquo;t ask
              for your name and we don&rsquo;t track your location.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

/** Small inline trigger for a listing card or detail page. */
export function ReportParkingButton({
  locationId,
  locationName,
  className,
}: {
  locationId: string;
  locationName: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          'min-h-[44px] text-sm font-semibold text-muted underline-offset-4 hover:text-signal hover:underline'
        }
      >
        Report parking info
      </button>
      <ReportParkingSheet
        mode="issue"
        locationId={locationId}
        locationName={locationName}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/** Footer trigger for "we don't have this place yet". */
export function MissingParkingButton({
  routeContext,
  className,
}: {
  routeContext?: RouteContext;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          'min-h-[48px] w-full rounded-card border border-line px-4 font-display uppercase tracking-wide text-ink transition-colors hover:border-signal'
        }
      >
        Parking location missing?
      </button>
      <ReportParkingSheet
        mode="missing"
        routeContext={routeContext}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
