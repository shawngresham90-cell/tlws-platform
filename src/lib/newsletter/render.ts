import { FONT_STACK, PALETTE, ROAD_REPORT, SENDER } from './brand';
import { isPending, resolveCopy, type Copy } from './approval';

/**
 * The Road Report renderer — one email definition in, HTML and plain text out.
 *
 * THE FOOTER AND THE UNSUBSCRIBE LINK ARE NOT BLOCKS. A template cannot place
 * them, reorder them, or leave them out, because they are appended by this
 * function after the template's own content. Making them blocks would make
 * "every email has an unsubscribe link" a thing each new template has to
 * remember, and the one that forgets is a compliance failure rather than a
 * layout bug. Here it is structural: the only way to omit the unsubscribe link
 * is to edit this file, which is a reviewable act.
 *
 * NO IMAGES ANYWHERE. Not a logo, not a spacer, not a tracking pixel. Most
 * clients block remote images by default, so an image-based masthead renders as
 * a broken box or empty space for a large share of readers on first open. The
 * masthead is text styled to look deliberate, which means the image-disabled
 * rendering and the normal rendering are the same rendering — the QA item stops
 * being a risk instead of being a thing to check.
 *
 * TABLES, INLINE STYLES, AND NO SHORTHAND. Email clients are not browsers:
 * Outlook renders through Word, Gmail strips `<style>` from forwarded copies,
 * and several ignore `margin` shorthand. Layout is tables, every visual
 * property is inline on the element that needs it, and the `<style>` block
 * carries only progressive enhancement (dark mode, small screens) that nothing
 * depends on for legibility.
 */

export type Block =
  | { kind: 'heading'; text: Copy }
  | { kind: 'paragraph'; text: Copy }
  | { kind: 'list'; items: Copy[] }
  | { kind: 'cta'; label: Copy; href: Copy; caption?: Copy }
  | { kind: 'correction'; text: Copy }
  | { kind: 'divider' }
  /**
   * An inline reference link. Deliberately NOT a `cta`: it renders as ordinary
   * underlined body text, never as a button. That distinction is what lets an
   * issue mention a dozen things while asking for exactly one — if every
   * reference were a button, the single primary call to action would be one
   * button among thirteen.
   */
  | { kind: 'link'; label: Copy; href: Copy }
  /**
   * Small muted text under a section — a source credit, a caveat. Visually
   * subordinate so it reads as attribution rather than as content.
   */
  | { kind: 'note'; text: Copy };

export type NewsletterEmail = {
  /** Stable id. Used by the campaign registry, the audit log and tests. */
  slug: string;
  subject: Copy;
  /** The preheader — the grey line after the subject in most inboxes. */
  previewText: Copy;
  blocks: Block[];
};

export type RenderContext = {
  /**
   * Where this recipient's unsubscribe link points. Per-recipient by design: a
   * shared link cannot identify who clicked it, so it cannot record an opt-out
   * against an address.
   */
  unsubscribeUrl: string;
  /** Shown in the greeting. Null or blank falls back to a neutral address. */
  recipientName?: string | null;
  /** Absolute base for links. Defaults to the site's canonical URL. */
  siteUrl?: string;
  /**
   * The postal address for the footer. Defaults to `SENDER.postalAddress`,
   * which is still awaiting owner approval and therefore renders as a marker.
   *
   * Overridable so the success path is reachable. With the module constant as
   * the only source, every render would contain a pending marker forever, and
   * "a fully valid issue passes validation" — the branch that decides real
   * sends happen — would be the one branch no test could ever exercise. This is
   * not a way around the approval gate: `evaluateSendReadiness` reads the
   * sender identity separately and still refuses while it is unapproved.
   */
  postalAddress?: Copy;
};

export type RenderedEmail = {
  slug: string;
  subject: string;
  previewText: string;
  html: string;
  text: string;
};

/** HTML-escape. Applied to every piece of copy without exception. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const c = (copy: Copy) => resolveCopy(copy);
const ec = (copy: Copy) => esc(resolveCopy(copy));

/** Wrap plain text at a width that survives narrow terminals and mail clients. */
function wrap(text: string, width = 72): string {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.length <= width) {
      out.push(paragraph);
      continue;
    }
    let line = '';
    for (const word of paragraph.split(' ')) {
      // A single word longer than the wrap width (a long URL) goes on its own
      // line intact rather than being broken — a split URL is a dead URL.
      if (line && line.length + word.length + 1 > width) {
        out.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) out.push(line);
  }
  return out.join('\n');
}

function greeting(name?: string | null): string {
  const trimmed = (name ?? '').trim();
  // Names are user-supplied and unbounded. `word-break` in the HTML handles the
  // display; this keeps the greeting itself from becoming a wall of text.
  return trimmed ? trimmed : 'driver';
}

/* ── HTML blocks ─────────────────────────────────────────────────────────── */

function blockHtml(block: Block): string {
  const pad = `padding:0 28px;`;
  switch (block.kind) {
    case 'heading':
      return `<tr><td style="${pad}padding-top:26px;padding-bottom:8px;"><h2 style="margin:0;font-family:${FONT_STACK};font-size:20px;line-height:1.3;font-weight:700;color:${PALETTE.ink};word-break:break-word;">${ec(block.text)}</h2></td></tr>`;

    case 'paragraph':
      return `<tr><td style="${pad}padding-top:0;padding-bottom:14px;"><p style="margin:0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:${PALETTE.ink};word-break:break-word;">${ec(block.text)}</p></td></tr>`;

    case 'list':
      return `<tr><td style="${pad}padding-top:0;padding-bottom:14px;"><ul style="margin:0;padding-left:20px;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:${PALETTE.ink};">${block.items
        .map((item) => `<li style="margin:0 0 8px 0;word-break:break-word;">${ec(item)}</li>`)
        .join('')}</ul></td></tr>`;

    case 'cta': {
      // A bordered, padded anchor rather than a background-image button: it
      // keeps its shape with images off and stays a real link for screen
      // readers and keyboard users.
      const caption = block.caption
        ? `<p style="margin:10px 0 0 0;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:${PALETTE.muted};">${ec(block.caption)}</p>`
        : '';
      return `<tr><td style="${pad}padding-top:8px;padding-bottom:22px;"><a href="${ec(block.href)}" style="display:inline-block;background-color:${PALETTE.signal};color:${PALETTE.signalInk};font-family:${FONT_STACK};font-size:16px;font-weight:700;text-decoration:none;padding:14px 26px;border-radius:8px;border:1px solid ${PALETTE.signal};">${ec(block.label)}</a>${caption}</td></tr>`;
    }

    case 'correction':
      // Left rule plus an explicit label, because colour alone cannot carry
      // meaning — for colour-blind readers, and for the clients that drop the
      // background entirely.
      return `<tr><td style="${pad}padding-top:6px;padding-bottom:18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-left:3px solid ${PALETTE.warn};padding:10px 0 10px 14px;"><p style="margin:0;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${PALETTE.ink};"><strong style="color:${PALETTE.warn};">Correction:</strong> ${ec(block.text)}</p></td></tr></table></td></tr>`;

    case 'divider':
      return `<tr><td style="${pad}padding-top:4px;padding-bottom:18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${PALETTE.cardEdge};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>`;

    case 'link':
      // Underlined as well as coloured. Colour alone does not distinguish a
      // link for a colour-blind reader, and several clients override link
      // colours wholesale.
      return `<tr><td style="${pad}padding-top:0;padding-bottom:16px;"><p style="margin:0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:${PALETTE.ink};word-break:break-word;"><a href="${ec(block.href)}" style="color:${PALETTE.signal};text-decoration:underline;">${ec(block.label)}</a></p></td></tr>`;

    case 'note':
      return `<tr><td style="${pad}padding-top:0;padding-bottom:16px;"><p style="margin:0;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:${PALETTE.muted};word-break:break-word;">${ec(block.text)}</p></td></tr>`;
  }
}

/* ── Plain text blocks ───────────────────────────────────────────────────── */

function blockText(block: Block): string {
  switch (block.kind) {
    case 'heading': {
      // Underlined with dashes so structure survives in a client that shows
      // only the text part — plain text still has to be readable, not a dump.
      //
      // A PENDING MARKER IS NEVER UPPERCASED. Two reasons, and the second is
      // the one that bites: the marker text is an instruction to the author and
      // shouting it helps nobody, and an uppercased marker is a DIFFERENT
      // string from the one in the HTML, so the placeholder scan counts the
      // same unfinished heading twice and reports a total nobody can reconcile.
      const text = c(block.text);
      const shown = isPending(block.text) ? text : text.toUpperCase();
      return `${shown}\n${'-'.repeat(Math.min(shown.length, 72))}`;
    }
    case 'paragraph':
      return wrap(c(block.text));
    case 'list':
      return block.items.map((i) => wrap(`  * ${c(i)}`)).join('\n');
    case 'cta':
      return `${wrap(`${c(block.label)}:`)}\n${c(block.href)}${
        block.caption ? `\n${wrap(c(block.caption))}` : ''
      }`;
    case 'correction':
      return wrap(`CORRECTION: ${c(block.text)}`);
    case 'divider':
      return '—'.repeat(40);
    case 'link':
      // Label and URL on one logical line, wrapped but never split mid-URL.
      return wrap(`${c(block.label)}: ${c(block.href)}`);
    case 'note':
      return wrap(c(block.text));
  }
}

/* ── The whole email ─────────────────────────────────────────────────────── */

export function renderEmail(email: NewsletterEmail, ctx: RenderContext): RenderedEmail {
  const siteUrl = ctx.siteUrl ?? ROAD_REPORT.site;
  const postalAddress = ctx.postalAddress ?? SENDER.postalAddress;
  const name = greeting(ctx.recipientName);
  const subject = c(email.subject);
  const previewText = c(email.previewText);

  const body = email.blocks.map(blockHtml).join('');

  // Preheader: shown by the inbox next to the subject, hidden in the open
  // message. The trailing entities stop the client pulling the masthead text in
  // after it; `mso-hide` handles Outlook, which honours neither zero height nor
  // `display:none` reliably.
  const preheader = `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PALETTE.card};opacity:0;">${esc(previewText)}${'&#8199;&#65279;&#847; '.repeat(30)}</div>`;

  const html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(subject)}</title>
<style>
  /* Progressive enhancement only. Every value below has an inline fallback,
     so a client that strips this block still renders a legible email. */
  @media (prefers-color-scheme: dark) {
    .rr-page { background-color: #0F0F10 !important; }
    .rr-page-ink { color: ${PALETTE.muted} !important; }
  }
  @media only screen and (max-width: 480px) {
    .rr-pad { padding-left: 18px !important; padding-right: 18px !important; }
    .rr-card { border-radius: 0 !important; }
  }
  a { color: ${PALETTE.signal}; }
</style>
</head>
<body class="rr-page" style="margin:0;padding:0;background-color:${PALETTE.page};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PALETTE.page};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

        <!-- Masthead. Text, never an image. -->
        <tr>
          <td class="rr-card rr-pad" style="background-color:${PALETTE.card};border:1px solid ${PALETTE.cardEdge};border-bottom:none;border-radius:12px 12px 0 0;padding:28px 28px 0 28px;">
            <p style="margin:0;font-family:${FONT_STACK};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${PALETTE.signal};font-weight:700;">${esc(ROAD_REPORT.publisher)}</p>
            <h1 style="margin:6px 0 0 0;font-family:${FONT_STACK};font-size:28px;line-height:1.15;font-weight:800;color:${PALETTE.ink};">${esc(ROAD_REPORT.name)}</h1>
            <p style="margin:6px 0 0 0;font-family:${FONT_STACK};font-size:14px;line-height:1.5;color:${PALETTE.muted};">${esc(ROAD_REPORT.standfirst)}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${PALETTE.cardEdge};padding-top:0;font-size:0;line-height:0;height:22px;">&nbsp;</td></tr></table>
          </td>
        </tr>

        <!-- Greeting + template body.
             The inner table is wrapped in its own row+cell. A <table> placed
             directly inside a <table> is invalid, and Outlook's Word renderer
             does not quietly tolerate it — it hoists the stray table out,
             which drops the body above the masthead. -->
        <tr>
          <td style="padding:0;background-color:${PALETTE.card};border-left:1px solid ${PALETTE.cardEdge};border-right:1px solid ${PALETTE.cardEdge};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="rr-pad" style="padding:0 28px 14px 28px;"><p style="margin:0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:${PALETTE.ink};word-break:break-word;">Hey ${esc(name)},</p></td></tr>
              ${body}
            </table>
          </td>
        </tr>

        <!-- Footer. Appended here, not by the template. -->
        <tr>
          <td class="rr-pad" style="background-color:${PALETTE.card};border:1px solid ${PALETTE.cardEdge};border-top:none;border-radius:0 0 12px 12px;padding:22px 28px 26px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${PALETTE.cardEdge};font-size:0;line-height:0;height:18px;">&nbsp;</td></tr></table>
            <p style="margin:0;font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${PALETTE.muted};">
              ${esc(ROAD_REPORT.name)} is written by ${esc(ROAD_REPORT.publisher)}.<br>
              <a href="${esc(siteUrl)}" style="color:${PALETTE.signal};">${esc(siteUrl)}</a>
            </p>
            <p style="margin:12px 0 0 0;font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${PALETTE.muted};">
              ${esc(c(postalAddress))}
            </p>
            <p style="margin:12px 0 0 0;font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${PALETTE.muted};">
              You are receiving this because you signed up at ${esc(siteUrl)}.<br>
              <a href="${esc(ctx.unsubscribeUrl)}" style="color:${PALETTE.signal};text-decoration:underline;">Unsubscribe</a> — one click, no questions, and it takes effect immediately.
            </p>
          </td>
        </tr>

        <tr>
          <td class="rr-page-ink rr-pad" style="padding:16px 28px 0 28px;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:${PALETTE.pageInk};" align="center">
            ${esc(ROAD_REPORT.publisher)}
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    ROAD_REPORT.name.toUpperCase(),
    ROAD_REPORT.standfirst,
    `From ${ROAD_REPORT.publisher} — ${siteUrl}`,
    '='.repeat(40),
    '',
    `Hey ${name},`,
    '',
    email.blocks.map(blockText).join('\n\n'),
    '',
    '='.repeat(40),
    `${ROAD_REPORT.name} is written by ${ROAD_REPORT.publisher}.`,
    siteUrl,
    '',
    wrap(c(postalAddress)),
    '',
    wrap(`You are receiving this because you signed up at ${siteUrl}.`),
    'Unsubscribe — one click, no questions, effective immediately:',
    ctx.unsubscribeUrl,
    '',
  ].join('\n');

  return { slug: email.slug, subject, previewText, html, text };
}
