# Disposable Supabase Test Project — Setup Checklist

**No approved test database exists yet.** This is the checklist to create one,
written because the live-database validation of migrations 049–051 is blocked
on it and nothing else.

> **Nothing here touches production.** The `tlws-platform` Supabase project
> (`cgvxwvymkembftznhcdl`) is the live one and is deliberately unreachable from
> `npm run test:db` — see the refusal rail below.

---

## What was checked, and what was found

Searched for approved test credentials. **None exist** in this environment:

| Variable | State |
|---|---|
| `SUPABASE_URL_TEST` | unset |
| `SUPABASE_TEST_URL` / `TEST_SUPABASE_URL` | unset |
| `SUPABASE_SERVICE_ROLE_KEY_TEST` and every spelling of it | unset |
| `SUPABASE_TEST_DB_URL` / `SUPABASE_DB_URL_TEST` | unset |
| `TEST_DATABASE_URL` / `DATABASE_URL_TEST` | unset |

No `SUPABASE_*` variable of any kind is set here, `.env.example` documents only
the three production-shaped names (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), and the CI
workflows reference no database secrets at all.

The Supabase organization holds seven projects. **None is a test or staging
project for this repository:**

| Project | Role |
|---|---|
| `tlws-platform` | **PRODUCTION for this repo — never a test target** |
| `TruckLifePWA`, `cdl-preschool`, `ShopScheduler`, `RosedaleIdle`, `crewcut-os`, `TRUCKING-LIFE-PWA-HUFFYONLY` | other products — real data, equally not scratch space |

All seven refs are hard-coded into `scripts/test-live-postgres.mjs` as refusals.

---

## Create the project

1. **New Supabase project**, free tier is enough. Suggested name
   **`tlws-platform-test`**. Same region as production (`us-east-1`) so
   behaviour matches; region does not affect correctness here.
2. **Do not connect it to anything.** No Netlify site, no deploy context, no
   custom SMTP, no auth providers. It exists to be written to and thrown away.
3. **Do not copy production data into it.** The test script refuses to run
   against a target where `sms_consents`, `leads` or `navigator_profiles` holds
   rows — a populated table is production-shaped evidence, not scratch data.
4. Note the project ref (the subdomain in its URL). **Add it to nothing** —
   the refusal list in the script is a deny-list, not an allow-list, so a new
   test ref needs no code change.

## The one credential the test needs

`npm run test:db` speaks to PostgreSQL directly over `psql`, not through the
REST API, because it creates roles and functions and runs concurrent
transactions. It needs the **direct connection string**, not the pooler:

> Supabase dashboard → **Project Settings → Database → Connection string →
> URI**, and use the **direct** connection (port `5432`), not the transaction
> pooler (`6543`). The pooler multiplexes sessions and will not hold the
> session-level `SET ROLE` the RLS tests depend on.

| Variable | Value | Notes |
|---|---|---|
| `NAVIGATOR_TEST_DATABASE_URL` | `postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres` | **the only one required** |
| `SUPABASE_TEST_DB_URL` | same | optional alias, read if the first is unset |

Nothing else is needed. No anon key, no service-role key, no project URL — the
script does not use the REST API.

**Where to keep it:** a local shell only, or a CI secret. It is a superuser
credential for a database, so it does not belong in `.env.example`, in the
repository, or in any file that gets committed.

## Run it

```bash
NAVIGATOR_TEST_DATABASE_URL='postgresql://…:5432/postgres' npm run test:db
```

Expected on a fresh project: the script reports
`target : Supabase-shaped (auth.users present) — shim NOT applied`, applies
**049, 050, 051 and 052 in order**, and runs the full battery. It cleans up its
own fixtures at the end.

> **The sequence must never stop at 051.** 049–051 alone leave
> `navigator_profiles` and `navigator_state` with TRUNCATE granted to
> `authenticated`, and RLS does not filter TRUNCATE — any signed-in driver
> could empty both tables for everyone. 052 closes it and is harmless to apply
> twice. See `navigator-account-launch-readiness.md` §0.

`npm test` is unaffected and stays hermetic — the live test is a separate
command and is not picked up by the harness runner.

## If it refuses to run

| Message | Meaning |
|---|---|
| `REFUSED: the connection URL names project ref …` | You pointed it at production or another real project. No connection was opened. |
| `REFUSED: public.<table> … holds N row(s)` | The target has production-shaped data. Use an empty project. |
| `SKIPPED: … is not set` | No URL configured. This is a skip, not a pass — no evidence was collected. |
| `SKIPPED: the database did not answer` | Wrong password, wrong port (pooler instead of direct), or no network. |

## Afterwards

The project can be deleted once 049–052 are confirmed, or kept for the next
migration. If kept, **delete it before it accumulates anything real** — the
value of a disposable database is entirely in its being disposable.

---

## What running this closes

Gate 5 of the readiness checklist in `navigator-account-mode-rollout.md`:
*migrations 049, 050, 051 and 052 reviewed and applied, in that order.* It is
the last technical gate; the remainder (SMTP, Terms, Privacy, HERE, real-phone
tests) are owner actions that no test can perform.

The same battery has already run green against **PostgreSQL 16.13 in a
throwaway local cluster** (75 passed, 0 failed) using a documented shim for the
Supabase roles and `auth` schema. What a Supabase test project adds is
confirmation that the real managed `auth` schema and PostgreSQL 17 behave the
same — which is exactly the part a shim cannot speak for.
