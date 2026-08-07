'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  PILOT_ACCESS_PATH,
  PILOT_COOKIE_NAME,
  PILOT_MAX_AGE_SECONDS,
  issuePilotToken,
  pilotConfigured,
  sanitizeNextPath,
  verifyPilotPassword,
} from '@/lib/navigator-api/pilot-access';

/**
 * Server action for the Navigator pilot password screen.
 *
 * Everything that matters happens here, on the server: the submitted password
 * is compared in constant time against NAVIGATOR_PREVIEW_PASSWORD and is then
 * discarded. It is never returned to the browser, never logged, never stored,
 * and never placed in the cookie — the cookie carries an HMAC keyed by the
 * password, which is not reversible into it.
 *
 * Failures redirect back with `error=1` and nothing else. The response does
 * not distinguish "wrong password" from "password too short" or reveal any
 * property of the expected value.
 */
export async function unlockNavigatorAction(formData: FormData): Promise<void> {
  const password = String(formData.get('password') ?? '');
  const next = sanitizeNextPath(String(formData.get('next') ?? ''));
  const back = `${PILOT_ACCESS_PATH}?next=${encodeURIComponent(next)}`;

  if (!pilotConfigured()) redirect(`${back}&error=notconfigured`);
  if (!verifyPilotPassword(password)) redirect(`${back}&error=1`);

  const token = await issuePilotToken(Date.now());
  if (!token) redirect(`${back}&error=notconfigured`);

  cookies().set(PILOT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: PILOT_MAX_AGE_SECONDS,
  });

  redirect(next);
}
