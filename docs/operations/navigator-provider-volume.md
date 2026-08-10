# Navigator — Provider Call Volume

**How many routing transactions the pilot generates, and where the
documented allowance runs out.**

No dollar amounts appear anywhere in this document or in the model behind
it. Pricing is a contract term that changes without notice and is not
readable from this repository; a number invented here would be quoted back
later as if it had been checked.

Everything below is computed by `src/lib/navigator/provider-volume.ts` and
pinned by `scripts/test-navigator-provider-volume.ts`, which also asserts
that the caps quoted here still match the code they came from.

---

## The one number that matters

| | Drivers the documented free allowance supports |
|---|---|
| **Under ordinary driving** | **42** |
| **If every driver spends the hourly reroute rail for every hour driven** | **3** |

The gap between 42 and 3 is what the reroute budgets are buying — and how
much of it is left. It is also the honest answer to "what happens if a
reroute defect ships": the blast radius is bounded, but at three drivers'
worth of allowance, not at a comfortable margin.

**Wave 1 is 2–3 drivers.** That sits at **7% of the allowance** under
ordinary driving and **82% in the worst case the code permits** — inside
both, but the worst case has almost no room left. The volume question does
not gate Wave 1; a **fourth driver crosses the worst case**, which is one
more reason the wave gate caps it at three.

> ### ⚠ Correction, same session
>
> An earlier version of this model used `maxPerSession` (12) as the
> per-trip ceiling and published **8 drivers** as the worst case. That was
> wrong. The state-combination harness established that `sessionCount` is
> incremented in exactly one place — on the **success** path — so a trip
> that never gets a usable route never advances it, and the only rail
> bounding provider calls is `maxPerHour`.
>
> The two budgets are different rails, not two versions of the same one:
> **`maxPerSession` caps route churn, `maxPerHour` caps spend.** A spend
> model has to use the spend rail, which makes the ceiling scale with
> **trip length**. The corrected figure is **3**.

---

## The assumptions — argue with these, not with the arithmetic

The interesting part of a volume model is never the multiplication. Each
default is defended; each is a caller-replaceable argument.

| Assumption | Default | Why |
|---|---|---|
| Trips per driver per day | **2** | A run out and a run back, or two deliveries. Six stops a day is a different product and needs its own model. |
| Driving days per month | **22** | A working month with weekends off. Deliberately not 30 — a model that assumes every day is a driving day flatters itself. |
| Destinations entered per trip | **1.5** | Most trips have one; some are re-entered because the first result was the wrong one of two similarly-named places. |
| Search calls per destination | **4** | `"walm"` … `"walmart d"` … `"walmart dc dal"`. Typeahead is debounced on the client, but a driver typing a warehouse name still fires several calls before tapping a result. |
| Route plans per trip | **1.2** | One plan, plus the occasional re-plan before pulling out. |
| **Reroutes per trip** | **1.5** | A missed turn or a closure on roughly every other trip. **This is the assumption most worth replacing with a measurement** — it scales worst, and it is the one Wave 1 measures directly. |
| Driving hours per trip | **5** | Two trips a day at five hours each is a legal driving day. Used only by the worst case, and it is why the worst case is not a per-trip constant. |
| Failed fraction | **5%** | Provider errors, timeouts, dead-zone transport failures. |

> **These are estimates.** The only honest source for them is Wave 1, which
> has not run. When it does, pass the observed rates into the model and
> re-read the answer rather than rewriting the file.

---

## Expected volume — ordinary driving

Per driver per month: **44 trips, 264 search calls, 118.8 truck
transactions.**

| Drivers | Trips | Search calls | Route plans | Reroutes | **Truck transactions** | % of allowance |
|---:|---:|---:|---:|---:|---:|---:|
| **3** | 132 | 792 | 158 | 198 | **356** | **7.1%** ✅ |
| **10** | 440 | 2,640 | 528 | 660 | **1,188** | **23.8%** ✅ |
| **50** | 2,200 | 13,200 | 2,640 | 3,300 | **5,940** | **118.8%** ❌ |
| **100** | 4,400 | 26,400 | 5,280 | 6,600 | **11,880** | **237.6%** ❌ |

**Truck transactions = route plans + reroutes.** Searches hit a different
provider product with its own quota, which this repository does not
document — see "What this model cannot tell you".

## Worst case — every budget spent, every trip

Not a forecast. This is **the ceiling the code enforces**: one plan per
trip, then the **hourly** reroute rail (6/hour) spent for every hour driven.
Nothing in the app can exceed it without a budget constant changing.

**Search calls are deliberately absent from this table.** They are rate
limited (30/minute/IP) but not capped per trip or per session, so there is
no enforced ceiling to publish — a driver who keeps typing keeps spending.
The model carries a representative high figure for them; it is an estimate,
and it is not quoted as a bound.

| Drivers | Route plans | Reroutes | **Truck transactions** | % of allowance |
|---:|---:|---:|---:|---:|
| **3** | 132 | 3,960 | **4,092** | **81.8%** ✅ |
| **10** | 440 | 13,200 | **13,640** | **272.8%** ❌ |
| **50** | 2,200 | 66,000 | **68,200** | **1,364%** ❌ |
| **100** | 4,400 | 132,000 | **136,400** | **2,728%** ❌ |

**Four drivers is where the ceiling crosses the allowance.** At three it is
inside it with 18% to spare — which is not much, and is exactly the margin
a reroute defect would eat.

---

## The caps that produce these ceilings

All verified against the code by test — if any changes, this document fails
the build.

| Cap | Value | Where |
|---|---|---|
| Route requests | **6 per hour, per IP** | route endpoint limiter |
| Destination searches | **30 per minute, per IP** | search endpoint limiter |
| Reroutes | **6 per hour** (spend rail), **12 per session** (route-churn rail), per driver | `REROUTE_DEFAULTS` |
| Reroute failure backoff | **30 s → 60 s → 120 s** | `REROUTE_DEFAULTS` |
| Adapter live calls | **100 per hour, per warm instance** | routing adapter free-tier guard |
| Documented free truck transactions | **5,000 per month** | the routing adapter's own header |

### Two properties of the code that keep the model honest

**Automatic retries are zero — by construction, not by estimate.** The
reroute controller does not retry a failure. It starts the backoff ladder
and waits for the next *confirmed* off-route state. There is no path in
which a failing provider is hammered, and a test pins that the model's
retry figure is zero for that reason rather than because it was assumed to
be small.

**Transport failures are refunded to the budget.** A request that never
reached the provider costs nothing, so it must not ration a later one that
could succeed.

**The two reroute budgets are different rails.** `maxPerSession` counts
*successful replacements* — its counter increments only on the success path
— so it caps how many times a route may be swapped, not how many calls a
trip may make. `maxPerHour` is the one that caps spend, and it is the one
this model uses. A **known consequence, recorded and not yet fixed**: an
expired pilot session is charged against the budget even though its 401
never reached the provider.

---

## What this model cannot tell you

| | |
|---|---|
| **What any of it costs** | Deliberately absent. Not derivable from this repository. |
| **The search-product quota** | The 5,000/month figure the adapter documents is for **truck transactions**. Destination search uses a different product with a quota this repository does not record. At 100 drivers the model projects **26,400 search calls a month** — enough that the quota is worth establishing before a wave that size, not after. |
| **Whether the per-IP limiters bind per driver** | They do not, reliably. Two drivers behind the same carrier NAT share an IP; one driver moving between towers gets several. The limiters bound abuse, not per-driver fairness. |
| **Cache relief on reroutes** | The adapter caches 24 full routes per warm instance, keyed including avoidances. That helps a driver re-planning the same trip; it does **not** help rerouting, because every replacement has a different origin. Do not assume cache relief on the reroute column. |
| **Real driver behaviour** | Every row above rests on seven estimates. Wave 1 replaces them. |

---

## What to do before each wave

| Before | Do this |
|---|---|
| **Wave 1 (2–3 drivers)** | Nothing. 7% expected, 82% worst case. |
| **A fourth driver** | Re-run the model with the reroutes-per-trip figure Wave 1 actually measured. That single number moves the answer more than the other six combined. |
| **A fourth driver, again** | The worst case crosses the documented allowance at four. Either establish the real allowance with the provider, or accept that a reroute defect at four drivers can exhaust it. |
| **Ten or more** | Establish the real allowance for both products with the provider. |
| **Fifty or more** | Ordinary driving alone exceeds the documented allowance. This is a commercial decision before it is an engineering one. |
