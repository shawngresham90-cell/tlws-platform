'use client';

/**
 * Submit button that asks before letting its parent form's action run.
 * Used for destructive actions (soft delete).
 */
export function ConfirmSubmit({
  message,
  children,
  className,
  name,
  value,
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
  /** Optional submit name/value pair (e.g. bulk op selector). */
  name?: string;
  value?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      name={name}
      value={value}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
