'use client';

import { useId, useRef, useState } from 'react';

/**
 * Accessible 1–5 star rating input: a radiogroup of five buttons. Keyboard
 * users tab to the group and pick with arrow keys / space like native radios.
 */
export function StarRatingInput({
  value,
  onChange,
  error,
}: {
  /** 0 = not chosen yet. */
  value: number;
  onChange: (rating: number) => void;
  error?: string;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  const errorId = useId();
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  /** Roving tabindex: only the checked star (or the first, if none) is tabbable. */
  const tabbableStar = value || 1;

  const selectAndFocus = (star: number) => {
    onChange(star);
    buttonsRef.current[star - 1]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, star: number) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        selectAndFocus(star === 5 ? 1 : star + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        selectAndFocus(star === 1 ? 5 : star - 1);
        break;
      case 'Home':
        event.preventDefault();
        selectAndFocus(1);
        break;
      case 'End':
        event.preventDefault();
        selectAndFocus(5);
        break;
    }
  };

  return (
    <div>
      <span className="mb-1.5 block text-sm font-semibold text-ink">
        Your rating
        <span className="text-diesel" aria-hidden="true">
          {' '}
          *
        </span>
      </span>
      <div
        role="radiogroup"
        aria-label="Star rating"
        aria-describedby={error ? errorId : undefined}
        className="flex items-center gap-1"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            ref={(el) => {
              buttonsRef.current[star - 1] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            tabIndex={star === tabbableStar ? 0 : -1}
            onClick={() => onChange(star)}
            onKeyDown={(event) => handleKeyDown(event, star)}
            onMouseEnter={() => setHover(star)}
            className="rounded p-1 text-3xl leading-none transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-signal"
          >
            <span aria-hidden="true" className={star <= shown ? 'text-signal' : 'text-line'}>
              ★
            </span>
          </button>
        ))}
        {value > 0 && (
          <span className="ml-2 text-sm text-muted">
            {value} star{value === 1 ? '' : 's'}
          </span>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-sm font-medium text-diesel">
          {error}
        </p>
      )}
    </div>
  );
}
