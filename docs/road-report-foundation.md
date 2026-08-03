# The Road Report — launch foundation

**Date:** 2026-08-03 · **Base:** `main` @ `a71a467` · **Status:** foundation built, nothing sendable.

Everything needed to run a newsletter, with no way to send one. That is deliberate: the pieces that decide *whether* a send may happen are worth building and reviewing before the piece that performs it.

**No email was sent. No production data was written. Nothing was deployed. No secret value was read or printed.**

---

## 1. Email infrastructure audit

Findings are from the repository, checked file by file.

| Item | Status | Evidence |
|---|---|---|
| Email utility | **Exists, dormant, unused** | `src/lib/api/email.ts` — posts to `api.resend.com`, gated on `EMAIL_SENDING_ENABLED === 'true'` |
| Callers of it | **None** | No import of `sendEmail` anywhere in `src/` or `scripts/` |
| Provider SDK | **None installed** | No `resend`, `sendgrid`, `postmark`, `mailgun`, `nodemailer` or SES package in `package.json` |
| Sender identity | **Not configured in code** | `EMAIL_FROM` is read but never defaulted; no From name, no Reply-To, no postal address anywhere |
| Unsubscribe handling | **Did not exist** | No unsubscribe route, token, header or suppression concept before this change |
| Suppression handling | **Did not exist** | Nothing read an opt-out list; `email_unsubscribes` is proposed in migration 049 (PR #229), unapplied |
| Template system | **Did not exist** | `sendEmail` takes an HTML string. No layout, no plain-text part, no templates |
| Test-send capability | **Partial and unsafe** | The dormant helper's dry run logs a subject and returns; there is no test-vs-production distinction and no record that a test happened |
| Environment requirements | **Three names referenced** | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_SENDING_ENABLED` |

### On the Netlify side — deliberately not read

Whether those three variables are *set in Netlify* is not reported here, and that is a choice rather than an omission.

Reading Netlify's environment returns **values in clear text**, not just key names. That happened once already during the Plausible audit and is the reason five credentials are currently recommended for rotation. Re-reading it to answer "is `RESEND_API_KEY` present?" would pull that key into a transcript too and extend the rotation list, in exchange for a fact Shawn can confirm in about ten seconds.

**Safe manual check:** Netlify → the site → Site configuration → Environment variables. Look only at whether these key names are listed; do not open the values.

- `RESEND_API_KEY` — needed only when a real provider is wired
- `EMAIL_FROM` — needed, and blocked on `ROAD-REPORT-SENDER-01` below regardless
- `EMAIL_SENDING_ENABLED` — leave absent or `false`

Note it is **not** required for anything in this change to work. Nothing here sends.

### What was built instead

The instruction was to build provider-neutral interfaces if no provider exists. One exists but is unusable for a newsletter — it is Resend-specific, HTML-only, and has no notion of a plain-text part, a `List-Unsubscribe` header, or a campaign. So `src/lib/newsletter/transport.ts` defines what sending *means* here:

- `OutboundMessage` — with `text` **required, not optional**. HTML-only bulk mail is treated as more likely to be spam by most filters and is unreadable in a text-only client. Making it mandatory in the type means a template cannot forget it.
- `EmailTransport` — an interface with a `canDeliver` flag.
- `dryRunTransport` — the only implementation. `canDeliver: false`, transmits nothing.
- `listHeaders()` — `List-Unsubscribe` and `List-Unsubscribe-Post`, which is what makes a mail client render its own one-click unsubscribe button. Without it, a reader's only exit is the spam button, which costs the sending domain far more than an unsubscribe.

**No transport capable of delivery is implemented.** That is stronger than a flag defaulting to off — there is nothing for a flag to switch on. A test asserts no file under `src/lib/newsletter/` calls `fetch`, imports the Resend helper, names a provider endpoint, or reads a secret.

## 2. The Road Report templates

`src/lib/newsletter/render.ts`, driven by a block list. Six block kinds: heading, paragraph, list, CTA, correction notice, divider. `renderEmail()` returns HTML and plain text from one definition.

**The footer and the unsubscribe link are not blocks.** A template cannot place, reorder, or omit them, because the renderer appends them after the template's content. As blocks, "every email has an unsubscribe link" would be something each new template had to remember, and the one that forgot would be a compliance failure rather than a layout bug. A test renders an email with *zero* blocks and asserts both still appear.

**No images anywhere** — not a logo, not a spacer, not a tracking pixel. Most clients block remote images by default, so an image masthead renders as a broken box on first open for a large share of readers. The masthead is text, which means the images-disabled rendering and the normal rendering are the same rendering.

Layout is tables with every visual property inline. The `<style>` block carries only progressive enhancement — dark mode and a small-screen breakpoint — so a client that strips it still renders a legible email.

The outermost page background is **light** on purpose, against an otherwise dark design. Several clients ignore body backgrounds and composite onto white; a dark-only design fails there as pale text on white. The dark card sits on a light page so the failure mode stays readable.

## 3. Welcome series

Four templates in `src/lib/newsletter/campaigns/welcome.ts`, each with subject, preview text, body, one CTA, and a plain-text version.

| # | Slug | Subject | Items awaiting approval |
|---|---|---|---|
| 1 | `welcome-1-road-report` | Welcome to The Road Report | 3 |
| 2 | `welcome-2-cdl-resources` | The CDL resources worth your time | 2 |
| 3 | `welcome-3-academy` | *awaiting approval* | 7 |
| 4 | `welcome-4-tools-and-products` | *awaiting approval* | 6 |

**Every link points at a route that exists.** The list was taken from `src/app`, not from memory, and a test walks the filesystem and re-checks each one.

**No news, no DOT update, no promotion.** Tests scan the templates for fabricated regulatory changes, invented discounts and deadlines, earnings claims, guarantees, and job-placement claims.

Emails 1 and 2 are largely real: what the newsletter is, who writes it, and the free resources that genuinely exist. Emails 3 and 4 are mostly placeholders, because they are the ones that make claims — what the Academy costs and leads to, what the products do for someone. Those are promises made in Shawn's name, and several of them (training outcomes, earnings, job placement) are regulated speech.

### How placeholders work

`pending()` produces copy that renders as a **visible inline marker** in both the HTML and the plain text:

```
[OWNER_APPROVAL_REQUIRED: what the Academy is, in two or three plain sentences]
```

The usual approach — a comment or a checklist — leaves the rendered email looking completely shippable. Someone previews it, sees polished copy, sends it, and an unapproved claim reaches the whole list. The comment was right there in the source; it just was not in the thing anyone looked at.

Two consequences, both intended: a human previewing cannot miss it, and the send gate can find it **by reading the finished output** rather than trusting a flag someone remembered to set. A gate that inspects metadata is defeated by forgetting to write the metadata. A gate that inspects the rendered bytes is not.

The placeholder text is deliberately a **request**, never draft copy. Writing plausible marketing prose and calling it a placeholder is how unapproved claims ship — someone reads it, decides it looks fine, and deletes the marker instead of writing the real thing.

## 4. Send workflow — designed, not executed

`src/lib/newsletter/send-workflow.ts` is a decision function and nothing else. No I/O, no database, no path to a transport. `evaluateSendReadiness()` takes the full state of a proposed send and returns whether it may proceed.

**Every blocker is returned at once**, not the first. Fix-one-rerun-find-another is how someone ends up disabling checks at 11pm before a send.

**Every gate fails closed.** An unknown subscription status is not permission; an absent approval is not approval; an unrecognised mode is not `test`.

| Gate | Blocker code | Rule |
|---|---|---|
| Draft protection | `draft_mode` | A draft can never be sent — including to a test address |
| Unknown mode | `unknown_mode` | An unrecognised mode is refused, not guessed at |
| Owner approval | `owner_approval_missing` | No recorded approval, no send |
| Approval freshness | `owner_approval_stale` | Approval is bound to a content digest; editing after approval revokes it |
| Unapproved copy | `copy_pending_approval` | Any marker in the rendered output blocks the send |
| Sender identity | `sender_identity_unset` | Any unapproved sender field blocks it |
| Test send | `test_send_missing` | Production requires a test send first |
| Test freshness | `test_send_stale` | Tested content and current content must match |
| Confirmation | `production_confirmation_missing` | A phrase typed out in full, never a checkbox |
| Transport | `no_delivering_transport` | Nothing capable of delivery is configured |
| Consent contradiction | `consent_contradiction` | Suppression and consent disagreeing stops the send rather than picking the permissive answer |
| Recipients | `no_eligible_recipients` | Every recipient excluded means nothing to send |

Per recipient, addresses are normalised then excluded for: blank, duplicate in the list, on the suppression list, no consent evidence on record, or not currently subscribed. **Exclusions are always itemised with a reason** — a list that silently shrinks is worse than one that refuses.

Consent comes from `email_subscription_status` (migration 049, PR #229) rather than being recomputed here, so latest-instruction-wins and ties-fail-closed are decided in exactly one place.

The audit log records **refused** attempts as well as successful ones — "who tried to send what, and what stopped them" is the question worth answering later. It carries counts, never addresses, so the log survives being read by someone with no business seeing the list. A test asserts no `@` appears in a serialised entry.

**No automation. No scheduled sending.** Nothing calls this function yet.

## 5. Newsletter placement audit

Signup exists in exactly one place today: the homepage `<Newsletter />` section. Everything below is a recommendation; **nothing was implemented.**

| Surface | Existing signup | Recommended CTA | Timing | Duplication risk | Owner approval |
|---|---|---|---|---|---|
| Homepage | **Yes** — `<Newsletter />` | Keep as-is | Already in place | None | No |
| Academy | No — the apply form captures email for applications | None. Keep the application as the single conversion | — | **High**: a newsletter box beside an application form competes with the higher-value action | Yes, if added |
| Practice Tests | Partial — results screen offers an email save (`source: 'practice-test'`) | Reuse the existing save; add a line saying it also subscribes, only once the disclosure is approved | After a completed attempt, where intent is highest | **High**: two email fields on one screen | **Yes** — needs `EMAIL-CONSENT-01` first |
| Knowledge Center | No | End-of-article signup | After the article, not interrupting it | Low | Yes |
| Store | No | None | — | Competes with checkout | Yes, if added |
| Directory | No | None near listing/claim flows | — | Claim inquiries are a different funnel and a different expectation | Yes, if added |
| Founder Wall | No | None | — | Founders already gave an address through a different form with different consent | **Do not add without review** |
| Road Ahead | No | Signup under the video/series | After content | Low | Yes |

Two points worth flagging before anything is built:

**The practice-test save is the highest-intent placement and the most legally sensitive.** It currently records a lead with `source: 'practice-test'`, and that flow never displayed a newsletter disclosure. Treating those addresses as newsletter subscribers would be claiming consent that was never given. They need either a fresh opt-in or the approved disclosure shown at the point of save.

**Founder Wall and Academy applicants gave their addresses for a specific purpose.** Adding them to a newsletter list because they are in the `leads` table is the same category of mistake as the upsert bug fixed in PR #229 — treating a record as permission.

## 6. Template QA

Verified by rendering the real templates and asserting against the output, not by inspection.

| Check | Result | How |
|---|---|---|
| Mobile rendering | Pass | `width=device-width` viewport, a 480px breakpoint that removes side padding and the card radius, `max-width:600px` container |
| Dark mode | Pass | `color-scheme` and `supported-color-schemes` meta, `prefers-color-scheme: dark` rules, and inline fallbacks so a stripped `<style>` block still renders legibly |
| Plain-text rendering | Pass | Real prose with headings underlined, lists bulleted, URLs on their own lines and never broken mid-URL. Asserted to contain no markup and no HTML entities |
| Accessibility | Pass | `lang="en"`, `dir="ltr"`, every layout table `role="presentation"` (asserted by count), semantic `h1`/`h2`/`ul`, CTAs are real anchors, and the correction notice is labelled in text rather than signalled by colour alone |
| Long names | Pass | Rendered at 3× a 45-character name; `word-break:break-word` throughout; blank, whitespace and null names fall back to "Hey driver," |
| Long titles | Pass | A 200+ character subject and heading render intact and escaped |
| Image-disabled | Pass | There are no images, so this rendering *is* the normal rendering. Asserted: no `<img>`, no `background-image`, no remote asset reference |
| Footer always present | Pass | Structural. Asserted on a zero-block email |
| Unsubscribe always present | Pass | Structural, in both HTML and text, on every template and on a zero-block email |

Two real defects were found and fixed by looking at rendered output rather than trusting the code:

1. **Invalid table nesting** — the body table was a direct child of the outer table rather than sitting in a `<tr><td>`. Valid-looking in a browser; Outlook's Word renderer hoists the stray table, which would have dropped the message body above the masthead.
2. **Double-counted placeholders** — the plain-text wrapper inserts newlines inside a marker, so every pending item was reported twice and the count came out roughly double. The scan now normalises whitespace.

## 7. Tests

`scripts/test-road-report.ts` — **304 assertions, 0 failures.** Covering: every template renders in both parts; plain text is genuine prose; unsubscribe and sender always render including on an empty template; the correction section renders and is labelled; markup in copy and in recipient names is escaped; every block kind reaches both outputs; drafts cannot send; unapproved copy blocks a send; every gate fires and every blocker is reported in one pass; consent, suppression, duplicates and blanks are excluded with reasons; the audit log carries no addresses; no module reaches a network or a secret; no fabricated claims.

## 8. Owner decisions required

| Id | Decision |
|---|---|
| `ROAD-REPORT-SENDER-01` | From address, From display name, Reply-To and who monitors it, and the postal address required in the footer of commercial email. The postal address is a legal requirement and cannot be invented. |
| `ROAD-REPORT-CADENCE-01` | Days between each welcome email, and whether email 1 goes out immediately on signup. |
| `ROAD-REPORT-COPY-01` | The 18 marked items across the four templates — what the newsletter covers, its real cadence, and everything the Academy and product emails claim. |
| `EMAIL-CONSENT-01` | Carried over from PR #229: the disclosure sentence. Still blocks recording consent, and therefore blocks any send. |
| Provider | Whether to use the existing dormant Resend wiring or another provider. Nothing here depends on the answer. |

## 9. What this deliberately does not do

No newsroom. No PWA. No Navigator. No scheduled sending, no automation, no queue. No unsubscribe endpoint — the evidence table and record builder exist in PR #229, but a link that does not resolve is worse than none, and wiring it needs the approved disclosure and an applied migration. No signup placements were implemented. No changes to HERE routing, HOS, Trip Planner, Directory, Store, or Founder Wall.
