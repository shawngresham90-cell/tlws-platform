import Link from 'next/link';
import { LegalPage } from '@/components/legal/LegalPage';
import { LEGAL } from '@/lib/legal/company';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'SMS Terms & Conditions | Trucking Life',
  description:
    'Terms for the Trucking Life Academy text-messaging program: what you receive, message frequency, rates, and how to opt out (reply STOP) or get help (reply HELP).',
  path: '/sms-terms',
});

export default function SmsTermsPage() {
  return (
    <LegalPage title="SMS Terms & Conditions">
      <p>
        These terms govern the <strong>{LEGAL.smsProgramName}</strong> text-messaging program from{' '}
        <strong>{LEGAL.entity}</strong> (&ldquo;Trucking Life,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us&rdquo;). By opting in, you agree to these terms.
      </p>

      <h2>Program description</h2>
      <p>
        If you provide your mobile number and check the consent box on one of our forms, we may send
        you text messages related to what you signed up for — for example, updates about your school
        application and enrollment, and occasional related information from Trucking Life Academy.
      </p>

      <h2>Opting in</h2>
      <p>
        You opt in by checking the SMS consent box on a form and providing your mobile number. Your
        consent is not required to enroll, purchase, or use any part of our site or services — it is
        entirely optional.
      </p>

      <h2>Message frequency</h2>
      <p>Message frequency varies based on your activity and what you signed up for.</p>

      <h2>Cost</h2>
      <p>
        <strong>Message and data rates may apply.</strong> These charges are set by your mobile
        carrier and are your responsibility; Trucking Life does not charge for the messages
        themselves.
      </p>

      <h2>How to opt out</h2>
      <p>
        You can cancel at any time by replying <strong>STOP</strong> to any message. After you send
        STOP, we will send one confirmation message and then stop sending texts, unless you opt in
        again.
      </p>

      <h2>How to get help</h2>
      <p>
        Reply <strong>HELP</strong> to any message for help, or email{' '}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>

      <h2>Carriers</h2>
      <p>
        Carriers are not liable for delayed or undelivered messages. Delivery is subject to
        transmission by your mobile carrier and is not guaranteed.
      </p>

      <h2>Privacy</h2>
      <p>
        Your mobile information is handled as described in our{' '}
        <Link href="/privacy">Privacy Policy</Link>. We do not sell or share mobile phone numbers or
        SMS consent with third parties or affiliates for their own marketing.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms from time to time. Changes take effect when posted, and we will
        update the &ldquo;Last updated&rdquo; date at the top of this page.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about the messaging program? Email{' '}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>
    </LegalPage>
  );
}
