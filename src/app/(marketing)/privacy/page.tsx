import Link from 'next/link';
import { LegalPage } from '@/components/legal/LegalPage';
import { LEGAL } from '@/lib/legal/company';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Privacy Policy | Trucking Life',
  description:
    'How Trucking Life Academy collects, uses, and protects your information — including text messaging, analytics, and your choices.',
  path: '/privacy',
});

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This Privacy Policy explains how <strong>{LEGAL.entity}</strong> (&ldquo;Trucking
        Life,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;), based in {LEGAL.locale}, collects, uses,
        and shares information when you use <a href={LEGAL.website}>{LEGAL.website}</a> and our
        related services. By using the site or submitting a form, you agree to this policy.
      </p>

      <h2>Information we collect</h2>
      <p>
        <strong>Information you give us.</strong> When you fill out a form — a school application, a
        founder or sponsor inquiry, a newsletter or lead sign-up, or a directory submission — we
        collect what you enter, which may include your name, email address, phone number, city and
        state, and details about your interest in our training or services.
      </p>
      <p>
        <strong>Information collected automatically.</strong> We use privacy-friendly, cookieless
        website analytics to understand aggregate traffic (for example, which pages are popular). We
        do not use these analytics to build advertising profiles of you. Our forms use a bot-check
        (Cloudflare Turnstile) to prevent spam.
      </p>

      <h2>How we use your information</h2>
      <ul>
        <li>To respond to your application or inquiry and follow up with you.</li>
        <li>To send you information you asked for, such as newsletter updates or resources.</li>
        <li>
          To send text messages <strong>only if you opt in</strong> — see our{' '}
          <Link href="/sms-terms">SMS Terms &amp; Conditions</Link>.
        </li>
        <li>To operate, secure, and improve the site.</li>
        <li>To meet legal and regulatory obligations.</li>
      </ul>

      <h2>Text messaging (SMS)</h2>
      <p>
        We send text messages only to people who explicitly opt in on one of our forms. Your consent
        to receive texts is never a condition of enrolling, purchasing, or using any part of the
        site. You can opt out at any time by replying <strong>STOP</strong>. Full details, including
        message frequency and how to get help, are in our{' '}
        <Link href="/sms-terms">SMS Terms &amp; Conditions</Link>. When you opt in, we keep a record
        of the consent you gave — the disclosure you agreed to, its version, and when — so we can
        honor your choice and our own obligations.{' '}
        <strong>
          We do not share or sell mobile phone numbers or SMS consent to third parties or affiliates
          for their own marketing.
        </strong>
      </p>

      <h2>Navigator accounts</h2>
      <p>
        A free Navigator account lets your setup follow you between devices. This section describes
        what an account holds and — just as importantly — what it deliberately does not.
      </p>

      <p>
        <strong>What you give us when you sign up.</strong> Your <strong>first name</strong>, your{' '}
        <strong>email address</strong>, and — only if you choose to give it — a{' '}
        <strong>phone number</strong>. The phone number is optional and the account works fully
        without it. We do not ask for your last name, your address, your carrier, your DOT or CDL
        number, or a date of birth.
      </p>

      <p>
        <strong>How you sign in.</strong> By email, with a six-digit code we send you each time.
        There is no permanent username and no password: we do not create one for you, we never ask
        you to choose one, and there is therefore no password of yours for us to store or to lose.
        The sign-in code is a transactional message, part of operating your account, and is separate
        from any marketing email — you receive sign-in codes whether or not you agreed to marketing,
        and agreeing to marketing is never a condition of having an account.
      </p>

      <p>
        <strong>Where accounts live.</strong> We use <strong>Supabase</strong> as our account and
        database provider. Supabase stores your account record, handles sending your sign-in codes,
        and holds the account data described below, on our behalf and under our instructions.
      </p>

      <p>
        <strong>What your account saves for you.</strong> If you are signed in, the Navigator keeps
        a copy of the setup you have entered so it can be restored on another device or after you
        reinstall:
      </p>
      <ul>
        <li>
          your <strong>saved truck profile</strong> — the dimensions, weight and configuration you
          entered;
        </li>
        <li>
          your <strong>route preferences</strong> — the routing options you chose;
        </li>
        <li>
          your <strong>hours-of-service clocks</strong>, which are the values{' '}
          <strong>you typed in</strong>. These are informational and are not a compliance record;
          the Navigator is not an ELD and does not record duty status. See our{' '}
          <Link href="/terms">Terms of Service</Link>.
        </li>
        <li>
          your <strong>onboarding state</strong> — which setup steps and briefings you have already
          completed, so you are not asked twice.
        </li>
      </ul>
      <p>
        That list is the whole list, and the database enforces it: it will reject a record that is
        not one of those four kinds.
      </p>

      <p>
        <strong>What we deliberately do not store.</strong> This is a decision, not an omission. We
        do not keep <strong>live GPS or location history</strong>, we do not keep the{' '}
        <strong>destinations you enter</strong>, we do not keep the{' '}
        <strong>searches you type</strong>, and we do not keep the{' '}
        <strong>routes the Navigator generates for you</strong>. Your position is used on your
        device, in the moment, to draw the map and guide you, and it is not sent to us to be kept.
        We chose this because a record of where a driver has been is the most sensitive thing this
        product could hold, and the safest way to protect it is not to have it.
      </p>
      <p>
        To keep the service running and its costs bounded, we do count how many routing and search
        requests are made — by month, by which feature was used, and against your account. Those
        counts are numbers only. They contain no name, email, phone number, position, destination,
        search text, or route.
      </p>

      <p>
        <strong>Consent records.</strong> When you answer the marketing questions at signup, we
        record your answer, the exact wording you were shown, its version, and when — for both the
        &ldquo;yes&rdquo; answers and the &ldquo;no&rdquo; answers. That record is how we can prove
        we are honoring what you chose.
      </p>
      <p>
        <strong>Withdrawing consent.</strong> You can turn marketing off at any time from your
        account screen, by using the unsubscribe link in an email, or by emailing us. Withdrawal is
        recorded as a new entry rather than by editing the old one, so both your original choice and
        your change of mind are preserved. Once withdrawn, you are excluded from future marketing
        sends and from the contact exports described next.
      </p>

      <p>
        <strong>Marketing contact exports (Stan Store).</strong> When we run an email campaign, we{' '}
        <strong>manually export</strong> a CSV of the contacts who have a current recorded consent
        to marketing email, and upload it to <strong>Stan Store</strong>, the platform we use to
        send those campaigns. The export contains name and email address for consenting contacts
        only. It is not automatic, it is not continuous, and anyone who has withdrawn consent is
        absent from it. Your truck profile, preferences, clocks, and usage counts are never part of
        it.
      </p>

      <p>
        <strong>Deleting your account.</strong> You can delete your Navigator account from the
        account screen. Doing so removes your sign-in identity, your account profile, and the truck
        setup, route preferences, clocks and onboarding state stored for you. Two things remain, on
        purpose: your <strong>consent records</strong>, because a record proving you asked not to be
        contacted has to outlive the account for us to keep honoring it; and anything the Navigator
        saved <strong>on your own device</strong>, which stays there until you clear it or
        uninstall. You can also email us to request deletion.
      </p>

      <p>
        <strong>How long we keep it.</strong> Account data is kept while your account exists and is
        removed when you delete it. Consent and unsubscribe records are kept as long as we need them
        to honor your choices and meet our obligations. Usage counts are kept for cost and capacity
        reporting.
      </p>

      <p>
        <strong>Security, honestly stated.</strong> Account data is protected by per-account access
        rules enforced in the database, so one driver&rsquo;s records are not reachable by another,
        and by access controls on our side. We use reputable providers and keep the number of places
        your information lives small. But no service is perfectly secure, and we cannot guarantee
        that your information will never be accessed without authorization. Your email account is
        part of that picture: because sign-in is by emailed code, anyone who can read your email can
        sign in as you.
      </p>

      <h2>How we share information</h2>
      <p>
        We do not sell your personal information, and we do not share it with third parties for
        their own marketing. We do rely on companies that operate parts of the service for us, and
        your information passes through them. We share it only in these limited ways:
      </p>
      <ul>
        <li>
          <strong>Service providers</strong> who operate the site on our behalf — for example, our
          hosting provider, <strong>Supabase</strong> (accounts, database, and sign-in code
          delivery), <strong>Stan Store</strong> (email campaigns to contacts who consented), our
          map and routing provider, our bot-check provider, our email provider, and our text-
          messaging provider — and only as needed to provide the service.
        </li>
        <li>
          <strong>Legal reasons</strong> — if required by law, or to protect our rights, safety, or
          property.
        </li>
        <li>
          <strong>Business transfers</strong> — if the business is involved in a merger,
          acquisition, or sale of assets, subject to this policy.
        </li>
      </ul>

      <h2>Affiliate links</h2>
      <p>
        Some links on our site are affiliate links, including Amazon and Truck Parking Club. As an
        Amazon Associate, Trucking Life earns from qualifying purchases made through store links,
        and we may earn a commission on Truck Parking Club reservations. Using an affiliate link
        does not change your price, and partnerships never change organic directory rankings.
      </p>

      <h2>Data retention</h2>
      <p>
        We keep your information for as long as needed to provide our services and for legitimate
        business or legal purposes, then delete or de-identify it. You can ask us to delete your
        information at any time (see &ldquo;Your choices&rdquo;).
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>
          <strong>Text messages:</strong> reply STOP to any message to opt out, or email us.
        </li>
        <li>
          <strong>Email:</strong> use the unsubscribe link, or email us to be removed.
        </li>
        <li>
          <strong>Access or deletion:</strong> email us to request a copy of, or the deletion of,
          the information we hold about you.
        </li>
      </ul>

      <h2>Children&rsquo;s privacy</h2>
      <p>
        Our services are intended for adults pursuing a commercial driving career and are not
        directed to children under 13. We do not knowingly collect information from children under
        13.
      </p>

      <h2>Third-party sites</h2>
      <p>
        Our site links to third-party sites (such as YouTube, our store partners, and Truck Parking
        Club). Their privacy practices are their own; please review their policies.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. When we do, we will change the &ldquo;Last
        updated&rdquo; date at the top of this page.
      </p>

      <h2>Contact us</h2>
      <p>
        Questions or requests about your privacy? Email{' '}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>
    </LegalPage>
  );
}
