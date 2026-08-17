/**
 * What a driver is asked at signup, what counts as a valid answer, and the
 * exact wording they were shown when they answered.
 *
 * Pure: no clock, no I/O, no Supabase, no browser globals. Every timestamp
 * arrives as an argument. That is what lets the harness test the consent
 * rules exhaustively without a database, which matters more here than
 * anywhere else in this milestone — a consent bug is not a crash, it is a
 * quiet compliance failure that looks like working software.
 *
 * THE COPY IS DATA, NOT JSX. The consent evidence log stores the exact
 * sentence a person agreed to, verbatim, alongside a version. That only works
 * if there is one copy of the sentence and it is quotable — so the wording
 * lives here, the screen renders it, and the evidence row stores it. A future
 * edit to the wording must bump the version in the same commit; a test pins
 * that the two move together.
 */

/**
 * Bumped whenever ANY string in CONSENT_COPY changes.
 *
 * Stored on every profile and every consent-evidence row, so a row from
 * before an edit still proves what that person actually saw.
 */
export const CONSENT_COPY_VERSION = 'navigator-account-v2';

export const CONSENT_COPY = Object.freeze({
  /**
   * The required acceptance.
   *
   * v1 NAMED PRIVACY ONLY, AND SAID WHY: "This platform has no Terms of
   * Service page … asking a driver to accept 'the Terms' while linking
   * nothing, or linking a page that does not exist, would be recording an
   * agreement to a document that was never shown."
   *
   * That reasoning has not been relaxed — its premise changed. `/terms` now
   * exists as a real page describing this product, so naming it here records
   * an agreement to something a driver can actually open and read. The
   * `terms_accepted_at` column 050 left nullable for exactly this moment is
   * now written at signup.
   *
   * The version moved with the wording, which is the rule this file states
   * about itself: a consent row from before this edit still proves what that
   * person saw, because it carries `navigator-account-v1` and v1's sentence.
   *
   * THE COPY IS STILL AHEAD OF ITS REVIEW. The Terms page is marked in its own
   * header as proposed text pending owner and legal review. If that review
   * changes the wording of the acceptance sentence, this constant and this
   * version must move again in the same commit — and they can, freely, because
   * account mode is enabled nowhere and no driver has yet agreed to anything.
   * The test that resolves each named document to a real page is what stops
   * this from drifting back into naming something that is not there.
   */
  acceptance: 'I agree to the Trucking Life Terms of Service and Privacy Policy.',

  /** Optional. Unchecked by default, and never a condition of entry. */
  emailMarketing: 'Email me TLWS news, trucking resources, product updates, and special offers.',

  /** Optional, and only offered once a usable phone number exists. */
  smsMarketing:
    'Text me TLWS news and offers. Message and data rates may apply. Reply STOP to opt out.',

  /**
   * Shown beside the button, because a driver typing an email address into a
   * trucking app deserves to know which emails are the price of entry and
   * which are a choice. Transactional and marketing are different things and
   * this sentence is where the product says so.
   */
  transactionalNote:
    'We email you a sign-in code every time you sign in. That is part of your account and is separate from marketing email.',
});

export type SignupInput = {
  firstName: string;
  email: string;
  phone?: string | null;
  acceptedPrivacy: boolean;
  emailMarketing: boolean;
  smsMarketing: boolean;
};

export type SignupProblem =
  | 'first-name-required'
  | 'first-name-too-long'
  | 'email-required'
  | 'email-invalid'
  | 'phone-invalid'
  | 'privacy-required'
  | 'sms-consent-needs-phone';

/**
 * Normalize an email the same way the database does.
 *
 * `email_consents.email` and `navigator_profiles.email` both carry a check
 * constraint requiring `lower(btrim(x))`, and the marketing export joins them
 * on that column. Two spellings of one address would split a person's history
 * and hide half their evidence — so normalization happens once, here, at the
 * parse boundary.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Deliberately permissive: one @, something either side, a dot in the domain,
 * no whitespace. Anything stricter rejects real addresses — and the address
 * is verified by a code sent to it moments later, which is a far better test
 * of validity than a regex has ever been.
 */
export function isPlausibleEmail(value: string): boolean {
  if (value.length < 6 || value.length > 320) return false;
  if (/\s/.test(value)) return false;
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(value);
}

/**
 * Reduce a typed phone number to digits, keeping a leading +.
 *
 * Returns null for anything that cannot be a phone number, INCLUDING an empty
 * string — the field is optional, and "not given" and "given wrongly" are
 * different answers that the caller has to be able to tell apart.
 *
 * A bare 10-digit US number gains a +1, because that is the only country this
 * product currently collects numbers in and a CSV importer needs the country
 * code. An 11-digit number starting 1 is treated the same way.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '') return null;
  const digits = trimmed.replace(/[^\d+]/g, '');
  const plus = digits.startsWith('+');
  const bare = digits.replace(/\+/g, '');
  if (bare.length === 0) return null;
  if (!plus && bare.length === 10) return `+1${bare}`;
  if (!plus && bare.length === 11 && bare.startsWith('1')) return `+${bare}`;
  if (bare.length < 8 || bare.length > 15) return null;
  if (bare.startsWith('0')) return null;
  return `+${bare}`;
}

/**
 * Validate a signup. Returns every problem, not the first — a driver on a
 * phone should fix one form once.
 */
export function validateSignup(input: SignupInput): SignupProblem[] {
  const problems: SignupProblem[] = [];

  const firstName = input.firstName.trim();
  if (firstName.length === 0) problems.push('first-name-required');
  else if (firstName.length > 80) problems.push('first-name-too-long');

  const email = normalizeEmail(input.email ?? '');
  if (email.length === 0) problems.push('email-required');
  else if (!isPlausibleEmail(email)) problems.push('email-invalid');

  const rawPhone = (input.phone ?? '').trim();
  const phone = normalizePhone(rawPhone);
  // Given-but-unparseable is an error. Not given at all is fine.
  if (rawPhone !== '' && phone === null) problems.push('phone-invalid');

  if (!input.acceptedPrivacy) problems.push('privacy-required');

  /*
   * The rule the database cannot enforce, because the consent row and the
   * phone number live in different tables. A texting consent with no number
   * to text is not a lesser record — it is a false one, and it would sit in
   * an append-only log that by design nobody can go back and correct.
   */
  if (input.smsMarketing && phone === null) problems.push('sms-consent-needs-phone');

  return problems;
}

/**
 * The evidence rows a valid signup should append — one per marketing channel
 * the driver was ASKED about, whichever way they answered.
 *
 * A decline is evidence too. "Was shown the disclosure and said no" and "was
 * never asked" are different facts, and only a recorded decline can tell them
 * apart later. So this returns a row for each channel that was offered, with
 * `granted` carrying the answer — never an empty list because someone
 * unticked a box.
 *
 * SMS is offered only when a phone number was supplied, so a signup with no
 * phone yields exactly one row. Recording an SMS decline for someone who was
 * never shown the SMS checkbox would be inventing evidence.
 */
export type ConsentEvidence = {
  channel: 'email' | 'sms';
  granted: boolean;
  disclosureText: string;
  version: string;
};

export function consentEvidenceFor(input: SignupInput): ConsentEvidence[] {
  const rows: ConsentEvidence[] = [
    {
      channel: 'email',
      granted: input.emailMarketing === true,
      disclosureText: CONSENT_COPY.emailMarketing,
      version: CONSENT_COPY_VERSION,
    },
  ];
  if (normalizePhone(input.phone) !== null) {
    rows.push({
      channel: 'sms',
      granted: input.smsMarketing === true,
      disclosureText: CONSENT_COPY.smsMarketing,
      version: CONSENT_COPY_VERSION,
    });
  }
  return rows;
}

/**
 * A six-digit code, and nothing that merely looks like one.
 *
 * Supabase issues six digits; anything else is a typo or a probe, and
 * rejecting it here saves a round-trip and denies an attacker a free oracle
 * on what shape the code is.
 */
export function isWellFormedOtp(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}

/**
 * How long a driver must wait before asking for another code.
 *
 * Short enough that a code lost to a spam folder is not a dead end, long
 * enough that the button is not a free email-sending API pointed at a
 * stranger's inbox. Supabase enforces its own limit on top; this one exists
 * so the UI can say how long, which Supabase's error cannot.
 */
export const OTP_RESEND_COOLDOWN_SECONDS = 45;

export function resendAvailableInSeconds(lastSentAtMs: number | null, nowMs: number): number {
  if (lastSentAtMs === null) return 0;
  const elapsed = Math.floor((nowMs - lastSentAtMs) / 1000);
  return Math.max(0, OTP_RESEND_COOLDOWN_SECONDS - elapsed);
}

/**
 * The one thing every failed sign-in says, whatever actually happened.
 *
 * An honest error here would answer "does this address have an account?" for
 * anyone who asks — which is exactly the question an attacker enumerating
 * addresses wants answered, and which a driver never needs answered because
 * the flow is identical either way. Sending a code to an unknown address and
 * sending one to a known address produce the same screen and the same words.
 */
export const GENERIC_OTP_SENT_MESSAGE =
  'If that address can receive mail, a six-digit code is on its way. It expires shortly.';

export const GENERIC_OTP_FAILED_MESSAGE =
  'That code did not work. Codes expire quickly — request a new one and try again.';

/**
 * What a server action hands back to the account form.
 *
 * Lives here rather than beside the actions because the client component
 * imports it, and a `'use server'` module is not a place to source a type
 * from — everything exported from one must be an async function.
 *
 * The collected fields are echoed back on purpose. The profile is written at
 * VERIFICATION, not before, because `navigator_profiles.user_id` is a foreign
 * key to `auth.users` and no user exists until a code is verified. So the
 * answers have to survive the round trip, and the honest options are a server
 * session, a cookie, or the form itself. The form is the one that stores
 * nothing anywhere and disappears when the tab closes.
 */
export type AccountActionState = {
  stage: 'collect' | 'code';
  message?: string;
  problems?: SignupProblem[] | string[];
  email?: string;
  next?: string;
  /** Echoed so the code stage can complete the profile it could not write yet. */
  collected?: {
    firstName: string;
    phone: string;
    emailMarketing: boolean;
    smsMarketing: boolean;
  };
};
