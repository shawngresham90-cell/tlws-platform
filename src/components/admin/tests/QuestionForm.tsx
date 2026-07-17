'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { CHOICE_KEYS, type AdminQuestionRow } from '@/lib/admin/tests';
import type { QuestionFormState } from '@/app/admin/(dashboard)/tests/actions';

/**
 * Edit form for an EXISTING question (Milestone 7, edit-only). Server-side
 * validation is the authority (parseQuestionForm blocks every invalid-edit
 * class); this form just renders the fields, the first validation error, and
 * a pending state. The question UUID never appears as an editable field —
 * it's bound into the action, so an edit can only ever update that row.
 */

const FIELD =
  'w-full rounded-card border border-line bg-asphalt px-3 py-2 text-sm text-ink ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal';

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
    >
      {children}
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-card bg-signal px-5 py-2.5 text-sm font-semibold text-asphalt transition-opacity disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Save changes'}
    </button>
  );
}

export function QuestionForm({
  action,
  question,
}: {
  action: (prev: QuestionFormState, formData: FormData) => Promise<QuestionFormState>;
  question: AdminQuestionRow;
}) {
  const [state, formAction] = useFormState(action, { error: null });
  const choiceText = (key: string) => question.choices.find((c) => c.key === key)?.text ?? '';

  return (
    <form action={formAction} className="max-w-3xl space-y-5">
      {state.error && (
        <p
          role="alert"
          className="rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel"
        >
          {state.error}
        </p>
      )}

      <div>
        <Label htmlFor="prompt">Prompt</Label>
        <textarea
          id="prompt"
          name="prompt"
          rows={3}
          required
          defaultValue={question.prompt}
          className={FIELD}
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted">
          Answer choices (canonical a–d array)
        </legend>
        {CHOICE_KEYS.map((key) => (
          <div key={key} className="flex items-start gap-3">
            <span className="mt-2 w-5 font-display uppercase text-signal">{key}.</span>
            <textarea
              id={`choice_${key}`}
              name={`choice_${key}`}
              aria-label={`Choice ${key.toUpperCase()}`}
              rows={2}
              required
              defaultValue={choiceText(key)}
              className={FIELD}
            />
          </div>
        ))}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <Label htmlFor="correct_key">Correct key</Label>
          <select
            id="correct_key"
            name="correct_key"
            defaultValue={question.correct_key}
            className={FIELD}
          >
            {CHOICE_KEYS.map((k) => (
              <option key={k} value={k}>
                {k.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="difficulty">Difficulty (1–3)</Label>
          <select
            id="difficulty"
            name="difficulty"
            defaultValue={String(question.difficulty)}
            className={FIELD}
          >
            {[1, 2, 3].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="verified_date">Verified date</Label>
          <input
            id="verified_date"
            name="verified_date"
            type="date"
            required
            defaultValue={question.verified_date ?? ''}
            className={FIELD}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="explanation">Explanation (plain English, shown to students)</Label>
        <textarea
          id="explanation"
          name="explanation"
          rows={4}
          required
          defaultValue={question.explanation ?? ''}
          className={FIELD}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="cfr_cite">Citation (49 CFR … or CDL Manual §…)</Label>
          <input
            id="cfr_cite"
            name="cfr_cite"
            type="text"
            required
            defaultValue={question.cfr_cite ?? ''}
            placeholder="49 CFR 392.7 or CDL Manual §5.1"
            className={FIELD}
          />
        </div>
        <div>
          <Label htmlFor="tags">Tags (comma-separated, kebab-case)</Label>
          <input
            id="tags"
            name="tags"
            type="text"
            required
            defaultValue={question.tags.join(', ')}
            placeholder="air-brakes, inspection"
            className={FIELD}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <SubmitButton />
        <p className="text-xs text-muted">
          Update-only: the question&apos;s UUID is preserved, so attempt history and student
          bookmarks stay intact.
        </p>
      </div>
    </form>
  );
}
