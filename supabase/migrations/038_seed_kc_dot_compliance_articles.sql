-- 038_seed_kc_dot_compliance_articles.sql
-- Knowledge Center Batch 2 — DOT Compliance cluster (10 authority pages).
--
-- ⚠️ COMMITTED; apply AFTER 015 (schema) and 037 (Batch 1 — the cross-link
-- update block at the end touches two Batch 1 bodies).
-- IDEMPOTENT AND NON-DESTRUCTIVE: every article inserts ONLY when no article
-- with the same (category, slug) exists; kc_related rows insert with
-- ON CONFLICT DO NOTHING; the two Batch 1 cross-link UPDATEs are guarded so
-- they run once and never clobber other content (slug-scoped, substring
-- replacement, skip when the link is already present).
--
-- Content rules (hard, same as 037):
--   * Original wording only. Official primary sources only (eCFR / FMCSA /
--     CVSA / official methodology sites), cited per claim and listed in
--     `sources`. Federal regulation vs CVSA criteria vs FMCSA guidance vs
--     recommendation vs company policy vs example are labeled in-text.
--   * No invented penalties, OOS thresholds, enforcement statistics,
--     retention periods, disqualifying conditions, or medical outcomes.
--   * reg_verified = true, reg_verified_date 2026-07-17 (visible
--     last-reviewed date), in-body regulatory-change disclaimer.
--   * Slugs are stable identifiers.

do $kc$
declare
  v_dot uuid;
  v_hos uuid;
  v_cdl uuid;
  v_pub timestamptz := '2026-07-17 13:00:00+00';
  v_bio text := 'CDL-A driver and instructor — 17 years driving, zero violations. Founder of Trucking Life with Shawn and the TLWS truck driving school in Dalton, Georgia.';
begin
  select id into v_dot from public.kc_categories where slug = 'dot-compliance';
  select id into v_hos from public.kc_categories where slug = 'hours-of-service';
  select id into v_cdl from public.kc_categories where slug = 'cdl-training';
  if v_dot is null or v_hos is null or v_cdl is null then
    raise exception 'Knowledge Center categories missing';
  end if;

  ---------------------------------------------------------------------------
  -- 1. DOT Inspection Levels 1–8 Compared (cluster pillar)
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_dot and slug = 'dot-inspection-levels-compared') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_dot,
      'dot-inspection-levels-compared',
      'DOT Inspection Levels 1–8 Compared: What Each One Checks',
      'The eight CVSA North American Standard inspection levels side by side — what each level covers, which ones examine the driver, the vehicle, or both, which can earn a decal, and how drivers should prepare for each.',
      $mdx$**Quick answer:** Roadside inspections in North America follow eight standardized levels defined by the [Commercial Vehicle Safety Alliance](https://www.cvsa.org/inspections/all-inspection-levels/). **Level I** is the full driver-plus-vehicle inspection (including under the vehicle); **Level II** is a walk-around (no under-vehicle); **Level III** checks the driver and credentials only; **Level IV** is a one-time special study; **Level V** inspects the vehicle only, without the driver; **Level VI** is the enhanced inspection for certain radioactive shipments; **Level VII** covers jurisdiction-mandated programs; **Level VIII** is the electronic inspection performed wirelessly while the vehicle is moving.

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026**. Inspection levels and procedures are defined and updated by CVSA; the underlying safety rules live in the FMCSRs. Confirm current details on [CVSA's inspection-levels page](https://www.cvsa.org/inspections/all-inspection-levels/) and with [FMCSA](https://www.fmcsa.dot.gov/) before relying on this. Not legal advice.

## What the inspection levels are

CVSA — the alliance of government enforcement agencies across the U.S., Canada, and Mexico — publishes the **North American Standard**: the uniform procedures certified inspectors follow at scales, checkpoints, and roadside stops. The "levels" are simply the standard's defined scopes, so a Level II in Georgia checks the same things as a Level II in Oregon. The rules being enforced come from [49 CFR Parts 390–396](https://www.ecfr.gov/current/title-49/part-396) (and Part 395 for your logs); the levels define how much of that ground one stop covers.

## Why the levels matter to a driver

Knowing the level tells you what is about to happen, how long it will take, and what paperwork or access the inspector needs. It also tells you what a decal on your windshield does and does not prove — and why a clean [pre-trip inspection](/knowledge/cdl-training/cdl-pre-trip-inspection-guide) is your side of every level.

## Who gets inspected

Any CMV operator can be selected at any level — fixed facilities, roadside, or targeted stops. Carrier safety history feeds screening systems, and visible defects invite attention; beyond that, do not assume any particular frequency or trigger. (**Not in the standard:** claims like "you're due every 90 days" are lot lore, not CVSA procedure.)

## The eight levels, one by one

### Level I — North American Standard Inspection

The full procedure: driver credentials, medical certificate, record of duty status, seat-belt use, and impairment indicators, plus a complete vehicle examination **including under-vehicle** components. Our deep dive: [Level 1 DOT Inspection Explained](/knowledge/dot-compliance/level-1-dot-inspection). A vehicle that passes without disqualifying defects can receive a **CVSA decal**.

### Level II — Walk-Around Driver/Vehicle Inspection

Everything in the driver portion plus a vehicle walk-around; the inspector examines what can be checked **without physically getting under the vehicle**.

### Level III — Driver/Credential/Administrative Inspection

Driver-only: license, medical certificate, [hours-of-service records](/knowledge/hours-of-service/cdl-hours-of-service-rules), seat belt, and related administrative requirements. No vehicle examination.

### Level IV — Special Inspection

A one-time examination of a particular item, typically as part of a study or to verify or refute a suspected trend. You will rarely see one, and its scope is whatever the study defines.

### Level V — Vehicle-Only Inspection

The full Level I vehicle examination **without the driver present** — commonly performed at a carrier's location, for example during a compliance review. Passing can also earn a CVSA decal.

### Level VI — Enhanced NAS Inspection for Radioactive Shipments

An enhanced inspection with additional criteria for select shipments of **highway route controlled quantities of radioactive material**. Vehicles and drivers on these moves are inspected under this dedicated standard before the trip.

### Level VII — Jurisdictional Mandated Commercial Vehicle Inspection

Inspections a state, province, or locality requires for particular operations — school buses, shared-ride services, and similar programs — performed under that jurisdiction's mandate rather than the core roadside program.

### Level VIII — North American Standard Electronic Inspection

A wireless inspection conducted electronically **while the vehicle is in motion**, with no direct interaction between officer and driver — the vehicle and carrier data (identifiers, license status, medical qualification, HOS, and more) are assessed in real time where jurisdictions have deployed it.

## Real-world example

**Example (illustration, not legal advice):** You cross a scale and get the "pull around back" board. An officer takes your CDL, med card, and ELD transfer — so far this could be a Level III. Then she asks you to turn on your lights and walks the rig: it became a Level II. If she'd rolled a creeper under the trailer, you'd be in a Level I, with a decal possible on the way out. Same rules, three different depths — and your preparation (documents in one place, logs current, pre-trip done) is identical for all three.

## Common mistakes

- Treating a decal like immunity. A decal reflects a passed Level I or V vehicle inspection — it does not exempt the driver portion, and an officer can always inspect.
- Not knowing your ELD's roadside transfer mode until an officer is waiting.
- Assuming Level III is "the easy one." Most driver out-of-service conditions — hours, license status — are exactly what Level III examines; see [CVSA Out-of-Service Criteria](/knowledge/dot-compliance/cvsa-out-of-service-criteria).
- Arguing scope ("you can't check that") — the standard defines scope, not the driver; the dispute channel afterward is [DataQs](/knowledge/dot-compliance/dataqs-disputes).

## Compliance risks

Violations found at any level go on the inspection report, feed the [FMCSA Safety Measurement System](/knowledge/dot-compliance/csa-scores-sms-explained), and follow both carrier and driver; out-of-service conditions stop the trip under the CVSA criteria. Inaccurate reports can be challenged through [DataQs](/knowledge/dot-compliance/dataqs-disputes).

## Driver checklist

- Documents staged: CDL, medical certificate, registration, permits, load papers.
- ELD transfer mode practiced.
- Logs current before the scale, not after.
- Pre-trip done daily — the vehicle portion of every level is checking your work.
- Know the level being performed; answer what is asked, briefly and honestly.

## Keep learning

- The deep dives: [Level 1 DOT Inspection Explained](/knowledge/dot-compliance/level-1-dot-inspection) · [CVSA Out-of-Service Criteria](/knowledge/dot-compliance/cvsa-out-of-service-criteria) · [Annual DOT Inspections](/knowledge/dot-compliance/annual-dot-inspection) · [What Is a DOT Inspection?](/knowledge/dot-compliance/what-is-a-dot-inspection)
- Your side of the glass: [Complete CDL Pre-Trip Inspection Guide](/knowledge/cdl-training/cdl-pre-trip-inspection-guide) · [CDL Hours of Service Rules](/knowledge/hours-of-service/cdl-hours-of-service-rules)
- Drill the underlying rules free: [General Knowledge practice test](/practice-tests/general-knowledge) · [practice-test hub](/practice-tests)
- Watch: [FMCSA Just Changed DOT Inspections](https://youtu.be/UlW-GlLugUg) on the Trucking Life with Shawn channel.
- **Learn inspection readiness hands-on:** [TLWS Academy](/academy) · start free with [CDL Pre-School](/cdl-pre-school) · [join the email list](/#newsletter).$mdx$,
      'DOT Inspection Levels 1–8 Compared (CVSA Standard) | Trucking Life with Shawn',
      'All eight CVSA inspection levels side by side: what Levels 1–8 check, which cover driver vs vehicle, which earn a decal, and how drivers prepare for each.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"CVSA — North American Standard Inspection Levels","url":"https://www.cvsa.org/inspections/all-inspection-levels/"},
        {"label":"49 CFR Part 396 — Inspection, Repair, and Maintenance (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-396"},
        {"label":"49 CFR Part 395 — Hours of Service of Drivers (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395"},
        {"label":"FMCSA — Federal Motor Carrier Safety Administration","url":"https://www.fmcsa.dot.gov/"}
      ]$j$::jsonb,
      $j$[
        {"q":"What is the difference between a Level 1 and Level 2 DOT inspection?","a":"Both examine the driver and the vehicle, but Level I includes under-vehicle components while Level II is limited to what an inspector can check in a walk-around without getting under the vehicle, per the CVSA North American Standard."},
        {"q":"Which DOT inspection levels can earn a CVSA decal?","a":"Vehicles that pass a Level I or Level V inspection without disqualifying defects can receive a CVSA decal. Levels II and III do not involve the full vehicle examination the decal represents."},
        {"q":"What is a Level 8 DOT inspection?","a":"The North American Standard Electronic Inspection — an inspection conducted wirelessly while the vehicle is in motion, with no direct officer interaction, assessing data such as license status, medical qualification, and hours of service where jurisdictions have deployed the capability."},
        {"q":"Does a Level 3 inspection check my truck?","a":"No. Level III is a driver/credential/administrative inspection — license, medical certificate, record of duty status, seat belt, and related items. The vehicle is not examined, but driver out-of-service conditions can still end the trip."},
        {"q":"What is a Level 6 inspection used for?","a":"Level VI is the enhanced North American Standard inspection applied to select shipments of highway route controlled quantities of radioactive material, with inspection criteria beyond the standard Level I."}
      ]$j$::jsonb,
      '{dot-inspection,cvsa,inspection-levels,roadside}',
      8, true, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 2. CVSA Out-of-Service Criteria
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_dot and slug = 'cvsa-out-of-service-criteria') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_dot,
      'cvsa-out-of-service-criteria',
      'CVSA Out-of-Service Criteria: What Parks a Driver or a Truck',
      'How the CVSA North American Standard Out-of-Service Criteria work: the difference between driver OOS and vehicle OOS, where the criteria come from, what an OOS order means, and how drivers avoid the conditions that trigger one.',
      $mdx$**Quick answer:** The **North American Standard Out-of-Service Criteria** are published by the [Commercial Vehicle Safety Alliance](https://www.cvsa.org/inspections/all-inspection-levels/) and identify the violations serious enough that a **driver, vehicle, or cargo may not continue** until the condition is fixed. Driver OOS conditions (for example, exceeding [hours-of-service limits](/knowledge/hours-of-service/cdl-hours-of-service-rules) or driving without a valid CDL) park the driver; vehicle OOS conditions (critical defects in systems like brakes or steering) park the truck. The criteria are updated by CVSA regularly — the CVSA publication itself, not secondhand summaries, is the authority for any specific threshold.

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026**. The OOS criteria are a CVSA publication updated on a recurring cycle, and the underlying rules are FMCSRs that also change. This page deliberately explains the framework rather than restating numeric thresholds — confirm specifics in the current CVSA criteria and the [eCFR](https://www.ecfr.gov/current/title-49/part-396) before relying on them. Not legal advice.

## What the OOS criteria are

Inspectors find violations of many severities. The OOS criteria are the line CVSA draws through that list: conditions judged to present an imminent hazard get an **out-of-service order**, meaning the driver or vehicle may not operate until the condition is corrected. Everything else still goes on the [inspection report](/knowledge/dot-compliance/level-1-dot-inspection) — it just doesn't stop the trip on the spot.

**Whose rule is what, clearly separated:**

- **Federal regulation:** the safety requirements themselves — brakes ([Part 393](https://www.ecfr.gov/current/title-49/part-393)), maintenance ([Part 396](https://www.ecfr.gov/current/title-49/part-396)), hours ([Part 395](https://www.ecfr.gov/current/title-49/part-395)), driving rules ([Part 392](https://www.ecfr.gov/current/title-49/part-392)).
- **CVSA criteria:** which violations of those rules rise to out-of-service severity. CVSA updates and publishes the criteria; enforcement across North America applies the same edition.
- **One regulatory OOS baked into the FMCSRs directly:** [49 CFR 392.5](https://www.ecfr.gov/current/title-49/part-392/section-392.5) — a driver found consuming or in possession of alcohol, or with any measured alcohol concentration, is placed out of service for **24 hours** (possession as part of a manifested shipment excepted).

## Why the criteria exist

Uniformity. Without a shared standard, a brake defect might park a truck in one state and roll through the next. The criteria give every certified inspector the same line, which is also why they are worth understanding rather than fearing: the line is written down.

## Who they apply to

Every CMV driver and vehicle subject to roadside inspection in participating jurisdictions across the U.S., Canada, and Mexico — company drivers and owner-operators alike.

## Driver OOS vs vehicle OOS, step by step

### Driver out-of-service

The driver may not drive until the condition clears. Typical categories (per the CVSA criteria — check the current edition for specifics):

- **Hours of service** — driving past the limits; the OOS ends when enough off-duty time restores legal hours. Deep dives: [11-hour limit](/knowledge/hours-of-service/11-hour-driving-limit) · [14-hour window](/knowledge/hours-of-service/14-hour-driving-window).
- **License and credentials** — no valid CDL for the vehicle class, suspended or disqualified status, missing required medical qualification. See [The DOT Medical Card](/knowledge/dot-compliance/dot-medical-card).
- **Impairment** — alcohol and drug conditions, including the 392.5 24-hour alcohol OOS above and the prohibited status covered in [drug and alcohol testing rules](/knowledge/dot-compliance/drug-alcohol-testing-clearinghouse).
- **Records** — no record of duty status where required (why the paper-log routine in [ELD Malfunctions](/knowledge/hours-of-service/eld-malfunctions) matters).

### Vehicle out-of-service

The vehicle may not be driven until repaired. The criteria address critical safety systems — brakes, steering, tires, wheels, coupling, frames, suspension, lighting where required, and [cargo securement](/knowledge/dot-compliance/cargo-securement-basics) — at defect severities the CVSA publication defines item by item. A vehicle OOS often means a mobile repair or tow before the trip resumes.

### Cargo/hazmat out-of-service

Securement failures and hazardous-materials violations can place the cargo or the whole operation out of service under the same framework.

## Real-world example

**Example (illustration, not legal advice):** At a Level II, the inspector finds a brake hose chafed through its outer layer and an air leak she can hear. Whether that specific condition is OOS is exactly what the CVSA criteria answer — she looks it up in the current edition, not from memory. If it is, the truck sits until it is repaired and the repair is verifiable; if not, it is a violation on the report you must still fix. Either way, [your pre-trip](/knowledge/cdl-training/cdl-pre-trip-inspection-guide) would have found the hose first — for the cost of a hose.

## Common mistakes

- Learning thresholds from the fuel-island lawyer. Brake-adjustment numbers, tread depths, percentages: quote the current CVSA publication or don't quote at all.
- Driving "just to the next exit" on an OOS order. Operating under an OOS order is itself a serious violation with consequences for driver and carrier.
- Assuming OOS is only about trucks — driver conditions (hours, license, medical) park more careers than brake shoes do.
- Treating an OOS as the end of the process. Repairs get certified, hours recover — and inaccurate reports can be disputed through [DataQs](/knowledge/dot-compliance/dataqs-disputes).

## Compliance risks

OOS violations carry heavy weight in the [Safety Measurement System](/knowledge/dot-compliance/csa-scores-sms-explained) and are tracked in carrier and driver histories; operating in violation of an OOS order escalates everything. The framework's whole design means most OOS conditions were findable before the trip — by inspection, by log discipline, by maintenance.

## Driver checklist

- Know your hours before every dispatch — the most common driver OOS is arithmetic.
- Carry a valid CDL and current medical certificate; know your [Clearinghouse status](/knowledge/dot-compliance/drug-alcohol-testing-clearinghouse).
- Pre-trip the critical systems daily: brakes, steering, tires, coupling, securement, lights.
- Zero alcohol anywhere near duty — 392.5's 24-hour OOS has no de minimis.
- If placed OOS: fix the condition, get it documented, and never move before it clears.

## Keep learning

- The inspection that applies these criteria: [DOT Inspection Levels 1–8 Compared](/knowledge/dot-compliance/dot-inspection-levels-compared) · [Level 1 DOT Inspection Explained](/knowledge/dot-compliance/level-1-dot-inspection)
- The clocks behind driver OOS: [CDL Hours of Service Rules](/knowledge/hours-of-service/cdl-hours-of-service-rules)
- Where violations land: [CSA Scores and the SMS](/knowledge/dot-compliance/csa-scores-sms-explained) · disputes via [DataQs](/knowledge/dot-compliance/dataqs-disputes)
- Free drills: [General Knowledge practice test](/practice-tests/general-knowledge) · [Air Brakes](/practice-tests/air-brakes)
- **Build OOS-proof habits:** [TLWS Academy](/academy) · [email list](/#newsletter).$mdx$,
      'CVSA Out-of-Service Criteria Explained — Driver vs Vehicle OOS | Trucking Life with Shawn',
      'How CVSA out-of-service criteria work: driver OOS vs vehicle OOS, the 392.5 alcohol rule, what an OOS order means, and the habits that keep trucks rolling.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"CVSA — North American Standard inspection program (OOS criteria publisher)","url":"https://www.cvsa.org/inspections/all-inspection-levels/"},
        {"label":"49 CFR 392.5 — Alcohol prohibition and 24-hour out-of-service (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-392/section-392.5"},
        {"label":"49 CFR Part 393 — Parts and Accessories Necessary for Safe Operation (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-393"},
        {"label":"49 CFR Part 396 — Inspection, Repair, and Maintenance (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-396"},
        {"label":"49 CFR Part 395 — Hours of Service of Drivers (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395"}
      ]$j$::jsonb,
      $j$[
        {"q":"What does out of service mean for a truck driver?","a":"An out-of-service order means the driver, vehicle, or cargo may not continue operating until the disqualifying condition is corrected — hours restored, defect repaired, credential resolved. Operating in violation of an OOS order is itself a serious violation."},
        {"q":"Who writes the out-of-service criteria?","a":"The Commercial Vehicle Safety Alliance (CVSA) publishes and regularly updates the North American Standard Out-of-Service Criteria, which participating jurisdictions across North America apply uniformly. The underlying safety rules are the FMCSRs."},
        {"q":"Can any alcohol put a driver out of service?","a":"Yes. Under 49 CFR 392.5, a driver consuming, possessing (other than as manifested cargo), or showing any measured alcohol concentration is placed out of service for 24 hours — separate from the 0.04 threshold that constitutes a testing violation under Part 382."},
        {"q":"Is an out-of-service violation worse than a normal violation on my record?","a":"OOS violations are weighted heavily in FMCSA's Safety Measurement System and are specifically tracked in carrier and driver histories, so they carry more consequence than non-OOS violations of the same rule area."}
      ]$j$::jsonb,
      '{cvsa,out-of-service,oos,roadside,compliance}',
      8, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 3. The DVIR Explained
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_dot and slug = 'dvir-explained') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_dot,
      'dvir-explained',
      'The DVIR Explained: When You Must Write One and Who Signs What',
      'The driver vehicle inspection report under 49 CFR 396.11 — when a written report is actually required since the 2014 rule change, how it differs from your pre-trip duty under 396.13, and who signs what in the repair loop.',
      $mdx$**Quick answer:** Under [49 CFR 396.11](https://www.ecfr.gov/current/title-49/part-396/section-396.11), a property-carrying driver must prepare a written **driver vehicle inspection report (DVIR)** at the end of each day's work **when a defect or deficiency is discovered** that would affect safe operation or cause a breakdown. Since the **December 2014 rule change, no-defect DVIRs are no longer required for property carriers** (passenger carriers still file them). The DVIR is the end-of-day paperwork; your **pre-trip duty** — being satisfied the vehicle is safe and reviewing the last DVIR — is the separate rule in [49 CFR 396.13](https://www.ecfr.gov/current/title-49/part-396/section-396.13).

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026** against the eCFR. Confirm the current [49 CFR 396.11](https://www.ecfr.gov/current/title-49/part-396/section-396.11) and [396.13](https://www.ecfr.gov/current/title-49/part-396/section-396.13) before relying on this — the 2014 change proves this exact rule does get rewritten. Not legal advice.

## What a DVIR is

The DVIR is the written record that connects what a driver found to what the carrier fixed. It covers at least the parts and accessories the regulation lists — service brakes, parking brake, steering mechanism, lighting devices and reflectors, tires, horn, windshield wipers, rear vision mirrors, coupling devices, wheels and rims, emergency equipment — and it must identify the vehicle and list any defect or deficiency the driver discovered or had reported to them.

Three documents drivers routinely blur together, separated:

- **Pre-trip inspection** — the *looking*, before driving ([396.13](https://www.ecfr.gov/current/title-49/part-396/section-396.13) and [392.7](https://www.ecfr.gov/current/title-49/part-392/section-392.7)). Not itself a written report. Full guide: [Complete CDL Pre-Trip Inspection Guide](/knowledge/cdl-training/cdl-pre-trip-inspection-guide).
- **DVIR** — the *writing*, at the completion of each day's work, when defects were found (396.11).
- **Periodic ("annual") inspection** — the once-every-12-months inspection under [396.17](/knowledge/dot-compliance/annual-dot-inspection), a different rule entirely.

## Why the rule exists

A defect found by a driver at 18:00 is worthless if the next driver leaves at 06:00 without knowing. The DVIR forces the loop: driver documents → carrier repairs or certifies no repair needed → next driver reviews and acknowledges. The 2014 change removed the millions of daily "no defect" reports precisely because they added paperwork without adding safety.

## Who does what, step by step

- **Step 1 — the driver at day's end.** Defect discovered (or reported to you)? Write the DVIR: vehicle identified, defect listed, signature. Multiple vehicles operated that day means the duty applies for each. No defect? For property carriers, **no report is required** — that is the 2014 change, in the regulation's own text.
- **Step 2 — the carrier before the next dispatch.** When a reported defect would affect safe operation, the carrier must repair it — or certify that repair is unnecessary — **before the vehicle is operated again**, and certify that on the DVIR ([396.11(a)(3)](https://www.ecfr.gov/current/title-49/part-396/section-396.11)).
- **Step 3 — the next driver.** Under 396.13, review the last DVIR and, **if defects were noted**, sign to acknowledge you reviewed it and that the required repair certification is there. No defects noted, nothing to countersign — your review duty and your own satisfaction that the vehicle is safe remain.
- **Step 4 — retention.** **Federal requirement:** the carrier keeps the DVIR, the repair certification, and the reviewing driver's acknowledgment for **three months** from the report date (396.11(c)(2)).

## Real-world example

**Example (illustration, not legal advice):** Tuesday night you write up a inoperative left-turn signal on tractor 4412. Wednesday morning another driver picks up 4412: the shop swapped the bulb overnight and certified the repair on your DVIR. The Wednesday driver reads it, sees the certification, signs the acknowledgment, does their own pre-trip — signal works — and rolls. Every signature in that chain answers a specific regulatory question: what was wrong, who fixed it, who verified the loop closed.

## Common mistakes

- Filing daily no-defect DVIRs "to be safe" at a property carrier. Not illegal — but if your company requires it, that is **company policy**, not 49 CFR, and it is worth knowing which is which.
- Skipping the DVIR because "the shop already knows." The regulation requires the report from the driver, not a hallway conversation.
- The next-day driver signing the acknowledgment without reading what was written or checking for the repair certification — the signature certifies exactly that review.
- Confusing the DVIR list with the whole pre-trip. Your 396.13/392.7 duty covers the vehicle's safe operation broadly; the DVIR's enumerated list is a minimum for the written report.
- Forgetting trailers. The report covers the vehicle(s) operated, including towed equipment defects you found.

## Compliance risks

Missing or false DVIRs, missing repair certifications, and operating with a known unrepaired defect that affects safety are all violations under Part 396 — discoverable at [roadside inspections](/knowledge/dot-compliance/dot-inspection-levels-compared) and in compliance reviews, and they feed the maintenance-related scores in the [Safety Measurement System](/knowledge/dot-compliance/csa-scores-sms-explained). A written trail that says "we knew" with no repair behind it is the worst document a carrier can own after a crash.

## Driver checklist

- End of day: any defect found or reported → DVIR written, signed, submitted.
- Multiple vehicles today → the duty applies for each one operated.
- Next morning: read the last DVIR; if defects were noted, verify the repair certification and sign the acknowledgment.
- Never accept a vehicle with an uncertified safety defect on its last DVIR.
- Know your carrier's DVIR mechanics (paper or electronic) — the medium is policy, the duty is federal.

## Keep learning

- The looking half of the loop: [Complete CDL Pre-Trip Inspection Guide](/knowledge/cdl-training/cdl-pre-trip-inspection-guide)
- The other inspections: [Annual DOT Inspections](/knowledge/dot-compliance/annual-dot-inspection) · [DOT Inspection Levels 1–8 Compared](/knowledge/dot-compliance/dot-inspection-levels-compared)
- Where maintenance violations land: [CSA Scores and the SMS](/knowledge/dot-compliance/csa-scores-sms-explained)
- Free drills: [General Knowledge practice test](/practice-tests/general-knowledge) covers inspection duties.
- **Learn the whole discipline:** [TLWS Academy](/academy) · free [CDL Pre-School](/cdl-pre-school) · [email list](/#newsletter).$mdx$,
      'DVIR Rules Explained — 49 CFR 396.11 After the 2014 Change | Trucking Life with Shawn',
      'When a DVIR is required: the defect-only rule for property carriers since 2014, the 396.11 repair-certification loop, and who signs what.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR 396.11 — Driver vehicle inspection report(s) (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-396/section-396.11"},
        {"label":"49 CFR 396.13 — Driver inspection (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-396/section-396.13"},
        {"label":"49 CFR 392.7 — Equipment, inspection and use (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-392/section-392.7"},
        {"label":"FMCSA — Federal Motor Carrier Safety Administration","url":"https://www.fmcsa.dot.gov/"}
      ]$j$::jsonb,
      $j$[
        {"q":"Is a daily no-defect DVIR still required at property carriers?","a":"No. Since the December 2014 rule change, 49 CFR 396.11 requires a written DVIR from property-carrying drivers only when a defect or deficiency is discovered or reported. Passenger-carrying operations still prepare reports regardless. Your carrier may require daily reports as company policy."},
        {"q":"Who signs a DVIR?","a":"The driver who prepares it signs it; the carrier certifies on it that listed defects were repaired or that repair was unnecessary; and the next driver signs an acknowledgment of having reviewed it when defects were noted (49 CFR 396.11 and 396.13)."},
        {"q":"How long must DVIRs be kept?","a":"The motor carrier must retain the DVIR, the certification of repairs, and the reviewing driver's acknowledgment for three months from the date the report was prepared, under 49 CFR 396.11(c)(2)."},
        {"q":"Is the pre-trip inspection the same as the DVIR?","a":"No. The pre-trip is the driver's duty before driving — being satisfied the vehicle is safe and reviewing the last report (49 CFR 396.13, 392.7). The DVIR is the written end-of-day report required when defects are found (396.11)."}
      ]$j$::jsonb,
      '{dvir,inspection,396-11,maintenance,compliance}',
      8, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 4. CSA Scores and the SMS
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_dot and slug = 'csa-scores-sms-explained') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_dot,
      'csa-scores-sms-explained',
      'CSA Scores and the SMS: How Violations Follow Drivers and Carriers',
      'What FMCSA''s CSA program and Safety Measurement System actually score: the seven BASICs, severity and time weighting, why there is no public "driver CSA score," and how inspections still follow drivers through the PSP.',
      $mdx$**Quick answer:** **CSA** (Compliance, Safety, Accountability) is FMCSA's enforcement program; its **Safety Measurement System (SMS)** groups inspection violations and crash records into **seven BASICs** and percentile-ranks **motor carriers** against peers to prioritize interventions. **CSA does not produce a public driver score** — but the inspections a driver takes still follow them: carriers see them in the SMS data they monitor, and prospective employers see a driver's five-year crash and three-year inspection history through FMCSA's **Pre-Employment Screening Program (PSP)**. Methodology source: [FMCSA's SMS documentation](https://csa.fmcsa.dot.gov/).

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026**. FMCSA revises SMS methodology over time — weights, groupings, and displays have all changed before. Confirm current details in [FMCSA's published SMS methodology](https://csa.fmcsa.dot.gov/) before relying on this. Not legal advice.

## What CSA and the SMS are

Every roadside inspection report and reportable crash lands in FMCSA's data systems. The SMS is the algorithm that turns that raw history into a prioritization tool: which carriers get warning letters, investigations, and interventions.

## Why it matters

Understanding the SMS kills two expensive myths at once — that CSA is a driver's personal score (it is not), and that violations vanish when the ticket is paid (they do not; adjudicated citations and SMS records are different things). Carriers make hiring, coaching, and termination decisions in the shadow of these numbers, so drivers live with the system whether they understand it or not.

## Who is scored — and who is not

The SMS percentile-ranks **motor carriers** (by USDOT number) against peers. **Drivers are not scored**, but they are recorded: every inspection a driver takes rides on the carrier's record, and the driver's own history is retrievable through PSP as described below. Owner-operators with their own authority are, for SMS purposes, carriers.

## The seven BASICs

The SMS organizes safety events into Behavior Analysis and Safety Improvement Categories:

- **Unsafe Driving** — moving violations recorded during inspections and enforcement (speeding, lane, texting, seat belt)
- **Crash Indicator** — the carrier's recordable crash history
- **Hours-of-Service Compliance** — everything covered in [our HOS guide](/knowledge/hours-of-service/cdl-hours-of-service-rules), from over-hours driving to log violations
- **Vehicle Maintenance** — the defects found at [inspections](/knowledge/dot-compliance/dot-inspection-levels-compared), plus [DVIR](/knowledge/dot-compliance/dvir-explained) and repair failures
- **Controlled Substances/Alcohol** — violations of the rules in [drug and alcohol testing](/knowledge/dot-compliance/drug-alcohol-testing-clearinghouse)
- **Hazardous Materials Compliance** — placarding, papers, and the rest of the hazmat rules
- **Driver Fitness** — licensing and [medical qualification](/knowledge/dot-compliance/dot-medical-card) records

## How the scoring works, step by step

Per the published methodology (state the mechanics, then check the current documents for specifics):

- **Step 1 — events accrue.** Violations from inspection reports and crashes attach to the carrier's record, generally remaining in the SMS calculation window for **24 months**.
- **Step 2 — severity weighting.** Each violation type carries a severity weight from FMCSA's published tables; out-of-service violations weigh heavier within their category.
- **Step 3 — time weighting.** Recent events count more than older ones under the methodology's published time-weighting steps.
- **Step 4 — peer grouping and percentiles.** Carriers are compared with peers of similar size/activity, producing percentile ranks per BASIC — a percentile, not an absolute grade.
- **Step 5 — intervention.** High percentiles in a BASIC draw FMCSA attention: warning letters, targeted roadside screening, investigations.

## Where drivers actually fit

**No public driver CSA score exists.** What exists for drivers:

- Their violations ride on the carrier's SMS record — which is why carriers care about every clean inspection.
- **PSP:** with the driver's consent, prospective employers can pull the driver's own **five years of crash data and three years of roadside inspection history** from FMCSA's [Pre-Employment Screening Program](https://www.fmcsa.dot.gov/). PSP is a record, not a score.
- Serious enough personal violations have their own consequences (disqualifications under Part 383, [OOS orders](/knowledge/dot-compliance/cvsa-out-of-service-criteria)) independent of any scoring.

## Real-world example

**Example (illustration, not legal advice):** A driver takes a Level II with one violation: a lamp inoperative. The carrier's Vehicle Maintenance BASIC absorbs a small, time-weighted hit that fades over 24 months. The same event appears in that driver's PSP history for three years, where a future recruiter will see it — one lamp, documented forever-ish. Multiply by a fleet and you understand why carriers chase clean inspections; multiply by a career and you understand why drivers should too.

## Common mistakes

- Calling PSP "my CSA score." PSP is history; SMS is carrier scoring; conflating them leads to bad decisions in both directions.
- Believing a paid ticket removes an inspection violation from SMS data. Citation adjudication and inspection records are separate tracks — data corrections go through [DataQs](/knowledge/dot-compliance/dataqs-disputes).
- Ignoring "minor" violations. Percentiles are comparative: a carrier's rank can move on volumes of small, recent, severity-weighted events.
- Quoting exact severity weights from memory. The tables are published — link them, don't folklore them.

## Compliance risks

For carriers: intervention exposure, insurance and shipper scrutiny of public BASIC data. For drivers: hiring friction via PSP and the carrier-level pressure that follows every inspection. The mitigation is unglamorous — [pre-trips](/knowledge/cdl-training/cdl-pre-trip-inspection-guide), hours discipline, and disputing genuinely wrong records promptly.

## Driver checklist

- Treat every inspection as a record that follows you (PSP) and your carrier (SMS).
- Keep your own copies of inspection reports; verify what enters your record.
- Dispute inaccuracies promptly through DataQs — with documentation.
- Ask a prospective carrier how they monitor SMS and coach drivers; it tells you how they will treat your record.
- Review your own PSP before job hunting — recruiters will.

## Keep learning

- The inspections that feed the data: [DOT Inspection Levels 1–8 Compared](/knowledge/dot-compliance/dot-inspection-levels-compared) · [CVSA Out-of-Service Criteria](/knowledge/dot-compliance/cvsa-out-of-service-criteria)
- Fixing bad records: [DataQs: How to Dispute an Inspection Report](/knowledge/dot-compliance/dataqs-disputes)
- The biggest BASIC inputs: [CDL Hours of Service Rules](/knowledge/hours-of-service/cdl-hours-of-service-rules) · [The DVIR Explained](/knowledge/dot-compliance/dvir-explained)
- Free drills: [General Knowledge practice test](/practice-tests/general-knowledge)
- **A zero-violation career is teachable:** [TLWS Academy](/academy) · [email list](/#newsletter).$mdx$,
      'CSA Scores and the SMS Explained — BASICs, Weighting, PSP | Trucking Life with Shawn',
      'What FMCSA''s CSA/SMS really scores: the seven BASICs, severity and time weighting, the 24-month window, why drivers have no public CSA score, and how PSP records follow them.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"FMCSA — CSA / Safety Measurement System methodology","url":"https://csa.fmcsa.dot.gov/"},
        {"label":"FMCSA — Federal Motor Carrier Safety Administration (PSP program)","url":"https://www.fmcsa.dot.gov/"},
        {"label":"49 CFR Part 395 — Hours of Service (HOS Compliance BASIC) (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-395"},
        {"label":"49 CFR Part 396 — Inspection, Repair, and Maintenance (Vehicle Maintenance BASIC) (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-396"}
      ]$j$::jsonb,
      $j$[
        {"q":"Do truck drivers have a CSA score?","a":"No public driver CSA score exists — the SMS percentile-ranks motor carriers, not drivers. A driver's inspections and crashes still follow them through the carrier's SMS data and through their own PSP record, which employers can request pre-hire."},
        {"q":"How long do violations stay in the SMS?","a":"Under the published methodology, violations and crashes generally remain in a carrier's SMS calculation for 24 months, with more recent events weighted more heavily. PSP driver records show three years of inspection history and five years of crash history."},
        {"q":"What are the seven CSA BASICs?","a":"Unsafe Driving, Crash Indicator, Hours-of-Service Compliance, Vehicle Maintenance, Controlled Substances/Alcohol, Hazardous Materials Compliance, and Driver Fitness — the categories FMCSA's Safety Measurement System uses to organize safety events."},
        {"q":"Does paying a ticket remove the violation from CSA data?","a":"No. Court adjudication of a citation and the inspection-report data in FMCSA's systems are separate. Corrections to inspection or crash records go through FMCSA's DataQs process, and outcomes depend on the reviewing agency."},
        {"q":"Can other companies see my inspection history?","a":"With your consent, prospective employers can obtain your PSP record — five years of crash involvement and three years of roadside inspection history from FMCSA data. Many carriers request it as a standard part of hiring."}
      ]$j$::jsonb,
      '{csa,sms,basics,psp,safety-score}',
      9, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 5. DataQs
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_dot and slug = 'dataqs-disputes') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_dot,
      'dataqs-disputes',
      'DataQs: How to Dispute an Inspection Report or Crash Record',
      'How FMCSA''s DataQs system works: who can file a Request for Data Review, what DataQs can and cannot change, the crash preventability program, and how to build a dispute that the reviewing agency can actually act on.',
      $mdx$**Quick answer:** [DataQs](https://dataqs.fmcsa.dot.gov/) is FMCSA's online system for filing a **Request for Data Review (RDR)** on federal and state crash and inspection data. **Anyone can file** — drivers, carriers, or other parties. The request is routed to the agency responsible for the record (usually the state that conducted the inspection), which reviews and decides. DataQs can **correct or remove inaccurate data**; it cannot re-try a citation, and **no outcome is guaranteed**.

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026**. DataQs processes and the crash-preventability program are administered by FMCSA and evolve; confirm the current process at [dataqs.fmcsa.dot.gov](https://dataqs.fmcsa.dot.gov/) before relying on this. Not legal advice.

## What DataQs is

Inspection reports and crash records feed the [Safety Measurement System](/knowledge/dot-compliance/csa-scores-sms-explained) and driver PSP histories. When one of those records is wrong — the violation cited doesn't match the facts, the crash was assigned to the wrong carrier, the report has a data error — DataQs is the official channel for asking the responsible agency to review it. It is a data-quality process, not an appeals court.

**What it can and cannot do, clearly separated:**

- **Can:** correct inaccurate fields, remove violations or crashes documented in error, attach preventability determinations to eligible crashes, fix duplicate or misassigned records.
- **Cannot:** overturn a citation you were convicted of in court, re-adjudicate whether you deserved a ticket, or promise removal of any record. The reviewing agency decides; filing is a request.

## Why it matters

Records drive consequences: carrier SMS percentiles, driver PSP histories, insurance reviews, hiring decisions. A wrong record left unchallenged works against you for years; a documented RDR is the only sanctioned way to fix it.

## Who can file

**FMCSA process fact:** any registered DataQs user — a driver personally, a carrier, or another party with an interest in the record. Drivers do **not** need to route requests through their carrier, though telling your carrier is usually wise since the record affects both of you.

## How to file a request, step by step

- **Step 1 — get the record.** You need the inspection report number (or crash report details), date, and jurisdiction — another reason to keep every inspection report you're handed.
- **Step 2 — register and file.** Create a DataQs account, open an RDR, select the record and the specific element you dispute.
- **Step 3 — make a factual argument.** State what the record says, what actually happened, and attach evidence: photos, repair invoices, the ELD file, the shipping papers, the court disposition. Reviewing agencies act on documentation, not indignation.
- **Step 4 — the agency reviews.** The request routes to the agency that owns the record — usually the inspecting state. They may accept, reject, or ask for more information.
- **Step 5 — the result flows downstream.** Corrections propagate into FMCSA data systems, including the records behind SMS and PSP. Keep the closure documentation.

### Crash preventability reviews

For crash types eligible under FMCSA's **Crash Preventability Determination Program**, a DataQs request can seek a determination that a crash was **not preventable** — an eligible-type list and process FMCSA publishes and has expanded over time. A "not preventable" determination changes how the crash is treated in SMS displays and calculations per the current methodology; it does not erase the crash from history.

## Real-world example

**Example (illustration, not legal advice):** An inspection report cites an inoperative headlamp — but your dashcam timestamp and the truck-stop receipt show the lamp was replaced two hours before the inspection, and the officer's narrative describes the *other* lamp position. You file an RDR with the report number, both documents, and a two-paragraph factual account. The state reviews and corrects the record — or explains why not. Either way you now have a documented, time-stamped challenge instead of a grievance.

## Common mistakes

- Arguing the ticket instead of the record. "The fine was unfair" is for court; "the report states X, the evidence shows Y" is for DataQs.
- Filing with no evidence. An unsupported RDR is an easy rejection.
- Waiting a year. Evidence goes stale; file while the paper trail is fresh.
- Expecting removal because you filed. Agencies keep accurate records exactly as often as they fix inaccurate ones — treat DataQs as review, never as erasure.
- Not checking the outcome landed everywhere: after acceptance, verify the change appears in your PSP and the carrier's SMS view.

## Compliance risks

Nothing about filing an RDR harms your record — the risk is in *not* filing when a record is genuinely wrong, and in relying on promised outcomes when planning around a dispute. Records under review generally remain in effect until the owning agency changes them.

## Driver checklist

- Keep every inspection report, photo the truck at the scene when practical.
- File RDRs personally when the record about you is wrong; loop your carrier in.
- Evidence first: documents, timestamps, dispositions.
- One issue per request, stated factually.
- Follow up until the correction (or the final answer) is documented.

## Keep learning

- What the records feed: [CSA Scores and the SMS](/knowledge/dot-compliance/csa-scores-sms-explained)
- Where the records come from: [DOT Inspection Levels 1–8 Compared](/knowledge/dot-compliance/dot-inspection-levels-compared) · [Level 1 DOT Inspection Explained](/knowledge/dot-compliance/level-1-dot-inspection)
- Avoiding the dispute entirely: [CVSA Out-of-Service Criteria](/knowledge/dot-compliance/cvsa-out-of-service-criteria) · [Complete CDL Pre-Trip Inspection Guide](/knowledge/cdl-training/cdl-pre-trip-inspection-guide)
- Free drills: [General Knowledge practice test](/practice-tests/general-knowledge)
- **Drive a record worth defending:** [TLWS Academy](/academy) · [email list](/#newsletter).$mdx$,
      'DataQs Explained — Disputing Inspection and Crash Records | Trucking Life with Shawn',
      'How to use FMCSA''s DataQs: who can file a Request for Data Review, what it can and cannot change, and how to document a dispute properly.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"FMCSA — DataQs (Requests for Data Review)","url":"https://dataqs.fmcsa.dot.gov/"},
        {"label":"FMCSA — CSA / Safety Measurement System","url":"https://csa.fmcsa.dot.gov/"},
        {"label":"FMCSA — Federal Motor Carrier Safety Administration","url":"https://www.fmcsa.dot.gov/"}
      ]$j$::jsonb,
      $j$[
        {"q":"Can a driver file a DataQs challenge without their company?","a":"Yes. Any registered DataQs user — including a driver personally — can file a Request for Data Review on a record about them. The request routes to the agency that owns the record, typically the inspecting state."},
        {"q":"Can DataQs remove a violation from my record?","a":"It can, when the reviewing agency agrees the record is inaccurate — but no outcome is promised. DataQs corrects data errors; it does not overturn court adjudications or re-try citations."},
        {"q":"What is the crash preventability program in DataQs?","a":"FMCSA's Crash Preventability Determination Program lets eligible crash types be reviewed through DataQs for a determination that the crash was not preventable, which changes how the crash is treated in SMS under the current methodology. Eligibility and process are defined by FMCSA."},
        {"q":"What evidence should a DataQs request include?","a":"Whatever documents the factual error: the inspection report number, photos, repair invoices, ELD records, shipping papers, court dispositions, dashcam stills. Reviewing agencies act on documentation tied to the specific record element being disputed."}
      ]$j$::jsonb,
      '{dataqs,disputes,rdr,crash-preventability,records}',
      8, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 6. The DOT Medical Card
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_dot and slug = 'dot-medical-card') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_dot,
      'dot-medical-card',
      'The DOT Medical Card: Requirements, Renewals, and Disqualifiers',
      'How DOT medical certification works under 49 CFR 391.41–391.45: what the certified medical examiner evaluates, how long certificates last, the CDL self-certification step, and how regulatory paths handle conditions like insulin-treated diabetes.',
      $mdx$**Quick answer:** Interstate CMV drivers must be **medically certified** under [49 CFR 391.41](https://www.ecfr.gov/current/title-49/part-391/section-391.41). The exam is performed by a **certified medical examiner** listed on FMCSA's National Registry ([49 CFR 391.42–391.43](https://www.ecfr.gov/current/title-49/part-391/section-391.43)), who issues a **Medical Examiner's Certificate (MEC, Form MCSA-5876)** valid for **up to 24 months** — the examiner may certify for less when a condition warrants monitoring. CDL holders must also **self-certify** their operation type with their state licensing agency so the medical status attaches to the license. **The examiner, applying the federal standards, decides qualification — no article can.**

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026** against the eCFR. Medical qualification rules change — insulin-treated diabetes gained a regulatory path in 2018 ([391.46](https://www.ecfr.gov/current/title-49/part-391/section-391.46)) and vision gained an alternative standard in 2022 ([391.44](https://www.ecfr.gov/current/title-49/part-391/section-391.44)) — so confirm the current [Part 391, Subpart E](https://www.ecfr.gov/current/title-49/part-391) and [FMCSA's medical program pages](https://www.fmcsa.dot.gov/) before relying on this. This page is education, **not medical advice, and it cannot tell you whether you qualify.**

## What the medical card is

The "DOT physical" verifies that a driver meets the physical qualification standards of 391.41(b) — a list covering vision, hearing, cardiovascular, respiratory, neurological, musculoskeletal conditions, diabetes, and the use of certain medications — as evaluated by an examiner trained and listed under FMCSA's **National Registry of Certified Medical Examiners**. Pass, and you carry the MEC; for CDL holders the result is also transmitted into the licensing system.

## Why it exists

An 80,000-pound vehicle amplifies any medical event. The standards target conditions that could cause sudden incapacity or gradually erode safe operation, and the certified-examiner requirement exists because evaluating them against the federal standards is specialized work — which is also why this article stays out of the examiner's chair.

## Who needs it

**Federal requirement:** drivers of CMVs in interstate commerce as defined in [390.5](https://www.ecfr.gov/current/title-49/part-390/section-390.5). CDL holders self-certify one of four operation categories with the state (interstate/intrastate, excepted/non-excepted); non-excepted interstate drivers must keep a current MEC on file with the state. Intrastate-only rules are the state's, often parallel. **State-variation note:** self-certification mechanics and grace practices vary by state licensing agency — confirm with yours.

## How certification works, step by step

- **Step 1 — find a certified examiner.** Only examiners on FMCSA's National Registry can issue a valid MEC (391.42). Doctors, DOs, PAs, APNs, and chiropractors can all be registry-certified, varying by state scope.
- **Step 2 — the exam.** Health history plus examination against the 391.41(b) standards: vision (including the distant-acuity and field-of-vision standards in the regulation), hearing (the whisper-test or audiometric standard), blood pressure and cardiovascular status, and the rest of the listed categories.
- **Step 3 — the determination.** The examiner certifies, certifies for a shorter period, or does not certify — their determination, applying the federal standards and FMCSA's examiner guidance. Periodic monitoring (a one-year or shorter card) is common where a condition needs watching; the specific interval is the examiner's call within the regulation's 24-month maximum.
- **Step 4 — regulatory paths for specific conditions.** Some conditions have their own defined routes rather than a flat bar: **insulin-treated diabetes** through the 391.46 process (treating-clinician form, then examiner evaluation), **vision** in one eye through the 391.44 alternative standard, and certain conditions through FMCSA **exemption programs**. What these paths require is exactly what the cited sections say — not what a forum remembers.
- **Step 5 — self-certify and carry.** CDL holders submit the operation category (and MEC where required) to the state licensing agency; the medical status rides on the CDL record checked at [roadside inspections](/knowledge/dot-compliance/dot-inspection-levels-compared). An expired MEC is a [driver out-of-service and disqualification problem](/knowledge/dot-compliance/cvsa-out-of-service-criteria), not paperwork trivia.

## Real-world example

**Example (illustration, not legal advice):** A driver's exam shows elevated blood pressure. The examiner — following the standards and FMCSA guidance — issues a shorter-duration certificate and tells the driver what improvement the next exam needs to show. Nothing about that outcome came from a fixed public chart the driver could have gamed; it came from the examiner applying the program's guidance to one person's numbers. The driver's move is treatment and a calendar reminder, not internet threshold-shopping.

## Common mistakes

- Letting the card expire because the CDL is still valid. The license and the medical certification are separate clocks, and the state can downgrade a CDL over a lapsed medical.
- Using a non-registry examiner. The certificate is invalid regardless of the exam's quality.
- Reading condition lists online as verdicts. The regulation defines standards and paths; the examiner applies them to you. Assume nothing in either direction.
- Skipping the self-certification update after changing operation type — the state record is what enforcement sees.
- Withholding history from the examiner. Certification obtained on bad information unwinds badly.

## Compliance risks

Driving without valid medical certification when required violates Part 391, appears in the Driver Fitness area of the [SMS](/knowledge/dot-compliance/csa-scores-sms-explained), can place a driver out of service, and can lead to CDL downgrade under state implementation of the federal rules. The fix is boring: a valid card, a registry examiner, a current self-certification.

## Driver checklist

- Know your MEC expiration; calendar the renewal 60+ days early.
- Use only National Registry examiners; verify the listing.
- Bring your history: conditions, medications, treating-clinician documentation where a regulatory path (like 391.46) requires it.
- After the exam: card in the truck, state self-certification current.
- Condition changed materially? Deal with it before enforcement or a crash makes it the record.

## Keep learning

- Where medical status gets checked: [DOT Inspection Levels 1–8 Compared](/knowledge/dot-compliance/dot-inspection-levels-compared) · [CVSA Out-of-Service Criteria](/knowledge/dot-compliance/cvsa-out-of-service-criteria)
- The other qualification program: [CDL Drug and Alcohol Testing and the Clearinghouse](/knowledge/dot-compliance/drug-alcohol-testing-clearinghouse)
- Starting your CDL journey? The physical is step one — [CDL Pre-School](/cdl-pre-school) walks you to the permit free, and [TLWS Academy](/academy) takes you the rest of the way.
- Free drills: [General Knowledge practice test](/practice-tests/general-knowledge) · [email list](/#newsletter) for new guides.$mdx$,
      'DOT Medical Card Requirements and Renewals (49 CFR 391.41) | Trucking Life with Shawn',
      'DOT medical certification: the certified examiner''s role, the 24-month maximum card, CDL self-certification, and regulatory paths like 391.46.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR 391.41 — Physical qualifications for drivers (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.41"},
        {"label":"49 CFR 391.43 — Medical examination; certificate (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.43"},
        {"label":"49 CFR 391.46 — Insulin-treated diabetes mellitus (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.46"},
        {"label":"49 CFR 391.44 — Alternative vision standard (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.44"},
        {"label":"FMCSA — Medical program / National Registry","url":"https://www.fmcsa.dot.gov/"}
      ]$j$::jsonb,
      $j$[
        {"q":"How long is a DOT medical card good for?","a":"Up to 24 months under 49 CFR 391.45, but the certified medical examiner may issue a shorter certificate when a condition warrants monitoring — one-year and shorter cards are common outcomes of that discretion."},
        {"q":"Who can perform a DOT physical?","a":"Only a medical examiner certified and listed on FMCSA's National Registry of Certified Medical Examiners (49 CFR 391.42–391.43). Depending on state scope of practice, that can include MDs, DOs, physician assistants, advanced practice nurses, and chiropractors."},
        {"q":"Can a diabetic on insulin get a DOT medical card?","a":"There is a defined regulatory path: 49 CFR 391.46 allows insulin-treated drivers to be certified when the treating clinician completes the required assessment and the certified medical examiner determines the standards are met. The examiner makes the individual determination — no article can."},
        {"q":"What happens if my medical card expires?","a":"Without valid medical certification where required, you are not qualified to drive under Part 391 — a driver out-of-service condition — and state licensing agencies can downgrade a CDL over a lapsed medical status. Renew before expiration, not after."}
      ]$j$::jsonb,
      '{dot-physical,medical-card,391-41,medical-examiner,qualification}',
      9, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 7. Drug & Alcohol Testing + Clearinghouse
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_dot and slug = 'drug-alcohol-testing-clearinghouse') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_dot,
      'drug-alcohol-testing-clearinghouse',
      'CDL Drug and Alcohol Testing Rules and the Clearinghouse',
      'The DOT testing program under 49 CFR Parts 40 and 382: the six test types, the 0.04 and 0.02 alcohol lines, what the Clearinghouse records and who must query it, and the SAP-supervised return-to-duty and follow-up process.',
      $mdx$**Quick answer:** CDL drivers performing safety-sensitive functions are covered by the DOT testing program: **[49 CFR Part 382](https://www.ecfr.gov/current/title-49/part-382)** says when tests happen (pre-employment, random, post-accident, reasonable suspicion, return-to-duty, follow-up) and **[Part 40](https://www.ecfr.gov/current/title-49/part-40)** says how. Violations — positives, refusals, the **0.04+ alcohol** line — go into FMCSA's **[Drug and Alcohol Clearinghouse](https://clearinghouse.fmcsa.dot.gov/)**, employers must query it, and a driver in **prohibited status** cannot perform safety-sensitive functions (and faces CDL downgrade under the current rules) until completing the **SAP-supervised return-to-duty process**.

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026**. This program moves — oral-fluid testing was authorized in 2023 (pending lab certification for actual use), and the Clearinghouse's license-downgrade provisions took effect in 2024. Confirm the current [Part 382](https://www.ecfr.gov/current/title-49/part-382), [Part 40](https://www.ecfr.gov/current/title-49/part-40), and [Clearinghouse site](https://clearinghouse.fmcsa.dot.gov/) before relying on this. Not legal advice.

## What the program covers

The DOT drug panel and alcohol testing under Part 40's procedures — collection, laboratory, **Medical Review Officer (MRO)** verification, and reporting are all federally specified, which is what makes a DOT test different from a company screen.

## Why the program exists

Impairment in a CMV is uniquely unforgiving, and self-reporting is unreliable by design of the problem. The program substitutes verified testing at defined moments — before hiring, at random, after qualifying crashes, on trained observation — plus a national record (the Clearinghouse) so a violation at one employer cannot be quietly left behind at the next.

## Who is covered

**Federal requirement:** CDL holders operating CMVs that require a CDL, when performing "safety-sensitive functions" — a defined term that covers far more than driving (waiting to be dispatched, inspecting, loading supervision, and more, per [382.107](https://www.ecfr.gov/current/title-49/part-382/section-382.107)). Owner-operators are covered too, and must be enrolled in a consortium for random testing.

## The six test types, step by step

- **Pre-employment** — a negative DOT drug test result is required **before** first performing safety-sensitive functions for an employer (382.301).
- **Random** — unannounced, spread through the year, at annual minimum rates FMCSA sets and publishes; selection must be scientifically random, and notification means you proceed to the collection site immediately (382.305).
- **Post-accident** — after qualifying crashes per the table in [382.303](https://www.ecfr.gov/current/title-49/part-382/section-382.303): any fatality, or an injury-treated-away or disabling-tow crash where the driver received a citation. The regulation's table, not the tow truck's presence alone, decides.
- **Reasonable suspicion** — ordered by a trained supervisor based on specific, contemporaneous observations (382.307).
- **Return-to-duty (RTD)** — the directly observed test that ends prohibited status after the SAP process below (Part 40, Subpart O).
- **Follow-up** — unannounced, directly observed tests after RTD on the SAP's plan: **at least 6 tests in the first 12 months**, extendable **up to 5 years** (40.307).

**The two alcohol lines, precisely:** a confirmed **0.04 or greater** is a program violation; **0.02–0.039** is not a violation but stands the driver down from safety-sensitive functions for at least 24 hours (382.505). And separately from testing, [49 CFR 392.5's](/knowledge/dot-compliance/cvsa-out-of-service-criteria) roadside alcohol rule carries its own 24-hour out-of-service.

## The Clearinghouse

The [Clearinghouse](https://clearinghouse.fmcsa.dot.gov/) is FMCSA's database of program violations: verified positives, refusals, actual-knowledge violations, and the RTD milestones that clear them.

- **Employers must query:** a full pre-employment query before a driver first performs safety-sensitive functions, and at least a **limited query annually** on every driver (382.701).
- **Reporting in:** MROs report verified positives; employers report refusals, actual knowledge, and 0.04+ alcohol results.
- **Drivers can and should register** to view their own record and provide the consents queries require.
- **Prohibited status has teeth:** under the Clearinghouse-II rules effective 2024, state licensing agencies must **downgrade the CDL** of a driver in prohibited status until the RTD process restores them.

## Return-to-duty, honestly described

A violation is not automatically a career ending — it is a defined, supervised road back, and both halves of that sentence are true:

- **Step 1 — immediate removal** from safety-sensitive functions.
- **Step 2 — SAP evaluation.** A qualified **Substance Abuse Professional** assesses and prescribes education and/or treatment (Part 40, Subpart O).
- **Step 3 — compliance, re-evaluation** by the SAP.
- **Step 4 — RTD test**, directly observed, negative result required.
- **Step 5 — follow-up plan**, 6+ tests in 12 months, up to 5 years, directly observed and unannounced.

**Both sides' duties, kept distinct:** the **employer** runs the testing program, queries, reports, and may not use a prohibited driver; the **driver** owns showing up for tests, the SAP process, consents, and their own Clearinghouse record. Neither side's obligations transfer to the other. (**Company policy note:** employers may layer stricter policies — zero-tolerance firing, hair testing as a hiring screen — on top; those are policy, not Part 382, and the Clearinghouse records only DOT-program violations.)

## Real-world example

**Example (illustration, not legal advice):** A driver's random comes back a verified positive from the MRO. Removal is immediate; the violation enters the Clearinghouse; prohibited status begins and the state moves to downgrade the CDL under the 2024 rules. The driver engages a SAP, completes the prescribed program, passes a directly observed RTD test, and returns under a follow-up plan of unannounced tests. Eighteen months later they are driving with a documented, completed RTD record — the process worked exactly as designed in both directions: real consequence, real road back.

## Common mistakes

- Believing a refusal is safer than a positive. A refusal — including not showing up, or conduct that obstructs collection — is a violation with the same Clearinghouse consequences (40.191, 382.211).
- Ignoring the Clearinghouse until a job application. Register, check your record, and handle consent requests promptly — an unanswered query consent blocks hiring.
- Assuming state cannabis law changes the federal program. It does not; DOT testing and the Clearinghouse are federal.
- Treating the 0.02–0.039 stand-down as "passing." It is not a violation, but you are done driving for at least 24 hours under 382.505.
- Quitting mid-RTD and assuming a new employer resets it. Prohibited status and the SAP plan follow the driver in the Clearinghouse until completed.

## Compliance risks

Program violations mean prohibited status, Clearinghouse records visible to every future DOT employer, CDL downgrade until RTD, and entries in the Controlled Substances/Alcohol area of the [SMS](/knowledge/dot-compliance/csa-scores-sms-explained) for the carrier. For carriers, missed queries and program failures are their own violation exposure.

## Driver checklist

- Register on the Clearinghouse; review your own record.
- Respond to query consents same-day.
- Know what counts as a refusal; when in doubt, complete the test and dispute later.
- Any prescription that could affect a DOT panel? Have the MRO conversation with documentation ready.
- If a violation happens: SAP immediately, follow the plan exactly, keep every completion document.

## Keep learning

- The roadside side of alcohol rules: [CVSA Out-of-Service Criteria](/knowledge/dot-compliance/cvsa-out-of-service-criteria)
- The other qualification track: [The DOT Medical Card](/knowledge/dot-compliance/dot-medical-card)
- Where program violations land: [CSA Scores and the SMS](/knowledge/dot-compliance/csa-scores-sms-explained) · the inspections that check status: [DOT Inspection Levels 1–8 Compared](/knowledge/dot-compliance/dot-inspection-levels-compared)
- Free drills: the [General Knowledge practice test](/practice-tests/general-knowledge) covers the rules of the road this program protects.
- Starting fresh? [TLWS Academy](/academy) trains drivers for careers that never meet a SAP — begin free with [CDL Pre-School](/cdl-pre-school) · [email list](/#newsletter).$mdx$,
      'CDL Drug and Alcohol Testing + Clearinghouse Rules (Parts 40/382) | Trucking Life with Shawn',
      'DOT testing for CDL drivers: the six test types, the 0.04 and 0.02 alcohol lines, Clearinghouse queries, and the SAP return-to-duty process.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR Part 382 — Controlled Substances and Alcohol Use and Testing (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-382"},
        {"label":"49 CFR Part 40 — Procedures for Transportation Workplace Testing (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-40"},
        {"label":"49 CFR 382.303 — Post-accident testing (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-382/section-382.303"},
        {"label":"FMCSA — Drug and Alcohol Clearinghouse","url":"https://clearinghouse.fmcsa.dot.gov/"}
      ]$j$::jsonb,
      $j$[
        {"q":"When is a DOT post-accident drug test required?","a":"Per the table in 49 CFR 382.303: always after a fatality; and after a crash involving an injury treated away from the scene or a vehicle towed disabled when the CDL driver received a citation. The regulation's table controls — not the mere presence of a tow truck."},
        {"q":"What alcohol level is a violation for CDL drivers?","a":"A confirmed 0.04 or greater is a program violation under Part 382. A result of 0.02–0.039 is not a violation but removes the driver from safety-sensitive functions for at least 24 hours under 382.505. Roadside, 49 CFR 392.5 separately imposes a 24-hour out-of-service for any measured alcohol."},
        {"q":"What does the Clearinghouse show employers?","a":"DOT program violations — verified positive tests, refusals, actual-knowledge violations, and 0.04+ alcohol results — plus return-to-duty status. Employers must run a full query before using a new driver and at least a limited query annually on every driver."},
        {"q":"How does a driver get out of prohibited status?","a":"Only through the return-to-duty process of Part 40, Subpart O: SAP evaluation, completing the prescribed education or treatment, SAP re-evaluation, a negative directly observed RTD test, then unannounced follow-up testing — at least 6 tests in 12 months, extendable to 5 years."},
        {"q":"Does a refusal count the same as a positive test?","a":"A refusal is itself a violation with the same consequences — Clearinghouse record, prohibited status, and the full return-to-duty process. Failing to appear, leaving the site, or obstructing collection can all constitute refusal under 49 CFR 40.191."}
      ]$j$::jsonb,
      '{drug-testing,alcohol,clearinghouse,part-40,part-382,sap}',
      10, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 8. Cargo Securement Basics
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_dot and slug = 'cargo-securement-basics') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_dot,
      'cargo-securement-basics',
      'Cargo Securement Basics: Tie-Downs, Working Load Limits, and the Rules',
      'The federal cargo securement rules in 49 CFR Part 393 Subpart I: the performance standard, aggregate working load limit, the general tie-down minimums, and why commodity-specific rules override the general counts.',
      $mdx$**Quick answer:** Cargo on a CMV must be secured under [49 CFR Part 393, Subpart I](https://www.ecfr.gov/current/title-49/part-393) so it cannot leak, spill, blow, fall from, or shift on the vehicle ([392.9](https://www.ecfr.gov/current/title-49/part-392/section-392.9) makes driving without that a violation). The system must meet the **performance standard** of [393.102](https://www.ecfr.gov/current/title-49/part-393/section-393.102) (holding against defined forward, rearward, and sideways forces), the **aggregate working load limit** of the tie-downs must be **at least half the cargo weight** ([393.106(d)](https://www.ecfr.gov/current/title-49/part-393/section-393.106)), general freight follows the **tie-down minimums in [393.110](https://www.ecfr.gov/current/title-49/part-393/section-393.110)** — and for listed commodities, the **commodity-specific rules control**, not the general counts.

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026** against the eCFR. Confirm the current [Part 393, Subpart I](https://www.ecfr.gov/current/title-49/part-393) — and your commodity's specific section — before relying on this. Not legal advice.

## What the securement rules are

Subpart I is a layered system:

- **A performance standard (393.102):** the securement must withstand deceleration in the forward direction and acceleration in the rearward and lateral directions at the g-values the section specifies — the physics target every method must hit.
- **General securement rules (393.104–393.114):** proper devices in proper condition, blocking and bracing, front-end structures, and the tie-down mathematics below.
- **Commodity-specific rules (393.116–393.136):** logs, dressed lumber, metal coils, paper rolls, concrete pipe, intermodal containers, vehicles-as-cargo, roll-on/roll-off containers, boulders, and heavy equipment each have their own section that **supplements or replaces** the general rules.

## Why it matters

A shifted load steers the truck; a lost load becomes everyone's emergency. Securement violations are also inspection staples — visible in seconds at any [Level I or II](/knowledge/dot-compliance/dot-inspection-levels-compared), with the serious ones sitting in the [CVSA out-of-service criteria](/knowledge/dot-compliance/cvsa-out-of-service-criteria).

## Who it applies to

**Federal requirement:** every CMV operator in interstate commerce — dry van freight included. Securement is not a flatbed specialty: 392.9's "secured and unshifting" duty applies to pallets in a box just as to coils on a deck, and the driver shares it personally.

## The load math, step by step

- **Step 1 — know the cargo weight.** Every rule below is computed from it.
- **Step 2 — working load limit (WLL).** Each device's WLL comes from its marking or, unmarked, from the default tables in [393.108](https://www.ecfr.gov/current/title-49/part-393/section-393.108). A tie-down's rating is its weakest component's.
- **Step 3 — aggregate WLL.** Sum the tie-downs per 393.106(d)'s counting method: the total must be **at least 50% of the cargo weight**.
- **Step 4 — minimum count for general freight ([393.110](https://www.ecfr.gov/current/title-49/part-393/section-393.110)):** one tie-down for articles 5 ft or shorter and 1,100 lbs or lighter; two tie-downs for articles 5 ft or shorter and heavier than 1,100 lbs, or for articles longer than 5 ft up to 10 ft; and for longer articles, two plus **one more for each additional 10 ft or fraction thereof**. These minimums apply when the article is not blocked against forward movement; blocked cargo has its own line in the section.
- **Step 5 — commodity check.** Hauling a listed commodity? Its section governs — **general counts do not answer coil, log, or equipment questions.** Read the specific rule or the [FMCSA driver's handbook on cargo securement](https://www.fmcsa.dot.gov/).
- **Step 6 — inspect en route.** [392.9(b)](https://www.ecfr.gov/current/title-49/part-392/section-392.9) requires examining the cargo and securement within the first 50 miles and re-examining at duty changes, and at intervals of 3 hours or 150 miles thereafter, whichever comes first (with the section's stated exceptions, such as sealed loads you've been ordered not to open).

## Real-world example

**Example (illustration, not legal advice):** An 8-foot, 4,000-lb crate on a flatbed, not blocked forward. Length says two tie-downs minimum (over 5 ft, under 10 ft). Aggregate WLL must reach 2,000 lbs — two unmarked 3/8-inch chain assemblies rated per the 393.108 defaults would clear it, but check the actual table and the weakest component, not this sentence. Two straps that satisfy the *count* but sum under 2,000 lbs WLL fail the math; the count and the aggregate are separate tests and you must pass both.

## Common mistakes

- Counting straps but never summing WLL — or vice versa. Both requirements bind.
- Rating a tie-down by its strongest part. Weakest component controls, and damaged devices (per the general rules) don't count at all.
- Applying general counts to listed commodities. Coils are not crates; the commodity section controls.
- Skipping the 50-mile check because the dock loaded it. 392.9 puts the en-route duty on the driver, sealed-load exceptions aside.
- Dry-van complacency: unblocked, unbraced pallets that "always ride fine" — until the hard stop that 393.102's forward standard exists for.

## Compliance risks

Securement violations feed the Vehicle Maintenance area of the [SMS](/knowledge/dot-compliance/csa-scores-sms-explained), the serious ones are out-of-service conditions under the CVSA criteria, and a lost-load crash makes the securement record the case's centerpiece. Every one of them is visible in a walk-around you can do first.

## Driver checklist

- Cargo weight known; devices inspected, marked or default-rated.
- Aggregate WLL ≥ half the cargo weight — do the sum.
- Minimum counts met per 393.110 (or the commodity section applied).
- Blocking/bracing and front-end structure used as the rules require.
- 50-mile check, then every 3 hours / 150 miles / duty change.

## Keep learning

- Where securement gets checked: [DOT Inspection Levels 1–8 Compared](/knowledge/dot-compliance/dot-inspection-levels-compared) · [CVSA Out-of-Service Criteria](/knowledge/dot-compliance/cvsa-out-of-service-criteria)
- The daily discipline it belongs to: [Complete CDL Pre-Trip Inspection Guide](/knowledge/cdl-training/cdl-pre-trip-inspection-guide)
- Drill it free: cargo questions live in the [General Knowledge practice test](/practice-tests/general-knowledge).
- **Learn load securement hands-on:** [TLWS Academy](/academy) · [email list](/#newsletter).$mdx$,
      'Cargo Securement Rules — Tie-Downs and Working Load Limits (Part 393) | Trucking Life with Shawn',
      'Federal cargo securement: the 393.102 performance standard, aggregate WLL at half the cargo weight, 393.110 tie-down minimums, and en-route checks.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR Part 393, Subpart I — Protection Against Shifting and Falling Cargo (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-393"},
        {"label":"49 CFR 393.102 — Performance criteria (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-393/section-393.102"},
        {"label":"49 CFR 393.106 — Aggregate working load limit (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-393/section-393.106"},
        {"label":"49 CFR 393.110 — What else do I have to do to determine the minimum number of tiedowns? (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-393/section-393.110"},
        {"label":"49 CFR 392.9 — Inspection of cargo, cargo securement devices and systems (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-392/section-392.9"}
      ]$j$::jsonb,
      $j$[
        {"q":"How many tie-downs does a load legally need?","a":"For general freight not blocked forward, 49 CFR 393.110 sets the minimums: one tie-down for articles up to 5 ft and 1,100 lbs; two for heavier short articles or articles 5–10 ft; and one more for each additional 10 ft or fraction beyond that. Listed commodities (coils, logs, equipment) follow their own sections instead — and the aggregate working load limit must separately reach half the cargo weight."},
        {"q":"What is aggregate working load limit?","a":"The sum of the tie-downs' working load limits counted per 49 CFR 393.106(d), which must be at least 50 percent of the cargo's weight. Each device's WLL comes from its marking or the default tables in 393.108, rated by its weakest component."},
        {"q":"How often must a driver check cargo securement during a trip?","a":"Under 49 CFR 392.9(b): within the first 50 miles, then at each duty-status change and at intervals of 3 hours or 150 miles, whichever comes first — with stated exceptions such as sealed loads the driver is ordered not to open."},
        {"q":"Do cargo securement rules apply to dry vans?","a":"Yes. 49 CFR 392.9 prohibits driving unless cargo is secured against shifting on or within the vehicle, and Subpart I's general rules apply to enclosed freight as well — walls contain a load; they do not secure it against the forces 393.102 specifies."}
      ]$j$::jsonb,
      '{cargo-securement,tie-downs,wll,part-393,flatbed}',
      9, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 9. Truck Lighting and Reflector Requirements
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_dot and slug = 'truck-lighting-requirements') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_dot,
      'truck-lighting-requirements',
      'Truck Lighting and Reflector Requirements, Light by Light',
      'What 49 CFR 393.9–393.26 and Table 1 of 393.11 actually require: which lamps and reflectors a truck and trailer must have, their required colors and positions, the all-lamps-operable rule, and the conspicuity treatment on trailers.',
      $mdx$**Quick answer:** [49 CFR 393.9](https://www.ecfr.gov/current/title-49/part-393/section-393.9) requires **all required lamps to be capable of being operated at all times** — one dead required lamp is a violation even at noon. Which lamps are required, where, and in what color comes from **[393.11](https://www.ecfr.gov/current/title-49/part-393/section-393.11) and its Table 1**, keyed to vehicle type, width, and length: white headlamps forward, **amber** front and mid-body markers and clearance lamps, **red** at the rear (tail, stop, rear markers and clearance), plus turn signals, hazard flashers, license-plate lamp, and retroreflective **conspicuity treatment** on qualifying trailers.

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026** against the eCFR. Lamp requirements are equipment-specific and keyed to Table 1's categories — confirm your vehicle's row in the current [393.11 Table 1](https://www.ecfr.gov/current/title-49/part-393/section-393.11) before relying on any summary, including this one. Not legal advice.

## What the lighting rules are

Part 393's lighting sections do three jobs: **393.9** makes every required lamp's operability mandatory; **393.11 (with Table 1)** specifies the required devices — type, color, position, and how many — by vehicle category; and the sections after it add specifics: hazard flashers ([393.19](https://www.ecfr.gov/current/title-49/part-393/section-393.19)), headlamps ([393.24](https://www.ecfr.gov/current/title-49/part-393/section-393.24)), mounting and visibility ([393.25](https://www.ecfr.gov/current/title-49/part-393/section-393.25)), and reflex reflectors ([393.26](https://www.ecfr.gov/current/title-49/part-393/section-393.26)). The devices themselves must meet the referenced federal equipment standards.

## Why it matters

Lighting is the most conspicuous system on the truck — literally and to inspectors. A lamp out is visible from the patrol car behind you, it is among the most common vehicle violations found at [roadside inspections](/knowledge/dot-compliance/dot-inspection-levels-compared), and lighting failures in darkness are the kind of defect the [CVSA criteria](/knowledge/dot-compliance/cvsa-out-of-service-criteria) treat seriously.

## Who it applies to

**Federal requirement:** CMVs in interstate commerce; the specific required-device list depends on the Table 1 category — truck, truck tractor, trailer, semitrailer, and dimension thresholds. Older-vehicle grandfather lines exist in the table's footnotes for some devices; the table, not memory, resolves them.

## The lighting map, walked around the rig

The colors and placements below follow Table 1's pattern for typical tractor-trailer equipment — verify your vehicle's row for counts and applicability:

### Front (white and amber)

- **Headlamps** — white, two, with upper/lower beams (393.24 governs their use and mounting).
- **Front turn signals** — amber, visible per 393.25's visibility requirements.
- **Front clearance and side-marker lamps** — **amber**, marking the vehicle's width and forward flanks on qualifying widths.
- **Front reflex reflectors** — amber along the front portion of the sides.

### Sides (amber forward, red rearward)

- **Intermediate side-marker lamps and reflectors** — amber, required on longer units per the table.
- **Rear side-marker lamps and reflectors** — **red**, marking the rear portion of the sides.

### Rear (red, plus signals and plate)

- **Tail lamps** and **stop lamps** — red.
- **Rear turn signals** — red or amber per the table's options.
- **Rear clearance lamps and identification lamps** — red, marking width and the vehicle's upper rear on qualifying vehicles.
- **Rear reflex reflectors** — red; **license-plate lamp** — white; **backup lamp** — white, on vehicles the table requires it for.

### Everywhere

- **Hazard warning flashers** (393.19) — simultaneous flashing of the turn lamps, required to work from the driver's position.
- **Conspicuity treatment** — retroreflective red-and-white sheeting (or approved reflectors) on trailers meeting the width and weight criteria in 393.11's conspicuity provisions: along the sides, across the lower rear, and on the upper rear corners, per the specified patterns.

## Real-world example

**Example (illustration, not legal advice):** On your light check you find one amber intermediate side-marker dark on a 53-foot trailer. It is mid-afternoon and bright — but 393.9's operability rule doesn't care about the sun, and the fix is a two-dollar bulb at the yard versus a violation on the inspection report that follows your carrier's [Vehicle Maintenance record](/knowledge/dot-compliance/csa-scores-sms-explained) for two years. The walk with the lights on is the cheapest compliance program in trucking.

## Common mistakes

- Treating daytime as a defense. Operability of required lamps is required "at all times" (393.9).
- Mixing up the color logic. Amber faces forward and mid-body; red faces rearward — a red lamp facing forward is its own violation class.
- Ignoring reflectors and conspicuity tape because "the lights work." The table requires reflex reflectors, and degraded conspicuity sheeting on trailers is inspectable equipment.
- Assuming every truck needs every device. Table 1 keys requirements to type and dimensions — learn your vehicle's row instead of over- or under-equipping from folklore.
- Skipping the [DVIR](/knowledge/dot-compliance/dvir-explained) on a lamp defect. Lighting defects found at day's end are exactly what the report exists for.

## Compliance risks

Lighting violations are frequent inspection findings that accumulate in the Vehicle Maintenance area of the [SMS](/knowledge/dot-compliance/csa-scores-sms-explained); required-lamp failures in darkness conditions carry out-of-service exposure under the CVSA criteria; and unlit trucks at night are how securement and fatigue stories become crash stories. Every one starts as a bulb you could have caught on the walk-around.

## Driver checklist

- Full light walk daily: headlamps both beams, markers, clearance, ID lamps, tail, stop, turns, flashers, plate lamp.
- Colors sane: amber forward/side-forward, red rearward.
- Reflectors present and unbroken; conspicuity tape intact, not painted over or peeling.
- Defect found → fixed before driving or written up per your carrier's process and 396.11.
- Carry spare bulbs and fuses your equipment allows you to change.

## Keep learning

- The inspection your lights meet first: [DOT Inspection Levels 1–8 Compared](/knowledge/dot-compliance/dot-inspection-levels-compared) · [Level 1 DOT Inspection Explained](/knowledge/dot-compliance/level-1-dot-inspection)
- The daily habit: [Complete CDL Pre-Trip Inspection Guide](/knowledge/cdl-training/cdl-pre-trip-inspection-guide) · [The DVIR Explained](/knowledge/dot-compliance/dvir-explained)
- Drill it free: lighting questions appear in the [General Knowledge practice test](/practice-tests/general-knowledge).
- **Learn the walk-around from an instructor:** [TLWS Academy](/academy) · start free with [CDL Pre-School](/cdl-pre-school) · [email list](/#newsletter).$mdx$,
      'Truck Lighting Requirements — 393.11 Table 1, Light by Light | Trucking Life with Shawn',
      'Required truck lighting under 49 CFR 393.9–393.26: what Table 1 requires, the amber-forward/red-rear color logic, and trailer conspicuity tape.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR 393.9 — Lamps operable; prohibition of obstructions (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-393/section-393.9"},
        {"label":"49 CFR 393.11 — Lamps and reflective devices (Table 1) (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-393/section-393.11"},
        {"label":"49 CFR 393.19 — Hazard warning signals (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-393/section-393.19"},
        {"label":"49 CFR 393.25 — Requirements for lamps other than head lamps (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-393/section-393.25"},
        {"label":"49 CFR 393.26 — Requirements for reflectors (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-393/section-393.26"}
      ]$j$::jsonb,
      $j$[
        {"q":"Is one light out a DOT violation even in daytime?","a":"Yes. 49 CFR 393.9 requires all lamps required by 393.11 to be capable of operating at all times — operability is the standard, not whether conditions currently require the lamp's use."},
        {"q":"What color are truck marker lights required to be?","a":"Under Table 1 of 49 CFR 393.11, side-marker and clearance lamps and reflectors are amber toward the front and intermediate positions and red at the rear — the color tells other drivers which end of the vehicle they are seeing."},
        {"q":"What is the reflective tape requirement on trailers?","a":"393.11's conspicuity provisions require qualifying trailers to carry retroreflective red-and-white treatment (or approved reflectors) along the sides, across the lower rear, and on the upper rear corners, in the patterns the regulation specifies."},
        {"q":"Do all trucks need the same lights?","a":"No. Table 1 of 393.11 keys required devices to vehicle type, width, and length — trucks, truck tractors, trailers, and semitrailers of different dimensions have different required-device rows, including some grandfather provisions by manufacture date."}
      ]$j$::jsonb,
      '{lighting,reflectors,393-11,conspicuity,markers}',
      9, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 10. Annual DOT Inspections
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_dot and slug = 'annual-dot-inspection') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_dot,
      'annual-dot-inspection',
      'Annual DOT Inspections: What 396.17 Requires Every 12 Months',
      'The periodic inspection rule in 49 CFR 396.17–396.25: every CMV inspected at least every 12 months against Appendix A, by a qualified inspector, with documentation kept — and how it differs from roadside inspections and the daily pre-trip.',
      $mdx$**Quick answer:** Under [49 CFR 396.17](https://www.ecfr.gov/current/title-49/part-396/section-396.17), every CMV must pass a **periodic inspection at least once every 12 months** covering, at minimum, the items in **[Appendix A to Part 396](https://www.ecfr.gov/current/title-49/part-396)** — brakes, steering, suspension, frame, wheels, coupling, lighting, and more. The inspection must be performed by a **qualified inspector** ([396.19](https://www.ecfr.gov/current/title-49/part-396/section-396.19); brake work under [396.25](https://www.ecfr.gov/current/title-49/part-396/section-396.25)), documented, and the proof (report and/or decal) kept with the vehicle and carrier per [396.21](https://www.ecfr.gov/current/title-49/part-396/section-396.21). It is a different obligation from roadside inspections and from your daily pre-trip.

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026** against the eCFR. Confirm the current [49 CFR 396.17–396.25 and Appendix A](https://www.ecfr.gov/current/title-49/part-396), and any state program details, before relying on this. Not legal advice.

## What the annual inspection is

Three inspection regimes share a truck, and confusing them causes real violations:

- **Daily:** the driver's [pre-trip duty](/knowledge/cdl-training/cdl-pre-trip-inspection-guide) (396.13) and the [DVIR loop](/knowledge/dot-compliance/dvir-explained) (396.11) — driver-performed, every day.
- **Random:** [roadside inspections](/knowledge/dot-compliance/dot-inspection-levels-compared) — enforcement-performed, whenever selected.
- **Periodic ("annual"):** 396.17 — a scheduled, documented technical inspection against Appendix A's minimum standards, at least every 12 months, arranged by the carrier.

Passing an annual does not exempt anything: it does not skip roadside selection, does not replace the pre-trip, and a truck can be perfectly legal on its annual and still go [out of service](/knowledge/dot-compliance/cvsa-out-of-service-criteria) Tuesday for a defect that developed since.

## Why it exists

Daily checks catch what a driver can see; roadside catches what enforcement finds. The periodic inspection is the scheduled deep look by someone qualified to judge brake internals, steering components, and frame condition against a written minimum standard — the maintenance system's floor, in writing, once a year at minimum.

## Who is responsible

**Federal requirement:** the **motor carrier** (and for their vehicles, intermodal equipment providers) must ensure the inspection happens and the records exist — but [396.17(g)](https://www.ecfr.gov/current/title-49/part-396/section-396.17) also makes clear a motor carrier must not use a vehicle that hasn't passed, which is why drivers should know what proof rides in the truck. Owner-operators wear both hats.

## How it works, step by step

- **Step 1 — who may inspect ([396.19](https://www.ecfr.gov/current/title-49/part-396/section-396.19)).** The inspector must be qualified by training/experience as the section specifies — a carrier's own technician can qualify; so can a commercial garage's. **Brake inspections** have their own qualification rule in [396.25](https://www.ecfr.gov/current/title-49/part-396/section-396.25). Carriers keep evidence of inspector qualification ([396.19(b)](https://www.ecfr.gov/current/title-49/part-396/section-396.19)).
- **Step 2 — what gets inspected.** At minimum, every applicable item in **Appendix A**: brake systems, coupling devices, exhaust and fuel systems, lighting, securement of cargo equipment, steering, suspension, frame, tires, wheels and rims, windshield glazing and wipers, and the rest of the appendix's list for the vehicle type.
- **Step 3 — pass or fix.** Vehicles failing any Appendix A item must be repaired before use; the standard is the appendix's minimums, not shop opinion.
- **Step 4 — document and carry ([396.21](https://www.ecfr.gov/current/title-49/part-396/section-396.21)).** The original or a copy of the inspection report is retained **for 14 months from the report date**, and proof of the passed inspection — the report copy or a decal/sticker referencing it — must be on or in the vehicle where it can be produced.
- **Step 5 — state programs ([396.23](https://www.ecfr.gov/current/title-49/part-396/section-396.23)).** Mandatory state inspection programs FMCSA has determined equivalent can satisfy the requirement — the compliance calendar is still the carrier's to keep.

## Real-world example

**Example (illustration, not legal advice):** A one-truck owner-operator buys a used tractor in March with a decal from last August. The decal is proof of the *previous* inspection — the 12-month clock runs from that inspection date, not from the purchase. The smart move is a fresh periodic inspection at purchase: it restarts the calendar, applies Appendix A to a truck whose history is unknown, and produces the report that lives in the cab for the next roadside question.

## Common mistakes

- Believing the annual replaces the daily pre-trip (or vice versa). Different rules, both mandatory.
- Losing the proof. A passed inspection you cannot produce at roadside is a documentation violation waiting to be written.
- Letting a shop without brake-inspector qualification sign off brake work — 396.25's qualification is specific.
- Running a lapsed annual "because the truck is fine." 396.17 is a use prohibition, not a suggestion.
- Assuming any state's safety sticker qualifies — only programs recognized under 396.23 substitute; verify, don't guess.

## Compliance risks

Operating beyond the 12-month interval, missing documentation, or unqualified inspections are Part 396 violations — discoverable at every roadside inspection and compliance review, feeding the Vehicle Maintenance area of the [SMS](/knowledge/dot-compliance/csa-scores-sms-explained). And mechanically: the annual is where slow-developing defects get caught by someone with a creeper and a standard.

## Driver checklist

- Know where the current inspection proof is in your truck — before an officer asks.
- Know the inspection date and calendar the renewal ahead of the 12-month line.
- Buying or leasing equipment? Verify (or redo) the periodic inspection at acquisition.
- Defects between annuals are yours to catch: pre-trip daily, DVIR when found.
- Owner-operators: keep the report, the qualification evidence trail, and the 14-month retention like the carrier you are.

## Keep learning

- The other inspection regimes: [DOT Inspection Levels 1–8 Compared](/knowledge/dot-compliance/dot-inspection-levels-compared) · [Complete CDL Pre-Trip Inspection Guide](/knowledge/cdl-training/cdl-pre-trip-inspection-guide) · [The DVIR Explained](/knowledge/dot-compliance/dvir-explained)
- What failure costs: [CVSA Out-of-Service Criteria](/knowledge/dot-compliance/cvsa-out-of-service-criteria) · [CSA Scores and the SMS](/knowledge/dot-compliance/csa-scores-sms-explained)
- Free drills: [General Knowledge](/practice-tests/general-knowledge) and [Air Brakes](/practice-tests/air-brakes) practice tests.
- **Run equipment like a pro from day one:** [TLWS Academy](/academy) · [email list](/#newsletter).$mdx$,
      'Annual DOT Inspection Requirements (49 CFR 396.17 + Appendix A) | Trucking Life with Shawn',
      'The periodic inspection rule: every CMV inspected every 12 months against Part 396 Appendix A by a qualified inspector, with 14-month records.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR 396.17 — Periodic inspection (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-396/section-396.17"},
        {"label":"49 CFR 396.19 — Inspector qualifications (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-396/section-396.19"},
        {"label":"49 CFR 396.21 — Periodic inspection recordkeeping (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-396/section-396.21"},
        {"label":"49 CFR 396.25 — Qualifications of brake inspectors (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-396/section-396.25"},
        {"label":"49 CFR Part 396, Appendix A — Minimum periodic inspection standards (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-396"}
      ]$j$::jsonb,
      $j$[
        {"q":"How often is a DOT annual inspection required?","a":"At least once every 12 months for every CMV, under 49 CFR 396.17, covering at minimum the items in Appendix A to Part 396. State inspection programs FMCSA recognizes as equivalent under 396.23 can satisfy it."},
        {"q":"Who can perform a DOT annual inspection?","a":"An inspector qualified under 49 CFR 396.19 — which can include a carrier's own qualified technician or a commercial facility — with brake inspections additionally governed by the brake-inspector qualifications of 396.25. Carriers must retain evidence of the inspector's qualifications."},
        {"q":"How long are annual inspection records kept?","a":"The report (original or copy) is retained for 14 months from the report date under 49 CFR 396.21, and proof of the passed inspection — a report copy or decal referencing it — must be available on or in the vehicle."},
        {"q":"Is the annual inspection the same as a roadside DOT inspection?","a":"No. The periodic inspection is a scheduled maintenance-standard inspection the carrier arranges under 396.17; roadside inspections are enforcement events under the CVSA program, and passing one never exempts you from the other — or from the daily pre-trip."}
      ]$j$::jsonb,
      '{annual-inspection,periodic-inspection,396-17,appendix-a,maintenance}',
      9, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- Manual related-article curation (3 per new article + cross-cluster).
  ---------------------------------------------------------------------------
  declare
    b1 uuid; b2 uuid; b3 uuid; b4 uuid; b5 uuid;
    b6 uuid; b7 uuid; b8 uuid; b9 uuid; b10 uuid;
    l1 uuid; pretrip uuid; hos uuid; eld uuid; stub uuid;
  begin
    select id into b1  from public.kc_articles where category_id = v_dot and slug = 'dot-inspection-levels-compared';
    select id into b2  from public.kc_articles where category_id = v_dot and slug = 'cvsa-out-of-service-criteria';
    select id into b3  from public.kc_articles where category_id = v_dot and slug = 'dvir-explained';
    select id into b4  from public.kc_articles where category_id = v_dot and slug = 'csa-scores-sms-explained';
    select id into b5  from public.kc_articles where category_id = v_dot and slug = 'dataqs-disputes';
    select id into b6  from public.kc_articles where category_id = v_dot and slug = 'dot-medical-card';
    select id into b7  from public.kc_articles where category_id = v_dot and slug = 'drug-alcohol-testing-clearinghouse';
    select id into b8  from public.kc_articles where category_id = v_dot and slug = 'cargo-securement-basics';
    select id into b9  from public.kc_articles where category_id = v_dot and slug = 'truck-lighting-requirements';
    select id into b10 from public.kc_articles where category_id = v_dot and slug = 'annual-dot-inspection';
    select id into l1      from public.kc_articles where category_id = v_dot and slug = 'level-1-dot-inspection';
    select id into stub    from public.kc_articles where category_id = v_dot and slug = 'what-is-a-dot-inspection';
    select id into pretrip from public.kc_articles where category_id = v_cdl and slug = 'cdl-pre-trip-inspection-guide';
    select id into hos     from public.kc_articles where category_id = v_hos and slug = 'cdl-hours-of-service-rules';
    select id into eld     from public.kc_articles where category_id = v_hos and slug = 'eld-malfunctions';

    insert into public.kc_related (article_id, related_id, sort_order) values
      (b1, b2, 1),  (b1, b10, 2),
      (b2, b1, 1),  (b2, b4, 2),
      (b3, b10, 2), (b3, b4, 3),
      (b4, b5, 1),  (b4, b2, 2),  (b4, b1, 3),
      (b5, b4, 1),  (b5, b1, 2),
      (b6, b7, 1),  (b6, b2, 2),  (b6, b1, 3),
      (b7, b6, 1),  (b7, b4, 2),  (b7, b2, 3),
      (b8, b2, 1),  (b8, b1, 2),
      (b9, b3, 1),  (b9, b1, 2),
      (b10, b3, 1), (b10, b1, 2)
    on conflict (article_id, related_id) do nothing;

    if l1 is not null then
      insert into public.kc_related (article_id, related_id, sort_order) values
        (b1, l1, 3), (b5, l1, 3), (b9, l1, 3)
      on conflict (article_id, related_id) do nothing;
    end if;
    if pretrip is not null then
      insert into public.kc_related (article_id, related_id, sort_order) values
        (b3, pretrip, 1), (b8, pretrip, 3), (b10, pretrip, 3)
      on conflict (article_id, related_id) do nothing;
    end if;
    if hos is not null then
      insert into public.kc_related (article_id, related_id, sort_order) values
        (b2, hos, 3)
      on conflict (article_id, related_id) do nothing;
    end if;
    -- Give the Batch 1 bridge articles a reverse path into this cluster.
    if l1 is not null then
      insert into public.kc_related (article_id, related_id, sort_order) values
        (l1, b1, 5), (l1, b2, 6)
      on conflict (article_id, related_id) do nothing;
    end if;
    if eld is not null then
      insert into public.kc_related (article_id, related_id, sort_order) values
        (eld, b2, 5)
      on conflict (article_id, related_id) do nothing;
    end if;
    if stub is not null then
      insert into public.kc_related (article_id, related_id, sort_order) values
        (stub, b1, 1)
      on conflict (article_id, related_id) do nothing;
    end if;
  end;

  ---------------------------------------------------------------------------
  -- Batch 1 cross-links (UPDATE-only, guarded, idempotent).
  -- Two precise substring replacements wire the HOS pillar's violations
  -- section and the Level 1 article's DataQs mention into this cluster.
  -- Each runs only when the target text is present AND the link is absent,
  -- so re-runs are no-ops and nothing else in the bodies is touched.
  ---------------------------------------------------------------------------
  update public.kc_articles a set body_mdx = replace(
      a.body_mdx,
      'feed the FMCSA Safety Measurement System scores that follow both driver and carrier',
      'feed the [FMCSA Safety Measurement System](/knowledge/dot-compliance/csa-scores-sms-explained) scores that follow both driver and carrier')
  from public.kc_categories c
  where c.id = a.category_id and c.slug = 'hours-of-service'
    and a.slug = 'cdl-hours-of-service-rules'
    and a.body_mdx like '%feed the FMCSA Safety Measurement System scores that follow both driver and carrier%'
    and a.body_mdx not like '%/knowledge/dot-compliance/csa-scores-sms-explained%';

  update public.kc_articles a set body_mdx = replace(
      a.body_mdx,
      'The dispute process exists — FMCSA''s DataQs system, which drivers as well as carriers can use;',
      'The dispute process exists — [FMCSA''s DataQs system](/knowledge/dot-compliance/dataqs-disputes), which drivers as well as carriers can use;')
  from public.kc_categories c
  where c.id = a.category_id and c.slug = 'dot-compliance'
    and a.slug = 'level-1-dot-inspection'
    and a.body_mdx like '%The dispute process exists — FMCSA''s DataQs system, which drivers as well as carriers can use;%'
    and a.body_mdx not like '%/knowledge/dot-compliance/dataqs-disputes%';

  -- Internal-link restraint fix for a Batch 1 article: the 11-hour page
  -- linked its pillar three times in-body; de-link the least contextual one
  -- (max two links per target per article). Presence-guarded → idempotent:
  -- once replaced, the pattern is gone and the row no longer matches.
  update public.kc_articles a set body_mdx = replace(
      a.body_mdx,
      'burn the window and the [60/70-hour totals](/knowledge/hours-of-service/cdl-hours-of-service-rules) instead',
      'burn the window and the 60/70-hour totals instead')
  from public.kc_categories c
  where c.id = a.category_id and c.slug = 'hours-of-service'
    and a.slug = '11-hour-driving-limit'
    and a.body_mdx like '%burn the window and the [60/70-hour totals](/knowledge/hours-of-service/cdl-hours-of-service-rules) instead%';

end $kc$;
