'use client';

import { useState } from 'react';
import {
  FEEDBACK_NOTE_MAX,
  FEEDBACK_QUESTIONS,
  SKIPPED,
  buildFeedback,
  feedbackLines,
} from '@/lib/navigator/post-trip-feedback';

/**
 * Post-trip feedback (pilot-ops priority 3).
 *
 * Rendered only after a trip ends, and only inside the stationary-only
 * slot the driving screen already gates — it inherits the existing motion
 * rail rather than adding a permission. Nine questions are a tap each and
 * the note is optional, because this is asked at the end of a shift and
 * anything that needs typing is a question that gets skipped.
 *
 * Nothing is submitted anywhere. There is no pilot report backend yet, so
 * the flow produces text the driver copies or reads out — the same
 * reversible fallback the road-test report uses. Skipping a question is a
 * first-class outcome; every unanswered item renders and reports as
 * "skipped" rather than quietly scoring as fine.
 */
export function PostTripFeedback() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [output, setOutput] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<string | null>(null);

  const response = buildFeedback({ answers, note });

  return (
    <details className="rounded-card border border-line p-4">
      <summary className="min-h-16 cursor-pointer text-lg font-semibold text-ink">
        How did that trip go? ({response.answeredCount}/{FEEDBACK_QUESTIONS.length})
      </summary>

      <div className="mt-3 space-y-4">
        {FEEDBACK_QUESTIONS.map((q) => (
          <fieldset key={q.id}>
            <legend className="text-lg text-ink">{q.prompt}</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {q.choices.map((choice) => {
                const selected = answers[q.id] === choice;
                return (
                  <button
                    key={choice}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setAnswers((prev) =>
                        // Tapping the chosen answer again clears it, so a
                        // mis-tap does not lock in a wrong data point.
                        prev[q.id] === choice
                          ? { ...prev, [q.id]: SKIPPED }
                          : { ...prev, [q.id]: choice },
                      );
                      setCopyState(null);
                    }}
                    className={`min-h-16 rounded-card border px-4 text-lg ${
                      selected ? 'border-ink font-semibold text-ink' : 'border-line text-ink/80'
                    }`}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <label className="block text-lg text-ink/80" htmlFor="feedback-note">
          Anything else? (optional, {FEEDBACK_NOTE_MAX} characters)
        </label>
        <textarea
          id="feedback-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={FEEDBACK_NOTE_MAX}
          rows={3}
          className="w-full rounded-card border border-line bg-transparent p-3 text-lg text-ink"
        />

        <button
          type="button"
          className="min-h-16 w-full rounded-card border border-line px-4 text-xl font-semibold text-ink"
          onClick={() => {
            const text = feedbackLines(response).join('\n');
            setOutput(text);
            const clip =
              typeof navigator !== 'undefined' && navigator.clipboard ? navigator.clipboard : null;
            if (clip === null) {
              setCopyState('Clipboard unavailable — select the text below and copy it.');
              return;
            }
            clip.writeText(text).then(
              () => setCopyState('Copied.'),
              () => setCopyState('Copy refused — select the text below and copy it.'),
            );
          }}
        >
          Copy feedback
        </button>

        {copyState ? (
          <p role="status" className="text-lg text-ink/80">
            {copyState}
          </p>
        ) : null}

        {output ? (
          <textarea
            readOnly
            aria-label="Trip feedback"
            value={output}
            rows={12}
            className="w-full rounded-card border border-line bg-transparent p-3 font-mono text-sm text-ink"
          />
        ) : null}
      </div>
    </details>
  );
}
