'use client';

import { cn } from '@/lib/utils/cn';

const fieldBase =
  'w-full rounded-card border bg-asphalt-800 px-4 py-3 text-ink placeholder:text-muted ' +
  'focus:outline-none focus:ring-2 focus:ring-signal focus:ring-offset-2 focus:ring-offset-asphalt';

function Label({ id, label, required }: { id: string; label: string; required?: boolean }) {
  return (
    <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
      {label}
      {required && (
        <span className="text-diesel-300" aria-hidden="true">
          {' '}
          *
        </span>
      )}
    </label>
  );
}

function ErrorText({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-medium text-diesel-300">
      {error}
    </p>
  );
}

type BaseProps = {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
};

export function TextField({
  id,
  label,
  error,
  required,
  type = 'text',
  value,
  onChange,
  autoComplete,
  inputMode,
  placeholder,
}: BaseProps & {
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'numeric';
  placeholder?: string;
}) {
  return (
    <div>
      <Label id={id} label={label} required={required} />
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(fieldBase, error ? 'border-diesel' : 'border-line')}
      />
      <ErrorText id={id} error={error} />
    </div>
  );
}

export function SelectField({
  id,
  label,
  error,
  required,
  value,
  onChange,
  options,
  placeholder = 'Select…',
}: BaseProps & {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div>
      <Label id={id} label={label} required={required} />
      <select
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(fieldBase, 'appearance-none', error ? 'border-diesel' : 'border-line')}
      >
        {/* An optional select must let the user return to "no answer". */}
        <option value="" disabled={required}>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ErrorText id={id} error={error} />
    </div>
  );
}

export function CheckboxField({
  id,
  label,
  error,
  required,
  checked,
  onChange,
  children,
}: BaseProps & {
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Optional richer label body (disclosures, links). Falls back to `label`. */
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          name={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-1 h-5 w-5 shrink-0 rounded border-line bg-asphalt-800 text-signal focus:ring-2 focus:ring-signal focus:ring-offset-2 focus:ring-offset-asphalt"
        />
        <label htmlFor={id} className="text-sm text-muted">
          {children ?? label}
          {required && (
            <span className="text-diesel-300" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
      </div>
      <ErrorText id={id} error={error} />
    </div>
  );
}
