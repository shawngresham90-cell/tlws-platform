import { SITE } from '@/lib/seo/site';
import { pending, type Copy } from './approval';

/**
 * The Road Report — newsletter identity and the palette the templates draw on.
 *
 * Colours are the site's own tokens, restated here as literal hex. Email
 * clients do not run Tailwind and many strip `<style>` blocks entirely, so
 * every value ends up inline on the element. Importing the token names would
 * read better and produce nothing an inbox could use.
 *
 * WHAT IS DELIBERATELY NOT SETTLED HERE: the sender identity. `from` and
 * `replyTo` are owner decisions with consequences that outlive a code review —
 * the address people reply to, the domain whose reputation carries the
 * deliverability, the name in the inbox line. Guessing produces a plausible
 * address that silently discards replies.
 */

export const ROAD_REPORT = {
  /** The newsletter's name. Fixed, and used in the header, footer and subjects. */
  name: 'The Road Report',
  /** Who it comes from, in prose. Appears in the footer. */
  publisher: SITE.brand,
  /** One line under the masthead saying what this is. */
  standfirst: 'Straight talk for drivers, from a driver.',
  site: SITE.url,
} as const;

/**
 * Sender identity — OWNER DECISION, `ROAD-REPORT-SENDER-01`.
 *
 * Four things have to be settled together, because they interact:
 *   1. The From address (which mailbox, at which domain).
 *   2. The From display name as it appears in a crowded inbox.
 *   3. The Reply-To — where a driver's reply actually lands, and who reads it.
 *   4. The postal address for the CAN-SPAM footer.
 *
 * The last one is a legal requirement for commercial email in the US and it
 * cannot be invented: it has to be a real address that can receive mail.
 */
export const SENDER: {
  fromAddress: Copy;
  fromName: Copy;
  replyTo: Copy;
  postalAddress: Copy;
} = {
  fromAddress: pending('the From address for The Road Report, on a domain you control'),
  fromName: pending('the From display name shown in the inbox'),
  replyTo: pending('the Reply-To address, and who monitors that inbox'),
  postalAddress: pending('the postal mailing address required in the footer of commercial email'),
};

/**
 * Inline palette. Dark-first, matching the site, with one deliberate exception:
 * the outermost background is light. Several clients (notably older Outlook and
 * Gmail's clipped view) ignore body backgrounds and composite the message onto
 * white, which turns a dark-only design into pale text on white. The card sits
 * on a light page so the failure mode stays legible instead of vanishing.
 */
export const PALETTE = {
  page: '#F2F0EB',
  card: '#1F1F22',
  cardEdge: '#2A2A2E',
  ink: '#F2F0EB',
  muted: '#A3A39B',
  signal: '#F5A623',
  signalInk: '#141414',
  warn: '#F87171',
  ok: '#7FC993',
  /** Text on the light page outside the card — must pass contrast on #F2F0EB. */
  pageInk: '#3F3F3A',
} as const;

/** Font stack. No web fonts: most clients refuse them and fall back anyway. */
export const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
