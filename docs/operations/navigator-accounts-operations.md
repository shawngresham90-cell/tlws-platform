# Navigator Accounts — Operations

Everything that has to be true before `NAVIGATOR_ACCESS_MODE=account` is
switched on, and how to run the marketing export once it is.

---

## Rollback, first

The whole point of keeping the passcode gate is that this is one line:

```
NAVIGATOR_ACCESS_MODE=pilot
```

Read at runtime, so a redeploy of the same build is enough — no rebuild, no
revert, no code change. Unsetting it entirely does the same thing, because
anything unrecognized resolves to `pilot`.

Do this the moment OTP delivery is unreliable, and do it before investigating.
A driver who cannot sign in cannot navigate; a driver on the passcode can.

---

## Email readiness — the gate before `account` mode

**Status: NOT VERIFIED.** This could not be checked from the build environment
— the Supabase management tools available there expose no auth or SMTP
settings, and the network policy blocks direct API calls. Nothing in this
repository can confirm or deny it, so it is listed as unverified rather than
assumed either way.

Until every box below is ticked by hand, production stays on `pilot`. The
Supabase default email service is a shared, heavily rate-limited sender
intended for development. It is not a production sender, and treating it as
one produces exactly the failure that looks like a broken product: codes that
arrive late, land in spam, or never arrive at all.

| | Check | Why it matters |
|---|---|---|
| ☐ | **Custom SMTP configured** in Supabase Auth settings | The default sender is development-only and rate-limited per project |
| ☐ | **Sender domain authenticated** — SPF, DKIM, and DMARC aligned | Unauthenticated mail from a new domain goes to spam, and a sign-in code in spam is a lost driver |
| ☐ | **OTP email template branded** — TLWS sender name, subject that reads as a sign-in code, no default Supabase copy | A generic template from an unknown sender reads as phishing, which is the correct instinct for a driver to have |
| ☐ | **Redirect URLs allow-listed** for production AND the Netlify preview domain | A missing preview URL makes the flow work in production and fail in review, or the reverse |
| ☐ | **Auth rate limits reviewed** in the Supabase dashboard | The in-app limiter is per-process; Supabase's is the one that actually bounds send volume |
| ☐ | **CAPTCHA reviewed** — Turnstile is already wired into this project (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`) and can be enabled in Supabase Auth | The sign-in form emails a stranger on demand; without a challenge it is an email-sending API pointed at someone else's inbox |
| ☐ | **OTP tested on a real phone**, on cellular, not on desk wifi | Deliverability and autofill both behave differently on a phone |
| ☐ | **Spam-folder behaviour tested** across at least Gmail and one Microsoft address | These two decide most drivers' experience |

---

## Migrations

Apply in this order. `050` depends on `049`.

| # | File | State | Contains |
|---|---|---|---|
| 049 | `049_email_consents.sql` | **Written, NOT applied** | `email_consents`, `email_unsubscribes`, `email_subscription_status` |
| 050 | `050_navigator_accounts.sql` | **Written, NOT applied** | `navigator_profiles`, `navigator_state`, `navigator_marketing_contacts` |

`sms_consents` (046) is already applied and holds real rows.

**Applying `050` without `049`** leaves signup unable to record email consent
and the marketing export returning a 503 rather than an empty file — which is
deliberate, because an empty CSV would read as "nobody consented", a false
statement about real people.

Both files parse against the real PostgreSQL grammar. Neither has been run
against a live server.

---

## The marketing export

### Who is in it

Decided by `public.navigator_marketing_contacts`, not by the route. The view
joins a driver's profile to the append-only consent evidence and keeps only
those whose **latest instruction was an opt-in**. Concretely, a driver appears
only when all of these hold:

- they have a `navigator_profiles` row with a normalized email;
- `email_subscription_status.is_subscribed` is true for that address, meaning
  the most recent evidence is a consent and not an unsubscribe;
- ties resolve to unsubscribed — equal timestamps fail closed.

A driver who unticks the box in their account settings appends an unsubscribe
row. Nothing is updated, and they drop out of the next export automatically.

**An address with no evidence at all does not appear.** Absence is not
consent, and the view is built so absence cannot be mistaken for it.

### Downloading

Admin session required. The route authenticates itself and answers 401 rather
than redirecting, because a browser following a redirect would save the login
page as a `.csv`.

```
/admin/navigator/marketing/csv                     — everyone currently consented
/admin/navigator/marketing/csv?since=2026-08-01    — only signups since that date
```

The `since` filter is by signup date, for exporting new contacts without
re-importing the whole list. An unparseable date means *no filter* rather than
an empty window — a misread date that silently narrowed the export would
produce a file that looks complete and quietly omits people.

Response headers carry the counts, so they cannot be mistaken for contacts:

- `x-tlws-included` — rows written
- `x-tlws-dropped-no-email` — rows with no usable address
- `x-tlws-dropped-duplicate` — repeat addresses, first occurrence kept
- `x-tlws-over-stan-limit` — true when the file exceeds Stan's import ceiling

### The file

| First Name | Last Name | Email | Phone |
|---|---|---|---|

`Last Name` is always empty. The Navigator collects a first name only; the
column exists because Stan's mapper expects it, and a blank column imports
more cleanly than a missing one.

`Phone` prefers the normalized `+1…` form — an importer matching on phone
needs one spelling, and `(555) 123-4567` and `+15551234567` are two.

De-duplication is by normalized address, keeping the **earliest** signup: the
row whose consent evidence has been standing longest.

### Importing into Stan — manual, every time

1. Download the CSV from the admin area.
2. Open Stan Store.
3. Go to **Customers**.
4. Choose **Add Contacts** or **Upload**.
5. Import the CSV.
6. Apply the tag **`TLWS Navigator`**.
7. Follow Stan's own imported-contact consent process.

**Stan's manual-import limit is 5,000 contacts per store.** Over that, split
the file using the `since` filter rather than letting an importer silently
take the first 5,000.

**There is no automatic integration and there must not be one in this
milestone.** No contact is sent to Stan by any code in this repository, and no
unofficial Stan endpoint is called. The export is a file a person downloads
and a person uploads.

---

## What is deliberately never exported

- Anyone who declined marketing, or was never asked.
- Anyone who has since unsubscribed.
- Any location, destination, search or route — none of it is stored
  server-side at all. `navigator_state` has a check constraint listing the four
  domains it accepts, and widening that list takes a reviewed migration.

---

## Legal pages — open items

Both are **owner decisions**, not code, and neither is resolved:

1. **There is no Terms of Service page.** The signup checkbox therefore accepts
   the Privacy Policy only, and `navigator_profiles.terms_accepted_at` stays
   null. Recording acceptance of a document that does not exist would be
   recording an agreement nobody could have read. Adding Terms later is a copy
   change plus a decision about existing accounts — not a migration.

2. **The Privacy Policy does not describe accounts.** Across its 759 words:
   `account` 0, `authenticat*` 0, `password` 0, `Supabase` 0, `withdraw` 0,
   `marketing` 1. Before `account` mode is public it needs to say, accurately:
   what is collected (first name, email, optional phone), that authentication
   is an emailed code, what is saved to the account (truck, preferences,
   clocks, onboarding — and explicitly not location), why, how marketing
   consent is given and withdrawn, how an account is deleted and what survives
   deletion, retention, and that Supabase processes this data with Stan
   receiving marketing contacts by manual import.

No wording for either has been drafted here.
