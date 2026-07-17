-- 037_seed_kc_authority_articles.sql
-- Knowledge Center Expansion — first 10 authority pages (HOS + inspections).
--
-- ⚠️ COMMITTED; apply AFTER 015 (the Knowledge Center schema).
-- IDEMPOTENT AND NON-DESTRUCTIVE: every article inserts ONLY when no article
-- with the same (category, slug) exists — a re-run never duplicates, and an
-- existing article with the same slug is NEVER overwritten. kc_related rows
-- insert with ON CONFLICT DO NOTHING.
--
-- Content rules (hard):
--   * Original wording only — no DMV/blog/commercial-course copy.
--   * Every regulatory claim carries an official citation (eCFR / FMCSA /
--     CVSA / CDL manual), and each article's `sources` jsonb lists them.
--   * Federal requirements vs good practice vs examples vs company policy
--     are labeled in the text; examples are not legal advice.
--   * reg_verified = true with reg_verified_date 2026-07-17 (the visible
--     "last reviewed" date), plus an in-body regulatory-change disclaimer.
--   * Slugs are stable identifiers — future edits must reuse them.

do $kc$
declare
  v_hos uuid;
  v_dot uuid;
  v_cdl uuid;
  v_pub timestamptz := '2026-07-17 12:00:00+00';
  v_bio text := 'CDL-A driver and instructor — 17 years driving, zero violations. Founder of Trucking Life with Shawn and the TLWS truck driving school in Dalton, Georgia.';
begin
  select id into v_hos from public.kc_categories where slug = 'hours-of-service';
  select id into v_dot from public.kc_categories where slug = 'dot-compliance';
  select id into v_cdl from public.kc_categories where slug = 'cdl-training';
  if v_hos is null or v_dot is null or v_cdl is null then
    raise exception 'Knowledge Center categories missing (hours-of-service / dot-compliance / cdl-training)';
  end if;

  ---------------------------------------------------------------------------
  -- 1. CDL Hours of Service Rules Explained (pillar page)
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_hos and slug = 'cdl-hours-of-service-rules') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_hos,
      'cdl-hours-of-service-rules',
      'CDL Hours of Service Rules Explained: Every Clock, in Plain English',
      'The federal hours-of-service rules for property-carrying CDL drivers — the 11-hour driving limit, the 14-hour window, the 30-minute break, the 60/70-hour limits, and the exceptions — explained the way a trainer would, with citations to 49 CFR Part 395.',
      $mdx$**Quick answer:** After 10 consecutive hours off duty, a property-carrying driver may drive up to **11 hours** inside a **14-consecutive-hour window**, must take a **30-minute break** before driving past 8 cumulative hours of driving, and may not drive after reaching **60 hours on duty in 7 days** (or **70 in 8 days** for carriers operating every day). The rules live in [49 CFR Part 395](https://www.ecfr.gov/current/title-49/part-395).

**Regulatory-change disclaimer:** Hours-of-service rules change through rulemaking, exemptions, and guidance. This page was last reviewed on **July 17, 2026** against the eCFR. Confirm the current text of 49 CFR Part 395 on [ecfr.gov](https://www.ecfr.gov/current/title-49/part-395) and [FMCSA's HOS summary](https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations) before relying on it. Nothing on this page is legal advice.

## What "hours of service" means

Hours of service (HOS) are the federal limits on when and how long you may drive a commercial motor vehicle (CMV). The Federal Motor Carrier Safety Administration (FMCSA) publishes them in 49 CFR Part 395. Your electronic logging device (ELD) exists to record your duty status against these limits — the limits themselves come from the regulation, not the device.

Every minute of your work day falls into one of four duty statuses: **off duty**, **sleeper berth**, **driving**, and **on duty (not driving)**. Every HOS rule is arithmetic over those four statuses.

## Why the rules exist

Part 395 is a fatigue rule. Driving performance degrades with time behind the wheel and time since real rest, and a loaded combination vehicle leaves no margin for a driver who is asleep at 65 mph. The limits force rest before the fatigue, not after the crash.

## Who must follow these rules

**Federal requirement:** The property-carrier HOS rules apply to drivers of CMVs in interstate commerce, as defined in [49 CFR 390.5](https://www.ecfr.gov/current/title-49/part-390/section-390.5). That generally means:

- vehicles with a gross vehicle weight rating or gross combination weight rating of 10,001 pounds or more
- vehicles placarded for hazardous materials
- certain passenger configurations (passenger carriers follow their own limits in 395.5)

Intrastate-only drivers follow their state's version of the rules — often similar, never guaranteed identical. Check your state.

## The four core limits, step by step

### 1. The 11-hour driving limit

After 10 consecutive hours off duty, you may drive a total of 11 hours. Driving time is time at the controls. Full article: [The 11-Hour Driving Limit](/knowledge/hours-of-service/11-hour-driving-limit). Citation: [49 CFR 395.3(a)(3)](https://www.ecfr.gov/current/title-49/part-395/section-395.3).

### 2. The 14-hour driving window

Once you come on duty after 10 consecutive hours off, a 14-consecutive-hour clock starts. You may not drive after that window closes, no matter how little you drove — breaks and lunches do not stop it. Full article: [The 14-Hour Driving Window](/knowledge/hours-of-service/14-hour-driving-window). Citation: [49 CFR 395.3(a)(2)](https://www.ecfr.gov/current/title-49/part-395/section-395.3).

### 3. The 30-minute break

You may not drive once you have accumulated 8 hours of driving time without at least a 30-minute non-driving interruption. Since the 2020 rule change, on-duty-not-driving time can satisfy the break. Full article: [The 30-Minute Break Rule](/knowledge/hours-of-service/30-minute-break-rule). Citation: [49 CFR 395.3(a)(3)(ii)](https://www.ecfr.gov/current/title-49/part-395/section-395.3).

### 4. The 60/70-hour limits

You may not drive after 60 hours on duty in any 7 consecutive days (carriers that do not operate every day of the week) or 70 hours in 8 consecutive days (carriers that do). Taking 34 or more consecutive hours off duty restarts the 7/8-day calculation. Citation: [49 CFR 395.3(b) and (c)](https://www.ecfr.gov/current/title-49/part-395/section-395.3).

## The flexibilities that sit on top

- **Split sleeper berth** — split your 10 hours off into a 7/3 or 8/2 pairing, with the qualifying periods excluded from the 14-hour window. Full article: [Split Sleeper-Berth Rules](/knowledge/hours-of-service/split-sleeper-berth-rules). Citation: [49 CFR 395.1(g)](https://www.ecfr.gov/current/title-49/part-395/section-395.1).
- **Adverse driving conditions** — up to 2 extra hours of driving time and window when you hit weather or road conditions you could not have known about before dispatch. Citation: [49 CFR 395.1(b)(1)](https://www.ecfr.gov/current/title-49/part-395/section-395.1).
- **Short-haul exception** — drivers who stay within a 150 air-mile radius and meet the return-to-base and 14-hour conditions of [49 CFR 395.1(e)(1)](https://www.ecfr.gov/current/title-49/part-395/section-395.1) can run without ELDs or the 30-minute break.
- **Personal conveyance** and **yard moves** — two ELD driving categories that move the truck without spending your driving clocks the same way. Full articles: [Personal Conveyance Explained](/knowledge/hours-of-service/personal-conveyance) and [Yard Move Explained](/knowledge/hours-of-service/yard-move).

## A compliant day, worked example

**Example (illustration, not legal advice):** You had a full 10-hour break and come on duty at 05:00 for a pre-trip inspection. Your 14-hour window runs 05:00–19:00.

- 05:00–06:00 — on duty, pre-trip and paperwork (1 window hour used, 0 driving)
- 06:00–10:00 — drive 4 hours (4 of 11 used)
- 10:00–10:30 — 30-minute break (satisfies the break rule before you reach 8 cumulative driving hours)
- 10:30–14:30 — drive 4 more hours (8 of 11 used)
- 14:30–15:30 — on duty, unload (no driving)
- 15:30–18:30 — drive 3 hours (11 of 11 used)

At 18:30 the driving limit is exhausted, half an hour before the window closes at 19:00. Every number above checks out against 395.3: 11 driving, inside 14, break taken before the ninth cumulative driving hour.

## Common mistakes

- Treating the 14-hour window like a driving clock that pauses for lunch — it never pauses (only qualifying sleeper-berth periods are excluded).
- Assuming on-duty work after the 14th hour is a violation — it is not; only **driving** past the limits is prohibited, though the on-duty time still counts against 60/70.
- Confusing the 8-hour break trigger (cumulative **driving** hours) with 8 hours since the shift started.
- Running a 34-hour restart when the 60/70 math did not require one — the restart is optional recovery, not a weekly obligation.
- Copying another driver's interpretation of a carrier policy as if it were the federal rule. **Company policies can be stricter than Part 395 — they can never make Part 395 looser.**

## Violations and compliance risks

HOS compliance is checked at roadside inspections and during carrier investigations, using your ELD records. Violations are recorded on the inspection report, feed the FMCSA Safety Measurement System scores that follow both driver and carrier, and can result in a driver being placed out of service under the CVSA North American Standard Out-of-Service Criteria until enough off-duty time passes. For current enforcement specifics, rely on [FMCSA](https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations) and [CVSA](https://www.cvsa.org/inspections/all-inspection-levels/) — not forum lore.

## Driver checklist

- Know your four clocks before you turn the key: driving hours left, window hours left, cumulative driving since your last 30-minute break, and 60/70 hours left.
- Log your duty status changes as they happen, not at the end of the day.
- Plan the 30-minute break into the trip instead of donating it to a shipper's dock line.
- Before using a flexibility (split berth, adverse conditions, personal conveyance), be able to say which rule allows it and where it is written.
- When your ELD and your memory disagree, investigate immediately — see [ELD Malfunctions and What Drivers Must Do](/knowledge/hours-of-service/eld-malfunctions).

## Keep learning

- Deep dives: [11-hour limit](/knowledge/hours-of-service/11-hour-driving-limit) · [14-hour window](/knowledge/hours-of-service/14-hour-driving-window) · [30-minute break](/knowledge/hours-of-service/30-minute-break-rule) · [split sleeper](/knowledge/hours-of-service/split-sleeper-berth-rules) · [personal conveyance](/knowledge/hours-of-service/personal-conveyance) · [yard moves](/knowledge/hours-of-service/yard-move) · [ELD malfunctions](/knowledge/hours-of-service/eld-malfunctions)
- Getting inspected: [Level 1 DOT Inspection Explained](/knowledge/dot-compliance/level-1-dot-inspection)
- Test yourself free: the [CDL General Knowledge practice test](/practice-tests/general-knowledge) covers hours-of-service questions, and the [practice test hub](/practice-tests) has every bank.
- Watch: [FMCSA Just Changed DOT Inspections](https://youtu.be/UlW-GlLugUg) on the Trucking Life with Shawn YouTube channel.
- **Want a career built on doing this right?** [Train with us at the TLWS Academy](/academy), start free with [CDL Pre-School](/cdl-pre-school), or [join the email list](/#newsletter) for new guides as they publish.$mdx$,
      'CDL Hours of Service Rules Explained (49 CFR 395) | Trucking Life with Shawn',
      'The CDL hours-of-service rules in plain English: 11-hour limit, 14-hour window, 30-minute break, 60/70-hour caps — with eCFR citations and worked examples.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR Part 395 — Hours of Service of Drivers (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395"},
        {"label":"49 CFR 395.3 — Maximum driving time for property-carrying vehicles (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395/section-395.3"},
        {"label":"49 CFR 395.1 — Scope and exceptions (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395/section-395.1"},
        {"label":"49 CFR 390.5 — Definitions (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-390/section-390.5"},
        {"label":"FMCSA — Summary of Hours of Service Regulations","url":"https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations"}
      ]$j$::jsonb,
      $j$[
        {"q":"How many hours can a CDL driver legally drive in one day?","a":"A property-carrying driver may drive up to 11 hours after 10 consecutive hours off duty, and only within 14 consecutive hours of coming on duty (49 CFR 395.3). Weekly 60/70-hour limits apply on top of the daily clocks."},
        {"q":"Does the 14-hour window pause for breaks or lunch?","a":"No. The 14-hour window runs continuously from when you come on duty after 10 hours off. The only time excluded from it is a qualifying split-berth pairing under 49 CFR 395.1(g) — neither the 7+ hour sleeper period nor its paired 2+ hour period counts against the window."},
        {"q":"What is the difference between the 60-hour and 70-hour rule?","a":"They are the same rule with two schedules: 60 on-duty hours in 7 days applies at carriers that do not operate vehicles every day of the week; 70 hours in 8 days applies at carriers that do. Your carrier tells you which schedule it runs under."},
        {"q":"Is the 34-hour restart mandatory?","a":"No. The restart in 49 CFR 395.3(c) is an optional way to reset the 60/70-hour calculation by taking 34 or more consecutive hours off duty. Without it, hours simply roll off on the normal 7/8-day window."},
        {"q":"Do local and intrastate drivers follow these same rules?","a":"Interstate CMV drivers follow 49 CFR Part 395, and short-haul drivers may use the 150 air-mile exception in 395.1(e). Drivers operating only within one state follow that state's adopted rules, which are often similar but set by state law — verify with your state agency."}
      ]$j$::jsonb,
      '{hours-of-service,fmcsa,eld,11-hour,14-hour,30-minute-break}',
      9, true, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 2. The 11-Hour Driving Limit
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_hos and slug = '11-hour-driving-limit') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_hos,
      '11-hour-driving-limit',
      'The 11-Hour Driving Limit: What Counts, What Doesn''t, and How to Plan It',
      'How the federal 11-hour driving limit in 49 CFR 395.3 actually works for property-carrying CDL drivers — what counts as driving time, how it interacts with the 14-hour window and the 30-minute break, with worked examples.',
      $mdx$**Quick answer:** After 10 consecutive hours off duty, you may drive a commercial motor vehicle for a total of **11 hours**. The limit counts **driving time only** — time at the controls — not your whole work day. It resets only after another 10 consecutive hours off (or a qualifying sleeper-berth split). Citation: [49 CFR 395.3(a)(3)(i)](https://www.ecfr.gov/current/title-49/part-395/section-395.3).

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026** against the eCFR. Rules change — confirm the current text of [49 CFR 395.3](https://www.ecfr.gov/current/title-49/part-395/section-395.3) and [FMCSA's HOS summary](https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations) before relying on this page. This is education, not legal advice.

## What the 11-hour limit is

The 11-hour limit is the federal cap on total driving time between qualifying rest periods for property-carrying drivers. "Driving time" is defined in [49 CFR 395.2](https://www.ecfr.gov/current/title-49/part-395/section-395.2) as all time spent at the driving controls of a CMV in operation. Your ELD records it automatically whenever the vehicle is in motion above the recording threshold.

Three things it is **not**:

- It is not a shift length — that is the [14-hour window](/knowledge/hours-of-service/14-hour-driving-window).
- It is not a per-calendar-day allowance — it is per rest cycle.
- It does not include loading, fueling, inspections, or paperwork — those are on-duty (not driving) and burn the window and the [60/70-hour totals](/knowledge/hours-of-service/cdl-hours-of-service-rules) instead.

## Why the rule exists

Crash risk climbs with continuous hours behind the wheel. Capping driving time — separately from total work time — targets the specific fatigue that comes from sustained vehicle control, which is why the driving cap (11) is tighter than the duty window (14).

## Who it applies to

**Federal requirement:** Drivers of property-carrying CMVs in interstate commerce under [49 CFR Part 395](https://www.ecfr.gov/current/title-49/part-395). Passenger-carrying drivers have a 10-hour driving limit under 395.5 instead. Intrastate-only drivers follow their state's adopted version.

## How the clock works, step by step

- **Step 1 — earn it.** Take 10 consecutive hours off duty (off duty, sleeper berth, or a combination). You now have 11 hours of driving available.
- **Step 2 — spend it in any pattern.** The 11 hours do not need to be continuous. Four driving blocks separated by dock time all draw from the same 11.
- **Step 3 — respect the break trigger.** Once you accumulate 8 hours of driving without a 30-minute interruption, you cannot drive again until you take one — see [The 30-Minute Break Rule](/knowledge/hours-of-service/30-minute-break-rule).
- **Step 4 — stay inside the window.** All 11 driving hours must fit inside the 14-hour window. Late in the day, whichever clock has less time left is the one that controls.
- **Step 5 — reset.** Another 10 consecutive hours off restores the full 11. A [7/3 or 8/2 sleeper split](/knowledge/hours-of-service/split-sleeper-berth-rules) recalculates it differently.

## Worked example

**Example (illustration, not legal advice):** Off duty until 06:00, then on duty.

- 06:00–10:00 — drive 4 h (4 of 11 used; 4 cumulative toward the break trigger)
- 10:00–10:30 — 30-minute break (break clock resets to zero)
- 10:30–14:30 — drive 4 h (8 of 11 used)
- 14:30–15:00 — on duty at a receiver (no driving; this 30-minute non-driving period also would have satisfied the break rule)
- 15:00–18:00 — drive 3 h (**11 of 11 used**)

At 18:00 you are done driving. Your window (06:00 + 14 = 20:00) still has 2 hours in it — you may legally do paperwork or fuel someone else's tank, but the truck does not move with you at the wheel.

## Common mistakes

- Believing a nap "gives hours back." Short rest is good practice, but nothing under 10 hours (or a qualifying split-berth pairing) restores driving time.
- Chasing the 11 when the 14 controls. If the window closes at 20:00, driving time left after 19:00 is 1 hour — no matter what the driving clock says.
- Forgetting that adverse driving conditions under [49 CFR 395.1(b)(1)](https://www.ecfr.gov/current/title-49/part-395/section-395.1) allow up to 2 extra driving hours only for conditions you could not have known about at dispatch — routine congestion does not qualify.
- Letting a yard hostler shift count wrong: moving a CMV on public roads is driving time; a proper [yard move](/knowledge/hours-of-service/yard-move) inside a terminal is on-duty (not driving).

## Violations and compliance risks

Driving past the 11th hour is an hours-of-service violation, documented from your ELD data like any other. The record-keeping, safety-score, and out-of-service consequences work as described in [our HOS guide's violations section](/knowledge/hours-of-service/cdl-hours-of-service-rules); for current enforcement specifics, go to [FMCSA](https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations), not the driver's lounge.

## Driver checklist

- Before departing, say out loud: driving hours left, window hours left, hours until the break trigger.
- Plan the day so the last driving block ends with margin — arriving with 0:00 on the clock means one detour makes you illegal.
- Log dock time as on duty (not driving) so your driving clock reflects reality.
- If weather forces you past 11, annotate the adverse-conditions exception at the time, not at the scale house.
- Recheck your clocks after every status change; do not trust end-of-day memory.

## Keep learning

- The rest of the system: [CDL Hours of Service Rules Explained](/knowledge/hours-of-service/cdl-hours-of-service-rules) · [The 14-Hour Driving Window](/knowledge/hours-of-service/14-hour-driving-window) · [The 30-Minute Break Rule](/knowledge/hours-of-service/30-minute-break-rule) · [Split Sleeper-Berth Rules](/knowledge/hours-of-service/split-sleeper-berth-rules)
- Drill it: the free [General Knowledge practice test](/practice-tests/general-knowledge) includes hours-of-service questions with citations.
- **Building your CDL career?** [Apply to the TLWS Academy](/academy) or start free with [CDL Pre-School](/cdl-pre-school) — and [get new guides by email](/#newsletter).$mdx$,
      'The 11-Hour Driving Limit Explained (49 CFR 395.3) | Trucking Life with Shawn',
      'The CDL 11-hour driving limit: what counts as driving time, how it interacts with the 14-hour window and 30-minute break, plus worked examples.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR 395.3 — Maximum driving time for property-carrying vehicles (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395/section-395.3"},
        {"label":"49 CFR 395.2 — Definitions, including driving time (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395/section-395.2"},
        {"label":"49 CFR 395.1 — Adverse driving conditions and other exceptions (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395/section-395.1"},
        {"label":"FMCSA — Summary of Hours of Service Regulations","url":"https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations"}
      ]$j$::jsonb,
      $j$[
        {"q":"Does the 11-hour limit include loading and unloading time?","a":"No. Loading, unloading, fueling, and inspections are on-duty (not driving) time. They count against the 14-hour window and the 60/70-hour limits, but not against the 11 hours of driving time defined in 49 CFR 395.2 and capped by 395.3."},
        {"q":"Can I split my 11 hours of driving across the day?","a":"Yes. The 11 hours can be used in any number of separate driving blocks, as long as all driving fits inside the 14-hour window and you honor the 30-minute break rule after 8 cumulative driving hours."},
        {"q":"What happens to my driving hours after a 2-hour nap?","a":"Nothing changes. Rest periods shorter than 10 consecutive hours do not restore driving time unless they qualify under the sleeper-berth split in 49 CFR 395.1(g) — at least 7 hours in the sleeper paired with a second period of at least 2 hours, the two periods totaling at least 10 hours."},
        {"q":"Can I drive 11 hours every single day?","a":"Only until the weekly limit stops you: you may not drive after 60 hours on duty in 7 days or 70 in 8 days under 49 CFR 395.3(b). Daily maximum driving usually hits the weekly ceiling before the week ends."}
      ]$j$::jsonb,
      '{hours-of-service,11-hour,driving-time,fmcsa}',
      7, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 3. The 14-Hour Driving Window
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_hos and slug = '14-hour-driving-window') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_hos,
      '14-hour-driving-window',
      'The 14-Hour Driving Window: The Clock That Never Pauses',
      'The 14-hour rule in 49 CFR 395.3(a)(2) explained for CDL drivers: when the window starts, why breaks don''t stop it, what you can still do after it closes, and the sleeper-berth exception that pauses it.',
      $mdx$**Quick answer:** When you come on duty after 10 or more consecutive hours off, a **14-consecutive-hour window** opens. You may not drive a CMV after it closes — and it does **not pause** for breaks, meals, or dock time. Only the qualifying periods of a sleeper-berth split are excluded — both of them, the 7+ hour sleeper period and its 2+ hour partner. Non-driving work after the 14th hour is allowed. Citation: [49 CFR 395.3(a)(2)](https://www.ecfr.gov/current/title-49/part-395/section-395.3).

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026** against the eCFR. Confirm the current [49 CFR 395.3](https://www.ecfr.gov/current/title-49/part-395/section-395.3) and the [FMCSA HOS summary](https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations) before relying on it. Not legal advice.

## What the 14-hour window is

The 14-hour rule is a **driving eligibility window**, not a work limit. From the moment you first go on duty after a full 10-hour break, you have 14 consecutive clock hours during which driving is permitted (subject to the [11-hour driving limit](/knowledge/hours-of-service/11-hour-driving-limit) and the [30-minute break rule](/knowledge/hours-of-service/30-minute-break-rule)). At hour 14, driving eligibility ends — wherever you are.

The window is measured in consecutive real-world hours. A two-hour lunch, three hours in a dock door, a fuel stop — all of it consumes the window while it burns none of your driving time.

## Why the rule exists

Fatigue tracks time-since-rest, not just time-at-the-wheel. A driver who started at 05:00 is a very different driver at 21:00 even if half the day was spent waiting. The window caps how deep into a duty day any driving can occur, which is why it deliberately refuses to pause.

## Who it applies to

**Federal requirement:** Property-carrying CMV drivers in interstate commerce ([49 CFR Part 395](https://www.ecfr.gov/current/title-49/part-395)). Passenger carriers use a 15-hour on-duty rule that works differently (395.5). Short-haul drivers using the 150 air-mile exception have their own window conditions in [395.1(e)](https://www.ecfr.gov/current/title-49/part-395/section-395.1).

## How the window works, step by step

- **Step 1 — the trigger.** The window starts the first time you go on duty (any on-duty status) after at least 10 consecutive hours off. A 04:45 pre-trip starts the window at 04:45 — not when the wheels first roll.
- **Step 2 — simple arithmetic.** Start time + 14 hours = the last moment you may legally be driving. On duty at 05:30 means no driving after 19:30.
- **Step 3 — nothing ordinary stops it.** Off-duty lunch, waiting at a shipper, a nap in the bunk shorter than a qualifying split period — the window keeps running through all of it.
- **Step 4 — one real exception.** Under the split-berth rule of [49 CFR 395.1(g)](https://www.ecfr.gov/current/title-49/part-395/section-395.1), **both qualifying periods** — the 7+ hour sleeper-berth period and its paired 2+ hour period (off duty, sleeper, or both) — are **excluded** from the window calculation. That exclusion is the split's whole power. Details: [Split Sleeper-Berth Rules](/knowledge/hours-of-service/split-sleeper-berth-rules).
- **Step 5 — after the window.** You may not drive, but you may legally perform on-duty (not driving) work — paperwork, supervising loading. That time still feeds the 60/70-hour totals.
- **Step 6 — adverse conditions.** Weather or road conditions unknowable at dispatch allow up to 2 extra hours of driving time, and the window extends with it, under [49 CFR 395.1(b)(1)](https://www.ecfr.gov/current/title-49/part-395/section-395.1).

## Worked example

**Example (illustration, not legal advice):** On duty 05:00 after a full reset. Window closes 19:00.

- 05:00–06:00 — pre-trip and dispatch (1 window hour gone, 0 driving)
- 06:00–09:00 — drive 3 h
- 09:00–12:00 — held at a receiver (3 window hours gone, 0 driving)
- 12:00–12:30 — 30-minute break
- 12:30–18:30 — drive 6 h (9 of 11 driving used)

At 18:30 you have 2 driving hours left on the 11 — but only 30 minutes of window. **19:00 ends the day's driving**, with 2 driving hours stranded. That is the window doing exactly what it was designed to do; the fix is planning dock time, not arguing with the clock.

## Common mistakes

- Logging a long lunch off duty and assuming it extended the day. It never does — only the qualifying periods of a split-berth pairing are excluded, and an ordinary lunch is neither of them.
- Starting the window with a "quick" yard task at 04:00, then wondering where the afternoon went. The first on-duty minute opens the window, however trivial the task.
- Confusing "can't drive" with "can't work." Driving past hour 14 is the violation; finishing paperwork is not.
- Using the adverse-conditions extension for ordinary rush hour. The condition must have been unknowable when you were dispatched.
- Planning a day where the last leg needs every remaining minute. Detention happens; leave margin.

## Violations and compliance risks

Driving after the 14th hour is an HOS violation with the same recording, scoring, and out-of-service consequences covered in [our HOS guide's violations section](/knowledge/hours-of-service/cdl-hours-of-service-rules). One wrinkle unique to this rule: because the window is unforgiving of detention, it is the violation drivers most often talk themselves into "just this once" — verify enforcement specifics with [FMCSA](https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations), and plan the day instead.

## Driver checklist

- Note your window-close time the moment you go on duty; write it somewhere you can see it.
- Count every planned stop as window spend: fuel, meals, docks.
- If a shipper burns your morning, recalculate the whole day before you leave the lot.
- Know before the trip whether a sleeper split will be part of the plan — it is far easier to plan a split than to rescue a day with one.
- Never let "just 15 more minutes" put driving past the close — the ELD already knows.

## Keep learning

- The rest of the system: [CDL Hours of Service Rules Explained](/knowledge/hours-of-service/cdl-hours-of-service-rules) · [The 11-Hour Driving Limit](/knowledge/hours-of-service/11-hour-driving-limit) · [Split Sleeper-Berth Rules](/knowledge/hours-of-service/split-sleeper-berth-rules) · [Personal Conveyance Explained](/knowledge/hours-of-service/personal-conveyance)
- Quiz yourself: hours-of-service questions live in the free [General Knowledge practice test](/practice-tests/general-knowledge).
- **Learn this hands-on:** [TLWS Academy](/academy) teaches trip planning around real clocks — or start free with [CDL Pre-School](/cdl-pre-school). New guides land on [the email list](/#newsletter) first.$mdx$,
      'The 14-Hour Driving Window Explained (49 CFR 395.3) | Trucking Life with Shawn',
      'The CDL 14-hour rule: when the window starts, why breaks never pause it, the sleeper-berth exclusion, and what''s legal after hour 14 — with eCFR citations.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR 395.3 — Maximum driving time for property-carrying vehicles (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395/section-395.3"},
        {"label":"49 CFR 395.1 — Sleeper berths, adverse conditions, short-haul (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395/section-395.1"},
        {"label":"FMCSA — Summary of Hours of Service Regulations","url":"https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations"}
      ]$j$::jsonb,
      $j$[
        {"q":"Does off-duty time stop the 14-hour clock?","a":"No. Ordinary off-duty time — meals, waiting, short naps — counts against the 14-hour window. The only time excluded is a qualifying split-berth pairing under 49 CFR 395.1(g), where both the 7+ hour sleeper period and the paired 2+ hour period stay out of the window math."},
        {"q":"Can I keep working after my 14 hours are up?","a":"Yes, as long as you do not drive a CMV. On-duty (not driving) work after the window closes is legal under 49 CFR 395.3, but it still counts toward your 60/70-hour limit and delays your next 10-hour break."},
        {"q":"When exactly does the 14-hour window start?","a":"At your first on-duty activity after 10 or more consecutive hours off duty — a pre-trip inspection, paperwork, anything on duty. It does not wait for the first mile driven."},
        {"q":"Can the 14-hour window ever be extended?","a":"Two ways: the adverse driving conditions exception in 49 CFR 395.1(b)(1) allows up to 2 additional hours when conditions could not have been known at dispatch, and the two qualifying periods of a sleeper-berth split are excluded from the window under 49 CFR 395.1(g)."}
      ]$j$::jsonb,
      '{hours-of-service,14-hour,driving-window,fmcsa}',
      7, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 4. The 30-Minute Break Rule
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_hos and slug = '30-minute-break-rule') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_hos,
      '30-minute-break-rule',
      'The 30-Minute Break Rule After the 2020 Change: Who Needs It and What Counts',
      'The CDL 30-minute break rule in 49 CFR 395.3(a)(3)(ii): triggered by 8 cumulative hours of driving, satisfied by any 30-minute non-driving period — including on-duty time — since the 2020 rule change.',
      $mdx$**Quick answer:** You may not drive once you have accumulated **8 hours of driving time** without at least a **30-consecutive-minute interruption**. Since the September 2020 rule change, the break can be **off duty, sleeper berth, or on duty (not driving)** — it just cannot be driving. It is a break from *driving*, not necessarily from work. Citation: [49 CFR 395.3(a)(3)(ii)](https://www.ecfr.gov/current/title-49/part-395/section-395.3).

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026** against the eCFR. The break rule is exactly the kind of provision that changes — it already did once in 2020. Confirm the current [49 CFR 395.3](https://www.ecfr.gov/current/title-49/part-395/section-395.3) and the [FMCSA HOS summary](https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations) before relying on it. Not legal advice.

## What the rule says

The trigger is **cumulative driving hours**: once your driving time since your last 30-minute (or longer) non-driving interruption reaches 8 hours, further driving is prohibited until you take one. Two details drivers most often get wrong:

- The 8 hours are **driving hours**, not hours since your shift started.
- The 30 minutes must be **consecutive** — three 10-minute stops reset nothing.

## Why the rule exists

Sustained continuous driving degrades attention even when total daily hours are legal. A required interruption near the middle of a long driving stretch is a cheap, targeted counter to that specific risk — which is also why the 2020 revision let *any* non-driving activity qualify: the safety value is in being out from behind the wheel.

## Who it applies to

**Federal requirement:** Property-carrying CMV drivers subject to [49 CFR Part 395](https://www.ecfr.gov/current/title-49/part-395). Notable exception: drivers operating under the **150 air-mile short-haul exception** in [49 CFR 395.1(e)(1)](https://www.ecfr.gov/current/title-49/part-395/section-395.1) are not subject to the break requirement. Passenger-carrying drivers are not subject to this provision either — it lives in the property-carrier section.

## How it works, step by step

- **Step 1 — watch one number.** Your ELD tracks driving time since your last 30-minute non-driving interruption. When it approaches 8:00, a break is due before any more driving.
- **Step 2 — take any qualifying 30 minutes.** Off duty in the bunk, lunch in the cab, sleeper time, or on-duty non-driving work (a dock check, paperwork, fueling supervision) — 30 consecutive minutes of any of them satisfies the rule.
- **Step 3 — the counter resets.** After the interruption, you have a fresh 8 hours of driving available (still capped by the [11-hour limit](/knowledge/hours-of-service/11-hour-driving-limit) and [14-hour window](/knowledge/hours-of-service/14-hour-driving-window)).
- **Step 4 — most days need only one.** With 11 total driving hours, you can hit the trigger at most once (8 + 3), so one properly placed break covers a full driving day.

## Worked examples

**Example A (illustration, not legal advice):** Drive 06:00–10:00 (4 h), unload 10:00–10:45 (45 min on duty, not driving). That 45-minute dock stop already satisfies the rule — your cumulative counter is back to zero without a single "break" line on the log. Drive 10:45–17:45 (7 h) and you finish with 11 total driving hours, never having reached 8 cumulative without an interruption.

**Example B:** Drive 05:00–13:00 straight — 8 hours cumulative. The truck cannot legally move with you driving until a 30-consecutive-minute non-driving period is complete. Take 13:00–13:30, then drive up to 3 more hours (the 11-hour limit).

## Common mistakes

- Thinking only off-duty time can satisfy the break. Since 2020, on-duty (not driving) time qualifies — the pre-2020 version was stricter, and old advice still circulates.
- Splitting it: 20 minutes now, 10 later. Only a single 30-consecutive-minute period counts.
- Confusing the trigger: it is 8 **cumulative driving** hours, not 8 hours on duty and not 8 hours since your last break of any kind.
- Wasting a dock stop: 30+ minutes at a shipper already satisfied the rule — taking an extra "required" break afterward burns your 14-hour window for nothing.
- Short-haul drivers adopting it unnecessarily — if you genuinely qualify under 395.1(e)(1), the break rule does not apply to you. (**Company policy note:** your carrier may still require breaks as policy; that is their call to make, and stricter-than-federal is allowed.)

## Violations and compliance risks

Driving past 8 cumulative hours without the interruption is a Part 395 violation with the standard consequences covered in [our HOS guide's violations section](/knowledge/hours-of-service/cdl-hours-of-service-rules). It is also among the most avoidable — one well-placed dock stop satisfies it. Enforcement specifics belong to [FMCSA](https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations).

## Driver checklist

- Know your cumulative driving number every time you leave a stop.
- Plan the break where you already have to stop — a dock, a fuel island, a scale queue.
- Make it 30 minutes *plus a cushion*; a 29-minute break is worth nothing.
- If you run short-haul, confirm you actually meet every condition of 395.1(e)(1) before skipping the break.
- Annotate anything unusual (for example, a break interrupted by a safety issue) at the time it happens.

## Keep learning

- The rest of the system: [CDL Hours of Service Rules Explained](/knowledge/hours-of-service/cdl-hours-of-service-rules) · [The 11-Hour Driving Limit](/knowledge/hours-of-service/11-hour-driving-limit) · [The 14-Hour Driving Window](/knowledge/hours-of-service/14-hour-driving-window) · [Yard Move Explained](/knowledge/hours-of-service/yard-move)
- Drill the rules free: [General Knowledge practice test](/practice-tests/general-knowledge) — every question carries its citation.
- **Want training that treats the clocks as survival skills?** [TLWS Academy](/academy) · free [CDL Pre-School](/cdl-pre-school) · [email list](/#newsletter) for new guides.$mdx$,
      'CDL 30-Minute Break Rule Explained — 2020 Update (49 CFR 395.3) | Trucking Life with Shawn',
      'The CDL 30-minute break rule since 2020: triggered by 8 cumulative driving hours, satisfied by any 30-minute non-driving period — examples and eCFR citations.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR 395.3(a)(3)(ii) — 30-minute driving break (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395/section-395.3"},
        {"label":"49 CFR 395.1(e) — Short-haul exception (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395/section-395.1"},
        {"label":"FMCSA — Summary of Hours of Service Regulations","url":"https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations"}
      ]$j$::jsonb,
      $j$[
        {"q":"Can the 30-minute break be on-duty time?","a":"Yes. Since the September 2020 revision of 49 CFR 395.3(a)(3)(ii), any 30-consecutive-minute period without driving qualifies — off duty, sleeper berth, or on duty (not driving), such as dock time or paperwork."},
        {"q":"Do I need a 30-minute break every 8 hours of my shift?","a":"No — the trigger is 8 cumulative hours of driving time without a 30-minute interruption, not 8 hours of elapsed shift time. A driver who accumulates driving slowly, with natural 30-minute stops between blocks, may never owe a formal break."},
        {"q":"Does a 30-minute break reset my 11-hour or 14-hour clock?","a":"No. The break only resets the 8-hour cumulative-driving trigger. The 11-hour driving limit and the 14-hour window keep running exactly as before — the break actually consumes window time."},
        {"q":"Are any drivers exempt from the 30-minute break?","a":"Drivers who qualify for the 150 air-mile short-haul exception under 49 CFR 395.1(e)(1) are not subject to the break requirement. If you do not meet every condition of that exception on a given day, the break rule applies that day."}
      ]$j$::jsonb,
      '{hours-of-service,30-minute-break,8-hour-rule,fmcsa}',
      7, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 5. Split Sleeper-Berth Rules
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_hos and slug = 'split-sleeper-berth-rules') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_hos,
      'split-sleeper-berth-rules',
      'Split Sleeper-Berth Rules: 7/3 and 8/2 Without the Headache',
      'How the split sleeper-berth provision in 49 CFR 395.1(g) lets CDL drivers divide the 10-hour break into 7/3 or 8/2 pairings, why neither qualifying period counts against the 14-hour window, and a fully worked example.',
      $mdx$**Quick answer:** Instead of one 10-hour break, you may split rest into **two pairing periods**: one of **at least 7 consecutive hours in the sleeper berth**, and one of **at least 2 consecutive hours** off duty, in the sleeper, or both — together totaling **at least 10 hours** (7/3, 7.5/2.5, 8/2 all work). **Neither qualifying period counts against the 14-hour window.** After the pair completes, your clocks recalculate from the end of the *first* period. Citation: [49 CFR 395.1(g)(1)](https://www.ecfr.gov/current/title-49/part-395/section-395.1).

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026** against the eCFR. The split-berth provision took its current shape in the September 2020 rule; confirm the current [49 CFR 395.1(g)](https://www.ecfr.gov/current/title-49/part-395/section-395.1) and [FMCSA's HOS summary](https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations) before relying on it. Not legal advice.

## What the split-berth provision is

The split lets a driver take the required rest in two installments instead of one, and rewards it: a qualifying sleeper period **pauses the 14-hour window**. It is the only thing in Part 395 that does. Used well, it turns detention time or a mid-day traffic bomb into structured rest instead of wasted window.

The two qualifying periods:

- **Period A:** at least 7 consecutive hours, **in the sleeper berth** (this one cannot be plain off duty).
- **Period B:** at least 2 consecutive hours, off duty, sleeper berth, or any combination.
- **Together:** at least 10 hours. 7/3 and 8/2 are the common shapes; 7/2 fails (only 9 total).

## Why the provision exists

Freight schedules do not respect the human sleep cycle, and a rigid single 10-hour block forces drivers to burn their window sitting in docks. The split acknowledges that two substantial rest periods — one long enough for real sleep — can keep a driver fit while fitting the freight. The 2020 revision widened it from the old 8/2-only shape to any 7+/2+ combination totaling 10.

## Who it applies to

**Federal requirement:** Property-carrying CMV drivers under [49 CFR Part 395](https://www.ecfr.gov/current/title-49/part-395) operating a vehicle with a sleeper berth that meets the equipment specs referenced by [49 CFR 395.1(g)](https://www.ecfr.gov/current/title-49/part-395/section-395.1). Day-cab drivers cannot use it — Period A must be in a sleeper berth.

## How the recalculation works, step by step

- **Step 1.** Take one qualifying period (either order works — the 7-hour sleeper can come first or second).
- **Step 2.** While driving between the two periods, your available hours are still counted from your **original** calculation point — but the qualifying sleeper time is **excluded** from the 14-hour window math.
- **Step 3.** When the second period completes the pair, your new calculation point becomes the **end of the first period**. Recount 11 and 14 from there, again excluding qualifying rest.
- **Step 4.** Keep pairing. Each new qualifying period pairs with the previous one, letting the split roll forward day after day.

## Fully worked example

**Example (illustration, not legal advice):** Fresh after a 10-hour break, on duty and driving at 06:00.

- 06:00–12:00 — drive 6 h (6 of 11 used; 6 of 14 window hours used)
- 12:00–19:00 — **sleeper berth, 7 h (Period A)** — excluded from the window
- 19:00–24:00 — drive 5 h. Check the math at midnight: driving used = 6 + 5 = **11 of 11** ✓ at the limit; window used = 6 + 5 = **11 of 14** (the 7 sleeper hours do not count) ✓ legal.
- 00:00–03:00 — **off duty, 3 h (Period B)** — pair complete (7 + 3 = 10 ✓).
- **Recalculation:** the new calculation point is 19:00 — the end of Period A. Since 19:00 you have driven 5 h → **6 driving hours available**. Window since 19:00, excluding the qualifying 3-hour break: 5 h used → **9 window hours remaining** from 03:00.

Every number above is internally consistent — check it against [49 CFR 395.1(g)(1)](https://www.ecfr.gov/current/title-49/part-395/section-395.1) yourself; that is exactly the audit an officer's software performs.

## Common mistakes

- Pairing 7 + 2. The periods must **total at least 10**; 7/3 and 8/2 qualify, 7/2 does not.
- Taking Period A in a hotel. The 7-hour-plus period must be sleeper-berth time; only the shorter period may be plain off duty.
- Assuming the split adds hours. It never grants extra driving time — it repositions the window so your existing hours stay reachable.
- Forgetting the recalculation point is the **end of the first period**, not the end of the second. Counting from the wrong point makes a legal plan look illegal, and vice versa.
- Improvising a split mid-crisis without checking the arithmetic. **Good practice (not a federal requirement):** sketch the whole pairing — both periods and the recount — before committing to the first one.

## Violations and compliance risks

A failed split is not a special violation category — it simply means the excluded time counts after all, and the resulting 11/14 overruns are ordinary HOS violations on your record, with the same Safety Measurement System and out-of-service consequences as any other. Verify current specifics with [FMCSA](https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations).

## Driver checklist

- Confirm the rig actually has a compliant sleeper berth before planning a split.
- Write down the pairing plan: Period A start/end, Period B start/end, the total (≥10), and the recalculation point.
- Verify the ELD marked the sleeper period as sleeper — a mis-logged status breaks the pairing.
- Re-run your 11/14 math at the recalculation point before the wheels roll.
- If dispatch changes the plan mid-split, redo the arithmetic from scratch — do not assume the old pairing still works.

## Keep learning

- The clocks the split manipulates: [The 11-Hour Driving Limit](/knowledge/hours-of-service/11-hour-driving-limit) · [The 14-Hour Driving Window](/knowledge/hours-of-service/14-hour-driving-window) · [The 30-Minute Break Rule](/knowledge/hours-of-service/30-minute-break-rule) · [full HOS guide](/knowledge/hours-of-service/cdl-hours-of-service-rules)
- Test the concepts free: [General Knowledge practice test](/practice-tests/general-knowledge) and the whole [practice-test hub](/practice-tests).
- **Learn trip planning from a 17-year zero-violation driver:** [TLWS Academy](/academy) · [email list](/#newsletter) for new deep dives.$mdx$,
      'Split Sleeper-Berth Rules: 7/3 and 8/2 Explained | Trucking Life with Shawn',
      'The CDL split sleeper-berth rule: qualifying 7/3 and 8/2 pairings, the 14-hour window exclusion, the recalculation point, and a fully worked example.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR 395.1(g) — Sleeper berths (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395/section-395.1"},
        {"label":"49 CFR 395.3 — Maximum driving time (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395/section-395.3"},
        {"label":"FMCSA — Summary of Hours of Service Regulations","url":"https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations"}
      ]$j$::jsonb,
      $j$[
        {"q":"What sleeper-berth splits are legal?","a":"Any pairing of a sleeper-berth period of at least 7 consecutive hours with a second period of at least 2 consecutive hours (off duty, sleeper, or both) where the two total at least 10 hours — 7/3, 7.5/2.5, and 8/2 all qualify under 49 CFR 395.1(g)(1)."},
        {"q":"Does the split sleeper berth stop the 14-hour clock?","a":"A qualifying period is excluded from the 14-hour window calculation, which works like pausing the window for exactly that period. Ordinary breaks and short naps are not excluded — only periods that qualify for the split pairing."},
        {"q":"Do I get extra driving hours from a split?","a":"No. The 11-hour driving limit never grows. The split repositions the 14-hour window so that hours you already have remain usable later in the day."},
        {"q":"Where do my hours recalculate from after a split?","a":"From the end of the first of the two qualifying periods. After the second period completes the pair, count your 11 driving hours and 14-hour window from that earlier point, excluding qualifying rest."},
        {"q":"Can the two split periods come in either order?","a":"Yes. The shorter (2+ hour) period can come before or after the 7+ hour sleeper period. The pairing and the recalculation rule work the same either way."}
      ]$j$::jsonb,
      '{hours-of-service,sleeper-berth,split-sleeper,7-3-split,8-2-split}',
      8, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 6. Personal Conveyance Explained
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_hos and slug = 'personal-conveyance') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_hos,
      'personal-conveyance',
      'Personal Conveyance Explained: When Moving the Truck Is Off Duty',
      'What personal conveyance actually is under FMCSA guidance: off-duty movement of a CMV for personal purposes, what qualifies, what never does, the laden-vehicle question, and why carrier policy controls whether you get it at all.',
      $mdx$**Quick answer:** Personal conveyance (PC) is **off-duty movement of a CMV for personal purposes** — it does not consume your driving or on-duty clocks, because you are off duty while doing it. It is defined by FMCSA regulatory guidance to [49 CFR 395.8](https://www.ecfr.gov/current/title-49/part-395/section-395.8), the movement must be genuinely personal (it may not advance the load or the carrier's business), and **your carrier decides whether you may use it at all**.

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026**. PC is governed by FMCSA *guidance* (most recently revised in 2018), which the agency can update more easily than a regulation — check [FMCSA's personal-conveyance page](https://www.fmcsa.dot.gov/regulations/hours-service/personal-conveyance) and the current [49 CFR 395.8](https://www.ecfr.gov/current/title-49/part-395/section-395.8) before relying on this. Not legal advice.

## What personal conveyance is

PC is a duty-status question, not a switch on the ELD. Time behind the wheel is off duty — and therefore loggable as PC — only when the movement serves **your personal needs** rather than the carrier's freight. The ELD "personal use" category (an optional special driving category the carrier may enable under the ELD rule, [49 CFR Part 395 Subpart B](https://www.ecfr.gov/current/title-49/part-395)) merely records the claim; the facts of the trip decide whether the claim is true.

**Federal framework vs company policy, clearly separated:**

- **Federal:** FMCSA guidance defines what *may* qualify as PC. It sets no mileage cap and, since the 2018 revision, allows PC even in a **laden** vehicle — what matters is the purpose of the movement, not the cargo behind you.
- **Company policy:** Carriers choose whether to allow PC, and may cap it (miles, hours, situations) or ban it outright. A carrier limit is real for you even though it is not federal law.

## Why it exists

Drivers live out of the truck. Getting to a meal, a pharmacy, or home from a job site should not burn regulated hours when the movement has nothing to do with freight. PC keeps the off-duty concept honest for people whose personal vehicle is also their work vehicle.

## Who can use it

Any CMV driver whose **carrier permits it** and whose movement is genuinely personal. You must be **relieved from work and all responsibility for performing work** — PC is off-duty time, so if dispatch can still direct you, you are not off duty.

## What qualifies — and what never does

**May qualify (per FMCSA guidance examples):**

- Driving from en-route lodging (truck stop, rest area, hotel) to restaurants or entertainment nearby.
- Commuting between the driver's residence and the terminal or other work location — when the commute is genuinely personal time.
- Moving to the **nearest safe rest location** after a shipper or receiver orders you off the property once loading/unloading is done and you need rest — even loaded.

**Never qualifies:**

- Any movement that advances the load toward its destination — "I was heading to a truck stop that happened to be 200 miles down my route" fails the purpose test.
- Driving to a terminal, shipper, or receiver because dispatch told you to be there — that is work.
- Bobtailing or deadheading in the direction of the next business task.
- Using PC to reach a location that improves your operational position for tomorrow's dispatch.

**Example (illustration, not legal advice):** You deliver at 21:00 with zero window left and the receiver forbids overnight parking. Driving to the **nearest** safe parking to get your 10 hours can be PC under the guidance. Driving 45 minutes past three truck stops toward tomorrow's shipper is not — the extra distance served the load, not you.

## How to use it, step by step

- **Step 1.** Confirm your carrier allows PC and know its written limits. (**Company policy note:** many carriers cap PC at a fixed mileage; that cap is policy, not federal law — and it binds you anyway.)
- **Step 2.** Be actually off duty: work done, no pending dispatch obligations during the movement.
- **Step 3.** Select the PC status **before** the wheels roll, and annotate the reason ("receiver closed lot — moving to nearest safe parking").
- **Step 4.** Drive to the *nearest reasonable* personal destination — distance is the first thing anyone auditing the claim looks at.
- **Step 5.** End PC when the personal purpose ends.

## Common mistakes

- Treating PC as spare driving hours when the 14-hour window dies mid-route. An out-of-hours driver inching the load toward the consignee on PC is the classic abuse pattern.
- Forgetting the status until the trip is half over, then back-annotating.
- Using PC for a repositioning dispatch "as a favor" — if it helps the carrier, it is on-duty driving.
- Assuming a federal mileage cap exists (it does not) — or assuming the absence of one overrides the carrier's 25-mile policy (it does not).
- Using PC while technically still responsible for the vehicle's work tasks — off duty means relieved of duty.

## Violations and compliance risks

Misused PC is reclassified as driving time during inspections or audits, which usually converts the day into 11-hour or 14-hour violations after the fact — with the same record and out-of-service consequences as driving over hours in the first place, plus a false-log problem under [49 CFR 395.8(e)](https://www.ecfr.gov/current/title-49/part-395/section-395.8). The audit trail (GPS, ELD, receipts) makes purpose easy to reconstruct; rely on [FMCSA's guidance](https://www.fmcsa.dot.gov/regulations/hours-service/personal-conveyance) for what holds up.

## Driver checklist

- Carrier allows PC? Know the written policy before first use.
- Is the movement 100% personal — would it happen if the trailer vanished?
- Status set to PC before moving, with a one-line annotation.
- Nearest reasonable destination, not the most convenient-for-tomorrow one.
- Off duty for real: no work, no standby, no dispatch strings attached.

## Keep learning

- The other special category: [Yard Move Explained](/knowledge/hours-of-service/yard-move) — on-duty cousin to PC's off-duty status.
- The clocks PC protects: [CDL Hours of Service Rules Explained](/knowledge/hours-of-service/cdl-hours-of-service-rules) · [The 14-Hour Driving Window](/knowledge/hours-of-service/14-hour-driving-window) · [ELD Malfunctions and What Drivers Must Do](/knowledge/hours-of-service/eld-malfunctions)
- Free prep: [General Knowledge practice test](/practice-tests/general-knowledge).
- **Drive for a living, the right way:** [TLWS Academy](/academy) · [email list](/#newsletter).$mdx$,
      'Personal Conveyance Rules (FMCSA Guidance) | Trucking Life with Shawn',
      'Personal conveyance under FMCSA guidance: what qualifies as off-duty CMV movement, what never does, laden-vehicle rules, and carrier policy limits.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"FMCSA — Personal Conveyance guidance","url":"https://www.fmcsa.dot.gov/regulations/hours-service/personal-conveyance"},
        {"label":"49 CFR 395.8 — Driver's record of duty status (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395/section-395.8"},
        {"label":"49 CFR Part 395 — Hours of Service of Drivers (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395"}
      ]$j$::jsonb,
      $j$[
        {"q":"Can I use personal conveyance with a loaded trailer?","a":"Yes — since FMCSA's 2018 guidance revision, a laden vehicle can move under personal conveyance, provided the movement is for a personal purpose and does not advance the load or the carrier's business. Purpose, not cargo, decides."},
        {"q":"Is there a federal mileage limit on personal conveyance?","a":"No. FMCSA guidance sets no distance cap; it judges the purpose of the movement. Many carriers impose their own mileage caps as company policy, and drivers must follow those too."},
        {"q":"Can I use personal conveyance when I run out of hours?","a":"Only for a genuinely personal movement — for example, proceeding to the nearest safe rest location after a receiver orders you off the property. Continuing toward your delivery or staging for tomorrow's dispatch on PC is misuse and gets reclassified as driving time."},
        {"q":"Does personal conveyance count against my 11- or 14-hour clocks?","a":"No. Personal conveyance is off-duty time, so it does not consume driving or window hours. That is exactly why misusing it is treated as a false log — it hides what would otherwise be over-hours driving."}
      ]$j$::jsonb,
      '{hours-of-service,personal-conveyance,eld,off-duty}',
      8, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 7. Yard Move Explained
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_hos and slug = 'yard-move') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_hos,
      'yard-move',
      'Yard Move Explained: On Duty, Not Driving — and Why That Matters',
      'What a yard move is on an ELD, why it logs as on-duty (not driving) instead of driving time, where a "yard" ends per FMCSA guidance, and how yard moves interact with the 11-hour, 14-hour, and break clocks.',
      $mdx$**Quick answer:** A yard move is CMV movement **inside a yard or similar private property not open to public travel**, recorded through an ELD special driving category as **on duty (not driving)**. It burns your [14-hour window](/knowledge/hours-of-service/14-hour-driving-window) and weekly hours but **not your 11 hours of driving time**, and it does not feed the 8-hour trigger of the [30-minute break rule](/knowledge/hours-of-service/30-minute-break-rule). Basis: the ELD rule's special driving categories in [49 CFR Part 395, Subpart B](https://www.ecfr.gov/current/title-49/part-395) and FMCSA guidance on yard moves.

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026**. Yard-move boundaries come largely from FMCSA guidance rather than a single regulation section, and guidance evolves — check [FMCSA's ELD pages](https://eld.fmcsa.dot.gov/) and current guidance before relying on this. Not legal advice.

## What a yard move is

The ELD rule requires devices to record driving automatically whenever the vehicle moves above the recording threshold. Without a yard-move category, every trailer shuffle at a terminal would eat driving time. So the rule lets carriers configure a **yard move** special driving category: while it is active, vehicle movement records as **on duty (not driving)**.

The key concept is the *yard*: property such as a terminal, port, distribution center, or similar facility **not open to public travel**. FMCSA guidance treats limited public access under controlled circumstances (a gate, an escort) as still being a yard; a public street between two halves of a facility is not.

## Why the category exists

Duty-status accuracy. Ten minutes repositioning trailers is work — but it is not over-the-road driving fatigue, and the rules treat it accordingly: it counts as work time (window, weekly hours) without consuming the driving-specific limits.

## Who can use it

Drivers whose **carrier has enabled** the yard-move category on the ELD ([49 CFR Part 395, Subpart B](https://www.ecfr.gov/current/title-49/part-395) leaves special categories to carrier configuration), moving a CMV within qualifying property. **Company policy note:** there is no federal requirement that a carrier offer the category at all — whether you have the option, and any rules attached to it, are your carrier's call.

## How to use it, step by step

- **Step 1.** Confirm the movement is inside a genuine yard: private property, not open to public travel.
- **Step 2.** Select the yard-move status **before** moving, and annotate briefly ("hostling trailers, door 14 to door 3").
- **Step 3.** Make the move. The ELD records on duty (not driving).
- **Step 4.** End the status when the move ends — before you touch a public road.
- **Step 5.** If any leg crosses a public street open to traffic, that leg is **driving time**, full stop. Split the log accordingly.

## What yard moves do to your clocks

- **11-hour driving limit:** untouched — yard moves are not driving time. Details: [The 11-Hour Driving Limit](/knowledge/hours-of-service/11-hour-driving-limit).
- **14-hour window:** consumed — it is on-duty time like any other.
- **30-minute break trigger:** not fed — the 8-hour trigger counts driving hours only. A 30+ minute stretch of yard work can itself satisfy the break.
- **60/70-hour totals:** consumed — on-duty time always counts.

## Real-world example

**Example (illustration, not legal advice):** You arrive at a distribution center at 10:00 with 3 driving hours left and a window that closes at 18:00. Between 10:00 and 13:00 you shuttle four trailers between doors inside the fenced lot on yard-move status. At 13:00 you still have **3 driving hours** (yard moves took none), the window still closes at 18:00 (the 3 hours burned window like any on-duty work), and — because those 3 yard hours included more than 30 consecutive non-driving minutes — your break requirement is already satisfied for the driving ahead.

## Common mistakes

- Crossing the public road between two company lots on yard-move status. Open public roadway = driving time, even for 200 feet.
- Using yard move as "PC lite" to save driving hours on errands around a truck stop — truck-stop lots are open to public travel; that is not a yard.
- Believing yard moves extend the day. They protect driving hours, not the window — hour 14 still ends driving eligibility.
- Forgetting the annotation. An unexplained yard-move segment at 65 mph average speed audits itself.
- Confusing yard move (on duty) with [personal conveyance](/knowledge/hours-of-service/personal-conveyance) (off duty). Purpose and status are different in kind: yard moves are work.

## Violations and compliance risks

A movement mis-logged as a yard move that was actually public-road driving gets reclassified in an audit or inspection — often converting the day into over-hours violations and raising a false-log issue under [49 CFR 395.8(e)](https://www.ecfr.gov/current/title-49/part-395/section-395.8). ELD position data makes the reconstruction straightforward. Current enforcement details: [FMCSA](https://eld.fmcsa.dot.gov/).

## Driver checklist

- Carrier has the yard-move category enabled, and you know its policy for it.
- The whole path is inside property not open to public travel.
- Status selected before moving; annotation written.
- Status ended before any public-road leg.
- Clocks reviewed after: window spent, driving hours intact.

## Keep learning

- The off-duty sibling: [Personal Conveyance Explained](/knowledge/hours-of-service/personal-conveyance)
- The clocks in play: [CDL Hours of Service Rules Explained](/knowledge/hours-of-service/cdl-hours-of-service-rules) · [The 30-Minute Break Rule](/knowledge/hours-of-service/30-minute-break-rule) · [ELD Malfunctions and What Drivers Must Do](/knowledge/hours-of-service/eld-malfunctions)
- Free drills: [General Knowledge practice test](/practice-tests/general-knowledge).
- **Train with people who log it right:** [TLWS Academy](/academy) · [email list](/#newsletter).$mdx$,
      'Yard Move Rules — ELD Special Driving Category | Trucking Life with Shawn',
      'Yard moves: what counts as a yard per FMCSA guidance, why they log as on-duty (not driving), and what they do to the 11-hour, 14-hour, and break clocks.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR Part 395, Subpart B — Electronic logging devices (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395"},
        {"label":"FMCSA — ELD home (rule, guidance, and FAQs)","url":"https://eld.fmcsa.dot.gov/"},
        {"label":"49 CFR 395.8 — Driver's record of duty status (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395/section-395.8"}
      ]$j$::jsonb,
      $j$[
        {"q":"Does a yard move count against my 11 hours of driving?","a":"No. A properly recorded yard move logs as on duty (not driving), so it does not consume the 11-hour driving limit — but it does consume the 14-hour window and counts toward the 60/70-hour weekly limits."},
        {"q":"What counts as a yard for yard-move purposes?","a":"Property not open to public travel — terminals, ports, plants, distribution centers and similar facilities, per FMCSA guidance. Property with controlled, limited public access can still qualify; a public street between lots does not."},
        {"q":"Can a yard move satisfy my 30-minute break?","a":"Yes. The break rule requires 30 consecutive minutes without driving, and on-duty (not driving) time qualifies since the 2020 rule change — a half hour of yard work resets the 8-hour cumulative-driving trigger."},
        {"q":"Who turns on the yard-move option?","a":"The motor carrier. Yard move is an ELD special driving category that carriers may enable in the device configuration; if your carrier has not enabled it, yard movements record as ordinary driving time."}
      ]$j$::jsonb,
      '{hours-of-service,yard-move,eld,on-duty}',
      7, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 8. ELD Malfunctions and What Drivers Must Do
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_hos and slug = 'eld-malfunctions') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_hos,
      'eld-malfunctions',
      'ELD Malfunctions: The 3 Things a Driver Must Do (49 CFR 395.34)',
      'When an ELD malfunctions, 49 CFR 395.34 gives the driver three duties: notify the carrier within 24 hours, reconstruct the current day and prior 7 days on paper, and keep paper logs until the device is fixed. Here is how to do each one.',
      $mdx$**Quick answer:** When an ELD malfunctions, [49 CFR 395.34](https://www.ecfr.gov/current/title-49/part-395/section-395.34) requires the **driver** to (1) **notify the carrier in writing within 24 hours**, (2) **reconstruct** records of duty status on graph-grid paper for the **current 24 hours and the previous 7 days** (unless retrievable from the device), and (3) **keep paper logs** until the ELD works again. The **carrier** must repair or replace the device within **8 days** of discovering the malfunction or being told about it.

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026** against the eCFR. Confirm the current [49 CFR 395.34](https://www.ecfr.gov/current/title-49/part-395/section-395.34) and [FMCSA's ELD site](https://eld.fmcsa.dot.gov/) before relying on this. Not legal advice.

## Malfunction vs. data diagnostic — know which one you have

The ELD technical standard ([49 CFR Part 395, Subpart B and its Appendix A](https://www.ecfr.gov/current/title-49/part-395)) defines two families of events, and your duties differ:

- **Data diagnostic events** — the device flags a data issue (for example, missing required data elements or unidentified driving). You resolve or annotate; the device still works.
- **Malfunctions** — the device can no longer reliably record or transfer duty status (power, engine-synchronization, timing, positioning, data recording, or data transfer compliance failures). This is what triggers 395.34.

The device is required to show a visible malfunction indicator. When that indicator is on, assume 395.34 applies until proven otherwise.

## Why the rule exists

Your ELD record is the compliance record. When the recorder fails, the rule bridges the gap with the old technology — paper — so there is never a stretch of driving that no record covers, and it puts a hard deadline on the carrier so "the ELD's been broken for a month" cannot become normal.

## Who does what

- **Driver ([49 CFR 395.34(a)](https://www.ecfr.gov/current/title-49/part-395/section-395.34)):** written notice to the carrier within 24 hours; reconstruct the current 24-hour period and prior 7 days on paper graph-grid logs (unless the records are retrievable from the ELD); continue paper logs until the device is compliant again.
- **Carrier ([49 CFR 395.34(d)](https://www.ecfr.gov/current/title-49/part-395/section-395.34)):** correct, repair, replace, or service the ELD within **8 days** of discovery or driver notification — whichever comes first. Under [49 CFR 395.34(e)](https://www.ecfr.gov/current/title-49/part-395/section-395.34), carriers may request an extension from the FMCSA Division Administrator for the state of their principal place of business.

## What to do, step by step

- **Step 1 — confirm.** Malfunction indicator on? Note the code the device shows and what you were doing when it appeared.
- **Step 2 — tell the carrier in writing within 24 hours.** A message through the carrier's system, an email, even a text — written means reviewable. Keep your copy.
- **Step 3 — rebuild the paper trail.** If the device cannot produce the current day and previous 7 days, reconstruct them on graph-grid sheets from memory, receipts, and any partial data. **Good practice (not a federal requirement):** carry blank paper logs for exactly this day.
- **Step 4 — run on paper.** Log duty status manually until the ELD is fixed. Your [HOS limits](/knowledge/hours-of-service/cdl-hours-of-service-rules) have not changed — only the recording method has.
- **Step 5 — at roadside.** Tell the inspector the device is malfunctioning, show the written notice if you have it, and present your paper logs for the required period. That paper trail is what stands between you and a no-record-of-duty-status problem.
- **Step 6 — confirm the fix.** When the device is repaired, verify past data transferred correctly before you shred anything. **Good practice:** keep the paper originals per your carrier's retention policy.

## Real-world example

**Example (illustration, not legal advice):** Tuesday 09:15, mid-trip, the malfunction icon lights: positioning failure. You finish the leg safely, then at the next stop message dispatch — "ELD positioning malfunction since ~09:15, request service, running paper" — and photograph the message. The device still displays the past week, so no reconstruction is needed; you print nothing but start a paper log at 09:15 Tuesday. The carrier's shop swaps the unit Thursday — inside its 8-day clock — and you verify Tuesday–Thursday appear correctly before returning to electronic logging.

## Common mistakes

- Treating a data-diagnostic flag as a full malfunction (or the reverse — driving for days with the malfunction icon on and no paper logs).
- Telling a dispatcher verbally and calling it "notice." The rule says the notice must be written.
- Reconstructing only today. The requirement covers the current 24 hours **and the previous 7 days** when the device cannot produce them.
- Assuming the 8-day repair clock is the driver's problem to manage — it is the carrier's duty, but your paper logs must not stop while it runs.
- "The ELD is down, so nothing is being recorded" — the *limits* never paused; missing records are their own violation under [49 CFR 395.8](https://www.ecfr.gov/current/title-49/part-395/section-395.8).

## Violations and compliance risks

Operating without records — electronic or paper — during a malfunction is a record-of-duty-status violation, discoverable at any inspection, and it removes your ability to prove the hours you drove were legal. Both the missing-records problem and any underlying HOS overruns feed the same Safety Measurement System records as other Part 395 violations. Specifics: [FMCSA's ELD pages](https://eld.fmcsa.dot.gov/).

## Driver checklist

- Blank graph-grid logs and a pen in the truck, always.
- Malfunction indicator on → note the code and time immediately.
- Written notice to the carrier within 24 hours — keep proof.
- Paper logs from the moment of failure; reconstruct back 7 days if the device cannot show them.
- At inspection: disclose the malfunction, show the paper.
- After repair: verify the data before ending the paper routine.

## Keep learning

- The limits your paper logs must still respect: [CDL Hours of Service Rules Explained](/knowledge/hours-of-service/cdl-hours-of-service-rules) · [The 11-Hour Driving Limit](/knowledge/hours-of-service/11-hour-driving-limit) · [The 14-Hour Driving Window](/knowledge/hours-of-service/14-hour-driving-window)
- Where ELD categories go wrong: [Personal Conveyance Explained](/knowledge/hours-of-service/personal-conveyance) · [Yard Move Explained](/knowledge/hours-of-service/yard-move)
- What the officer checks at the scale: [Level 1 DOT Inspection Explained](/knowledge/dot-compliance/level-1-dot-inspection)
- Drill the rules free: the [General Knowledge practice test](/practice-tests/general-knowledge) covers logging and hours-of-service questions.
- **Get inspection-ready for real:** [TLWS Academy](/academy) · new guides via the [email list](/#newsletter).$mdx$,
      'ELD Malfunction Rules — Driver Duties Under 49 CFR 395.34 | Trucking Life with Shawn',
      'ELD malfunction duties under 49 CFR 395.34: written notice in 24 hours, paper logs for the current day plus 7 prior, and the carrier''s 8-day repair clock.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR 395.34 — ELD malfunctions and data diagnostic events (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395/section-395.34"},
        {"label":"49 CFR Part 395 — including Subpart B, Electronic Logging Devices (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395"},
        {"label":"FMCSA — Electronic Logging Devices","url":"https://eld.fmcsa.dot.gov/"},
        {"label":"49 CFR 395.8 — Driver's record of duty status (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395/section-395.8"}
      ]$j$::jsonb,
      $j$[
        {"q":"How long do I have to report an ELD malfunction?","a":"Written notice to your motor carrier within 24 hours of discovering the malfunction, under 49 CFR 395.34(a)(1). Keep a copy of the notice — it is also what you show an inspector."},
        {"q":"How many days of paper logs must I reconstruct?","a":"The current 24-hour period and the previous 7 consecutive days, on graph-grid paper, unless those records are still retrievable from the ELD itself (49 CFR 395.34(a)(2))."},
        {"q":"How long does the carrier have to fix a broken ELD?","a":"Eight days from discovering the malfunction or being notified by the driver, whichever comes first, under 49 CFR 395.34(d). Carriers can request an extension from the FMCSA Division Administrator under 49 CFR 395.34(e)."},
        {"q":"Do hours-of-service limits still apply while my ELD is broken?","a":"Completely. A malfunction changes how you record duty status, not the limits themselves — you track the 11-hour, 14-hour, break, and weekly limits on paper until the device is repaired."},
        {"q":"Is a data diagnostic event the same as a malfunction?","a":"No. Data diagnostic events are data-quality flags you resolve or annotate while the ELD keeps working. Malfunctions mean the device can no longer reliably record or transfer data, and they trigger the 395.34 driver and carrier duties."}
      ]$j$::jsonb,
      '{hours-of-service,eld,eld-malfunction,paper-logs}',
      8, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 9. Level 1 DOT Inspection Explained (dot-compliance)
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_dot and slug = 'level-1-dot-inspection') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_dot,
      'level-1-dot-inspection',
      'Level 1 DOT Inspection Explained: What the Officer Checks and Why',
      'The CVSA North American Standard Level I inspection — the most thorough roadside inspection — explained for drivers: the driver-side checks, the vehicle-side checks, the CVSA decal, and how to be ready before you''re ever waved in.',
      $mdx$**Quick answer:** A Level 1 inspection is the **most thorough roadside inspection**: a certified inspector examines both the **driver** (license, medical certificate, hours-of-service records, seat belt, signs of alcohol or drugs) and the **vehicle** (brakes, coupling, lights, steering, suspension, tires, wheels, cargo securement, and more) under the CVSA **North American Standard Level I** procedure — a 37-step process defined by the [Commercial Vehicle Safety Alliance](https://www.cvsa.org/inspections/all-inspection-levels/). A clean vehicle inspection can earn a CVSA decal.

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026**. Inspection procedures and out-of-service criteria are maintained by CVSA and updated regularly; the underlying vehicle and driver rules live in the FMCSRs — see [49 CFR Part 396](https://www.ecfr.gov/current/title-49/part-396) for inspection and maintenance and [49 CFR Part 395](https://www.ecfr.gov/current/title-49/part-395) for hours of service. Confirm current details with [CVSA](https://www.cvsa.org/inspections/all-inspection-levels/) and [FMCSA](https://www.fmcsa.dot.gov/) before relying on this. Not legal advice.

## What a Level 1 inspection is

Roadside inspections in North America follow standardized levels defined by CVSA, the alliance of government enforcement agencies that writes the North American Standard. **Level I** is the full procedure — driver credentials *and* a hands-on vehicle examination, under the truck included. Other common levels for contrast: Level II is a walk-around (no under-vehicle), Level III is driver-credentials only, and Level V is vehicle-only without the driver present.

## Why it exists

The FMCSRs make safety rules; inspections make them real. Level 1 exists to find the brake out of adjustment and the driver out of hours **before** either one finds a crash. The standardized procedure means a truck inspected in Georgia is judged by the same steps as one in Oregon.

## Who gets inspected

Any CMV driver can be selected — at fixed scales, roadside checkpoints, or targeted stops. Selection can be random, algorithmic (carrier safety scores feed screening systems), or triggered by something visible (a light out, a flat tire, an expired decal).

## What the officer checks, step by step

**Driver side:**

- CDL — valid, correct class and endorsements for the vehicle and load
- Medical examiner's certificate (and any required waivers or skill performance certificates)
- Record of duty status — your ELD display or [paper logs during a malfunction](/knowledge/hours-of-service/eld-malfunctions), checked against the [HOS limits](/knowledge/hours-of-service/cdl-hours-of-service-rules)
- Seat belt use, and observation for alcohol, drugs, illness, or fatigue
- Required documents for the load — including hazmat papers where applicable

**Vehicle side (hands-on, including under-vehicle):**

- Brake systems — adjustment, components, air system integrity
- Coupling devices — fifth wheel, kingpin, safety devices
- Steering mechanism and suspension
- Frame, driveline, exhaust, and fuel systems
- Lights and electrical, windshield wipers
- Tires, wheels, rims, and hubs
- Cargo securement
- Hazardous-materials compliance when placarded

**The outcome:** violations are recorded on the inspection report. A vehicle that passes with no disqualifying defects can receive a **CVSA decal**. Violations that meet the North American Standard **Out-of-Service Criteria** park the driver, the vehicle, or both until corrected.

## Real-world walkthrough

**Example (illustration, not legal advice):** You get the green-arrow wave at a scale. Documents first: CDL, med card, and the ELD handed over in inspection mode. While the officer reads your logs, be ready to answer where your day started — inconsistent answers invite deeper digging. Then the walk-around and creeper work: brakes, pushrod travel, hoses, tires, lights. Forty-five minutes later you have a report with zero violations and a decal on the windshield. The whole difference between that outcome and an out-of-service order was made **yesterday** — in your [pre-trip inspection](/knowledge/cdl-training/cdl-pre-trip-inspection-guide) and your log discipline.

## Common mistakes

- Fumbling documents. If the med card takes ten minutes to find, the officer reasonably wonders what else is disorganized.
- Not knowing how to put the ELD in inspection/transfer mode — learn it before you need it.
- Talking too much. Answer what is asked, honestly and briefly.
- Skipping the pre-trip and letting the officer be the first person to look under the truck that day.
- Arguing at roadside. The dispute process exists — FMCSA's DataQs system, which drivers as well as carriers can use; the shoulder of the highway is not it.

## Violations and compliance risks

Everything found goes on the inspection report, which follows both driver and carrier through FMCSA's Safety Measurement System. Out-of-service violations stop the trip immediately under the CVSA criteria. Beyond enforcement, inspection history shapes how often you get selected in the future. For current criteria and procedures, rely on [CVSA](https://www.cvsa.org/inspections/all-inspection-levels/) and [FMCSA](https://www.fmcsa.dot.gov/) directly.

## Driver checklist

- Documents in one place: CDL, med card, registration, permits, load papers.
- ELD inspection-transfer mode: practiced, not theoretical.
- Logs current before you hit the scale line, not after.
- Pre-trip done like it matters, every day it matters.
- Lights, tires, and leaks checked at every stop; those are the visible triggers.
- Stay belted. Seat-belt use is a driver check item.

## Keep learning

- Companion guides: [Complete CDL Pre-Trip Inspection Guide](/knowledge/cdl-training/cdl-pre-trip-inspection-guide) · [What Is a DOT Inspection?](/knowledge/dot-compliance/what-is-a-dot-inspection) · [ELD Malfunctions](/knowledge/hours-of-service/eld-malfunctions) · [CDL Hours of Service Rules](/knowledge/hours-of-service/cdl-hours-of-service-rules)
- Watch: [FMCSA Just Changed DOT Inspections](https://youtu.be/UlW-GlLugUg) and [DOT Officers Are Quietly Doing This](https://youtu.be/vXtKQs6we_s) on the Trucking Life with Shawn channel.
- Free prep: the [General Knowledge practice test](/practice-tests/general-knowledge) and the [Hazmat test](/practice-tests/hazmat) both carry inspection-related questions.
- **Learn inspection readiness from a driver with 17 years and zero violations:** [TLWS Academy](/academy) · start free with [CDL Pre-School](/cdl-pre-school) · [email list](/#newsletter).$mdx$,
      'Level 1 DOT Inspection Explained — CVSA North American Standard | Trucking Life with Shawn',
      'Inside a Level 1 DOT inspection: the driver and vehicle checks in the CVSA North American Standard procedure, the decal, and how drivers get ready.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"CVSA — North American Standard Inspection Levels","url":"https://www.cvsa.org/inspections/all-inspection-levels/"},
        {"label":"49 CFR Part 396 — Inspection, Repair, and Maintenance (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-396"},
        {"label":"49 CFR Part 395 — Hours of Service of Drivers (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395"},
        {"label":"FMCSA — Federal Motor Carrier Safety Administration","url":"https://www.fmcsa.dot.gov/"}
      ]$j$::jsonb,
      $j$[
        {"q":"What is checked in a Level 1 DOT inspection?","a":"Both driver and vehicle: license, medical certificate, hours-of-service records, seat belt, and impairment indicators on the driver side; brakes, coupling, steering, suspension, frame, lights, tires, wheels, cargo securement, and hazmat compliance on the vehicle side — per the CVSA North American Standard Level I procedure."},
        {"q":"How long does a Level 1 inspection take?","a":"It is the most thorough roadside level, including under-vehicle examination, so expect roughly an hour of your day depending on the site and findings. Levels II and III are shorter because they omit the under-vehicle or vehicle portions."},
        {"q":"What does a CVSA decal on a truck mean?","a":"A vehicle that passes a Level I (or Level V) inspection without disqualifying defects can receive a CVSA decal, signaling a recent passed inspection. Details and validity practices are maintained by CVSA."},
        {"q":"Can I refuse a roadside inspection?","a":"No. Submitting to inspections is a condition of operating a CMV; refusing puts you out of service and creates a far bigger problem than the inspection itself."},
        {"q":"What puts a driver out of service at a Level 1?","a":"Violations meeting the CVSA North American Standard Out-of-Service Criteria — for drivers, commonly hours-of-service and credential problems. The criteria are published and updated by CVSA; that document, not word of mouth, is the reference."}
      ]$j$::jsonb,
      '{dot-inspection,level-1,cvsa,roadside,compliance}',
      8, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 10. Complete CDL Pre-Trip Inspection Guide (cdl-training)
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_cdl and slug = 'cdl-pre-trip-inspection-guide') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_cdl,
      'cdl-pre-trip-inspection-guide',
      'The Complete CDL Pre-Trip Inspection Guide: Legal Duty, Exam Skill, Daily Habit',
      'The pre-trip inspection three ways: the federal duty in 49 CFR 396.13 and 392.7, the CDL skills-test walkthrough from the manual''s seven-step method, and the daily routine that keeps trucks off the out-of-service list.',
      $mdx$**Quick answer:** Before driving, a CMV driver must be **satisfied the vehicle is in safe operating condition**, must **review the last driver vehicle inspection report** and acknowledge required repairs when defects were noted ([49 CFR 396.13](https://www.ecfr.gov/current/title-49/part-396/section-396.13)), and may not drive unless specific equipment — service brakes, parking brake, steering, lights and reflectors, tires, horn, wipers, mirrors, coupling devices — is in good working order ([49 CFR 392.7](https://www.ecfr.gov/current/title-49/part-392/section-392.7)). The CDL skills exam tests the same discipline through the manual's **seven-step inspection method**.

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026** against the eCFR. Confirm the current [49 CFR 396.13](https://www.ecfr.gov/current/title-49/part-396/section-396.13), [392.7](https://www.ecfr.gov/current/title-49/part-392/section-392.7), and your state's CDL manual before relying on this. Skills-test scoring details vary by state. Not legal advice.

## What the pre-trip inspection is

Three overlapping things share the name:

- **A federal duty** — the driver's personal satisfaction that the vehicle is safe, every time, before driving (396.13, 392.7).
- **A CDL exam segment** — the vehicle-inspection skills test required by [49 CFR 383.113](https://www.ecfr.gov/current/title-49/part-383/section-383.113), taught in Section 2 of state CDL manuals as the seven-step method.
- **A working habit** — the daily routine that finds the cut tire in the yard instead of on the interstate shoulder.

The related paperwork: at the end of the day, [49 CFR 396.11](https://www.ecfr.gov/current/title-49/part-396/section-396.11) requires a **driver vehicle inspection report (DVIR)** when defects or deficiencies are discovered — and 396.13's morning review closes that loop before the next trip.

## Why it exists

Every mechanical out-of-service violation found at a [Level 1 inspection](/knowledge/dot-compliance/level-1-dot-inspection) was findable earlier by the person standing next to the truck with the keys. The rule makes that person responsible for looking.

## Who must do it

**Federal requirement:** Every CMV driver, every time, before driving (392.7, 396.13). This is a driver duty — a carrier's shop program supplements it but never replaces it.

## The seven-step method, walked through

The CDL manual's Section 2 method (the exam's backbone, and a solid daily routine):

### Step 1 — Vehicle overview

Approach the truck: lean, fresh fluid on the ground, damage. Review the last DVIR; if defects were written up, verify the repair certification before you accept the truck.

**Example (illustration, not legal advice):** The overview is where cheap catches happen. A dark stain under the steer axle that was not there yesterday is a five-minute conversation with the shop this morning — or a power-steering failure on an off-ramp this afternoon. Same defect, two prices.

### Step 2 — Engine compartment

Oil and coolant levels, power-steering fluid; belts and hoses for cracks, fraying, leaks; steering components (box, hoses, linkage) and front suspension (springs, shocks, mounts) for damage or missing hardware; wiring condition.

### Step 3 — Inside the cab

Start-up: gauges normal — oil pressure rising, air pressure building, voltmeter charging. Controls: horn(s), wipers and washers, heater/defroster, mirrors adjusted. Safety equipment aboard: fire extinguisher (charged and secured), spare fuses where applicable, warning triangles.

### Step 4 — Lights

Headlights (both beams), four-way flashers, turn signals, brake lights, clearance and marker lamps, reflectors — walk it with the lights on.

### Step 5 — Walkaround

Front to back, one side then the other: tires (tread depth, inflation, damage — [49 CFR 393.75](https://www.ecfr.gov/current/title-49/part-393/section-393.75) sets the minimums, with steer tires held to a deeper standard than the rest), wheels and rims (cracks, missing or loose lug nuts, hub oil), brake components you can see, suspension, frame, fuel tanks and caps, exhaust, mudflaps, cargo doors and securement, and the coupling — fifth wheel, kingpin, locking jaws, glad hands, air and electrical lines.

### Step 6 — Signal lights

A second dedicated pass: left signal, right signal, brake lights — confirmed from outside the vehicle.

### Step 7 — Brake checks

Parking brake test (does it hold against gentle power), service brake check (pulls straight, no unusual feel), and for air-braked vehicles the full air-brake sequence — leakage test, low-air warning, spring-brake pop-out, compressor build-up — using your state manual's exact numbers. Drill them free on our [Air Brakes practice test](/practice-tests/air-brakes).

## Exam vs. real life

**On the exam,** you narrate: point at the component, name it, and say what you are checking for ("belt — no cracks or fraying, proper tension"). Memory aids and the state manual's own wording are how examiners are trained to hear it. **On the job,** nobody grades the narration — but the sequence is the same, and drivers who keep the sequence keep finding problems early. **Good practice (not a federal requirement):** same order, every day, so a missing step feels wrong.

## Common mistakes

- Skipping the last-DVIR review — half of 396.13 is paperwork, and it is the half people forget.
- Checking tires by eye from six feet away. Tread depth and inflation are measured numbers, not impressions.
- Ignoring the coupling area because "it was fine yesterday."
- Rushing lights: one walk with everything on beats four half-checks.
- On the exam: silently *looking* at components instead of naming what you are checking for — unspoken checks score as unchecked.

## Violations and compliance risks

Driving a vehicle that fails 392.7's equipment list is itself a violation, and defects found at roadside become vehicle violations on the inspection report — the out-of-service ones under CVSA criteria stop the trip on the spot. Every one of them is cheaper found in the yard. The maintenance framework lives in [49 CFR Part 396](https://www.ecfr.gov/current/title-49/part-396).

## Driver checklist (the compressed daily version)

- Last DVIR reviewed; repairs certified if defects were noted.
- Fluids, belts, hoses, steering, front suspension — engine compartment clean of surprises.
- Gauges build and read normal; horn, wipers, mirrors, safety kit.
- All lights, all sides.
- Full walkaround: tires measured, lugs sound, brakes and suspension eyed, coupling locked, cargo secure.
- Air-brake sequence by the numbers.
- You are satisfied — the 396.13 word — before the truck moves.

## Keep learning

- What the officer will check against your work: [Level 1 DOT Inspection Explained](/knowledge/dot-compliance/level-1-dot-inspection) · [What Is a DOT Inspection?](/knowledge/dot-compliance/what-is-a-dot-inspection)
- The other daily disciplines: [CDL Hours of Service Rules Explained](/knowledge/hours-of-service/cdl-hours-of-service-rules)
- Drill the knowledge free: [General Knowledge](/practice-tests/general-knowledge) · [Air Brakes](/practice-tests/air-brakes) · [Combination Vehicles](/practice-tests/combination-vehicles) practice tests.
- Watch: [17 Years, Zero Violations — Here's How](https://youtu.be/PDeJF0CMoUw) on the Trucking Life with Shawn channel.
- **Learning the pre-trip for your CDL exam?** Start free with [CDL Pre-School](/cdl-pre-school), then [train hands-on at the TLWS Academy](/academy). New guides hit the [email list](/#newsletter) first.$mdx$,
      'CDL Pre-Trip Inspection Guide: The 7-Step Method | Trucking Life with Shawn',
      'CDL pre-trip inspection guide: the federal duty in 49 CFR 396.13 and 392.7, the seven-step exam method, DVIR review, and the daily defect-finding routine.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR 396.13 — Driver inspection (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-396/section-396.13"},
        {"label":"49 CFR 392.7 — Equipment, inspection and use (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-392/section-392.7"},
        {"label":"49 CFR 396.11 — Driver vehicle inspection report (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-396/section-396.11"},
        {"label":"49 CFR 383.113 — Required skills, including vehicle inspection (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.113"},
        {"label":"49 CFR 393.75 — Tires (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-393/section-393.75"}
      ]$j$::jsonb,
      $j$[
        {"q":"Is a pre-trip inspection legally required before every trip?","a":"Yes. 49 CFR 396.13 requires the driver to be satisfied the vehicle is in safe operating condition and to review the last vehicle inspection report before driving, and 49 CFR 392.7 prohibits driving unless key equipment is in good working order."},
        {"q":"What are the seven steps of the CDL pre-trip method?","a":"Vehicle overview, engine compartment, inside-the-cab start-up, lights check, walkaround inspection, signal-lights check, and brake checks — the sequence taught in Section 2 of state CDL manuals for the skills exam."},
        {"q":"Do I have to fill out a DVIR every day?","a":"Under 49 CFR 396.11, property-carrying drivers must prepare a driver vehicle inspection report when defects or deficiencies are discovered; the next driver's 396.13 duty includes reviewing the last report and acknowledging certified repairs."},
        {"q":"How is the exam pre-trip different from a working pre-trip?","a":"Same sequence, different audience: the exam requires you to name each component aloud and state what you are checking for, scored against your state's manual. On the job the narration disappears but the discipline — same order, every day — is what keeps finding defects early."},
        {"q":"What tread depth do CMV tires legally need?","a":"49 CFR 393.75 sets the federal minimums, holding steer-axle tires to a deeper groove standard than other positions. Measure with a gauge at the lowest point — do not eyeball it — and check your state manual for how the skills test expects it stated."}
      ]$j$::jsonb,
      '{pre-trip,inspection,dvir,cdl-exam,seven-step}',
      9, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- Manual related-article curation (kc_related) — 3 per new article.
  -- Inserted by slug lookup; ON CONFLICT DO NOTHING keeps re-runs safe.
  ---------------------------------------------------------------------------
  declare
    a1 uuid; a2 uuid; a3 uuid; a4 uuid; a5 uuid;
    a6 uuid; a7 uuid; a8 uuid; a9 uuid; a10 uuid;
    stub_dot uuid;
  begin
    select id into a1  from public.kc_articles where category_id = v_hos and slug = 'cdl-hours-of-service-rules';
    select id into a2  from public.kc_articles where category_id = v_hos and slug = '11-hour-driving-limit';
    select id into a3  from public.kc_articles where category_id = v_hos and slug = '14-hour-driving-window';
    select id into a4  from public.kc_articles where category_id = v_hos and slug = '30-minute-break-rule';
    select id into a5  from public.kc_articles where category_id = v_hos and slug = 'split-sleeper-berth-rules';
    select id into a6  from public.kc_articles where category_id = v_hos and slug = 'personal-conveyance';
    select id into a7  from public.kc_articles where category_id = v_hos and slug = 'yard-move';
    select id into a8  from public.kc_articles where category_id = v_hos and slug = 'eld-malfunctions';
    select id into a9  from public.kc_articles where category_id = v_dot and slug = 'level-1-dot-inspection';
    select id into a10 from public.kc_articles where category_id = v_cdl and slug = 'cdl-pre-trip-inspection-guide';
    select id into stub_dot from public.kc_articles where category_id = v_dot and slug = 'what-is-a-dot-inspection';

    insert into public.kc_related (article_id, related_id, sort_order) values
      (a1, a2, 1), (a1, a3, 2), (a1, a5, 3),
      (a2, a1, 1), (a2, a3, 2), (a2, a4, 3),
      (a3, a1, 1), (a3, a5, 2), (a3, a2, 3),
      (a4, a2, 1), (a4, a3, 2), (a4, a7, 3),
      (a5, a3, 1), (a5, a2, 2), (a5, a1, 3),
      (a6, a7, 1), (a6, a1, 2), (a6, a8, 3),
      (a7, a6, 1), (a7, a4, 2), (a7, a8, 3),
      (a8, a1, 1), (a8, a6, 2), (a8, a9, 3),
      (a9, a10, 1), (a9, a8, 2), (a9, a1, 3),
      (a10, a9, 1), (a10, a1, 2)
    on conflict (article_id, related_id) do nothing;

    -- Link to the pre-existing stub where it genuinely relates.
    if stub_dot is not null then
      insert into public.kc_related (article_id, related_id, sort_order) values
        (a10, stub_dot, 3),
        (a9, stub_dot, 4)
      on conflict (article_id, related_id) do nothing;
    end if;
  end;

end $kc$;
