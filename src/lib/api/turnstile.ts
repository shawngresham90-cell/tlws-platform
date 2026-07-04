import { log } from './logger';

/**
 * Verifies a Cloudflare Turnstile token server-side. Every public write route
 * calls this before touching the database — bots never reach the insert.
 *
 * Behavior: if TURNSTILE_SECRET_KEY is unset (local/dev before Cloudflare is
 * wired), verification is SKIPPED with a warning so development isn't blocked.
 * In production the key must be present or all submissions fail closed.
 */
export async function verifyTurnstile(token: string, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      log.error('turnstile_missing_secret_in_prod');
      return false; // fail closed in prod
    }
    log.warn('turnstile_skipped_no_secret_dev');
    return true; // allow in dev
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.append('remoteip', remoteIp);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] };
    if (!data.success) log.warn('turnstile_failed', { codes: data['error-codes'] });
    return data.success;
  } catch (err) {
    log.error('turnstile_verify_error', { message: (err as Error).message });
    return false;
  }
}
