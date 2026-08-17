import Link from 'next/link';
import { LegalPage } from '@/components/legal/LegalPage';
import { LEGAL } from '@/lib/legal/company';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * ============================================================================
 * PROPOSED TEXT — REQUIRES OWNER AND LEGAL REVIEW BEFORE LAUNCH
 * ============================================================================
 *
 * This page did not exist before. It is drafted to describe THIS product as it
 * actually behaves, and every clause below was written against the code rather
 * than adapted from a template — the ELD disclaimer, the map-currency
 * disclaimer and the driver-responsibility clause each correspond to something
 * `docs/operations/navigator-known-limitations.md` already records.
 *
 * It is NOT legal advice and it has not been reviewed by counsel. The same
 * caveat already stands over the Privacy Policy and SMS Terms in
 * `src/lib/legal/company.ts`.
 *
 * TWO THINGS AN OWNER MUST DECIDE BEFORE THIS IS BINDING ON ANYONE:
 *
 *   1. Counsel review of the wording, particularly the limitation-of-liability
 *      and governing-law sections, which are the two a template gets wrong.
 *   2. Whether `LEGAL.contactEmail` is a provisioned mailbox. It is currently
 *      marked "OWNER TO CONFIRM" and a Terms page that names an address nobody
 *      reads is worse than one that names none.
 *
 * WHAT IS DELIBERATELY ABSENT, because the product cannot support the claim:
 * no uptime commitment, no accuracy guarantee, no statement that the Navigator
 * is compliant with any regulation, no insurance, no indemnity running in the
 * driver's favour, and no claim that any authority has approved or certified
 * anything here. If a future edit adds one of those, it must be because
 * somebody bought it, not because the sentence read better.
 */

export const metadata = buildMetadata({
  title: 'Terms of Service | Trucking Life',
  description:
    'The terms for using Trucking Life services, including free Navigator accounts, acceptable use, and the limits of what the Navigator can tell you.',
  path: '/terms',
});

export default function TermsOfServicePage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These Terms govern your use of <a href={LEGAL.website}>{LEGAL.website}</a> and the services
        we offer through it, including the <strong>Navigator</strong> and a free Navigator account.
        They are an agreement between you and <strong>{LEGAL.entity}</strong> (&ldquo;Trucking
        Life,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;), based in {LEGAL.locale}. By using the site
        or creating an account, you agree to these Terms. If you do not agree, please do not use the
        service.
      </p>
      <p>
        How we handle your information is described separately in our{' '}
        <Link href="/privacy">Privacy Policy</Link>. Text messaging has its own terms in our{' '}
        <Link href="/sms-terms">SMS Terms &amp; Conditions</Link>.
      </p>

      <h2>Read this part first: what the Navigator is not</h2>
      <p>
        The Navigator is a planning and guidance aid. It is not a substitute for your own judgment,
        your own eyes, or the law.
      </p>
      <ul>
        <li>
          <strong>The road wins. Always.</strong> Posted signs, posted restrictions, physical
          barriers, permanent and temporary closures, detours, weight and height postings, and the
          instructions of law enforcement or a DOT officer{' '}
          <em>override anything the Navigator shows you</em>. If the screen and the sign disagree,
          the sign is right.
        </li>
        <li>
          <strong>We do not guarantee that any map record is current or correct.</strong> Road data,
          bridge and overpass clearances, weight limits, hazmat and truck restrictions, closures,
          construction, and points of interest come from third-party sources and from records that
          change without notice. Some of it is wrong. Some of it is out of date the day it is
          published. We make no promise that any particular restriction, bridge, closure, ramp,
          turn, or facility is accurately represented, or represented at all.
        </li>
        <li>
          <strong>You are responsible for verifying your route is legal for your vehicle.</strong>{' '}
          That includes your actual height, length, width, weight, axle configuration, and cargo,
          and any permits, escorts, or restrictions that apply to them. Entering a truck profile
          into the Navigator does not verify anything — it only tells the Navigator what to try to
          route around.
        </li>
        <li>
          <strong>The Navigator is not an ELD.</strong> It is not an electronic logging device, it
          is not an AOBRD, it does not record duty status, and it must not be used as a record of
          duty status or offered to an officer as one. It is not certified or registered with FMCSA
          for any purpose.
        </li>
        <li>
          <strong>Hours-of-service information is entered by you and is informational only.</strong>{' '}
          The Navigator&rsquo;s clocks reflect what you typed in. They are a convenience for
          planning your day. They are not a compliance record, they are not verified against
          anything, and they do not determine whether you are legal to drive. Your ELD and your
          carrier&rsquo;s records are what count.
        </li>
      </ul>

      <h2>Navigator accounts</h2>
      <p>
        A Navigator account is <strong>free</strong>. There is no subscription, no trial that
        converts to a charge, and no payment method required. We may change what a free account
        includes, or begin charging for some future feature, but we will not start charging you for
        something you already have without telling you first.
      </p>
      <p>
        You sign in with your email address and a one-time code we send you. There is no permanent
        username and no password to remember — we do not create one for you and we never ask you to
        choose one. Keep access to your email account secure: anyone who can read your email can
        receive a sign-in code.
      </p>
      <p>
        An account is for one person. You are responsible for what happens under it. Please tell us
        if you believe someone else is using it.
      </p>
      <p>
        <strong>Marketing is optional.</strong> Agreeing to receive marketing email or text messages
        is never a condition of creating an account or of using any part of the Navigator. You get
        the same access either way. We do send you a sign-in code each time you sign in, and other
        messages necessary to operate your account; those are part of the service and are separate
        from marketing.
      </p>

      <h2>Acceptable use</h2>
      <p>
        The Navigator calls paid third-party services every time it plans a route or runs a search,
        so abuse is not abstract here — it has a bill attached. You agree not to:
      </p>
      <ul>
        <li>
          use scripts, bots, scrapers, or other automated means to request routes, searches, or any
          other part of the service, or to create accounts;
        </li>
        <li>
          resell, redistribute, or rebroadcast our routing, search, or map results, or build a
          competing service out of them;
        </li>
        <li>
          attempt to work around usage limits, rate limits, or access controls, including by
          creating multiple accounts;
        </li>
        <li>
          probe, scan, or test the security of the service, or try to reach data that is not yours;
        </li>
        <li>interfere with the service or place an unreasonable load on it;</li>
        <li>
          upload or submit anything unlawful, or use the service to harass anyone or to break the
          law;
        </li>
        <li>misrepresent who you are, or use someone else&rsquo;s account.</li>
      </ul>
      <p>
        We apply usage limits to keep the service available and its costs bounded. If you reach one,
        the Navigator will tell you it cannot plan a new route right now. That is a limit on our
        side, not a fault in your truck or your route, and your saved setup is not affected.
      </p>

      <h2>Suspension and termination</h2>
      <p>
        We may suspend or terminate an account, or restrict access to part of the service, if we
        reasonably believe it is being used in breach of these Terms — in particular for automated
        abuse, for attempts to evade limits, or for activity that threatens the security or
        availability of the service for other drivers. Where it is practical and appropriate, we
        will tell you why. Where the activity is causing ongoing harm or cost, we may act first.
      </p>
      <p>You can stop using the service at any time.</p>

      <h2>Deleting your account</h2>
      <p>
        You can delete your Navigator account yourself from the account screen. Deleting it removes
        your sign-in identity, your saved profile, and the truck setup, route preferences, clocks
        and onboarding state we hold for you in the cloud.
      </p>
      <p>
        Two things do not disappear with it, and you should know both. Records of the consents you
        gave — what you agreed to, the exact wording, and when — are kept as evidence of your
        choices, including your choice to opt out; that is what lets us honor an unsubscribe after
        an account is gone. And information already saved on your phone by the Navigator stays on
        your phone until you clear it there. See the <Link href="/privacy">Privacy Policy</Link> for
        the detail.
      </p>

      <h2>Service availability</h2>
      <p>
        The service is provided on an{' '}
        <strong>&ldquo;as is&rdquo; and &ldquo;as available&rdquo;</strong> basis. We do not promise
        any level of uptime, and we do not promise the service will be uninterrupted, timely,
        secure, or error-free. We may change, suspend, limit, or discontinue any part of it —
        including the Navigator, an account feature, or the free tier — at any time.
      </p>
      <p>
        The Navigator depends on your device, your mobile signal, your GPS reception, and
        third-party services we do not control. It will lose position under bridges, in tunnels, in
        heavy cover and in buildings, and it will be unavailable when those things are. Plan for
        that: do not put yourself in a position where losing the screen is a problem.
      </p>

      <h2>Disclaimers and limits on our liability</h2>
      <p>
        To the fullest extent permitted by law, we disclaim all warranties, express or implied,
        including any implied warranties of merchantability, fitness for a particular purpose,
        accuracy, and non-infringement. We do not warrant that any route, restriction, clearance,
        closure, facility, price, or other information provided through the service is accurate,
        complete, or current.
      </p>
      <p>
        To the fullest extent permitted by law, we are not liable for any indirect, incidental,
        special, consequential, or punitive damages, or for lost profits, lost revenue, lost time,
        fines, citations, permit costs, towing, detention, cargo loss, or property damage, arising
        out of or relating to your use of the service — including any route it suggested, any
        restriction it failed to show, and any clock it displayed.
      </p>
      <p>
        Nothing in these Terms limits any liability that cannot be limited under applicable law.
      </p>
      <p>
        <strong>
          You remain solely responsible for the safe and legal operation of your vehicle.
        </strong>{' '}
        Do not operate the Navigator while the vehicle is moving. The Navigator restricts what can
        be done on screen while you are driving, but that restriction is an aid, not a guarantee,
        and it does not transfer responsibility for your attention to us.
      </p>

      <h2>Intellectual property</h2>
      <p>
        The site and the service — including the Navigator software, its interface and design, our
        written content, guides, course material, graphics, photographs, and the Trucking Life name
        and logo — belong to {LEGAL.entity} or to our licensors, and are protected by copyright,
        trademark, and other laws. Map, routing, and search data are provided by third parties and
        remain theirs, subject to their own terms.
      </p>
      <p>
        You may use the service for your own personal and professional driving use. You may not
        copy, modify, distribute, sell, license, reverse engineer, or create derivative works from
        any part of it, or remove any proprietary notice, except where that restriction is not
        permitted by law.
      </p>
      <p>
        Anything you enter — your truck setup, your preferences, your clocks — stays yours. You give
        us permission to store and process it in order to run the service for you, and nothing more.
      </p>

      <h2>Changes to these Terms</h2>
      <p>
        We may update these Terms. When we do, we will change the &ldquo;Last updated&rdquo; date at
        the top of this page. If a change materially affects your rights, we will make a reasonable
        effort to tell account holders. Continuing to use the service after a change means you
        accept the updated Terms.
      </p>

      <h2>Governing law</h2>
      <p>
        These Terms are governed by the laws of the <strong>State of Georgia</strong>, without
        regard to its conflict-of-laws rules. You and we agree that any dispute arising out of or
        relating to these Terms or the service will be brought exclusively in the state or federal
        courts located in Georgia, and you and we each consent to the jurisdiction of those courts.
        If any provision of these Terms is held unenforceable, the rest remains in effect.
      </p>

      <h2>Contact us</h2>
      <p>
        {LEGAL.entity}
        <br />
        {LEGAL.locale}
        <br />
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
        <br />
        <a href={LEGAL.website}>{LEGAL.website}</a>
      </p>
    </LegalPage>
  );
}
