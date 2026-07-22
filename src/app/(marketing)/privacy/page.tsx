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
        <Link href="/sms-terms">SMS Terms &amp; Conditions</Link>.{' '}
        <strong>
          We do not share or sell mobile phone numbers or SMS consent to third parties or affiliates
          for their own marketing.
        </strong>
      </p>

      <h2>How we share information</h2>
      <p>We do not sell your personal information. We share it only in these limited ways:</p>
      <ul>
        <li>
          <strong>Service providers</strong> who operate the site on our behalf — for example, our
          hosting and database providers, our bot-check provider, our email provider, and our text-
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
