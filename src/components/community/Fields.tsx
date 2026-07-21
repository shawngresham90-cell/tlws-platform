'use client';

import { cn } from '@/lib/utils/cn';

/**
 * Field pieces specific to the community forms. The shared single-line
 * inputs live in components/apply/Fields — these add the shapes the driver
 * forms need: multi-line text and a tri-state (yes / no / didn't check).
 */

const fieldBase =
  'w-full rounded-card border bg-asphalt-800 px-4 py-3 text-ink placeholder:text-muted ' +
  'focus:outline-none focus:ring-2 focus:ring-signal focus:ring-offset-2 focus:ring-offset-asphalt';

export function TextAreaField({
  id,
  label,
  error,
  required,
  value,
  onChange,
  rows = 4,
  placeholder,
  maxLength,
}: {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {required && (
          <span className="text-diesel-300" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      <textarea
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(fieldBase, 'resize-y', error ? 'border-diesel' : 'border-line')}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-medium text-diesel-300">
          {error}
        </p>
      )}
    </div>
  );
}

export type TriState = '' | 'yes' | 'no';

/** Yes / No / "didn't check" — '' means the driver didn't say either way. */
export function TriStateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: TriState;
  onChange: (v: TriState) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value as TriState)}
        className={cn(fieldBase, 'appearance-none border-line')}
      >
        <option value="">Didn’t check</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
  );
}

/** Tri-state select value → API boolean-or-null. */
export function triStateToBool(v: TriState): boolean | null {
  return v === '' ? null : v === 'yes';
}

/**
 * Honeypot input: visually hidden from humans (not display:none — some bots
 * skip those), irresistible to autofill bots. Any value = drop the payload.
 */
export function HoneypotField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
      <label htmlFor="company_website">Company website</label>
      <input
        id="company_website"
        name="company_website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** Photo upload placeholder — no storage integration yet, by design. */
export function PhotoPlaceholder() {
  return (
    <div className="rounded-card border border-dashed border-line bg-asphalt px-4 py-6 text-center">
      <p className="text-sm font-semibold text-ink">📷 Photos — coming soon</p>
      <p className="mt-1 text-xs text-muted">
        Photo uploads aren’t wired up yet. For now, mention in the comments if you have photos and
        we’ll follow up.
      </p>
    </div>
  );
}
