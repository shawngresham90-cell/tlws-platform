# Audit report — Shared API Infrastructure + Directory API Routes
Target: commit 881fb07 (working tree src/ verified identical to origin/main). All claims cited file:line.

## Client construction map (who creates what, when)

Four client factories, all **per-call functions, no module-level singletons anywhere**:

| Factory | Key | Library | Construction pattern |
|---|---|---|---|
| `createAdminClient()` — `src/lib/supabase/admin.ts:10-21` | **service role** (`SUPABASE_SERVICE_ROLE_KEY`, admin.ts:12) | `@supabase/supabase-js` v2.45.0 | New client per call; env re-read + validated per call (admin.ts:11-16); `server-only` import guard (admin.ts:1); `autoRefreshToken:false, persistSession:false` (admin.ts:19) |
| `createStaticClient()` — `src/lib/supabase/static.ts:8-14` | anon | supabase-js | New client per call; cookieless; `persistSession:false` (static.ts:12); non-null-asserted env (static.ts:10-11) — no validation, throws deep inside supabase-js if unset |
| `createClient()` (server) — `src/lib/supabase/server.ts:9-31` | anon + request cookies | `@supabase/ssr` 0.5.1 | Per-call, bound to `cookies()` (server.ts:10); comment at server.ts:7 ("service role reserved for isolated Edge Functions only") is **stale/contradicted** — the service role is used directly in ~99 route handlers/server actions |
| `createClient()` (browser) — `src/lib/supabase/client.ts:8-13` | anon (public env) | @supabase/ssr | Per-call; `createBrowserClient` internally memoizes a browser singleton, so per-call cost is negligible client-side |

**Call-site counts (VERIFIED via grep):**
- `createAdminClient()`: **99 call sites** outside its definition. In this subsystem: review/route.ts:24, submission/route.ts:26, parking-report/route.ts:38, view/route.ts:74. The rest are admin server actions/pages and lib/admin/*, lib/community/data.ts, plus 6 other public API routes.
- `createStaticClient()`: **24 call sites** — 11 alone in `src/lib/directory/data.ts` (lines 203, 289, 312, 338, 365, 392, 450, 524, 567, 635, 656), plus nearby.ts:70, redirects.ts:27, sponsors-data.ts:51, trip-planner/directory-loader.ts:216, kc/queries.ts:133, sitemap.ts:315, tests/queries.ts:42/65/123, community/founders.ts:60/86, community/data.ts:27, preschool/data.ts:30.
- server `createClient()`: 4 importers (cloud-api.ts, kc/queries.ts, auth.ts, FoundersWall.tsx, ProofBar.tsx — 5 files per grep); browser `createClient()`: 1 (useCloudSync.ts).

**Would hoisting matter?** Every construction is `new SupabaseClient` + `new URL(...)` + header/fetch setup — no network I/O and no per-request state for the admin/static variants (cookieless, `persistSession:false`). A directory page render that calls several `data.ts` functions constructs several identical anon clients per request. This is wasted allocation but almost certainly micro-scale. HYPOTHESIS: hoisting `createStaticClient()`/`createAdminClient()` to module-level singletons would save well under 1 ms/request; needs benchmark before claiming a win. The server/browser `@supabase/ssr` variants must stay per-request (cookie-scoped) — do not hoist those.

## Route inventory

All five directory routes are POST-only, `runtime = 'nodejs'` (nearby:10, view:20, review:7, submission:7, parking-report:11). None sets any `Cache-Control`/response cache header — the only cache-related API code in the repo is `revalidatePath` in `src/app/api/revalidate/route.ts:35`. POST route handlers are dynamic by default; `view` additionally declares `dynamic = 'force-dynamic'` (view/route.ts:21).

| Route | Guard | Rate limit | Validation | DB client | Auth |
|---|---|---|---|---|---|
| `POST /api/directory/nearby` (nearby/route.ts:27-40) | `guardedPost`, `requireTurnstile: false` (route.ts:29) | 30/min/IP in-memory | zod: lat/lng bounds, radius ≤500, limit ≤100 (route.ts:19-25) + US-bounds recheck (nearby.ts:68, geo.ts:36-44) + RPC-side caps (nearby.ts:74-76) | **anon** `createStaticClient` (nearby.ts:70) → `nearby_locations` RPC, RLS-scoped | none (public) |
| `POST /api/directory/view` (view/route.ts:47-80) | **hand-rolled, not guardedPost** | own in-memory limiter: 20/min/IP + 2000/min/instance (view/route.ts:28-45) | UUID regex only (view/route.ts:23,60); `sec-fetch-site` same-origin filter (view/route.ts:49-52) | **service role** (view/route.ts:74) → `record_directory_view` RPC | none; always answers 204, fails soft (view/route.ts:76-79) |
| `POST /api/directory/review` (review/route.ts:14-58) | `guardedPost` | 5/min/IP | `reviewSchema` (community/schemas.ts:131-141), honeypot (review/route.ts:19), Turnstile if token present | **service role** (review/route.ts:24); listing-exists check (review/route.ts:26-33); insert `status:'pending'` (review/route.ts:45) | none |
| `POST /api/directory/submission` (submission/route.ts:15-76) | `guardedPost` | 5/min/IP | `submissionSchema` (community/schemas.ts:60-127), honeypot, Turnstile-if-token | **service role** (submission/route.ts:26); insert pending (submission/route.ts:63) | none |
| `POST /api/directory/parking-report` (parking-report/route.ts:27-78) | `guardedPost` | 6/min/IP (route.ts:29) | `parkingReportSchema` — `.strict()` discriminated union (parking-report.ts:69-101), header-injection sanitization (parking-report.ts:119-126), honeypot | **service role** (route.ts:38); insert pending (route.ts:65) | none |

**Shared guard stack** (`src/lib/api/handler.ts:35-72`): order is rate-limit → JSON parse → zod → Turnstile → handler; any throw → generic 500 (handler.ts:66-71). Used by 10 routes total (the 4 directory writes + tests/attempt, application step1/step2, sponsor-inquiry, lead, preschool/claim).

**Turnstile is effectively optional on all four directory routes** — see Security notes.

## Middleware

`src/middleware.ts:4-13`: single job — `updateSession()` on every request matching `/((?!_next/static|_next/image|favicon.ico|fonts|.*\.(svg|png|jpg|jpeg|gif|webp)$).*)` (middleware.ts:11). That matcher **includes all `/api/*` routes and every HTML page**.

`updateSession` (`src/lib/supabase/middleware.ts:10-37`): builds a cookie-bound `createServerClient` per request (lines 13-30) and calls `supabase.auth.getUser()` (line 34) purely to refresh session cookies. It gates nothing — explicitly not `/admin` (comment lines 5-9; admin auth is the env-var gate in `src/lib/admin/auth.ts`).

- VERIFIED: every directory API POST first passes through this middleware, constructing an extra Supabase client per request.
- HYPOTHESIS (library behavior, not in-repo code): with no Supabase auth cookies present — the normal case for these anonymous public routes — `getUser()` in @supabase/ssr 0.5.1 short-circuits without a network call; with a session cookie it makes one HTTPS round trip to Supabase auth per matched request. Needs measurement/trace to confirm on Netlify.
- Given only ~6 files use the cookie-based auth flow at all, running session refresh on every API/page request is broader than needed; the matcher could exclude `/api/` outright.

## Failure modes

1. **In-memory rate limiting is per-instance and vanishes on cold start** (rate-limit.ts:10, view/route.ts:31-32). On Netlify serverless, concurrent invocations = separate instances, so the effective limit is N×limit. Both limiters fail OPEN (rate-limit.ts:30-33). VERIFIED design tradeoff, acknowledged in comments (rate-limit.ts:5-7, view/route.ts:26-27).
2. **`ipHits.clear()` at 10k entries** (view/route.ts:40) resets *everyone's* counters, momentarily unlimiting all IPs — cheap memory bound, minor correctness gap.
3. **Turnstile fetch has no timeout** (turnstile.ts:27-30): a slow Cloudflare siteverify stalls the request until platform timeout. Failure path returns false = fail closed (turnstile.ts:34-37) — safe but user-visible 403s during a Cloudflare outage.
4. **No request body size cap anywhere.** `req.json()` (handler.ts:48, view/route.ts:56) parses whatever arrives; zod bounds field lengths only after full parse. Effective cap is only the platform's (Netlify function payload ~6 MB). A 5 MB JSON body is fully parsed before rejection. Applies to all 10 guardedPost routes + view.
5. **`getNearbyListings` swallows all errors and returns `[]`** (nearby.ts:78, 96-98) — DB outages are indistinguishable from "nothing nearby"; no logging on that path.
6. **`createStaticClient` uses `!` assertions on env** (static.ts:10-11) vs. admin.ts's explicit throw (admin.ts:14-16) — misconfig surfaces as an opaque supabase-js error at build/static-gen time.
7. **view route double-parses IP with different header priority** than the shared helper: view/route.ts:65-68 checks `x-forwarded-for` then `x-real-ip`, never `x-nf-client-connection-ip`; `clientIp` (rate-limit.ts:37-44) checks `x-nf-client-connection-ip`/`cf-connecting-ip` first. On Netlify, `x-forwarded-for` first entry is client-spoofable in some configs — the view limiter keys on a weaker signal than the rest of the stack.

## Bottleneck candidates

- **VERIFIED (structural): middleware runs on every API and page request** (middleware.ts:11), building a per-request `createServerClient` + `getUser()` (supabase/middleware.ts:13-34) that these anonymous routes never benefit from. Excluding `/api/` from the matcher is a free win. Magnitude = HYPOTHESIS pending measurement (likely small when no auth cookie; one auth round trip when present).
- **VERIFIED (structural): per-request client construction** — e.g. one directory page render calls multiple `data.ts` loaders, each constructing a fresh anon client (data.ts:203 etc.); each API POST constructs a fresh admin client. HYPOTHESIS: sub-millisecond each; hoisting is a cleanliness win more than a latency win. Each fresh supabase-js client also means no HTTP connection reuse across clients (each carries its own fetch invocation; keep-alive is per-runtime-agent) — measurement needed.
- **VERIFIED: review/submission/parking-report do two sequential DB round trips** (existence check then insert — review/route.ts:26-48, submission/route.ts:30-66, parking-report/route.ts:42-68). Could be one RPC or an FK-violation-driven single insert. Low traffic; unlikely to matter.
- **VERIFIED: no caching on nearby** — every map "near me" query hits the `nearby_locations` RPC (nearby.ts:71). POST + per-user coordinates make HTTP caching genuinely inapplicable (privacy-deliberate, nearby/route.ts:13-17); DB-side cost is the real variable. HYPOTHESIS: RPC latency under load is the bottleneck for the map, not this route's Node overhead.
- **VERIFIED: Turnstile verification is a blocking external HTTPS call** (turnstile.ts:27) in the hot path of every tokened submission.

## Simplification opportunities

1. **Fold `view/route.ts` onto shared infra**: it hand-rolls its own limiter (view/route.ts:28-45), IP parsing (65-68), and body parsing (54-62) instead of `rateLimit`/`clientIp`/`guardedPost`. The 204-always contract differs from `fail()`'s envelopes, so full `guardedPost` reuse needs a "silent" mode — but `clientIp()` reuse is free and fixes the header-priority inconsistency.
2. **Hoist admin/static clients to lazy module singletons** (admin.ts:10, static.ts:8) — both are stateless/cookieless; 123 combined call sites would share two instances. Keep the `@supabase/ssr` variants per-request.
3. **Exclude `/api/` (and probably everything but the handful of auth-consuming paths) from the middleware matcher** (middleware.ts:11).
4. **Duplicate honeypot conventions**: `community/schemas.ts:58` (`max(200)`, value ignored-if-present) vs `parking-report.ts:78` (`max(0).or(literal(''))`) — two shapes for the same idea; the schemas.ts variant *accepts* up to 200 chars then branches in the route (review/route.ts:19). One shared `honeypot()` builder would do.
5. **Stale comment cleanup**: server.ts:7 claims service role is "reserved for isolated Edge Functions only"; reality is 99 in-process call sites. Misleading for future maintainers.
6. **`fail()` before/after Turnstile**: `requireTurnstile: false` on nearby (nearby/route.ts:29) is redundant given handler.ts:61 only verifies when a token is present and nearby's schema has no token field — harmless but suggests the option semantics are confusing (see Security).

## Security notes

- **Turnstile is skippable on every directory route (VERIFIED)**: handler.ts:60-63 verifies only `if (opts.requireTurnstile !== false && maybeToken)` — a bot that **omits** `turnstileToken` entirely bypasses verification, because `reviewSchema`/`submissionSchema` declare the token `.optional()` (community/schemas.ts:110, 140) and `parkingReportSchema` has no token field at all. Contrast: lead/application schemas require it (`api/schemas.ts:25`, used at :44, :73, :84). So directory review/submission/parking-report writes are protected only by the 5-6/min/IP in-memory limiter (multi-instance-weak, fails open) plus honeypot. Turnstile.ts's claim "Every public write route calls this before touching the database" (turnstile.ts:4-5) is false for these routes. **This is the biggest finding of the subsystem.**
- Service-role client used directly in public unauthenticated routes (review/route.ts:24, submission/route.ts:26, parking-report/route.ts:38, view/route.ts:74) — blast radius is contained by code discipline (insert-only, `status:'pending'`, parking-report `.strict()` schemas rejecting extra keys, parking-report.ts:60-64), not by DB privileges. Any future bug in these handlers runs with RLS bypassed.
- Good hygiene verified: coordinates never logged/stored (nearby/route.ts:13-17 and nothing in the code path logs them); view route stores nothing but a daily counter (view/route.ts:7-15); header-forgery stripping in parking-report free text (parking-report.ts:119-126); generic 500s without internals (handler.ts:70); structured logger keeps PII out (logger.ts:3, routes log only ids/codes, e.g. review/route.ts:51,55).
- `sec-fetch-site` filter on view (view/route.ts:49-52) passes requests that omit the header — fine for old clients, trivially bypassed by curl; correctly treated as bot-noise-reduction only.
- Netlify sets baseline security headers site-wide (netlify.toml headers block), no CSP.

## Open questions

1. Is the missing-required-Turnstile on directory review/submission/parking-report intentional (friction tradeoff for the ~100-driver test cohort, per parking-report.ts:4-5) or an oversight? The lead/application routes require it; the directory routes don't.
2. What does the middleware's `getUser()` actually cost on Netlify for cookie-less anonymous traffic — is there any network call in @supabase/ssr 0.5.1's no-session path? (Measurement needed before claiming the matcher change is a latency win.)
3. Does Netlify's Next runtime keep warm instances long enough for the in-memory limiter to hold state across the typical attack window, and what is the practical concurrency multiplier on the 5/min limits?
4. Is `record_directory_view` (view/route.ts:75) rate-bounded DB-side (e.g., unique daily row + atomic increment per migration 025), or is the in-memory limiter the only flood control before the write? (Migration SQL not in this subsystem's scope; the function is described but not read here.)
5. Whether a request-body size cap should be enforced app-side (guardedPost) rather than relying on the platform payload limit — relevant to all 10 guarded routes.