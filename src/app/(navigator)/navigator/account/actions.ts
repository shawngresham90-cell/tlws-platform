'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sanitizeNextPath } from '@/lib/navigator-api/pilot-access';
import { navigatorAccessMode } from '@/lib/navigator-api/access-policy';
import { RateLimiter } from '@/lib/trip-planner/rate-limit';
import { buildEmailConsentRecord } from '@/lib/leads/email-consent';
import {
  CONSENT_COPY,
  CONSENT_COPY_VERSION,
  GENERIC_OTP_FAILED_MESSAGE,
  GENERIC_OTP_SENT_MESSAGE,
  consentEvidenceFor,
  isWellFormedOtp,
  normalizeEmail,
  normalizePhone,
  validateSignup,
  type AccountActionState,
  type SignupInput,
} from '@/lib/navigator-account/signup-contract';

/**
 * The account server actions. Everything that decides anything happens here,
 * on the server: the client sends field values and gets back a rendered
 * result, never a token, never a verdict it computed itself.
 *
 * THE SHAPE OF EVERY ANSWER IS THE SAME. Requesting a code for an address
 * that has an account and for one that does not produce identical responses —
 * same message, same screen, same timing branch. An honest error here would
 * answer "does this person have an account?" for anyone who asks, which is
 * the question an enumeration attack is built to ask and which no driver ever
 * needs answered.
 *
 * RATE LIMITED BEFORE ANYTHING ELSE. A sign-in form that emails a stranger on
 * demand is an email-sending API pointed at someone else's inbox. The limiter
 * is per-IP and in-memory, the same known-limited discipline as every other
 * limiter in this repository; Supabase enforces its own limit underneath,
 * which is the one that actually bounds spend.
 */

const otpLimiter = new RateLimiter({
  capacity: 5,
  refillPerSecond: 5 / 900, // 5 per 15 minutes per IP, per instance
  nowMs: () => Date.now(),
});

const verifyLimiter = new RateLimiter({
  capacity: 10,
  refillPerSecond: 10 / 900,
  nowMs: () => Date.now(),
});

/** Same derivation as the Navigator API routes: edge-appended hop only. */
function clientKey(): string {
  const h = headers();
  const xff = h.get('x-forwarded-for');
  const lastHop = xff?.split(',').pop()?.trim();
  return h.get('x-nf-client-connection-ip') ?? lastHop ?? 'unknown';
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://truckinglifewithshawn.com';
}

/**
 * Step one: validate, remember the intent, and ask Supabase to send a code.
 *
 * The profile is NOT written here. There is no user yet — `auth.users` gains a
 * row only once a code is verified — and `navigator_profiles.user_id` is a
 * foreign key to it. Writing identity before verification would also mean an
 * unverified address could claim a profile, which is the one thing the code is
 * there to prevent. So the answers ride through the flow in the form and land
 * in the database in step two.
 */
export async function requestCodeAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  if (navigatorAccessMode() !== 'account') {
    return { stage: 'collect', message: 'Accounts are not open on this deploy.' };
  }

  const next = sanitizeNextPath(String(formData.get('next') ?? ''));
  const returning = String(formData.get('returning') ?? '') === 'true';
  const email = normalizeEmail(String(formData.get('email') ?? ''));

  /*
   * A returning driver supplies an address and nothing else — they accepted
   * the policy and answered the marketing questions when they signed up, and
   * asking again would either re-record consent they already gave or quietly
   * overwrite it. So the new-driver rules are checked only for a new driver.
   */
  const input: SignupInput = {
    firstName: String(formData.get('firstName') ?? ''),
    email,
    phone: String(formData.get('phone') ?? ''),
    acceptedPrivacy: String(formData.get('acceptedPrivacy') ?? '') === 'on',
    emailMarketing: String(formData.get('emailMarketing') ?? '') === 'on',
    smsMarketing: String(formData.get('smsMarketing') ?? '') === 'on',
  };

  const problems = returning
    ? email.length === 0 || !/^[^@]+@[^@.]+(\.[^@.]+)+$/.test(email)
      ? ['email-invalid']
      : []
    : validateSignup(input);
  if (problems.length > 0) {
    return { stage: 'collect', problems, email, next };
  }

  // Ordered before the send so a refused request costs no email and no quota.
  if (!otpLimiter.allow(clientKey())) {
    return {
      stage: 'collect',
      message: 'Too many code requests from this connection. Wait a few minutes and try again.',
      email,
      next,
    };
  }

  const supabase = createClient();
  /*
   * `shouldCreateUser: true` for both paths, deliberately. Setting it false
   * for a returning driver would make Supabase answer differently for a known
   * and an unknown address — reintroducing exactly the enumeration oracle the
   * generic message above exists to close.
   */
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${siteUrl()}/navigator/account`,
    },
  });

  /*
   * The error is deliberately not surfaced. A driver can do nothing with
   * "user already registered" or "over email rate limit" except learn
   * something about someone else's account, and both produce the same next
   * step: check your mail, and if nothing arrives, ask again.
   */
  /*
   * Nothing is logged here, and that is a repository-wide rule rather than an
   * oversight: no Navigator surface writes to a log or fires an analytics
   * event, because the cheapest way to guarantee that a driver's address and
   * movements never end up in a log line is to have no log lines. A failed
   * send is invisible to us and recoverable by the driver, who asks again.
   */
  void error;

  return {
    stage: 'code',
    message: GENERIC_OTP_SENT_MESSAGE,
    email,
    next,
    // Absent for a returning driver: there is nothing new to record, and an
    // empty first name must never overwrite the one already stored.
    collected: returning
      ? undefined
      : {
          firstName: input.firstName.trim(),
          phone: String(formData.get('phone') ?? ''),
          emailMarketing: input.emailMarketing,
          smsMarketing: input.smsMarketing,
        },
  };
}

/**
 * Step two: verify the code, then write identity and consent evidence.
 *
 * Order matters. The session is established first, so the profile insert runs
 * as the driver themselves and RLS proves ownership rather than the code
 * asserting it. The consent rows are written with the service role, because
 * migration 049 grants insert on the evidence log to nobody else — evidence
 * that a user could write is not evidence.
 */
export async function verifyCodeAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  if (navigatorAccessMode() !== 'account') {
    return { stage: 'collect', message: 'Accounts are not open on this deploy.' };
  }

  const next = sanitizeNextPath(String(formData.get('next') ?? ''));
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const token = String(formData.get('code') ?? '').trim();

  if (!isWellFormedOtp(token)) {
    return { stage: 'code', message: GENERIC_OTP_FAILED_MESSAGE, email, next };
  }
  if (!verifyLimiter.allow(clientKey())) {
    return {
      stage: 'code',
      message: 'Too many attempts from this connection. Wait a few minutes and try again.',
      email,
      next,
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error || !data.user) {
    return { stage: 'code', message: GENERIC_OTP_FAILED_MESSAGE, email, next };
  }

  const user = data.user;
  const now = new Date();
  const firstName = String(formData.get('firstName') ?? '').trim();
  const phoneRaw = String(formData.get('phone') ?? '');
  const phone = normalizePhone(phoneRaw);

  /*
   * A returning driver's form carries no first name, and must not blank the
   * one they already have. `upsert` with a partial row would do exactly that,
   * so identity is written only when there is something to write.
   */
  if (firstName.length > 0) {
    const { error: profileError } = await supabase.from('navigator_profiles').upsert(
      {
        user_id: user.id,
        first_name: firstName,
        email,
        phone: phone === null ? null : phoneRaw.trim(),
        phone_e164: phone,
        privacy_accepted_at: now.toISOString(),
        /*
         * Written now that `/terms` exists and the acceptance sentence names
         * it. 050 left this column nullable precisely so that adding Terms
         * later would be a copy change rather than a migration, and this is
         * that change arriving. One checkbox covers both documents, so the two
         * timestamps are the same instant by construction — recording them
         * separately would imply a second act of agreement that never
         * happened.
         */
        terms_accepted_at: now.toISOString(),
        consent_copy_version: CONSENT_COPY_VERSION,
        signup_source: 'navigator',
      },
      { onConflict: 'user_id' },
    );
    // A failed profile write must not cost the driver the session they just
    // proved they own. They are signed in; the Account screen can repair it.
    // Not logged — see the note above. The driver holds a verified session
    // either way, and the Account screen is where a missing name is repaired.
    void profileError;

    await recordSignupConsent({
      email,
      input: {
        firstName,
        email,
        phone: phoneRaw,
        acceptedPrivacy: true,
        emailMarketing: String(formData.get('emailMarketing') ?? '') === 'on',
        smsMarketing: String(formData.get('smsMarketing') ?? '') === 'on',
      },
      now,
    });
  }

  redirect(next);
}

/**
 * Append the consent evidence for a signup — one row per channel the driver
 * was actually shown, carrying the exact wording they saw.
 *
 * Failures are logged and swallowed. That is the right trade in this
 * direction only: a missing evidence row means an address that cannot be
 * marketed to, because `email_subscription_status` treats absence as "no
 * recorded consent" rather than as consent. The failure mode is a driver who
 * ticked the box and does not receive marketing — annoying, and strictly
 * safer than the reverse.
 */
async function recordSignupConsent(args: {
  email: string;
  input: SignupInput;
  now: Date;
}): Promise<void> {
  const rows = consentEvidenceFor(args.input);
  const emailRow = rows.find((r) => r.channel === 'email');
  if (!emailRow) return;

  try {
    const admin = createAdminClient();
    const { error } = await admin.from('email_consents').insert(
      buildEmailConsentRecord({
        sourceForm: 'navigator-account',
        sourceUrl: `${siteUrl()}/navigator/account`,
        email: args.email,
        consent: emailRow.granted,
        now: args.now,
        disclosureText: emailRow.disclosureText,
        disclosureVersion: emailRow.version,
      }),
    );
    void error;

    const smsRow = rows.find((r) => r.channel === 'sms');
    if (smsRow) {
      const { error: smsError } = await admin.from('sms_consents').insert({
        source_form: 'navigator-account',
        source_url: `${siteUrl()}/navigator/account`,
        email: args.email,
        phone: normalizePhone(args.input.phone),
        sms_consent: smsRow.granted,
        sms_consent_at: smsRow.granted ? args.now.toISOString() : null,
        sms_consent_version: smsRow.version,
        disclosure_text: smsRow.disclosureText,
      });
      void smsError;
    }
  } catch {
    /*
     * Swallowed on purpose, and only safe in this direction. A missing
     * evidence row means an address that CANNOT be marketed to, because
     * `email_subscription_status` reads absence as "no recorded consent"
     * rather than as consent. The failure mode is a driver who ticked the box
     * and hears nothing — annoying, and strictly safer than the reverse.
     */
  }
}

/** Sign out and return to the account screen. */
export async function signOutAction(): Promise<void> {
  await createClient().auth.signOut();
  redirect('/navigator/account');
}

/**
 * The consent-withdrawal half, and the reason the profile has no boolean.
 *
 * Withdrawing does not edit anything. It APPENDS an unsubscribe row, and the
 * derived view stops reporting the driver as subscribed on the next read —
 * so the marketing export drops them without a single UPDATE anywhere, and
 * the record of what they originally agreed to survives intact.
 */
export async function updateMarketingAction(formData: FormData): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/navigator/account');

  const wantsEmail = String(formData.get('emailMarketing') ?? '') === 'on';
  const { data: profile } = await supabase
    .from('navigator_profiles')
    .select('email')
    .eq('user_id', user.id)
    .maybeSingle();
  const email = (profile as { email?: string } | null)?.email;
  if (!email) redirect('/navigator/account');

  const now = new Date();
  try {
    const admin = createAdminClient();
    if (wantsEmail) {
      await admin.from('email_consents').insert(
        buildEmailConsentRecord({
          sourceForm: 'navigator-account',
          sourceUrl: `${siteUrl()}/navigator/account`,
          email,
          consent: true,
          now,
          disclosureText: CONSENT_COPY.emailMarketing,
          disclosureVersion: CONSENT_COPY_VERSION,
        }),
      );
    } else {
      await admin.from('email_unsubscribes').insert({
        email,
        method: 'manual',
        note: 'Withdrawn by the driver in Navigator account settings.',
      });
    }
  } catch {
    // Same fail-safe direction as signup: no row means not marketable.
  }
  redirect('/navigator/account?saved=1');
}

/**
 * Delete the account.
 *
 * One call, because the database does the rest: `navigator_profiles.user_id`
 * and `navigator_state.user_id` are both `references auth.users(id) on delete
 * cascade`, so removing the auth row removes the profile and every saved
 * domain with it. Doing it in application code instead would leave three
 * places that must each remember, and one of them eventually would not.
 *
 * The consent evidence is deliberately NOT deleted. It is an append-only
 * record of what a person agreed to and when, and a compliance record that
 * disappears with the account is not a compliance record. A driver who wants
 * to stop being emailed is served by the withdrawal path above, which is a
 * different request from deleting an account.
 */
export async function deleteAccountAction(formData: FormData): Promise<void> {
  if (String(formData.get('confirm') ?? '') !== 'DELETE') {
    redirect('/navigator/account?error=confirm');
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/navigator/account');

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) redirect('/navigator/account?error=delete');
  } catch {
    redirect('/navigator/account?error=delete');
  }
  await supabase.auth.signOut();
  redirect('/?deleted=1');
}
