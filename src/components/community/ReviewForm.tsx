'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { TextField, SelectField } from '@/components/apply/Fields';
import { TurnstileWidget } from '@/components/apply/TurnstileWidget';
import { TRUCK_TYPES } from '@/lib/community/schemas';
import type { ListingRef } from '@/lib/community/data';
import { LocationPicker } from './LocationPicker';
import { StarRatingInput } from './StarRatingInput';
import { TextAreaField, HoneypotField } from './Fields';

/**
 * Driver review form (/directory/reviews). POSTs to /api/directory/review;
 * every review lands PENDING and only shows publicly after admin approval.
 */

const TRUCK_TYPE_OPTIONS = TRUCK_TYPES.map((t) => ({ value: t, label: t }));

type Errors = Record<string, string>;

export function ReviewForm({ siteKey, listings }: { siteKey: string; listings: ListingRef[] }) {
  const [locationId, setLocationId] = useState('');
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [visitedOn, setVisitedOn] = useState('');
  const [truckType, setTruckType] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [token, setToken] = useState('');
  const [turnstileError, setTurnstileError] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function set<T>(setter: (v: T) => void, key: string) {
    return (v: T) => {
      setter(v);
      setErrors((p) => ({ ...p, [key]: '' }));
      setFormError('');
    };
  }

  function validate(): Errors {
    const e: Errors = {};
    if (!locationId) e.location_id = 'Pick the listing you’re reviewing.';
    if (rating < 1) e.rating = 'Pick a star rating.';
    if (title.trim().length < 2) e.title = 'Give your review a title.';
    if (body.trim().length < 10) e.body = 'Tell drivers a little more (10+ characters).';
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError('');
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    if (siteKey && !token) {
      setFormError(
        turnstileError || 'Please complete the verification challenge before continuing.',
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/directory/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          rating,
          title: title.trim(),
          body: body.trim(),
          visited_on: visitedOn,
          truck_type: truckType,
          reviewer_name: reviewerName.trim(),
          company_website: honeypot,
          ...(token ? { turnstileToken: token } : {}),
        }),
      });
      const resBody = await res.json();
      if (!res.ok || !resBody.ok) {
        setFormError(resBody.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setDone(true);
    } catch {
      setFormError('Network error. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-card border border-line bg-asphalt-800 p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-signal text-2xl text-asphalt">
          ✓
        </div>
        <h3 className="display-section mt-6 text-2xl">Review received</h3>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Thanks for looking out for other drivers. Reviews are approved by a human before they go
          live, so yours will show up once it clears moderation.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="relative rounded-card border border-line bg-asphalt-800 p-8"
    >
      <HoneypotField value={honeypot} onChange={setHoneypot} />

      <div aria-live="assertive">
        {formError && (
          <p className="mb-5 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel">
            {formError}
          </p>
        )}
      </div>

      <LocationPicker
        id="review_location"
        label="Which listing are you reviewing?"
        required
        listings={listings}
        value={locationId}
        onChange={set(setLocationId, 'location_id')}
        error={errors.location_id}
      />

      <div className="mt-6">
        <StarRatingInput value={rating} onChange={set(setRating, 'rating')} error={errors.rating} />
      </div>

      <div className="mt-6">
        <TextField
          id="review_title"
          label="Review title"
          required
          value={title}
          onChange={set(setTitle, 'title')}
          placeholder="e.g. Clean showers, tight lot"
          error={errors.title}
        />
      </div>

      <div className="mt-6">
        <TextAreaField
          id="review_body"
          label="Your review"
          required
          rows={6}
          value={body}
          onChange={set(setBody, 'body')}
          placeholder="Parking, showers, food, safety, how the staff treats drivers — what should the next driver know?"
          maxLength={4000}
          error={errors.body}
        />
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        <TextField
          id="review_visited_on"
          label="When were you there?"
          type="date"
          value={visitedOn}
          onChange={set(setVisitedOn, 'visited_on')}
          error={errors.visited_on}
        />
        <SelectField
          id="review_truck_type"
          label="What do you pull?"
          value={truckType}
          onChange={set(setTruckType, 'truck_type')}
          options={TRUCK_TYPE_OPTIONS}
          placeholder="Optional"
        />
        <TextField
          id="review_reviewer_name"
          label="Your name (optional)"
          value={reviewerName}
          onChange={set(setReviewerName, 'reviewer_name')}
          autoComplete="name"
          placeholder="Shown with your review"
        />
      </div>

      <div className="mt-6">
        <TurnstileWidget siteKey={siteKey} onToken={setToken} onError={setTurnstileError} />
      </div>

      <p className="mt-6 text-xs text-muted">
        Reviews are moderated. Nothing publishes automatically — a human reads every review before
        it appears in the directory.
      </p>

      <div className="mt-6">
        <Button type="submit" aria-disabled={submitting} disabled={submitting}>
          {submitting ? 'Sending…' : 'Submit review'}
        </Button>
      </div>
    </form>
  );
}
