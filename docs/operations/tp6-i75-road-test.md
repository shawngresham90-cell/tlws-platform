# TP-6 — I-75 Road-Test Protocol (Dalton → Atlanta → Macon)

One controlled run, one tester, one truck. The goal is evidence, not a
demo: did the planner's predictions match the road? Everything you record
stays on your phone, scrubbed of anything private, until you deliberately
copy the summary out.

**THE ONE SAFETY RULE, ABOVE EVERYTHING BELOW: never touch the phone
while the vehicle is moving. Every observation in this protocol is
entered while safely parked. If a step can't be done parked, skip it —
an incomplete test is a result; a distracted driver is not.**

If a **safety-critical defect** appears — a route obviously wrong for a
truck, an HOS cutoff that is wrong, parking offered where trucks are
prohibited — **stop the field test**, note what happened, and do not
continue just to finish this script.

---

## 0. Arm road-test mode (once, at home)

1. Open the Navigator (`/drive`) with your pilot access.
2. On the idle screen, find **Road test mode** → tap **Arm road test
   mode**. (This device only. Disarm the same way after the trip.)
3. Open the Trip Planner (`/trip-planner`) and confirm the **Road test
   (pilot)** panel appears at the bottom of the page.

## 1. Before departure (parked, at origin)

- [ ] Confirm the production site version (footer/build — should be the
      current deploy, not a preview URL).
- [ ] Truck profile confirmed in the Navigator (real dimensions/weight).
- [ ] Current clocks entered in the Navigator — exactly what your ELD
      shows. TLWS is a planning aid, not an ELD; your ELD stays the
      authority all day.
- [ ] In the Trip Planner: origin **Dalton, GA**, destination
      **Macon, GA**, via **Atlanta, GA**.
- [ ] Planned time at the Atlanta stop set to your real expected dwell.
      Answer the 30-minute-break question from what your ELD duty status
      will actually be — choose **No** if unsure.
- [ ] Safety buffer at the default **60 min**.
- [ ] Read the disclaimer line ("Planning aid only…") and acknowledge it
      applies all day.
- [ ] In the road-test panel: tap **Road Test Started**.

## 2. Dalton — create the plan (parked)

- [ ] Tap **Plan My Day** and read Your Trip Plan top to bottom.
- [ ] Note (Short observation) anything surprising in the plan itself.
- [ ] Note which clock the plan says limits the day (shown as
      "Limited by" — e.g. 11-hour / 14-hour / 30-minute-break / cycle).
- [ ] Pick your parking stop and tap **Send to Navigator**. This also
      captures the plan evidence (why that stop ranked where it did)
      into the road-test session automatically.
- [ ] Before driving: in the Navigator, confirm the planned stop is
      offered ("Your planned stop") and accept it.

Drive. Phone down.

## 3. Atlanta / via (parked at your Atlanta stop)

- [ ] Compare the plan's predicted via arrival to your actual arrival
      and record **ETA vs actual arrival** (pick the bucket).
- [ ] When you leave, compare your REAL time stopped against what you
      planned; put the comparison in a Short observation (e.g. "planned
      60m, actual closer to 90m").
- [ ] Note whether the plan's break treatment matched what your ELD
      actually logged for this stop (the planner only knows what you told
      it — this checks whether that question was answerable honestly).
      Do **not** expect TLWS to infer your duty status; it never will.

## 4. Parking (parked at — or as near as you got to — the chosen stop)

Record **Parking outcome** (one chip):

- `available` — you parked where the plan said
- `full` — real lot, no space
- `closed` — location closed
- `trucks-prohibited` — trucks not allowed despite the plan offering it
  (**safety-critical: stop the test and note details**)
- `access-difficult` — reachable but entrance/signage/geometry hostile
- `not-found` — location isn't where the record says
- `info-inaccurate` — there, but the record's details were wrong
- `not-tested` — you didn't attempt it

Also record:

- [ ] **60-minute buffer felt**: too-early / about-right / too-late.
- [ ] **Navigator handoff worked**: yes / no (was the planned stop
      offered, understandable, and correct when you needed it?).
- [ ] Short observation: overnight signage vs the plan's overnight
      status; whether one of the OTHER displayed choices would have been
      better, and why.

Your observations are evidence for later review — they never change the
parking directory by themselves.

## 5. Next morning / after the stop (parked)

- [ ] Open the Trip Planner. Confirm the **Continue your trip** card is
      there: From = your stop, To = Macon.
- [ ] Confirm it demands updated clocks and offers no continue button
      until you've re-entered them in the Navigator.
- [ ] Enter your current clocks (from your ELD) in the Navigator.
- [ ] Back in the planner: tap **Continue with my updated clocks**.
- [ ] Verify: origin is your stop, destination is Macon, and Atlanta
      (already passed) is **not** back in the plan — and its dwell is not
      charged again.
- [ ] Verify the new plan is a fresh quote — nothing from yesterday's
      arithmetic (limits, cutoffs, margins) should appear anywhere.
- [ ] Record **Resume after stop worked**: yes / no.

Drive. Phone down.

## 6. Macon — finish (parked)

- [ ] On arrival, complete the trip in the Navigator (or, if you didn't
      navigate this leg, tap **End Trip** on any remaining resume card).
- [ ] Confirm the Continue-your-trip card is gone.
- [ ] In the road-test panel: add any final Short observations, tap
      **Copy evidence summary**, and paste it somewhere safe (issue,
      email to yourself). The summary is scrubbed — coordinates and
      secret-shaped text are removed on the way out.
- [ ] Tap **End road test**, and disarm road-test mode in the Navigator.

## Failure checklist — stop conditions

Stop the test (and write a Short observation) if any of these occur:

- route obviously wrong for a truck
- HOS cutoff plainly incorrect vs your ELD
- parking marked usable where trucks are prohibited
- Navigator loses the planned stop before you get there
- resume shows or reuses yesterday's HOS numbers
- via dwell charged twice, or a passed via reappears
- destination lost across a reload
- any mobile UI state that blocks safe, parked use

Non-safety oddities (a mislabeled amenity, a clumsy wording, an ETA a
bucket off): record and continue.

## What this test never does

No GPS trail, no exact coordinates, no exact clock values, no identity,
no ELD data leaves the device or is even stored. Buckets and categories
only. TLWS remains a planning aid; the ELD, posted signs, and your
judgment control the day.
