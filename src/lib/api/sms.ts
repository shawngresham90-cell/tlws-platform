import { log } from './logger';

/**
 * Twilio SMS helper — DORMANT by design (Milestone 4 rule: no live SMS).
 * Gated behind SMS_SENDING_ENABLED === 'true'. TCPA: callers MUST confirm
 * sms_consent before invoking this; the guard here is a backstop, not the
 * primary consent check (that lives at the data layer).
 */
export type SmsPayload = { to: string; body: string; hasConsent: boolean };

export async function sendSms(payload: SmsPayload): Promise<{ sent: boolean; dryRun: boolean }> {
  const enabled = process.env.SMS_SENDING_ENABLED === 'true';
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  // TCPA backstop — never text without recorded consent.
  if (!payload.hasConsent) {
    log.warn('sms_blocked_no_consent');
    return { sent: false, dryRun: true };
  }
  if (!enabled) {
    log.info('sms_dry_run');
    return { sent: false, dryRun: true };
  }
  if (!sid || !token || !from) {
    log.error('sms_missing_config');
    return { sent: false, dryRun: false };
  }

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: payload.to, From: from, Body: payload.body }),
    });
    if (!res.ok) {
      log.error('sms_send_failed', { status: res.status });
      return { sent: false, dryRun: false };
    }
    log.info('sms_sent');
    return { sent: true, dryRun: false };
  } catch (err) {
    log.error('sms_send_error', { message: (err as Error).message });
    return { sent: false, dryRun: false };
  }
}
