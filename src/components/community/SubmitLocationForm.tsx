'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { TextField, SelectField, CheckboxField } from '@/components/apply/Fields';
import { TurnstileWidget } from '@/components/apply/TurnstileWidget';
import { AMENITIES } from '@/lib/directory/amenities';
import { DIRECTORY_STATES } from '@/lib/directory/states';
import { SUBMISSION_KINDS, type SubmissionKind } from '@/lib/community/schemas';
import type { ListingRef } from '@/lib/community/data';
import { LocationPicker } from './LocationPicker';
import {
  TextAreaField,
  TriStateField,
  HoneypotField,
  PhotoPlaceholder,
  triStateToBool,
  type TriState,
} from './Fields';

/**
 * Driver submission form (/directory/submit). Five kinds of report, one
 * moderated pipeline: everything POSTs to /api/directory/submission and lands
 * as a PENDING row that only the admin dashboard can approve — the form
 * cannot publish or change a listing.
 */

const KIND_OPTIONS: { value: SubmissionKind; label: string; hint: string }[] = [
  {
    value: 'new',
    label: 'New location',
    hint: 'A truck stop, parking spot, scale, wash, shop, hotel, school, or service we don’t list yet.',
  },
  {
    value: 'correction',
    label: 'Correction to a listing',
    hint: 'Wrong address, phone, website, name, or other details on an existing listing.',
  },
  {
    value: 'closure',
    label: 'Closed location',
    hint: 'A listed business that has shut down or no longer serves trucks.',
  },
  {
    value: 'missing-info',
    label: 'Missing information',
    hint: 'A listing is right but incomplete — add what you know.',
  },
  {
    value: 'amenity-change',
    label: 'Amenity changes',
    hint: 'Showers, parking, food, scales — what a listing offers has changed.',
  },
];

const CATEGORY_OPTIONS = [
  { value: 'parking', label: 'Truck Parking' },
  { value: 'truck-stops', label: 'Truck Stops' },
  { value: 'cat-scales', label: 'CAT Scales' },
  { value: 'truck-washes', label: 'Truck Washes' },
  { value: 'tire-repair', label: 'Tire Repair' },
  { value: 'weigh-stations', label: 'Weigh Stations' },
  { value: 'hotels-truck-parking', label: 'Hotels with Truck Parking' },
  { value: 'cdl-schools', label: 'CDL Schools' },
  { value: 'roadside-service', label: 'Roadside Service' },
];

const STATE_OPTIONS = DIRECTORY_STATES.map((s) => ({ value: s.code, label: s.name }));

/** Kinds that show the full detail fields (address, phone, website…). */
const DETAIL_KINDS: SubmissionKind[] = ['new', 'correction', 'missing-info'];
/** Kinds that show amenity checkboxes and parking fields. */
const AMENITY_KINDS: SubmissionKind[] = ['new', 'correction', 'missing-info', 'amenity-change'];

type Errors = Record<string, string>;

export function SubmitLocationForm({
  siteKey,
  listings,
}: {
  siteKey: string;
  listings: ListingRef[];
}) {
  const [kind, setKind] = useState<SubmissionKind>('new');
  const [locationId, setLocationId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [freeParking, setFreeParking] = useState<TriState>('');
  const [paidParking, setPaidParking] = useState<TriState>('');
  const [reservedParking, setReservedParking] = useState<TriState>('');
  const [overnightParking, setOvernightParking] = useState<TriState>('');
  const [parkingSpaces, setParkingSpaces] = useState('');
  const [comments, setComments] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [submitterContact, setSubmitterContact] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [token, setToken] = useState('');
  const [turnstileError, setTurnstileError] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Detail pages deep-link here (?listing=<detail slug>&kind=correction) so
  // the report arrives with the listing already picked. Slugs only — internal
  // ids never ride in URLs. Read from window.location in a mount effect
  // instead of useSearchParams, which would bail the form out of the page's
  // static HTML. Unknown values leave the default form untouched.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linked = listings.find((l) => l.detailSlug && l.detailSlug === params.get('listing'));
    const kindParam = params.get('kind');
    const linkedKind = (SUBMISSION_KINDS as readonly string[]).includes(kindParam ?? '')
      ? (kindParam as SubmissionKind)
      : undefined;
    if (linked) setLocationId(linked.id);
    if (linkedKind && (linkedKind === 'new' || linked)) setKind(linkedKind);
    else if (linked) setKind('correction');
    // Mount-only: the deep link is the initial URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showDetails = DETAIL_KINDS.includes(kind);
  const showAmenities = AMENITY_KINDS.includes(kind);
  const needsPicker = kind !== 'new';
  const selectedListing = listings.find((l) => l.id === locationId);

  function set<T>(setter: (v: T) => void, key: string) {
    return (v: T) => {
      setter(v);
      setErrors((p) => ({ ...p, [key]: '' }));
      setFormError('');
    };
  }

  function toggleAmenity(a: string) {
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  function validate(): Errors {
    const e: Errors = {};
    if (needsPicker && !locationId) e.location_id = 'Pick the listing this report is about.';
    if (kind === 'new') {
      if (name.trim().length < 2) e.name = 'Enter the business name.';
      if (!category) e.category_slug = 'Pick a category.';
    }
    if (parkingSpaces.trim() && !/^\d{1,5}$/.test(parkingSpaces.trim()))
      e.parking_spaces = 'Enter a number.';
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
      const res = await fetch('/api/directory/submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          location_id: needsPicker ? locationId : '',
          // For reports on an existing listing the name rides along from the
          // picked listing so moderators see it without a join.
          name: kind === 'new' ? name.trim() : (selectedListing?.name ?? ''),
          category_slug: kind === 'new' ? category : '',
          address: showDetails ? address.trim() : '',
          city: showDetails ? city.trim() : '',
          state: showDetails ? stateCode : '',
          zip: showDetails ? zip.trim() : '',
          phone: showDetails ? phone.trim() : '',
          website: showDetails ? website.trim() : '',
          description: showDetails ? description.trim() : '',
          amenities: showAmenities ? amenities : [],
          free_parking: showAmenities ? triStateToBool(freeParking) : null,
          paid_parking: showAmenities ? triStateToBool(paidParking) : null,
          reserved_parking: showAmenities ? triStateToBool(reservedParking) : null,
          overnight_parking: showAmenities ? triStateToBool(overnightParking) : null,
          parking_spaces: showAmenities ? parkingSpaces.trim() : '',
          comments: comments.trim(),
          submitter_name: submitterName.trim(),
          submitter_contact: submitterContact.trim(),
          company_website: honeypot,
          ...(token ? { turnstileToken: token } : {}),
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setFormError(body.error ?? 'Something went wrong. Please try again.');
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
        <h3 className="display-section mt-6 text-2xl">Thanks, driver</h3>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Your report is in the moderation queue. Nothing publishes automatically — Shawn reviews
          every submission before the directory changes, so give it a little time to appear.
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
          <p className="mb-5 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300">
            {formError}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-ink">
          What are you reporting?
          <span className="text-diesel-300" aria-hidden="true">
            {' '}
            *
          </span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {KIND_OPTIONS.map((k) => (
            <label
              key={k.value}
              className={`cursor-pointer rounded-card border px-4 py-3 transition-colors ${
                kind === k.value
                  ? 'border-signal bg-asphalt'
                  : 'border-line bg-asphalt hover:border-signal/50'
              }`}
            >
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="kind"
                  value={k.value}
                  checked={kind === k.value}
                  onChange={() => {
                    setKind(k.value);
                    setErrors({});
                    setFormError('');
                  }}
                  className="mt-1 h-4 w-4 shrink-0 border-line text-signal focus:ring-signal"
                />
                <span>
                  <span className="block text-sm font-semibold text-ink">{k.label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{k.hint}</span>
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {needsPicker && (
        <div className="mt-6">
          <LocationPicker
            id="submission_location"
            label="Which listing?"
            required
            listings={listings}
            value={locationId}
            onChange={set(setLocationId, 'location_id')}
            error={errors.location_id}
          />
        </div>
      )}

      {kind === 'new' && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <TextField
            id="submission_name"
            label="Business name"
            required
            value={name}
            onChange={set(setName, 'name')}
            error={errors.name}
          />
          <SelectField
            id="submission_category"
            label="Category"
            required
            value={category}
            onChange={set(setCategory, 'category_slug')}
            options={CATEGORY_OPTIONS}
            placeholder="Pick a category"
            error={errors.category_slug}
          />
        </div>
      )}

      {showDetails && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField
              id="submission_address"
              label={kind === 'new' ? 'Street address' : 'Corrected street address'}
              value={address}
              onChange={set(setAddress, 'address')}
              autoComplete="off"
              error={errors.address}
            />
          </div>
          <TextField
            id="submission_city"
            label="City"
            value={city}
            onChange={set(setCity, 'city')}
            error={errors.city}
          />
          <SelectField
            id="submission_state"
            label="State"
            value={stateCode}
            onChange={set(setStateCode, 'state')}
            options={STATE_OPTIONS}
            placeholder="Select state"
            error={errors.state}
          />
          <TextField
            id="submission_zip"
            label="ZIP"
            value={zip}
            onChange={set(setZip, 'zip')}
            inputMode="numeric"
            placeholder="12345"
            error={errors.zip}
          />
          <TextField
            id="submission_phone"
            label="Phone"
            type="tel"
            value={phone}
            onChange={set(setPhone, 'phone')}
            inputMode="tel"
            placeholder="(555) 555-5555"
            error={errors.phone}
          />
          <div className="sm:col-span-2">
            <TextField
              id="submission_website"
              label="Website"
              value={website}
              onChange={set(setWebsite, 'website')}
              placeholder="https://…"
              error={errors.website}
            />
          </div>
          <div className="sm:col-span-2">
            <TextAreaField
              id="submission_description"
              label="Description"
              value={description}
              onChange={set(setDescription, 'description')}
              placeholder="What should drivers know about this place?"
              maxLength={2000}
              error={errors.description}
            />
          </div>
        </div>
      )}

      {showAmenities && (
        <div className="mt-6">
          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-ink">Amenities</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {AMENITIES.map((a) => (
                <CheckboxField
                  key={a}
                  id={`submission_amenity_${a.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  label={a}
                  checked={amenities.includes(a)}
                  onChange={() => toggleAmenity(a)}
                />
              ))}
            </div>
          </fieldset>

          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <TriStateField
              id="submission_free_parking"
              label="Free parking"
              value={freeParking}
              onChange={setFreeParking}
            />
            <TriStateField
              id="submission_paid_parking"
              label="Paid parking"
              value={paidParking}
              onChange={setPaidParking}
            />
            <TriStateField
              id="submission_reserved_parking"
              label="Reserved parking"
              value={reservedParking}
              onChange={setReservedParking}
            />
            <TriStateField
              id="submission_overnight_parking"
              label="Overnight parking"
              value={overnightParking}
              onChange={setOvernightParking}
            />
          </div>
          <div className="mt-5 sm:max-w-xs">
            <TextField
              id="submission_parking_spaces"
              label="Truck parking spaces (if you counted)"
              value={parkingSpaces}
              onChange={set(setParkingSpaces, 'parking_spaces')}
              inputMode="numeric"
              placeholder="e.g. 80"
              error={errors.parking_spaces}
            />
          </div>
        </div>
      )}

      <div className="mt-6">
        <TextAreaField
          id="submission_comments"
          label={kind === 'closure' ? 'What happened?' : 'Anything else?'}
          value={comments}
          onChange={set(setComments, 'comments')}
          placeholder={
            kind === 'closure'
              ? 'Closed for good? Torn down? No longer allows trucks? When did you notice?'
              : 'Details that help us verify this faster.'
          }
          maxLength={2000}
          error={errors.comments}
        />
      </div>

      <div className="mt-6">
        <PhotoPlaceholder />
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <TextField
          id="submission_submitter_name"
          label="Your name (optional)"
          value={submitterName}
          onChange={set(setSubmitterName, 'submitter_name')}
          autoComplete="name"
        />
        <TextField
          id="submission_submitter_contact"
          label="Email or phone (optional)"
          value={submitterContact}
          onChange={set(setSubmitterContact, 'submitter_contact')}
          autoComplete="email"
          placeholder="In case we have a question"
        />
      </div>

      <div className="mt-6">
        <TurnstileWidget siteKey={siteKey} onToken={setToken} onError={setTurnstileError} />
      </div>

      <p className="mt-6 text-xs text-muted">
        Every submission is reviewed by a human before anything changes in the directory. Nothing
        you send here publishes automatically.
      </p>

      <div className="mt-6">
        <Button type="submit" aria-disabled={submitting} disabled={submitting}>
          {submitting ? 'Sending…' : 'Send to review'}
        </Button>
      </div>
    </form>
  );
}
