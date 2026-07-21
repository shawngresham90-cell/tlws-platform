'use client';

import { useState } from 'react';

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

  return (
    <div>
      <span className="mb-1.5 block text-sm font-semibold text-ink">
        Your rating
        <span className="text-diesel-300" aria-hidden="true">
          {' '}
          *
        </span>
      </span>
      <div
        role="radiogroup"
        aria-label="Star rating"
        className="flex items-center gap-1"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            onClick={() => onChange(star)}
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
        <p role="alert" className="mt-1.5 text-sm font-medium text-diesel-300">
          {error}
        </p>
      )}
    </div>
  );
}
