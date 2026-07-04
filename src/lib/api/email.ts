import { log } from './logger';

/**
 * Resend email helper — DORMANT by design (Milestone 4 rule: no live emails).
 * Sending is gated behind EMAIL_SENDING_ENABLED === 'true'. Until that flag is
 * set, this logs the intended send and returns { sent: false, dryRun: true }.
 * The wire-up is real so a later milestone flips one env var to go live.
 */
export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

export async function sendEmail(
  payload: EmailPayload,
): Promise<{ sent: boolean; dryRun: boolean }> {
  const enabled = process.env.EMAIL_SENDING_ENABLED === 'true';
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!enabled) {
    log.info('email_dry_run', { subject: payload.subject });
    return { sent: false, dryRun: true };
  }
  if (!apiKey || !from) {
    log.error('email_missing_config');
    return { sent: false, dryRun: false };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        reply_to: payload.replyTo,
      }),
    });
    if (!res.ok) {
      log.error('email_send_failed', { status: res.status });
      return { sent: false, dryRun: false };
    }
    log.info('email_sent', { subject: payload.subject });
    return { sent: true, dryRun: false };
  } catch (err) {
    log.error('email_send_error', { message: (err as Error).message });
    return { sent: false, dryRun: false };
  }
}
