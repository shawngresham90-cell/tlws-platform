'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import type { ListingRow } from '@/lib/admin/directory';
import type { FormState } from '@/app/admin/(dashboard)/directory/actions';
import { DIRECTORY_CATEGORIES } from '@/lib/directory/categories';

/** Amenity vocabulary duplicated as a plain list for rendering (source of
 *  truth for validation lives in lib/directory/admin.ts). */
const AMENITIES = [
  'Showers',
  'Food',
  'Fuel',
  'Laundry',
  'Restrooms',
  'Repair',
  'CAT Scale',
  'Wi-Fi',
  'Security',
];

const inputClasses =
  'w-full rounded-card border border-line bg-asphalt px-3 py-2.5 text-ink placeholder:text-muted/60 ' +
  'focus:border-signal focus:outline-none';
const labelClasses = 'mb-1.5 block text-sm font-semibold text-ink';
const helpClasses = 'mt-1 text-xs text-muted';

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-card border border-line bg-asphalt-800 p-5">
      <legend className="px-2 font-display text-lg uppercase text-signal">{legend}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-[#FFEB00]"
      />
      {label}
    </label>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-card bg-signal px-6 py-3 font-display text-lg uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600 disabled:opacity-60"
    >
      {pending ? 'Saving…' : label}
    </button>
  );
}

/**
 * The add/edit listing form. A client component only so validation errors from
 * the server action render inline without losing what was typed
 * (useFormState); every write still happens server-side in the action.
 */
export function ListingForm({
  action,
  listing,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  listing?: ListingRow | null;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, { error: null });
  const l = listing ?? null;
  const amenities = new Set(l?.amenities ?? []);

  return (
    <form action={formAction} className="grid max-w-3xl gap-6">
      {state.error && (
        <p
          role="alert"
          className="rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel"
        >
          {state.error}
        </p>
      )}

      <Fieldset legend="Basics">
        <div className="sm:col-span-2">
          <label htmlFor="f-name" className={labelClasses}>
            Business / location name *
          </label>
          <input
            id="f-name"
            name="name"
            required
            maxLength={120}
            defaultValue={l?.name ?? ''}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="f-category" className={labelClasses}>
            Category *
          </label>
          <select
            id="f-category"
            name="category_slug"
            required
            defaultValue={l?.category_slug ?? ''}
            className={inputClasses}
          >
            <option value="" disabled>
              Pick a category…
            </option>
            {DIRECTORY_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="f-description" className={labelClasses}>
            Description
          </label>
          <textarea
            id="f-description"
            name="description"
            rows={4}
            maxLength={2000}
            defaultValue={l?.description ?? ''}
            className={inputClasses}
          />
        </div>
      </Fieldset>

      <Fieldset legend="Location">
        <div className="sm:col-span-2">
          <label htmlFor="f-address" className={labelClasses}>
            Address
          </label>
          <input
            id="f-address"
            name="address"
            maxLength={200}
            defaultValue={l?.address ?? ''}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="f-city" className={labelClasses}>
            City *
          </label>
          <input
            id="f-city"
            name="city"
            required
            maxLength={80}
            defaultValue={l?.city ?? ''}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="f-state" className={labelClasses}>
            State *
          </label>
          <input
            id="f-state"
            name="state"
            required
            maxLength={2}
            placeholder="GA"
            defaultValue={l?.state ?? ''}
            className={inputClasses}
          />
          <p className={helpClasses}>Two-letter code.</p>
        </div>
        <div>
          <label htmlFor="f-zip" className={labelClasses}>
            ZIP code
          </label>
          <input
            id="f-zip"
            name="zip"
            maxLength={10}
            placeholder="30720"
            defaultValue={l?.zip ?? ''}
            className={inputClasses}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="f-lat" className={labelClasses}>
              Latitude
            </label>
            <input
              id="f-lat"
              name="lat"
              type="number"
              step="any"
              min={-90}
              max={90}
              defaultValue={l?.lat ?? ''}
              className={inputClasses}
            />
          </div>
          <div>
            <label htmlFor="f-lng" className={labelClasses}>
              Longitude
            </label>
            <input
              id="f-lng"
              name="lng"
              type="number"
              step="any"
              min={-180}
              max={180}
              defaultValue={l?.lng ?? ''}
              className={inputClasses}
            />
          </div>
        </div>
      </Fieldset>

      <Fieldset legend="Contact">
        <div>
          <label htmlFor="f-phone" className={labelClasses}>
            Phone
          </label>
          <input
            id="f-phone"
            name="phone"
            type="tel"
            maxLength={30}
            defaultValue={l?.phone ?? ''}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="f-website" className={labelClasses}>
            Website
          </label>
          <input
            id="f-website"
            name="website"
            type="url"
            placeholder="https://…"
            defaultValue={l?.website ?? ''}
            className={inputClasses}
          />
        </div>
      </Fieldset>

      <Fieldset legend="Parking">
        <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-4">
          <Check name="free_parking" label="Free parking" defaultChecked={l?.free_parking} />
          <Check name="paid_parking" label="Paid parking" defaultChecked={l?.paid_parking} />
          <Check
            name="reserved_parking"
            label="Reserved parking"
            defaultChecked={l?.reserved_parking}
          />
          <Check
            name="overnight_parking"
            label="Overnight allowed"
            defaultChecked={l?.overnight_parking}
          />
        </div>
        <div>
          <label htmlFor="f-spaces" className={labelClasses}>
            Number of truck spaces
          </label>
          <input
            id="f-spaces"
            name="parking_spaces"
            type="number"
            min={0}
            max={10000}
            defaultValue={l?.parking_spaces ?? ''}
            className={inputClasses}
          />
        </div>
      </Fieldset>

      <Fieldset legend="Amenities">
        <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-3">
          {AMENITIES.map((a) => (
            <Check key={a} name="amenities" label={a} defaultChecked={amenities.has(a)} />
          ))}
        </div>
      </Fieldset>

      <Fieldset legend="Monetization">
        <div>
          <label htmlFor="f-tpc" className={labelClasses}>
            TruckParkingClub URL
          </label>
          <input
            id="f-tpc"
            name="tpc_url"
            type="url"
            placeholder="https://truckparkingclub.com/…"
            defaultValue={l?.tpc_url ?? ''}
            className={inputClasses}
          />
          <p className={helpClasses}>
            When set, the public card shows a “Reserve a spot” button (rel=sponsored).
          </p>
        </div>
        <div>
          <label htmlFor="f-affiliate" className={labelClasses}>
            Affiliate code
          </label>
          <input
            id="f-affiliate"
            name="affiliate_code"
            maxLength={60}
            defaultValue={l?.affiliate_code ?? ''}
            className={inputClasses}
          />
        </div>
      </Fieldset>

      <Fieldset legend="Media">
        <div className="sm:col-span-2">
          <label htmlFor="f-image" className={labelClasses}>
            Image URL
          </label>
          <input
            id="f-image"
            name="image_url"
            type="url"
            placeholder="https://…"
            defaultValue={l?.image_url ?? ''}
            className={inputClasses}
          />
        </div>
      </Fieldset>

      <Fieldset legend="Editorial">
        <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-3">
          <Check name="is_published" label="Published (visible)" defaultChecked={l?.is_published} />
          <Check name="is_featured" label="Featured listing" defaultChecked={l?.is_featured} />
          <Check
            name="is_indexable"
            label="Include in SEO (complete)"
            defaultChecked={l?.is_indexable}
          />
        </div>
        <div>
          <label htmlFor="f-verified" className={labelClasses}>
            Verified date
          </label>
          <input
            id="f-verified"
            name="verified_on"
            type="date"
            defaultValue={l?.verified_at ? l.verified_at.slice(0, 10) : ''}
            className={inputClasses}
          />
          <p className={helpClasses}>When this listing’s details were last confirmed.</p>
        </div>
        {l?.updated_at && (
          <p className="self-end text-xs text-muted">
            Last updated {new Date(l.updated_at).toLocaleString('en-US')}
          </p>
        )}
      </Fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton label={submitLabel} />
        <Link
          href="/admin/directory"
          className="rounded-card border border-line px-5 py-3 font-display text-lg uppercase tracking-wide text-ink transition-colors hover:border-signal hover:text-signal"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
