-- 056_seed_kc_how_long_cdl_training.sql
-- Knowledge Center — one duration-intent page: "How Long Does CDL Training
-- Take?" in the existing cdl-training category (its second article).
--
-- ⚠️ COMMITTED; apply AFTER 015 (schema), 040 (Getting Your CDL cluster),
-- and 055 (Class A vs Class B — the cross-link block below touches its body).
-- IDEMPOTENT AND NON-DESTRUCTIVE: the article inserts ONLY when no article
-- with the same (category, slug) exists; kc_related rows insert with
-- ON CONFLICT DO NOTHING; the cross-link UPDATEs are guarded (slug-scoped,
-- substring replacement, presence guard on the target text + absence guard
-- on the new link) so a re-run is a no-op and nothing else can be touched.
--
-- Content rules (hard, same as 037/038/040/042/045/055):
--   * Original wording only. Primary sources only (eCFR / FMCSA / the FMCSA
--     Training Provider Registry / Georgia DDS), cited per claim and listed
--     in `sources`. Federal floor vs Georgia process vs school schedule vs
--     practical timing are labeled in-text; no fake universal "X weeks"
--     number anywhere.
--   * The ONLY school-specific durations quoted are the two program lengths
--     the repo's owner-approved source of truth (src/lib/academy/program.ts)
--     currently publishes — "eight weekends" and "approximately three to
--     four weeks" — in a clearly labeled Academy section. No tuition, no
--     dates, no phone, no address, no licensing/TPR status claims.
--   * Cannibalization guards: how-to-get-your-cdl keeps the full-process
--     intent, eldt-requirements keeps the ELDT-rule intent,
--     class-a-vs-class-b-cdl keeps the license-choice intent; this page
--     owns only the timeline/duration question. The pages cross-link.
--   * reg_verified = true, reg_verified_date 2026-08-19 (visible
--     last-reviewed date), in-body regulatory-change disclaimer.
--   * Slugs are stable identifiers.

do $kc$
declare
  v_cdl uuid;
  v_gyc uuid;
  v_pub timestamptz := '2026-08-19 16:00:00+00';
  v_bio text := 'CDL-A driver and instructor — 17 years driving, zero violations. Founder of Trucking Life with Shawn and the TLWS truck driving school in Dalton, Georgia.';
begin
  select id into v_cdl from public.kc_categories where slug = 'cdl-training';
  select id into v_gyc from public.kc_categories where slug = 'getting-your-cdl';
  if v_cdl is null or v_gyc is null then
    raise exception 'Knowledge Center categories missing (cdl-training / getting-your-cdl)';
  end if;

  ---------------------------------------------------------------------------
  -- 1. How Long Does CDL Training Take? (duration guide)
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_cdl and slug = 'how-long-does-cdl-training-take') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_cdl,
      'how-long-does-cdl-training-take',
      'How Long Does CDL Training Take?',
      'The honest answer to the most-asked CDL question. What federal rules actually require, why ELDT has no fixed hour count, the 14-day permit floor, the Georgia sequence step by step, and the real-world factors that stretch or shrink the calendar.',
      $mdx$**Quick answer:** There is no single honest number — plan in **weeks to a few months**, and know which parts are fixed. Federal rule sets exactly one hard clock: you cannot take the skills test in the **first 14 days after your commercial learner's permit is first issued** ([49 CFR 383.25](https://www.ecfr.gov/current/title-49/part-383/section-383.25)), and that clock runs **while you train**, not after. Entry-Level Driver Training has **no federal hour count** — it ends when you demonstrate proficiency. Everything else is schedule: how fast you pass the knowledge tests, how your program meets, and how soon a test seat is available. Full-time formats commonly finish in weeks; evening-and-weekend formats spread the same work across months.

**Regulatory-change disclaimer:** Last reviewed **August 19, 2026**. The federal pieces live in [49 CFR Part 383](https://www.ecfr.gov/current/title-49/part-383) and [Part 380](https://www.ecfr.gov/current/title-49/part-380); Georgia scheduling and procedure come from the Georgia Department of Driver Services. Confirm current rules with [FMCSA](https://www.fmcsa.dot.gov/) and Georgia DDS before relying on this. Not legal advice.

## Who this question faces

Anyone budgeting real life around a career change: how many weeks of evenings, how much time off work, how long before the license can start earning. It also faces Class B holders sizing up an upgrade, because the upgrade repeats most of the sequence. This page covers the clock; the steps themselves are mapped in [How to Get Your CDL](/knowledge/getting-your-cdl/how-to-get-your-cdl).

## What actually controls the timeline

Four different layers set your date, and they answer to different authorities:

- **Federal floor:** the 14-day minimum between CLP issuance and the skills test, and ELDT completion before you may test. These do not bend for anyone.
- **Georgia process:** a valid regular Georgia license first, knowledge tests to earn the CLP, medical certification where your operating category requires it, ELDT verified in the federal registry before testing, and the road test in the class of vehicle you will drive.
- **School schedule:** whether the program meets full-time, evenings, or weekends — the single biggest spread in real-world finish dates.
- **Your calendar:** study pace before the permit, attendance, document readiness, and how soon you can sit for tests when seats open.

A useful way to read the rest of this page: the first two layers are floors measured in **days**; the last two are the reason finished timelines differ by **months**.

## How long does Class A CDL training take?

Separate two things schools often blur. The **federal minimum** is proficiency, not a duration — there is no nationwide required program length for Class A training. The **program length** is a business decision each school publishes: a full-time format compresses theory, range, and road work into consecutive weeks, while a part-time format stretches identical requirements across more calendar. Class A adds the [combination vehicles knowledge test](/practice-tests/combination-vehicles) and combination-vehicle road skills, so its behind-the-wheel phase is typically the longest part of any format. When a school quotes you a length, ask what it assumes: how many students share a truck, how often you drive, and what happens if you need more time on a maneuver.

## Does ELDT require a certain number of hours?

No. Federal Entry-Level Driver Training — required since February 7, 2022 for a first Class A or Class B CDL and for a Class B-to-A upgrade — is **performance-based** ([49 CFR Part 380](https://www.ecfr.gov/current/title-49/part-380)). Theory ends with an assessment you must pass at 80 percent or better; behind-the-wheel ends when the instructor certifies proficiency in each required element; the provider must be listed on FMCSA's [Training Provider Registry](https://tpr.fmcsa.dot.gov/) and transmits your completion electronically. An "hours required by the federal government" quote is describing a school curriculum or a state rule, not the federal one. The full rule, including who is covered and its narrow exceptions, is in [ELDT Requirements](/knowledge/getting-your-cdl/eldt-requirements).

## How long do you have to hold a CLP?

Two federal numbers bracket the permit ([49 CFR 383.25](https://www.ecfr.gov/current/title-49/part-383/section-383.25)):

- **The floor:** you are not eligible for the skills test in the first **14 days** after the CLP is initially issued. Georgia applies the same 14-day hold before the road test.
- **The ceiling:** a CLP is valid for **no more than one year from initial issuance** without retaking the knowledge tests — so an open-ended pause has a real cost.

The floor matters less than people fear, because training happens **while** you hold the permit: for most students in a structured program, day 15 arrives before the behind-the-wheel work is finished anyway. Supervision rules and everything else the permit does and does not allow are in [The CDL Permit Explained](/knowledge/getting-your-cdl/cdl-permit-explained).

## A realistic Georgia timeline, step by step

The [Georgia DDS CDL process](https://dds.georgia.gov/georgia-licenses-ids-and-permits/new-license-id-or-permit/how-do-i-cdl-license) runs in a fixed order; how long each step takes is the part you influence:

- **Step 1 — Qualify and prepare.** Hold a valid regular Georgia driver's license, sort your documents, and handle medical certification if your operating category requires it. Study time here is the cheapest time in the whole sequence.
- **Step 2 — Pass the knowledge tests and receive the CLP.** General knowledge plus the tests for your class, per the [DDS permit instructions](https://dds.georgia.gov/georgia-licenses-ids-and-permits/new-license-id-or-permit/how-do-i-cdl-permit). The 14-day clock starts the day the permit is first issued.
- **Step 3 — Complete ELDT theory with a registered provider.** Proficiency-based; your pace and the program calendar set the length.
- **Step 4 — Complete behind-the-wheel training.** Range work, then public road — certified element by element while your CLP holding period runs in the background.
- **Step 5 — Take the three-part skills test on or after day 15.** Georgia tests you in the class of vehicle you will drive, and the state confirms your ELDT record in the federal registry before testing; what the [three parts cover](/knowledge/getting-your-cdl/cdl-skills-test) is its own page. Seat availability at your test site sets this step's wait.
- **Step 6 — License issuance and next steps.** Pass all three segments and DDS issues the license for your class; endorsements ride on their own tests.

No school and no article can promise the dates — the sequence is fixed, the calendar is yours.

## What can make it take longer

- A part-time format: the same proficiency work simply occupies more weeks by design.
- Shared trucks and full ranges — less wheel time per session means more sessions.
- Skills-test backlogs: a passed program with no open test seat still waits.
- A failed test segment: retesting means rescheduling, and the wait repeats.
- Document and medical loose ends discovered late, instead of in step 1.
- Life: work shifts, family, weather closures, missed sessions. The clock does not judge; it just runs.

## Can you get a CDL faster?

Legitimately, yes — by removing your own delays, never by skipping requirements:

- Study before you enroll: pass the knowledge tests on the first attempt with the free [general knowledge practice test](/practice-tests/general-knowledge) and its siblings, and the CLP arrives at the start of training rather than mid-way.
- Arrive with documents and medical certification already handled.
- Pick the format that matches your actual availability — a full-time program you cannot attend is slower than a weekend program you never miss.
- Ask early how test dates get booked, and take the first seat you are genuinely ready for.
- Show up to every session; repetition is what certifies proficiency.

There is no legitimate shortcut around ELDT, the permit, medical qualification, or the 14-day floor — anyone selling one is selling trouble.

## Choosing a training program

Length is one input, not the verdict. Compare on:

- **Class:** the vehicle group decides the tests and the training — settle [Class A vs Class B](/knowledge/getting-your-cdl/class-a-vs-class-b-cdl) first.
- **Schedule:** full-time, evening, or weekend — matched to your life, not the brochure's.
- **Wheel time:** how many students per truck, and how much of each session you actually drive.
- **Instructor support:** who watches your maneuvers, and how retries are handled.
- **Test preparation:** whether the program trains to proficiency or just to a calendar.
- **The registry:** the provider must appear on FMCSA's Training Provider Registry for the training to count — verify before paying anyone.

## The Academy's published program lengths

**School-specific facts, not federal rules.** Trucking Life Academy currently publishes two Class A formats: a **weekend program** that meets Saturdays and Sundays for **eight weekends**, and a **weekday program of approximately three to four weeks** — the weekday format is not open for enrollment yet. Both are built to the ELDT standard, which is why neither promises a fixed national hour count; current details live on [the Academy curriculum page](/academy/curriculum).

## Two students, one school (illustration, not a promise)

Two students earn their permits the same Friday. One trains weekdays, full-time: theory in week one, range in week two, road work after — and because the 14-day floor ran concurrently, the earliest legal test date arrives before the training does. The other keeps a full-time job and trains weekends only: identical requirements, identical proficiency bar, spread across two-plus months of Saturdays. Neither took a shortcut and neither wasted a day — they bought the same license on different calendars. That is the honest shape of "how long does it take."

## Common mistakes

- Assuming the 14 days start when training ends. They start when the CLP is **first issued** — get the permit early and the floor usually costs nothing.
- Treating a quoted program length as a licensing requirement. Federal rule requires proficiency; the length is the school's schedule.
- Leaving the knowledge tests until enrollment day, which parks you in a classroom seat you already paid for while you study for a permit you could have had.
- Paying a provider without checking the Training Provider Registry — unregistered training satisfies nothing, however long it took.
- Letting the CLP idle toward its one-year ceiling; lapse it and the knowledge tests come back.
- Planning a job start date around a promised graduation day instead of a passed skills test.

## Your timeline checklist

- Valid Georgia license in hand; documents and medical plan sorted first
- State CDL manual downloaded; [practice tests](/practice-tests) in daily rotation before enrolling
- Program format chosen to match your real availability
- CLP issue date written down — day 15 is your earliest legal test date
- Provider verified on the Training Provider Registry, by legal name
- Test-seat booking process asked about in week one, not at the end

## Keep learning

- The full sequence behind this timeline: [How to Get Your CDL](/knowledge/getting-your-cdl/how-to-get-your-cdl) · the training rule itself: [ELDT Requirements](/knowledge/getting-your-cdl/eldt-requirements)
- Still picking a license? [Class A vs Class B CDL: Which One Should You Get?](/knowledge/getting-your-cdl/class-a-vs-class-b-cdl)
- **Looking for Class A CDL training in Dalton, Georgia?** Learn more about [Trucking Life Academy](/academy) · get ahead before day one with [CDL Pre-School](/cdl-pre-school) · [new guides by email as they publish](/#newsletter).$mdx$,
      'How Long Does CDL Training Take? | Trucking Life with Shawn',
      'No single number is honest. How permit prep, proficiency-based ELDT, the federal 14-day CLP floor, and test scheduling set the CDL timeline — plus the Georgia steps in order.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR 383.25 — Commercial learner's permit provisions (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.25"},
        {"label":"49 CFR Part 380 — Entry-Level Driver Training (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-380"},
        {"label":"FMCSA Training Provider Registry","url":"https://tpr.fmcsa.dot.gov/"},
        {"label":"Georgia DDS — Apply for a Commercial (CDL) License","url":"https://dds.georgia.gov/georgia-licenses-ids-and-permits/new-license-id-or-permit/how-do-i-cdl-license"},
        {"label":"Georgia DDS — CDL Permit (CLP)","url":"https://dds.georgia.gov/georgia-licenses-ids-and-permits/new-license-id-or-permit/how-do-i-cdl-permit"},
        {"label":"FMCSA — Federal Motor Carrier Safety Administration","url":"https://www.fmcsa.dot.gov/"}
      ]$j$::jsonb,
      $j$[
        {"q":"How long does CDL school usually take?","a":"It depends on the format, not on a federal rule. Full-time programs compress theory, range, and road training into consecutive weeks, while evening and weekend programs spread identical proficiency requirements across two or more months. Federal ELDT sets no hour count, so the honest comparison between schools is schedule, wheel time, and how they certify proficiency — not a single advertised number."},
        {"q":"Can I get a CDL in two weeks?","a":"Almost never as a first-time applicant. Federal rule makes you ineligible for the skills test during the first 14 days after your commercial learner's permit is initially issued, so even a perfect run needs the permit on day one, completed ELDT, and a test seat on day 15 — before counting knowledge-test prep, training sessions, and scheduling. Treat two weeks as the legal floor, not a plan."},
        {"q":"How long do I have to hold a CLP in Georgia?","a":"At least 14 days before the road test — Georgia applies the federal floor in 49 CFR 383.25, which starts the clock when the permit is first issued. The permit also has a federal ceiling: no more than one year from initial issuance without retaking the knowledge tests, so the window is wide but not endless."},
        {"q":"How long does it take to get a Class A CDL?","a":"There is no universal Class A number. The fixed parts are federal: proficiency-based ELDT completed before testing and the 14-day minimum on the permit. The variable parts dominate: your knowledge-test prep, whether the program runs full-time or on weekends, how much wheel time each session gives you, and how soon a skills-test seat opens. Most students should think in weeks to a few months, set mainly by format."},
        {"q":"What can delay getting a CDL?","a":"The usual culprits are operational: shared trucks and crowded ranges that thin out wheel time, skills-test backlogs at the testing site, a failed segment that must be rescheduled, medical or document issues discovered late, and missed sessions. None of them change the requirements — they just stretch the calendar around them."}
      ]$j$::jsonb,
      '{cdl-training,timeline,how-long,eldt,clp,georgia}',
      8, false, 'published', true, '2026-08-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- Related-article rows (curated; ON CONFLICT DO NOTHING keeps re-runs clean)
  ---------------------------------------------------------------------------
  declare
    hl uuid; g1 uuid; g4 uuid; ab uuid;
  begin
    select id into hl from public.kc_articles where category_id = v_cdl and slug = 'how-long-does-cdl-training-take';
    select id into g1 from public.kc_articles where category_id = v_gyc and slug = 'how-to-get-your-cdl';
    select id into g4 from public.kc_articles where category_id = v_gyc and slug = 'eldt-requirements';
    select id into ab from public.kc_articles where category_id = v_gyc and slug = 'class-a-vs-class-b-cdl';

    if hl is not null and g1 is not null and g4 is not null and ab is not null then
      insert into public.kc_related (article_id, related_id, sort_order) values
        (hl, g1, 1), (hl, g4, 2), (hl, ab, 3)
      on conflict (article_id, related_id) do nothing;
    end if;
  end;
end $kc$;

-- ---------------------------------------------------------------------------
-- Cross-links INTO the new page from three existing articles (guarded,
-- slug-scoped, replace-based, idempotent — same doctrine as 040/042/045/055:
-- presence guard on the target text + absence guard on the new link, so a
-- re-run is a no-op and nothing else in the body can be touched).
-- ---------------------------------------------------------------------------

-- 1. How to Get Your CDL (pillar) → the timeline page: the honest-answer
--    line about state calendars now hands duration-seekers to the breakdown.
update public.kc_articles a set body_mdx = replace(
    a.body_mdx,
    'the honest answer to "how long does it take" always starts with your state''s calendar, not a national average.',
    'the honest answer to "how long does it take" always starts with your state''s calendar, not a national average. The whole clock — federal floors, the Georgia sequence, and what actually adds weeks — is broken down in [How Long Does CDL Training Take?](/knowledge/cdl-training/how-long-does-cdl-training-take).')
from public.kc_categories c
where c.id = a.category_id and c.slug = 'getting-your-cdl'
  and a.slug = 'how-to-get-your-cdl'
  and a.body_mdx like '%the honest answer to "how long does it take" always starts with your state''s calendar, not a national average.%'
  and a.body_mdx not like '%/knowledge/cdl-training/how-long-does-cdl-training-take%';

-- 2. ELDT Requirements → the timeline page: the quoted-hours mistake bullet
--    now routes calendar questions to the duration breakdown.
update public.kc_articles a set body_mdx = replace(
    a.body_mdx,
    '- Believing a quoted "federal minimum hours" number. The federal BTW standard is proficiency, not a clock.',
    '- Believing a quoted "federal minimum hours" number. The federal BTW standard is proficiency, not a clock. What that means for your calendar: [How Long Does CDL Training Take?](/knowledge/cdl-training/how-long-does-cdl-training-take).')
from public.kc_categories c
where c.id = a.category_id and c.slug = 'getting-your-cdl'
  and a.slug = 'eldt-requirements'
  and a.body_mdx like '%- Believing a quoted "federal minimum hours" number. The federal BTW standard is proficiency, not a clock.%'
  and a.body_mdx not like '%/knowledge/cdl-training/how-long-does-cdl-training-take%';

-- 3. Class A vs Class B → the timeline page: the repeat-the-sequence line in
--    "When Class A makes sense" now links the sequence's actual duration.
update public.kc_articles a set body_mdx = replace(
    a.body_mdx,
    'testing in a combination the first time beats repeating the licensing sequence later.',
    'testing in a combination the first time beats repeating the licensing sequence later. How long that sequence realistically takes is mapped in [How Long Does CDL Training Take?](/knowledge/cdl-training/how-long-does-cdl-training-take).')
from public.kc_categories c
where c.id = a.category_id and c.slug = 'getting-your-cdl'
  and a.slug = 'class-a-vs-class-b-cdl'
  and a.body_mdx like '%testing in a combination the first time beats repeating the licensing sequence later.%'
  and a.body_mdx not like '%/knowledge/cdl-training/how-long-does-cdl-training-take%';
