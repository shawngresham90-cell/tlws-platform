# Navigator Account Launch Readiness

Follows the merge of **PR #324** (`4c99c5433b3ae2546df2142b3a77425c595e8da3`).
This document is the owner-facing half of that work: what was validated against
a real PostgreSQL, what was found, and the exact external steps that Claude
cannot perform and nobody has performed yet.

**Production is on `NAVIGATOR_ACCESS_MODE=pilot` and nothing in this milestone
changes that.** No production environment variable, Supabase setting, SMTP
configuration or migration was touched. Account mode is enabled nowhere.

Companion documents, none of which are superseded:

| Document | Covers |
|---|---|
| `navigator-account-mode-rollout.md` | Access modes, rollback, what the counter is and is not |
| `navigator-accounts-operations.md` | Marketing export, day-to-day operation |
| `navigator-test-database-setup.md` | Standing up a disposable Supabase test project |
| `navigator-public-beta-cost-audit.md` | The provider spend argument |

---

## 0. The defect this milestone found

Validating migrations 049–051 against a real PostgreSQL — the thing PR #324
listed as outstanding — found a **privilege-escalation defect in migration
050** that no amount of reading the file would have surfaced, and that the
existing RLS tests could not see because it is not an RLS problem.

**What was wrong.** 050 created `navigator_profiles` and `navigator_state`,
enabled row level security, wrote correct per-driver policies, and then said:

```sql
revoke all on public.navigator_profiles from anon;
```

`anon` only. On Supabase a new table in `public` does not start with no
privileges — the project bootstrap runs `grant all on all tables in schema
public to anon, authenticated, service_role` plus a matching `alter default
privileges`. A `grant` is additive, so granting the three verbs we wanted
neither added nor removed anything, and **`authenticated` kept DELETE,
TRUNCATE, REFERENCES and TRIGGER** on both tables.

**Why it matters.** Row level security applies to SELECT, INSERT, UPDATE and
DELETE. **It does not apply to `TRUNCATE`**, which is authorised by the table
privilege alone with no policy consulted. Any signed-in driver — holding
nothing but their own verified email address — could have run:

```sql
truncate public.navigator_profiles;
truncate public.navigator_state;
```

and destroyed **every** driver's account profile and **every** driver's synced
truck, route preferences, HOS clocks and onboarding state, in one statement.

**Measured, not reasoned about.** On an isolated local PostgreSQL 16.13, with
the merged 050 applied and two drivers present:

| As driver A, signed in | Result |
|---|---|
| Read the profile table | 1 row — their own. RLS correct. |
| Delete driver B's row | `DELETE 0` — RLS correct. |
| `truncate navigator_profiles` | **`TRUNCATE TABLE` — succeeded. 2 rows → 0.** |

After applying migration **052**, the identical statement:

| As driver A, signed in | Result |
|---|---|
| `truncate navigator_profiles` | `ERROR: permission denied for table navigator_profiles` |
| Rows surviving | **2** |

**The fix, in two parts.** 050 is corrected so a project built from scratch is
right when the table appears. **`052_navigator_account_table_privileges.sql`**
repairs a project where the older 050 was already applied — it is idempotent,
changes only grants, and touches no row. Migrations 049 and 051 already revoked
from both roles and were never affected.

**Regression cover.** §8k–§8n of `scripts/test-live-postgres.mjs` insert real
rows and assert the truncate is refused. §13p is the generic form: it fails if
**any** `navigator_*` table ever grants TRUNCATE, REFERENCES or TRIGGER to
`anon` or `authenticated`, so a table added next year is covered by a test
written today.

> **Standing consequence for every future migration.** The Supabase
> `alter default privileges` line is project-wide and this milestone did not
> change it — a Navigator migration is the wrong place for a decision that
> broad. So **every migration that creates a table in `public` must revoke from
> BOTH `anon` and `authenticated` before granting.** §13p is what enforces it.

---

## 1. Migration validation — what was run

**Environment:** an isolated local PostgreSQL **16.13** cluster, created for
this run and destroyed after it. No Supabase project of any kind was contacted.
The script's own refusal rails were left in place: seven hard-coded production
project refs, plus a production-evidence probe.

**Command:**

```bash
NAVIGATOR_TEST_DATABASE_URL='postgresql://…disposable…' npm run test:db
```

**Result: 152 passed, 0 failed.**

| Area | Evidence |
|---|---|
| 049, 050, 051, 052 execute in order — then again | Idempotency holds |
| Global threshold under real concurrency | 24 parallel backends, **600 attempts → exactly 100 accepted**, threshold 100 |
| Per-user limit under real concurrency | 16 parallel backends, **160 attempts → exactly 15 accepted**, limit 15 |
| Negative control (read-then-write mutant) | **120 accepted against a threshold of 100 — overshoot.** The race is real and the shipped form holds it |
| Endpoint weights, month rollover, invalid input | As specified; `2026-13` refused by the check constraint |
| Guard dependency removed mid-flight | Function renamed away → the call **errors**; never answers "allowed" |
| No-refund | An accepted reservation survives an outage and a later refusal; **no refund-shaped function exists** in the schema |
| Schema inventory | Tables, views, functions, indexes, triggers, check constraints, grants and policies all read off the live catalog |
| RLS and cross-user isolation | Anonymous refused outright; cross-driver insert and re-owning both refused |
| **TRUNCATE** | **Refused after 052 — see §0** |
| Account deletion cascade | Profile, three synced domains and the usage row all removed by deleting the auth row |
| No PII in usage records | Read off the live catalog, not the migration text |
| Rollback documented | Asserted per migration as runnable SQL, not prose |

### What this run still does NOT establish

Stated plainly, because these are the gaps an owner has to decide about:

- **PostgreSQL 16 with a documented shim** (`scripts/sql/supabase-shim.sql`)
  for the Supabase roles and `auth` schema. **Supabase runs 17.** READ
  COMMITTED row-locking behaves identically across both, but that is reasoning,
  not a run.
- **Nothing at the PostgREST layer**, and nothing against the real managed
  `auth` schema.
- **The OTP round trip is still tested structurally**, not against a live auth
  server. It cannot be otherwise until SMTP exists.
- The migrations remain **unapplied on every Supabase project**.

Closing these needs a disposable Supabase test project — one credential, no
code change. Checklist: `navigator-test-database-setup.md`.

---

## 2. Netlify environment variables

### The three budget variables, from the merged code

All three are **required**. Account mode refuses every metered request until all
three are set and coherent — that is the intended fail-closed behaviour, not a
bug to work around.

| Variable | What it controls |
|---|---|
| `NAVIGATOR_PROVIDER_MONTHLY_ALLOWANCE` | **The allowance you believe you have.** Not enforced against traffic. It exists so the threshold can be sanity-checked against it and so the admin page can show both numbers. Set it to the allowance HERE actually contracts you — see §4. |
| `NAVIGATOR_PROVIDER_MONTHLY_THRESHOLD` | **The number actually enforced.** When the month's reserved units would cross this, metered requests are refused. **Must be strictly below the allowance** — equal is rejected as a configuration error, because the margin between them is the entire point of having two numbers. |
| `NAVIGATOR_PROVIDER_USER_MONTHLY_LIMIT` | **Per-driver monthly ceiling**, keyed to the verified `auth.uid()` — never an IP, because an IP is a whole carrier's NAT and also one moving truck's. Stops one account exhausting the shared threshold. |

Optional, defaulting to `1` each: `NAVIGATOR_PROVIDER_WEIGHT_ROUTE`,
`NAVIGATOR_PROVIDER_WEIGHT_SEARCH` — units charged per call to each endpoint.

Parsing is deliberately strict. `''`, `'abc'`, `'12.5'`, `'-1'` and `'0'` are
all rejected rather than coerced, because `Number('')` is `0` and a threshold of
zero would refuse every request while looking like a deliberate setting.

### Preview-only variables needed to test account mode

**Set these on a preview deploy context only. Do not set them on production.**
Claude has set none of them.

| Variable | Preview value |
|---|---|
| `NAVIGATOR_ACCESS_MODE` | `account` |
| `NEXT_PUBLIC_NAVIGATOR_ENABLED` | `true` |
| `NEXT_PUBLIC_SUPABASE_URL` | The **test** project's URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The **test** project's publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | The **test** project's service-role key |
| `NEXT_PUBLIC_SITE_URL` | The preview URL, so OTP redirects land back on the preview |
| `HERE_API_KEY` | A key you are willing to spend, ideally a separate one |
| `NAVIGATOR_PROVIDER_MONTHLY_ALLOWANCE` | Small — e.g. `200` |
| `NAVIGATOR_PROVIDER_MONTHLY_THRESHOLD` | Smaller — e.g. `100` |
| `NAVIGATOR_PROVIDER_USER_MONTHLY_LIMIT` | Small enough to hit on purpose — e.g. `10` |

> `.env.example` has been updated on this branch to document all five budget
> variables and the `account` mode. It is a template only and sets nothing.

---

## 3. Supabase email authentication — owner checklist

Claude cannot configure any of this. **None of it has been done.** Until it is,
account mode cannot be enabled anywhere, because a driver who never receives a
code cannot sign in.

Do all of this on the **test** project first.

- [ ] **Custom SMTP provider configured.** Supabase's built-in sender is
      rate-limited to a handful of messages an hour and is explicitly not for
      production. Auth → Settings → SMTP.
- [ ] **Authenticated sender domain** — send from the owned domain, not from
      the provider's shared domain.
- [ ] **SPF** record published for the sending domain.
- [ ] **DKIM** signing enabled and the record published.
- [ ] **DMARC** — recommended. Start at `p=none` with a reporting address,
      read the reports for a couple of weeks, then tighten. Publishing
      `p=reject` before SPF and DKIM are confirmed aligned will bounce your own
      sign-in codes.
- [ ] **Branded OTP email template.** The default is unbranded and reads as
      phishing to a driver who has just typed their address into a trucking
      app. Name the product, say the code expires, and say plainly that nobody
      from TLWS will ever ask them to read it out.
- [ ] **Production redirect URL** added to the allow-list.
- [ ] **Preview redirect URL** added to the allow-list — the preview will not
      complete a sign-in without it.
- [ ] **OTP expiration** set deliberately. Shorter is safer; long enough that a
      driver in poor signal can still use it.
- [ ] **Resend cooldown** configured, and matched to the UI's own cooldown so
      the button is not offering something the server will refuse.
- [ ] **Auth rate limits** reviewed. Supabase's limit is the one that actually
      bounds spend; the app's per-IP limiter is per-instance and documented as
      such.
- [ ] **CAPTCHA / Turnstile enabled on the auth endpoints.** A sign-in form that
      emails a stranger on demand is an email-sending API pointed at someone
      else's inbox. Turnstile keys already exist in this project for forms.
- [ ] **Delivery test** — to Gmail, Outlook and at least one carrier address.
- [ ] **Spam-folder test** — confirm arrival in the inbox, not just arrival.
      Check on a phone, which is where every real driver will read it.

---

## 4. HERE cost protection — owner checklist

- [ ] **Usage alerts configured** in the HERE dashboard.
- [ ] **Alert thresholds documented** here, next to the app threshold, so the
      two numbers can be compared without logging in.
- [ ] **Question sent to HERE, in writing:** *"Does our plan support a true,
      enforceable, account-level hard cutoff that stops serving requests at a
      quota — as opposed to a notification? If so, how is it enabled?"*
      Record the answer, whatever it is.
- [ ] **API credentials restricted** as far as the plan allows — referrer or
      IP restrictions, and a key that is not shared with any other project.
- [ ] **Actual monthly allowance verified** against the contract, per product.
      Routing and Discover search bill against **different products with
      different quotas**, and the cost audit records the search quota as
      *undocumented*.
- [ ] **Application threshold set below that allowance**, with real margin.

> **HERE dashboard notifications are alerts, not a spending cutoff.** An alert
> notifies; it does not refuse a request. Until HERE confirms an enforceable
> account-level quota in writing, **the application's own guard is the only
> thing that actually stops spend.** Nothing in the code, the UI or this
> document may describe HERE alerts as a hard cap.

---

## 5. Safe account-mode preview procedure

The ordinary preview stays in `pilot` unless its deploy context is deliberately
configured otherwise — which is correct, and means the normal preview does not
exercise the account screen at all.

To exercise it safely:

1. **Create a disposable Supabase test project.** Not the production project,
   not another product's project. `navigator-test-database-setup.md`.
2. **Apply the migrations to it, in order:** `049`, `050`, `051`, `052`.
3. **Run the live suite against it** before trusting it:
   `NAVIGATOR_TEST_DATABASE_URL='…' npm run test:db`. Use the **direct**
   connection URI on port 5432, not the pooler — the run creates roles and
   functions. It refuses to run against any known production ref.
4. **Configure test SMTP** on the test project (§3), with the preview URL in
   the redirect allow-list.
5. **Set the preview deploy context's variables** from the table in §2 — test
   Supabase credentials, deliberately small budget values.
6. **Verify before signing in:** the preview points at the test project. The
   simplest check is that the test project's `navigator_profiles` is empty and
   gains exactly one row when you sign up.

**Never during any of this:** no production database, no production Supabase
setting, no production environment variable, no production migration, no
production SMTP.

---

## 6. Real-phone checklist

Nothing here has been run. Every item needs a phone, applied migrations and
working SMTP. Run against the **preview + test project** from §5.

- [ ] 1. **New signup** — first name, email, optional phone; account created.
- [ ] 2. **OTP arrives** — and arrives in the inbox, not spam. Note how long it
      took.
- [ ] 3. **Reload without signing in again** — the session persists across a
      full page reload and an app restart.
- [ ] 4. **Saved truck restored** — and a restored truck whose confirmation no
      longer matches its values comes back **unconfirmed**, with Start
      disabled. Restoring a truck must never restore permission to route for a
      truck nobody checked.
- [ ] 5. **Route preferences restored.**
- [ ] 6. **HOS clocks restored** — the driver-entered values, unchanged.
- [ ] 7. **Second device** — sign in on a second phone; the truck, preferences
      and clocks arrive. Then change something on device B and confirm device A
      does not overwrite it with an older copy.
- [ ] 8. **Offline save, then synchronization** — turn the radio off, change the
      truck, confirm the save succeeds immediately and Start is never blocked;
      reconnect and confirm it reaches the account.
- [ ] 9. **Marketing refusal still allows full access** — sign up with both
      marketing boxes unticked and confirm the Navigator works completely.
- [ ] 10. **Consent withdrawal excludes the driver from the Stan CSV** —
      withdraw in account settings, re-export, confirm the address is absent.
- [ ] 11. **Account deletion** — the profile, all synced records and the usage
      row go; the consent evidence remains, by design.
- [ ] 12. **Anonymous API request rejected** — call
      `/api/navigator/route` and `/api/navigator/destination-search` with no
      session. Expect **401 `account-sign-in-required`**, no provider call, no
      budget unit spent, and nothing in the body naming a key, a host, an
      environment variable or Supabase.
- [ ] 13. **Usage-limit experience** — set the per-user limit low, cross it
      deliberately, and read what a driver actually sees. It must not mention a
      threshold, a remaining balance, a provider or a database.
- [ ] 14. **A real route and a real reroute**, driven.
- [ ] 15. **Stationary GPS loss under cover** — under a bridge, in a dock, in a
      building.
- [ ] 16. **Movement safety lock** — confirm the driving surface locks down as
      intended once the truck is moving.

---

## 7. Legal pages — status

`/terms` did not exist before this branch and the Privacy Policy did not
describe accounts. Both are addressed here as **proposed text**.

- **`/terms`** — new page. Free account usage, acceptable use and automated
  abuse, driver responsibility for posted signs and legal route verification,
  Navigator limitations, no guarantee that any restriction / bridge / closure /
  map record is current, **not an ELD**, HOS values are driver-entered and
  informational, suspension and termination for abuse, account deletion,
  intellectual property, service availability, Georgia governing law, TLWS
  contact details.
- **`/privacy`** — new "Navigator accounts" section covering first name, email,
  optional phone, email OTP, Supabase as the account provider, the four synced
  records, marketing consent records, the manual Stan CSV export, withdrawal,
  deletion, retention, honestly-stated security limitations, and the explicit
  decision **not** to store live GPS history, destinations, searches or
  generated routes. The sharing section now names Supabase and Stan Store
  rather than claiming data is never shared.

**Both require owner and legal review before launch.** They contain no invented
guarantee, no insurance, no regulatory approval and no compliance claim, and
they must not gain one.

Two items an owner must settle:

- [ ] **Counsel review**, particularly limitation of liability and governing
      law.
- [ ] **`LEGAL.contactEmail`** is still marked *OWNER TO CONFIRM* in
      `src/lib/legal/company.ts`. A Terms page naming a mailbox nobody reads is
      worse than one naming none.

The signup checkbox now names both documents and links both, and
`CONSENT_COPY_VERSION` moved to **`navigator-account-v2`** with the wording, as
the evidence model requires. **If legal changes the acceptance sentence, the
version must move again in the same commit** — which is free right now, because
account mode is enabled nowhere and no driver has agreed to anything yet.

---

## 8. Remaining owner actions, consolidated

| # | Action | Blocks |
|---|---|---|
| 1 | Create a disposable Supabase test project | Everything below |
| 2 | Apply `049`, `050`, `051`, **`052`** to the test project, in order | Preview, phone tests |
| 3 | Re-run `npm run test:db` against it | Closes the PG-17 / PostgREST gap |
| 4 | Configure SMTP on the test project (§3) | OTP, phone tests |
| 5 | Set the preview deploy context's variables (§2) | Preview |
| 6 | Work the real-phone checklist (§6) | Launch |
| 7 | Configure HERE alerts; ask HERE the hard-cutoff question in writing (§4) | Launch |
| 8 | Verify the real HERE allowance and set the three budget variables below it | Account mode |
| 9 | Legal review of `/terms` and the Privacy Policy additions (§7) | Launch |
| 10 | Provision or replace `LEGAL.contactEmail` | Launch |
| 11 | **Only then**, and deliberately, decide about production `account` mode | — |

Production stays on `pilot` until every one of those is done.
