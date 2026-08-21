'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { TextField, SelectField } from '@/components/apply/Fields';
import { TurnstileWidget } from '@/components/apply/TurnstileWidget';
import { trackEvent } from '@/lib/analytics';
import { INQUIRY_OPTIONS } from '@/lib/directory/offers';
import {
  DIRECTORY_EVENTS,
  boundCorridor,
  listingContextLine,
  sourceContextLine,
} from '@/lib/directory/funnel';

/**
 * Sponsor inquiry form. Posts to the existing guarded, Turnstile-protected
 * pipeline (`POST /api/sponsor-inquiry`), which files the prospect into the
 * sponsor CRM and logs an inbound touch. No pricing is committed here —
 * every conversation starts with a reply from Shawn.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-.\s]{7,20}$/;

/**
 * The options come from the offer authority, prices included, so the dropdown
 * cannot drift from the offer table rendered directly above it — and so the
 * bounded set the API validates against is the same list the form renders.
 */
const INTEREST_OPTIONS = INQUIRY_OPTIONS;

/** Billing preference is recorded on the inquiry — it never charges anything. */
const BILLING_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
];

/** Listing a directory CTA deep-linked from. Bounded params only — no PII. */
export type InquiryListing = {
  slug?: string;
  name?: string;
  category?: string;
  state?: string;
  /** Display form of the corridor (`I-95`), when the listing sits on one. */
  interstate?: string;
};

type Errors = Record<string, string>;

const INTEREST_VALUES: ReadonlySet<string> = new Set(INTEREST_OPTIONS.map((o) => o.value));

export function SponsorInquiryForm({
  siteKey,
  defaultInterest,
  listing,
  from,
}: {
  siteKey: string;
  /** Preselects the interest dropdown when a directory CTA deep-links in.
   * Only an existing allowed option is honored; anything else is ignored. */
  defaultInterest?: string;
  /** Listing this inquiry is about, when it came from a directory CTA. Shown
   * back to the sender and appended as one labelled line to the message. */
  listing?: InquiryListing;
  /** Bounded source token (a CTA surface or a campaign tag). Shown back and
   * appended as one labelled line — the CRM's only campaign attribution. */
  from?: string;
}) {
  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [interest, setInterest] = useState(
    defaultInterest && INTEREST_VALUES.has(defaultInterest) ? defaultInterest : '',
  );
  const [billing, setBilling] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [turnstileError, setTurnstileError] = useState('');
  const [token, setToken] = useState('');
  // Single-use Turnstile tokens are spent on any failed submit; remount the
  // widget (key bump) so the retry gets a fresh challenge.
  const [challengeKey, setChallengeKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const doneRef = useRef<HTMLDivElement>(null);

  // Focus the confirmation so it is announced and keyboard users aren't
  // stranded when the form unmounts.
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  // Analytics context: bounded, non-personal. Never the email, phone, company
  // name as typed, or the message body.
  const eventProps: Record<string, string> = {};
  if (listing?.slug) eventProps.slug = listing.slug;
  if (listing?.category) eventProps.category = listing.category;
  if (listing?.state) eventProps.state = listing.state;
  const corridor = boundCorridor(listing?.interstate);
  if (corridor) eventProps.corridor = corridor;
  if (from) eventProps.surface = from;
  if (interest) eventProps.interest = interest;
  if (billing) eventProps.billing = billing;

  // One "form started" event on first real interaction.
  const startedRef = useRef(false);
  function markStarted() {
    if (startedRef.current) return;
    startedRef.current = true;
    trackEvent(DIRECTORY_EVENTS.formStart, eventProps);
  }

  function set<T>(setter: (v: T) => void, key: string) {
    return (v: T) => {
      markStarted();
      setter(v);
      setErrors((p) => ({ ...p, [key]: '' }));
    };
  }

  function validate(): Errors {
    const e: Errors = {};
    if (!company.trim()) e.company = 'Enter your company name.';
    if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email.';
    if (phone.trim() && !PHONE_RE.test(phone.trim())) e.phone = 'Enter a valid phone number.';
    return e;
  }

  // The listing line is shown in the panel above and appended once, so the
  // inquiry that reaches the CRM says which listing it is about. Nothing is
  // hidden from the sender and nothing personal is added.
  const contextLine = listingContextLine(listing ?? {});
  const billingLine = billing
    ? `Billing preference: ${billing === 'annual' ? 'Annual' : 'Monthly'} (preference only — no payment was taken)`
    : '';
  const sourceLine = sourceContextLine(from);
  const composedMessage = [contextLine, billingLine, sourceLine, message.trim()]
    .filter(Boolean)
    .join('\n\n');

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (submitting) return;
    setFormError('');
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    if (!token) {
      setFormError(
        turnstileError || 'Please complete the verification challenge before continuing.',
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/sponsor-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: company.trim(),
          contact_name: contactName.trim() || undefined,
          email: email.trim(),
          phone: phone.trim(),
          tier_interest: interest || undefined,
          message: composedMessage || undefined,
          turnstileToken: token,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setFormError(body.error ?? 'Something went wrong. Please try again.');
        setToken('');
        setChallengeKey((k) => k + 1);
        // A rejected submit is a failure, never counted as a success.
        trackEvent(DIRECTORY_EVENTS.formFail, { ...eventProps, reason: 'rejected' });
        return;
      }
      trackEvent(DIRECTORY_EVENTS.formSubmit, eventProps);
      setDone(true);
    } catch {
      setFormError('Network error. Check your connection and try again.');
      setToken('');
      setChallengeKey((k) => k + 1);
      trackEvent(DIRECTORY_EVENTS.formFail, { ...eventProps, reason: 'network' });
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div
        ref={doneRef}
        tabIndex={-1}
        className="rounded-card border border-line bg-asphalt-800 p-8 text-center outline-none"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-signal text-2xl text-asphalt">
          ✓
        </div>
        <h3 className="display-section mt-6 text-2xl">Inquiry received</h3>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Thanks{contactName ? `, ${contactName}` : ''} — Shawn reads every inquiry himself and
          replies personally. Nothing is committed until you talk.
        </p>
        {/* What happens next, stated plainly. No promised reply time we have
            not agreed to, and no implication that a placement is now held: a
            paid slot is subject to review and to the page still having room. */}
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          Placement is subject to review and availability — pages have a fixed number of sponsored
          slots and we do not hold one on an inquiry. Nothing was charged and no payment details
          were collected.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="rounded-card border border-line bg-asphalt-800 p-8"
    >
      {(contextLine || sourceLine) && (
        <div className="mb-6 rounded-card border border-line bg-asphalt px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {contextLine ? 'About this listing' : 'Sent with your inquiry'}
          </p>
          {contextLine && <p className="mt-1 text-sm text-ink">{contextLine}</p>}
          {sourceLine && <p className="mt-1 text-sm text-muted">{sourceLine}</p>}
          <p className="mt-2 text-xs text-muted">
            {contextLine
              ? 'These lines are sent with your inquiry. Sending it does not verify ownership or change the listing — Shawn reviews every request.'
              : 'This line is sent with your inquiry so Shawn knows which post you came from. Sending it commits you to nothing.'}
          </p>
        </div>
      )}

      <div aria-live="assertive">
        {formError && (
          <p className="mb-5 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300">
            {formError}
          </p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="sponsor_company"
          label="Company"
          required
          value={company}
          onChange={set(setCompany, 'company')}
          autoComplete="organization"
          error={errors.company}
        />
        <TextField
          id="sponsor_contact_name"
          label="Contact name (optional)"
          value={contactName}
          onChange={set(setContactName, 'contact_name')}
          autoComplete="name"
          error={errors.contact_name}
        />
        <TextField
          id="sponsor_email"
          label="Email"
          type="email"
          required
          value={email}
          onChange={set(setEmail, 'email')}
          autoComplete="email"
          inputMode="email"
          error={errors.email}
        />
        <TextField
          id="sponsor_phone"
          label="Phone (optional)"
          type="tel"
          value={phone}
          onChange={set(setPhone, 'phone')}
          autoComplete="tel"
          inputMode="tel"
          placeholder="(555) 555-5555"
          error={errors.phone}
        />
        <SelectField
          id="sponsor_interest"
          label="What are you interested in? (optional)"
          value={interest}
          onChange={set(setInterest, 'interest')}
          options={[...INTEREST_OPTIONS]}
          placeholder="Not sure yet"
        />
        <SelectField
          id="sponsor_billing"
          label="If you go ahead, monthly or annual? (optional)"
          value={billing}
          onChange={set(setBilling, 'billing')}
          options={BILLING_OPTIONS}
          placeholder="No preference"
        />
      </div>

      <div className="mt-5">
        <label htmlFor="sponsor_message" className="mb-1.5 block text-sm font-semibold text-ink">
          Anything we should know? (optional)
        </label>
        <textarea
          id="sponsor_message"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
          rows={4}
          className="w-full rounded-card border border-line bg-asphalt px-4 py-3 text-ink outline-none focus:border-signal"
          placeholder="Goals, audience, timing — whatever helps the first conversation."
        />
      </div>

      <div className="mt-6">
        <TurnstileWidget
          key={challengeKey}
          siteKey={siteKey}
          onToken={setToken}
          onError={setTurnstileError}
        />
      </div>

      <p className="mt-6 text-xs text-muted">
        No payment is collected and no rate is committed here. This starts a conversation — Shawn
        replies personally. If you share a phone number, we use it only to reply to this inquiry,
        not for automated text messages.
      </p>

      {/* aria-disabled + in-handler guard instead of disabled, so keyboard
          focus isn't thrown off the button mid-submit. */}
      <div className="mt-6">
        <Button type="submit" aria-disabled={submitting} className="aria-disabled:opacity-60">
          {submitting ? 'Sending…' : 'Start the conversation'}
        </Button>
      </div>
    </form>
  );
}
