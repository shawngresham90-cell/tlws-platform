'use client';

import { useId, useRef, useState } from 'react';
import { MAX_FIRST_NAME_CHARS, normalizeFirstName } from '@/lib/navigator/driver-greeting';

/**
 * First-name entry — the only place the driver's name is ever typed.
 *
 * It renders inside `PilotTripControls`, which the driving screen already
 * mounts inside the stationary-only `edit-destination` LockGate. That is
 * deliberate and is the whole access story: typing is exactly what the
 * motion lock exists to prevent, so this field inherits that rail rather
 * than inventing a second one. There is no other mount point.
 *
 * The value is EPHEMERAL by owner decision. It is lifted to React state on
 * the driving screen and dies with the mounted screen — no localStorage, no
 * sessionStorage, no cookie, no profile, no database. A driver who reloads
 * the app types it again, and that is the intended cost.
 *
 * Accessibility, deliberately quiet:
 *   - a real `<label htmlFor>`, not a placeholder standing in for one;
 *   - a real `<form>`, so Enter submits and the control is reachable and
 *     operable from a keyboard without a pointer;
 *   - 64 px targets, matching every other control on this screen;
 *   - the validation message is wired through `aria-describedby` +
 *     `aria-invalid` and focus returns to the field, which tells a screen
 *     reader user what happened WITHOUT a live region. Voice guidance owns
 *     the audio channel on this screen; a chatty `aria-live` here would
 *     talk over navigation speech, which doc 06 does not permit.
 */

const inputClass =
  'min-h-16 w-full rounded-card border border-line bg-transparent px-4 text-xl text-ink';
const buttonClass =
  'min-h-16 w-full rounded-card border border-line px-4 text-xl font-semibold text-ink';

export function DriverNameEntry({
  firstName,
  onAccept,
}: {
  /** The accepted name, or null while none has been given. */
  firstName: string | null;
  /** Called with the SANITIZED name; never with raw input. */
  onAccept: (firstName: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  // Settled state: the name is shown back so the driver can see what will
  // be spoken, with one way to change it. No form, nothing to tab through.
  if (firstName !== null && !editing) {
    return (
      <div className="space-y-2">
        <p className="text-xl text-ink">
          Driving as <span className="font-semibold">{firstName}</span>
        </p>
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            setDraft(firstName);
            setError(null);
            setEditing(true);
          }}
        >
          Change name
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const result = normalizeFirstName(draft);
        if (!result.ok) {
          setError(result.reason);
          // Focus goes back to the field, so the described-by message is
          // read on arrival. This is the live region's job, done without
          // a live region.
          inputRef.current?.focus();
          return;
        }
        setError(null);
        setEditing(false);
        setDraft('');
        onAccept(result.firstName);
      }}
    >
      <label className="block text-lg text-ink/80" htmlFor={fieldId}>
        Your first name
      </label>
      <input
        id={fieldId}
        ref={inputRef}
        className={inputClass}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (error !== null) setError(null);
        }}
        // `maxLength` is a courtesy on the phone keyboard, never the
        // check: `normalizeFirstName` is the only thing that decides.
        maxLength={MAX_FIRST_NAME_CHARS}
        autoComplete="given-name"
        // A name is not a search box and not a sentence: no autocorrect
        // rewriting "Shawn" and no sentence-casing fighting "d'Angelo".
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={error !== null}
        aria-describedby={error === null ? undefined : errorId}
      />
      {error !== null ? (
        <p id={errorId} className="text-lg text-ink/80">
          {error}
        </p>
      ) : (
        <p className="text-base text-ink/60">
          Used only to greet you out loud. Not saved — re-enter it after a reload.
        </p>
      )}
      <button type="submit" className={buttonClass}>
        Save name
      </button>
    </form>
  );
}
