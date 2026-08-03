/**
 * Provider-neutral email transport.
 *
 * WHY AN INTERFACE RATHER THAN A RESEND CALL. `src/lib/api/email.ts` already
 * posts to `api.resend.com` and is dormant with zero callers. It hardcodes the
 * vendor, takes HTML only, and has no notion of a plain-text part, a
 * `List-Unsubscribe` header, or a campaign. A newsletter needs all four. This
 * describes what sending means for The Road Report, so the vendor becomes an
 * implementation detail chosen once — and so the rest of this module can be
 * written, reviewed and tested before that choice is made.
 *
 * THE ONLY TRANSPORT THAT EXISTS HERE CANNOT SEND. `dryRunTransport` returns a
 * result shaped exactly like a real one and transmits nothing. No live
 * transport is implemented in this change, so there is no code path in the
 * newsletter module that reaches a network — a stronger guarantee than a flag
 * defaulting to off, because there is nothing for a flag to turn on.
 */

export type OutboundMessage = {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  /**
   * Required, not optional. A newsletter sent as HTML alone is treated as more
   * likely to be spam by most filters, and is unreadable to anyone using a
   * text-only client or a screen reader that prefers the text part. Making it
   * mandatory in the type means a template cannot forget it.
   */
  text: string;
  /**
   * `List-Unsubscribe` and `List-Unsubscribe-Post` go here. Gmail and Yahoo
   * require them for bulk senders; without them, the only way out a reader has
   * is the spam button, which damages the sending domain far more than an
   * unsubscribe does.
   */
  headers?: Record<string, string>;
};

export type SendOutcome = {
  delivered: boolean;
  /** The provider's id for the message, when there is one. */
  providerId?: string;
  /** Why it was not delivered. Present only on failure or dry run. */
  reason?: string;
};

export interface EmailTransport {
  readonly name: string;
  /** True only for a transport that can actually put mail on the wire. */
  readonly canDeliver: boolean;
  send(message: OutboundMessage): Promise<SendOutcome>;
}

/**
 * The default and, in this change, the only transport. Accepts a message,
 * reports what it would have done, and delivers nothing.
 */
export const dryRunTransport: EmailTransport = {
  name: 'dry-run',
  canDeliver: false,
  async send(): Promise<SendOutcome> {
    return { delivered: false, reason: 'dry-run transport: no message was transmitted' };
  },
};

/**
 * Headers every Road Report message must carry.
 *
 * `List-Unsubscribe-Post` is what makes a mail client show its own one-click
 * unsubscribe button. That button is the difference between a reader leaving
 * quietly and a reader reporting the message as spam.
 */
export function listHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
