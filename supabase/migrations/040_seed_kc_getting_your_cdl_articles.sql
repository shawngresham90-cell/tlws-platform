-- 040_seed_kc_getting_your_cdl_articles.sql
-- Knowledge Center Batch 3 — Getting Your CDL cluster (10 authority pages).
--
-- ⚠️ COMMITTED; apply AFTER 015 (schema), 037 (Batch 1), and 038 (Batch 2 —
-- the cross-link update block at the end touches two Batch 2 bodies and one
-- Batch 1 body).
-- IDEMPOTENT AND NON-DESTRUCTIVE: the getting-your-cdl category inserts ONLY
-- when no category with that slug exists; every article inserts ONLY when no
-- article with the same (category, slug) exists; kc_related rows insert with
-- ON CONFLICT DO NOTHING; the cross-link UPDATEs are guarded so they run once
-- and never clobber other content (slug-scoped, substring replacement, skip
-- when the link is already present).
--
-- Content rules (hard, same as 037/038):
--   * Original wording only. Official primary sources only (eCFR / FMCSA /
--     the FMCSA Training Provider Registry), cited per claim and listed in
--     `sources`. Federal rule vs state variation vs recommendation vs school
--     policy vs employer-contract terms are labeled in-text.
--   * No invented tuition figures, fees, pass rates, salaries, approval
--     guarantees, or universal time estimates.
--   * reg_verified = true, reg_verified_date 2026-07-17 (visible
--     last-reviewed date), in-body regulatory-change disclaimer.
--   * Slugs are stable identifiers.

-- ---------------------------------------------------------------------------
-- 0. The category (insert-if-absent — never alters an existing category)
-- ---------------------------------------------------------------------------
insert into public.kc_categories (slug, name, description, icon, sort_order, is_active, meta_description)
select
  'getting-your-cdl',
  'Getting Your CDL',
  'The road from zero to CDL — requirements, the permit, ELDT, the skills test, schools, and what it all costs.',
  'map',
  6,
  true,
  'How to get your CDL step by step: federal requirements, the permit, ELDT, the skills test, school choices, and cost categories.'
where not exists (select 1 from public.kc_categories where slug = 'getting-your-cdl');

do $kc$
declare
  v_gyc uuid;
  v_dot uuid;
  v_cdl uuid;
  v_pub timestamptz := '2026-07-17 15:00:00+00';
  v_bio text := 'CDL-A driver and instructor — 17 years driving, zero violations. Founder of Trucking Life with Shawn and the TLWS truck driving school in Dalton, Georgia.';
begin
  select id into v_gyc from public.kc_categories where slug = 'getting-your-cdl';
  select id into v_dot from public.kc_categories where slug = 'dot-compliance';
  select id into v_cdl from public.kc_categories where slug = 'cdl-training';
  if v_gyc is null or v_dot is null or v_cdl is null then
    raise exception 'Knowledge Center categories missing (getting-your-cdl / dot-compliance / cdl-training)';
  end if;

  ---------------------------------------------------------------------------
  -- 1. How to Get Your CDL (cluster pillar)
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_gyc and slug = 'how-to-get-your-cdl') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_gyc,
      'how-to-get-your-cdl',
      'How to Get Your CDL: Complete Step-by-Step Guide',
      'The whole road from zero to CDL in one place — eligibility, the DOT physical, the permit tests, Entry-Level Driver Training, the 14-day wait, the three-part skills test, and license issuance, with the federal rule behind every step.',
      $mdx$**Quick answer:** Getting a CDL follows one federal sequence: confirm you meet the eligibility requirements (age, medical, residency), pass a DOT physical, pass your state's knowledge tests to earn a **commercial learner's permit (CLP)**, complete Entry-Level Driver Training from a registered provider if you're getting your first Class A or B, hold the CLP at least **14 days** ([49 CFR 383.25(e)](https://www.ecfr.gov/current/title-49/part-383/section-383.25)), then pass the three-part [skills test](/knowledge/getting-your-cdl/cdl-skills-test) in the class of vehicle you'll drive. Your state issues the license and any endorsements you've earned.

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026**. The federal framework lives in [49 CFR Part 383](https://www.ecfr.gov/current/title-49/part-383) and [Part 380](https://www.ecfr.gov/current/title-49/part-380); states add their own fees, forms, and scheduling on top. Confirm current rules with [FMCSA](https://www.fmcsa.dot.gov/) and your state licensing agency before relying on this. Not legal advice.

## What the CDL process actually is

A commercial driver's license is a **state-issued** license built on **federal minimum standards**. FMCSA sets the floor — who qualifies, what tests exist, what training is required — in 49 CFR Part 383, and every state's licensing agency administers it with its own paperwork, fees, and waiting rooms. That split explains almost every confusing thing about the process: the *sequence* is the same everywhere, but the *details* (cost, scheduling, which third-party testers exist) are state-specific.

## Who this applies to

Anyone getting a first CDL of any class, upgrading from Class B to Class A, or adding certain endorsements. If you already hold a CDL and just want the tanker or doubles/triples endorsement, you only need a knowledge test — the full pipeline below is for new drivers and class upgrades.

## The steps, in order

1. **Confirm eligibility.** Federal rules set age, medical, and residency floors, and [49 CFR 383.51](https://www.ecfr.gov/current/title-49/part-383/section-383.51) lists the disqualifying offenses. The details live in [CDL Requirements](/knowledge/getting-your-cdl/cdl-requirements).
2. **Pass the DOT physical.** A medical examiner on FMCSA's National Registry examines you under [49 CFR 391.41](https://www.ecfr.gov/current/title-49/part-391/section-391.41) and issues a medical examiner's certificate. Full details: [The DOT Medical Card](/knowledge/dot-compliance/dot-medical-card).
3. **Study and pass the knowledge tests.** Your state's CDL manual is the official study text; the [general knowledge test](/practice-tests/general-knowledge) is required for everyone, plus tests matching your vehicle — [air brakes](/practice-tests/air-brakes), [combination vehicles](/practice-tests/combination-vehicles) for Class A. Passing earns the **CLP** — the rules around it are in [The CDL Permit Explained](/knowledge/getting-your-cdl/cdl-permit-explained).
4. **Complete ELDT if it applies to you.** First-time Class A/B applicants and B-to-A upgrades must finish theory and behind-the-wheel training from a provider listed on FMCSA's [Training Provider Registry](https://tpr.fmcsa.dot.gov/) before the skills test — see [ELDT Requirements](/knowledge/getting-your-cdl/eldt-requirements).
5. **Practice under CLP rules.** You drive only with a qualified CDL holder beside you — the supervision rules are in [49 CFR 383.25](https://www.ecfr.gov/current/title-49/part-383/section-383.25).
6. **Take the skills test — after the 14-day minimum.** Federal rule: you must have held the CLP at least 14 days before testing. The test itself is three parts — vehicle inspection, basic control, road test — in a vehicle representative of your class ([49 CFR 383.113](https://www.ecfr.gov/current/title-49/part-383/section-383.113)).
7. **Get licensed, add endorsements.** The state issues your CDL. Endorsements — [hazmat](/practice-tests/hazmat), [tanker](/practice-tests/tanker), passenger, school bus, doubles/triples — each have their own tests and, for hazmat, a TSA security check. The map: [CDL Endorsements and Restrictions](/knowledge/getting-your-cdl/cdl-endorsements-restrictions).

## A realistic example (illustration, not a promise)

A 24-year-old warehouse worker in Georgia decides to drive. Week one: DOT physical, then a library copy of the state CDL manual and nightly [practice tests](/practice-tests). Week three: passes general knowledge, air brakes, and combination at the licensing agency and walks out with a Class A CLP. She enrolls with a TPR-listed school, logs her theory assessment and range time, and keeps practicing pre-trips. The earliest the skills test can legally happen is day 15 of the CLP — her state's testing backlog makes it week eight. Timelines vary widely by state and school; treat any promised date as an estimate.

## Common mistakes

- Scheduling a skills test inside the 14-day CLP window — the federal minimum in 383.25(e) is not waivable by a school.
- Paying tuition before checking the school on the [Training Provider Registry](https://tpr.fmcsa.dot.gov/) — training from an unregistered provider does not count for ELDT.
- Testing in the wrong vehicle. Test in an automatic or a vehicle without full air brakes and the license carries a [restriction](/knowledge/getting-your-cdl/cdl-endorsements-restrictions) barring what you skipped.
- Treating the DOT physical as a formality — a short-term medical certificate changes your renewal rhythm from day one.
- Ignoring the money side until enrollment day. The fee categories (and the contract trade-offs of sponsored training) are laid out in [What Does It Cost to Get a CDL?](/knowledge/getting-your-cdl/cdl-cost) and [Sponsored vs. Private School](/knowledge/getting-your-cdl/sponsored-vs-private-cdl-school).

## Costs and trade-offs

Every step has a fee attached somewhere — physical, permit tests, training, skills test, issuance — and states set most of them. Rather than quote numbers that go stale, the [cost breakdown](/knowledge/getting-your-cdl/cdl-cost) walks the categories and how drivers actually pay for them (self-pay, private financing, or a carrier contract).

## Your step-by-step checklist

- Eligibility confirmed against the requirements page
- DOT physical passed; medical certificate in hand
- State CDL manual downloaded; practice tests in daily rotation
- Knowledge tests passed → CLP issued
- ELDT provider verified on the Training Provider Registry
- 14 days on the CLP before the earliest skills-test date
- Skills test booked in the right vehicle class and transmission
- Endorsement plan chosen for after issuance

## Keep learning

- The spokes of this guide: [CDL Requirements](/knowledge/getting-your-cdl/cdl-requirements) · [The CDL Permit](/knowledge/getting-your-cdl/cdl-permit-explained) · [ELDT](/knowledge/getting-your-cdl/eldt-requirements) · [Classes A/B/C](/knowledge/getting-your-cdl/cdl-classes-compared) · [The Skills Test](/knowledge/getting-your-cdl/cdl-skills-test) · [A Study Plan That Works](/knowledge/getting-your-cdl/cdl-study-plan)
- Drill free: [General Knowledge practice test](/practice-tests/general-knowledge) · [the full test hub](/practice-tests)
- Watch: [17 Years, Zero Violations — Here's How](https://youtu.be/PDeJF0CMoUw) on the Trucking Life with Shawn channel.
- **Learn it hands-on:** [TLWS Academy](/academy) · start free with [CDL Pre-School](/cdl-pre-school) · [join the email list](/#newsletter).$mdx$,
      'How to Get Your CDL: Step-by-Step Guide (2026) | Trucking Life with Shawn',
      'Every step to a CDL: requirements, DOT physical, permit tests, ELDT, the 14-day wait, the three-part skills test, and endorsements — with the federal rule behind each.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR Part 383 — Commercial Driver's License Standards (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383"},
        {"label":"49 CFR 383.25 — Commercial learner's permit provisions (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.25"},
        {"label":"49 CFR Part 380 — Entry-Level Driver Training (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-380"},
        {"label":"FMCSA Training Provider Registry","url":"https://tpr.fmcsa.dot.gov/"},
        {"label":"FMCSA — Federal Motor Carrier Safety Administration","url":"https://www.fmcsa.dot.gov/"}
      ]$j$::jsonb,
      $j$[
        {"q":"How long does it take to get a CDL?","a":"There is no universal timeline. Federal rules impose one fixed floor — you must hold the commercial learner's permit at least 14 days before the skills test — while everything else depends on your study pace, your training provider's schedule, and your state's testing backlog."},
        {"q":"Can I get a CDL without going to school?","a":"If you are getting a first Class A or Class B CDL (or upgrading B to A), federal ELDT rules require training from a provider listed on FMCSA's Training Provider Registry before you can take the skills test. The registry includes many kinds of providers, not only traditional schools."},
        {"q":"What tests do I have to pass to get a CDL?","a":"Knowledge tests first — general knowledge plus the tests matching your vehicle, such as air brakes and combination vehicles — which earn the CLP. Then the three-part skills test: vehicle inspection, basic control, and the road test, taken in a vehicle representative of your license class."},
        {"q":"Do I need a DOT physical before the CDL process?","a":"You need to be medically qualified under 49 CFR 391.41, shown by a medical examiner's certificate from an examiner on FMCSA's National Registry. Most drivers complete the physical at the start, because states require medical certification information when issuing the CLP or CDL."},
        {"q":"Is the CDL process the same in every state?","a":"The sequence and the federal minimums are the same everywhere — they come from 49 CFR Part 383. Fees, forms, scheduling, third-party testing options, and some intrastate age rules differ by state, so always pair this guide with your state licensing agency's instructions."}
      ]$j$::jsonb,
      '{getting-your-cdl,cdl-process,clp,eldt,skills-test}',
      8, true, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 2. CDL Requirements
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_gyc and slug = 'cdl-requirements') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_gyc,
      'cdl-requirements',
      'CDL Requirements: Age, Medical, Residency, and Eligibility',
      'What it takes to qualify for a CDL before you ever touch a truck — the federal age rules for interstate and intrastate driving, medical qualification, residency and identity proof, the Clearinghouse, and the offenses that disqualify a driver.',
      $mdx$**Quick answer:** To qualify for a CDL you must meet the federal floor: be old enough (**21 for interstate** driving under [49 CFR 391.11](https://www.ecfr.gov/current/title-49/part-391/section-391.11); many states license **18–20-year-olds for intrastate-only** driving), be **medically qualified** under [49 CFR 391.41](https://www.ecfr.gov/current/title-49/part-391/section-391.41), prove **identity, lawful status, and state residency** ([49 CFR 383.71](https://www.ecfr.gov/current/title-49/part-383/section-383.71)), hold only **one license from one state** ([49 CFR 383.21](https://www.ecfr.gov/current/title-49/part-383/section-383.21)), and be clear of the **disqualifying offenses** in [49 CFR 383.51](https://www.ecfr.gov/current/title-49/part-383/section-383.51).

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026**. Federal requirements come from 49 CFR Parts 383 and 391; states can layer additional rules for intrastate drivers. Confirm current requirements with [FMCSA](https://www.fmcsa.dot.gov/) and your state licensing agency before relying on this. Not legal advice.

## The requirements at a glance

Think of eligibility as five gates, all federal, all checked before or during licensing: **age**, **medical qualification**, **identity and residency**, **a clean-enough record**, and **one single license**. States administer the checks and can add intrastate wrinkles, but they cannot lower the federal floor.

## Who this applies to

Every applicant for a commercial learner's permit or CDL of any class, and every working CDL holder — the medical and disqualification rules keep applying for as long as you drive. If you're mapping the whole journey, start at the [step-by-step guide](/knowledge/getting-your-cdl/how-to-get-your-cdl).

## Gate 1: age — the interstate/intrastate split

The number that matters is **21**: federal driver-qualification rules ([391.11(b)(1)](https://www.ecfr.gov/current/title-49/part-391/section-391.11)) require interstate CMV drivers to be at least 21. States may issue CDLs to drivers **18–20**, but those drivers are limited to **intrastate** work — loads and routes that never cross a state line or handle freight moving in interstate commerce. Practical consequence: most major carriers hire at 21, and an 18-year-old's first driving jobs are local and in-state. State rules on what 18–20-year-olds may haul vary — check yours.

## Gate 2: medical qualification

You must meet the physical qualification standards of 391.41 — vision, hearing, blood pressure, and the condition-by-condition rules — demonstrated in an exam by a medical examiner on FMCSA's **National Registry**, who issues the medical examiner's certificate. When you apply, the state also has you **self-certify** your operating category (interstate vs intrastate, excepted vs non-excepted), which controls whether the medical certificate must be on file at all. The full picture — exam, certificate lengths, variances, and what happens when a card lapses — is in [The DOT Medical Card](/knowledge/dot-compliance/dot-medical-card). The examiner decides medical outcomes, not the school, not the carrier, and not this article.

## Gate 3: identity, lawful status, and residency

Under [383.71](https://www.ecfr.gov/current/title-49/part-383/section-383.71) you prove who you are, that you're lawfully present in the U.S. (citizens and lawful permanent residents use the documents in the rule's proof table), and that you're **domiciled in the state issuing the license**. Bring originals — licensing agencies are strict about document lists, and the lists themselves are state-published. You must also surrender any other state's license: the **one-driver/one-license** rule in 383.21 is absolute, and holding two licenses is itself a violation.

## Gate 4: the record — disqualifying offenses

[49 CFR 383.51](https://www.ecfr.gov/current/title-49/part-383/section-383.51) is the disqualification engine. In outline:

- **Major offenses** — DUI in any vehicle (including a 0.04% or greater alcohol concentration in a CMV, or refusal to test), leaving the scene, using a vehicle to commit a felony, driving a CMV while your CDL is revoked, causing a fatality through negligent CMV operation. First offense: **one year** disqualified (three years if the vehicle was placarded for hazmat). Second: **lifetime**, with a possible reinstatement path after ten years at state discretion. Using a CMV in a felony involving controlled substances: **lifetime, no reinstatement**.
- **Serious traffic violations** — excessive speeding (15+ mph over), reckless driving, improper lane changes, following too closely, texting or hand-held phone use while driving a CMV, and more. Two convictions inside three years: **60 days**; three or more: **120 days**.
- **Railroad-crossing violations and out-of-service violations** carry their own escalating disqualifications.

These attach to the *person*, not the job — a DUI in your personal car counts against your CDL. That is the career risk 383.51 encodes, and why a clean record is an eligibility asset with a price on it.

## Gate 5: the Clearinghouse

Since drug-and-alcohol testing went digital, your **Clearinghouse status** is effectively an eligibility requirement: carriers must query it before putting you in a truck, and a prohibited status stops employment until return-to-duty is complete. How the database, the tests, and the RTD process work: [CDL Drug and Alcohol Testing Rules and the Clearinghouse](/knowledge/dot-compliance/drug-alcohol-testing-clearinghouse).

## A realistic example (illustration, not legal advice)

A 20-year-old applicant in Tennessee qualifies medically, proves residency, and earns a Class A CDL — valid for intrastate work only. On their 21st birthday nothing new is filed with FMCSA; the federal interstate age bar simply lifts, and the OTR applications go out. Meanwhile a 35-year-old with a five-year-old DUI in a personal vehicle is *not* barred from applying — the one-year disqualification ran long ago — but should expect carriers to see the record and underwrite accordingly. Individual situations differ; when a record is complicated, the state licensing agency is the authority on what it will issue.

## Common mistakes

- Assuming 18 means OTR. It means intrastate — the 21 rule is federal.
- Booking the DOT physical with a non-Registry examiner. The certificate only counts from a National Registry examiner.
- Showing up with photocopies. Identity and residency proofs are original-document territory.
- Forgetting the self-certification category, then wondering why the state flagged the medical certificate.
- Treating personal-vehicle convictions as separate from the CDL. 383.51 counts them.

## Eligibility checklist

- Age matches the driving you plan (21 interstate / state rules for 18–20 intrastate)
- DOT physical booked with a National Registry examiner
- Identity, lawful-status, and residency originals gathered per your state's list
- Any other state's license ready to surrender
- Driving record reviewed against 383.51 — know what a carrier will see
- Clearinghouse registration done (you'll need it for pre-employment queries)

## Keep learning

- Next step in the journey: [The CDL Permit Explained](/knowledge/getting-your-cdl/cdl-permit-explained) — and the [full step-by-step guide](/knowledge/getting-your-cdl/how-to-get-your-cdl)
- The medical deep dive: [The DOT Medical Card](/knowledge/dot-compliance/dot-medical-card)
- Start studying now, free: [General Knowledge practice test](/practice-tests/general-knowledge)
- **Get exam-ready with structure:** [TLWS Academy](/academy) · start free with [CDL Pre-School](/cdl-pre-school) · [join the email list](/#newsletter).$mdx$,
      'CDL Requirements 2026: Age, Medical, and Eligibility | Trucking Life with Shawn',
      'Who qualifies for a CDL: 21 for interstate (18–20 intrastate), DOT medical standards, residency proof, the one-license rule, and 383.51 disqualifications.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR 391.11 — General qualifications of drivers (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.11"},
        {"label":"49 CFR 391.41 — Physical qualifications for drivers (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.41"},
        {"label":"49 CFR 383.71 — Driver application and certification procedures (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.71"},
        {"label":"49 CFR 383.51 — Disqualification of drivers (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.51"},
        {"label":"49 CFR 383.21 — Number of drivers' licenses (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.21"}
      ]$j$::jsonb,
      $j$[
        {"q":"Can I get a CDL at 18?","a":"Many states issue CDLs to 18–20-year-olds, but federal rules restrict drivers under 21 to intrastate driving — work that stays inside the state. Interstate driving requires being at least 21 under 49 CFR 391.11."},
        {"q":"Does a DUI in my personal car affect CDL eligibility?","a":"Yes. The disqualification table in 49 CFR 383.51 counts major offenses committed in any vehicle, not just a CMV. A first DUI conviction disqualifies a CDL holder for one year; a second is a lifetime disqualification with only a limited reinstatement possibility."},
        {"q":"Do I need a medical card before applying for a CDL?","a":"You need to be medically qualified under 49 CFR 391.41 and, for most operating categories, to file a current medical examiner's certificate from a National Registry examiner with your state licensing agency, which also collects your self-certification of operating category."},
        {"q":"Can I hold driver's licenses from two states?","a":"No. 49 CFR 383.21 allows exactly one license, issued by your state of domicile. Applying for a CDL means surrendering any other state's license, and holding more than one is itself a violation."},
        {"q":"What documents prove residency for a CDL?","a":"Federal rules in 49 CFR 383.71 require proof of identity, lawful presence, and domicile in the issuing state, but the specific acceptable-document list is published by each state licensing agency — check your state's list and bring originals."}
      ]$j$::jsonb,
      '{getting-your-cdl,requirements,eligibility,medical,disqualification}',
      8, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 3. The CDL Permit Explained (CLP)
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_gyc and slug = 'cdl-permit-explained') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_gyc,
      'cdl-permit-explained',
      'The CDL Permit Explained: CLP Rules, Tests, and the 14-Day Wait',
      'Everything the commercial learner''s permit really allows — the knowledge tests that earn it, who must ride with you, the endorsements a CLP can and cannot carry, how long it lasts, and the federal 14-day rule before the skills test.',
      $mdx$**Quick answer:** The **commercial learner's permit (CLP)** is earned by passing your state's CDL **knowledge tests** and lets you practice driving a commercial vehicle **only with a qualified CDL holder seated beside you** ([49 CFR 383.25(a)](https://www.ecfr.gov/current/title-49/part-383/section-383.25)). It can carry only the **P, S, or N** endorsements (each restricted while learning), it is **valid for no more than one year** from issuance under federal rule, and you must hold it a minimum of **14 days** before you may take the skills test ([383.25(e)](https://www.ecfr.gov/current/title-49/part-383/section-383.25)).

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026**. CLP rules are federal ([49 CFR 383.25](https://www.ecfr.gov/current/title-49/part-383/section-383.25) and [383.71](https://www.ecfr.gov/current/title-49/part-383/section-383.71)); states set fees, issuance terms within the federal cap, and renewal mechanics. Confirm with [FMCSA](https://www.fmcsa.dot.gov/) and your state licensing agency. Not legal advice.

## What the CLP is

The CLP is the commercial equivalent of the learner's permit you had as a teenager: proof you've passed the *knowledge* side, and legal cover to build the *skills* side on real roads under supervision. No CLP, no lawful practice in a CMV — and no skills test, because the permit is a prerequisite for it.

## Who needs one

Everyone pursuing a first CDL or a class upgrade. Even experienced Class B drivers moving to Class A hold a Class A CLP while they learn the combination vehicle. If you're checking where this fits in the sequence, see the [step-by-step guide](/knowledge/getting-your-cdl/how-to-get-your-cdl).

## The tests that earn it

The CLP comes from knowledge tests only — no driving:

- **General knowledge** — required for every applicant. Drill it free: [General Knowledge practice test](/practice-tests/general-knowledge).
- **Air brakes** — required if your vehicle has them (skip it and the license is restricted to vehicles without full air brakes): [Air Brakes practice test](/practice-tests/air-brakes).
- **Combination vehicles** — required for Class A: [Combination practice test](/practice-tests/combination-vehicles).
- **Endorsement knowledge tests** you want to pre-load, within the CLP limits below.

States score against the federal minimums in [49 CFR 383.135](https://www.ecfr.gov/current/title-49/part-383/section-383.135); the questions themselves come from your state's testing system, built on the CDL manual.

## The supervision rule

A CLP holder may drive a CMV **only when accompanied by the holder of a valid CDL** for the same class and type of vehicle, and that supervisor must be **physically seated beside you** in the front seat — not in the sleeper, not following in another truck. That is 383.25(a)(1), and schools build their trucks and schedules around it.

## Endorsements on a CLP — only three, all limited

Federal rule allows a CLP to carry only:

- **P (passenger)** — but you may not carry passengers other than trainers, examiners, and fellow trainees;
- **S (school bus)** — same no-passengers limitation;
- **N (tank)** — but only with an **empty** tank, purged if it last held hazardous material.

Everything else — hazmat above all — waits for the full CDL. That's [383.25(b)](https://www.ecfr.gov/current/title-49/part-383/section-383.25).

## How long it lasts — and the 14-day floor

Two clocks run on every CLP:

1. **Validity:** federal rule caps a CLP at **one year from issuance**. States choose the actual term within that cap, and their renewal mechanics differ — some reissue, some make you retest. Check your state before letting one lapse.
2. **The 14-day minimum:** you must have **held the CLP at least 14 days** before taking the skills test. It's a floor on rushing, and no school, tester, or employer can waive it.

Used well, the 14 days are an asset: that's two weeks of supervised practice, [pre-trip drilling](/knowledge/cdl-training/cdl-pre-trip-inspection-guide), and [missed-question review](/practice-tests) before test day. A structured way to use the window: [A CDL Study Plan That Works](/knowledge/getting-your-cdl/cdl-study-plan).

## A realistic example (illustration only)

A student passes general knowledge and combination on a Tuesday but fails air brakes by one question. He returns Thursday, passes, and the CLP prints with no air-brake restriction problem ahead. His school schedules the skills test for the sixteenth day — the fourteenth falls on a Sunday and the testing site is closed. Had he booked day twelve "to save time," the state would have turned him away at the counter.

## Common mistakes

- Practicing with a supervisor whose CDL doesn't match the vehicle class — the rule says a valid CDL *for that vehicle*.
- Assuming the CLP allows solo bobtailing "just around the yard." Public-road driving needs the supervisor beside you.
- Trying to take hazmat while on a CLP — H cannot be added until the full license.
- Letting the CLP expire mid-training and discovering your state's renewal means retesting.
- Booking the skills test before day 14 and losing the appointment.

## CLP checklist

- Knowledge tests mapped to your target class and vehicle (GK + air brakes + combination for Class A)
- CLP printed with the right class and any P/S/N endorsement you'll train under
- Supervisor's CDL verified against the practice vehicle
- Skills test scheduled for day 15 or later
- Expiration date noted — with your state's renewal rule beside it

## Keep learning

- Next: [Entry-Level Driver Training](/knowledge/getting-your-cdl/eldt-requirements), then [The CDL Skills Test](/knowledge/getting-your-cdl/cdl-skills-test) — or zoom out to the [full guide](/knowledge/getting-your-cdl/how-to-get-your-cdl)
- Pass the knowledge tests the first time: [practice-test hub](/practice-tests)
- **Structured prep:** [TLWS Academy](/academy) · start free with [CDL Pre-School](/cdl-pre-school) · [join the email list](/#newsletter).$mdx$,
      'CDL Permit (CLP) Rules and the 14-Day Wait | Trucking Life with Shawn',
      'The CLP explained: the knowledge tests, front-seat supervision rule, P/S/N-only endorsements, the one-year federal cap, and the 14-day wait before the skills test.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR 383.25 — Commercial learner's permit provisions (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.25"},
        {"label":"49 CFR 383.71 — Driver application procedures (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.71"},
        {"label":"49 CFR 383.135 — Passing knowledge and skills tests (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.135"},
        {"label":"FMCSA — Federal Motor Carrier Safety Administration","url":"https://www.fmcsa.dot.gov/"}
      ]$j$::jsonb,
      $j$[
        {"q":"How long do I have to hold my CLP before the skills test?","a":"A federal minimum of 14 days under 49 CFR 383.25(e). The clock starts at issuance, and states cannot test you earlier — schedule the skills test for day 15 or later to be safe."},
        {"q":"Who has to ride with a CLP holder?","a":"The holder of a valid CDL with the proper class and endorsements for the vehicle being driven, physically seated beside the CLP holder in the front seat. Practicing without that supervisor is unlawful CMV operation."},
        {"q":"Which endorsements can go on a CLP?","a":"Only passenger (P), school bus (S), and tank (N) — and each is limited during training: no passengers beyond trainers, examiners, and fellow trainees for P and S, and only an empty (purged, if it held hazmat) tank for N. Hazmat cannot be added to a CLP."},
        {"q":"How long is a CLP valid?","a":"Federal rule caps CLP validity at one year from the date of issuance. States set the actual issued term within that cap and their own renewal or retest mechanics, so check your state before letting a permit run down."},
        {"q":"Do I need the air brakes test for my CLP?","a":"You need it if you plan to test and drive in a vehicle with full air brakes. Skip or fail it and your eventual CDL carries a restriction barring vehicles with full air brakes — which covers most highway tractors."}
      ]$j$::jsonb,
      '{getting-your-cdl,clp,permit,knowledge-tests,14-day-rule}',
      8, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 4. Entry-Level Driver Training (ELDT)
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_gyc and slug = 'eldt-requirements') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_gyc,
      'eldt-requirements',
      'Entry-Level Driver Training (ELDT) Requirements Explained',
      'Who must complete ELDT, what the federal theory and behind-the-wheel requirements actually say, why the Training Provider Registry is the only list that counts, and how the certification reaches your state before you can test.',
      $mdx$**Quick answer:** Since **February 7, 2022**, federal rule requires **Entry-Level Driver Training** before you can take the skills test for a **first Class A or Class B CDL** or a **Class B-to-A upgrade**, or the knowledge/skills test for a **first hazmat (H), passenger (P), or school bus (S) endorsement** ([49 CFR Part 380, Subpart F](https://www.ecfr.gov/current/title-49/part-380)). The training — **theory plus behind-the-wheel** for licenses and P/S, **theory only for H** — must come from a provider listed on FMCSA's [Training Provider Registry](https://tpr.fmcsa.dot.gov/), and the provider transmits your completion certification to the registry electronically. Federal rule sets **no minimum number of training hours**; completion is proficiency-based.

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026**. ELDT rules live in [49 CFR Part 380](https://www.ecfr.gov/current/title-49/part-380) and its curriculum appendices. Confirm current requirements with [FMCSA](https://www.fmcsa.dot.gov/) and the [Training Provider Registry](https://tpr.fmcsa.dot.gov/) before relying on this. Not legal advice.

## What ELDT is

ELDT is the federal minimum training standard for new commercial drivers — the rule that ended the era of walking into a skills test cold. It defines a **theory curriculum** (classroom/online knowledge) and a **behind-the-wheel curriculum** (range plus public road) in the Part 380 appendices, and it defines *who may teach it*: only training providers registered on FMCSA's Training Provider Registry (TPR), which can include schools, carriers, and other organizations that meet the registry requirements.

## Who must complete it

You are subject to ELDT if, on or after February 7, 2022, you are:

- getting your **first Class A CDL**;
- getting your **first Class B CDL**;
- **upgrading** an existing Class B to a Class A;
- adding a **first-time hazmat (H)**, **passenger (P)**, or **school bus (S)** endorsement.

Drivers who obtained the relevant CLP before that date, certain military-experience waivers under [49 CFR 383.77](https://www.ecfr.gov/current/title-49/part-383/section-383.77), and other narrow exceptions exist — if you think one applies to you, verify it with your state before counting on it. Adding **tanker (N)** or **doubles/triples (T)** to an existing CDL does **not** trigger ELDT — those are knowledge tests only.

## What the training covers

- **Theory:** the Part 380 appendices list the required topics — basic operation, safe operating procedures, advanced practices, vehicle systems and malfunctions, and non-driving duties like [hours of service](/knowledge/hours-of-service/cdl-hours-of-service-rules) and whistleblower rights. The provider must assess you, and the appendices require an overall score of at least **80%** on the theory assessment.
- **Behind-the-wheel (BTW):** split between a **range** (backing, docking, coupling) and **public roads** (visual search, speed and space management, hazard perception, hours-of-service awareness). There is **no federal minimum hour count** — the instructor certifies proficiency in each element. Any school quoting "the federally required hours" is describing its own curriculum or a state rule, not the federal one.
- **For H:** theory only, against the hazmat curriculum, before the state may administer the hazmat knowledge test.

## How the paperwork flows, step by step

You never carry an ELDT certificate to the counter. The provider **uploads your completion electronically to the TPR**, FMCSA makes it available to your state, and the state checks it **before administering the skills test** (or the H knowledge test). If your school hasn't transmitted, you don't test — one more reason the provider's registry status matters more than its marketing.

## Choosing a provider

The only list that counts is the [Training Provider Registry](https://tpr.fmcsa.dot.gov/) — search it before paying anyone. Registered providers range from community colleges to carrier academies to independent schools; the registry tells you they meet the federal floor, not that they're good. For how to compare them — cost structures, contracts, job-placement claims — see [Sponsored vs. Private School](/knowledge/getting-your-cdl/sponsored-vs-private-cdl-school) and the [cost breakdown](/knowledge/getting-your-cdl/cdl-cost).

## A realistic example (illustration only)

A Class B box-truck driver wants a Class A. He assumed years of experience would exempt him — but a B-to-A upgrade is squarely inside ELDT. He picks a TPR-listed school, clears the theory assessment in a weekend of study (his experience helps), and the school certifies his BTW proficiency after the instructor signs off element by element. The school transmits the certification Tuesday night; Wednesday the state sees it and his [skills test](/knowledge/getting-your-cdl/cdl-skills-test) stays on the calendar.

## Common mistakes

- Paying a provider that isn't on the TPR — the training doesn't count, no matter the quality.
- Believing a quoted "federal minimum hours" number. The federal BTW standard is proficiency, not a clock.
- Forgetting ELDT applies to B-to-A **upgrades** and first-time H/P/S, not just brand-new drivers.
- Scheduling a skills test before the provider has transmitted completion to the registry.
- Assuming ELDT replaces the [CLP rules](/knowledge/getting-your-cdl/cdl-permit-explained) — the 14-day minimum and supervision requirements still apply.

## ELDT checklist

- Confirm you're covered (first A/B, B→A, or first H/P/S)
- Provider verified on the Training Provider Registry — by legal name
- Theory topics and assessment plan in writing
- BTW proficiency elements listed (range + public road)
- Provider's transmission timing confirmed before booking the skills test

## Keep learning

- Where this sits in the sequence: [the step-by-step guide](/knowledge/getting-your-cdl/how-to-get-your-cdl) · then [The CDL Skills Test](/knowledge/getting-your-cdl/cdl-skills-test)
- Theory prep that mirrors the real tests: [General Knowledge](/practice-tests/general-knowledge) · [Hazmat](/practice-tests/hazmat) · [the full hub](/practice-tests)
- **Train with us:** [TLWS Academy](/academy) · start free with [CDL Pre-School](/cdl-pre-school) · [join the email list](/#newsletter).$mdx$,
      'ELDT Requirements: Who Needs It and How It Works | Trucking Life with Shawn',
      'ELDT explained: who must complete it, the theory and behind-the-wheel rules, the 80% assessment, the Training Provider Registry, and how certification reaches your state.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR Part 380 — Special Training Requirements, incl. Subpart F ELDT (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-380"},
        {"label":"FMCSA Training Provider Registry","url":"https://tpr.fmcsa.dot.gov/"},
        {"label":"49 CFR 383.77 — Substitute for driving skills tests (military) (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.77"},
        {"label":"FMCSA — Federal Motor Carrier Safety Administration","url":"https://www.fmcsa.dot.gov/"}
      ]$j$::jsonb,
      $j$[
        {"q":"Who is required to complete ELDT?","a":"Anyone who, on or after February 7, 2022, seeks a first Class A or Class B CDL, upgrades from Class B to Class A, or applies for a first-time hazmat, passenger, or school bus endorsement. Adding tanker or doubles/triples to an existing CDL does not require ELDT."},
        {"q":"How many hours of training does ELDT require?","a":"Federal rule sets no minimum hour count. Theory ends with an assessment requiring at least an 80% overall score, and behind-the-wheel training ends when the instructor certifies proficiency in each required element. Hour minimums you see quoted are school curricula or state rules."},
        {"q":"Can any CDL school provide ELDT?","a":"Only providers listed on FMCSA's Training Provider Registry. Training from an unregistered provider does not satisfy the federal requirement regardless of its quality — search the registry by the provider's legal name before paying."},
        {"q":"Do I get an ELDT certificate to bring to the DMV?","a":"No. The provider transmits your completion electronically to the Training Provider Registry, and your state verifies it there before administering the skills test — or, for hazmat, the knowledge test. If the transmission hasn't happened, you cannot test."},
        {"q":"Does ELDT apply to the hazmat endorsement?","a":"Yes — a first-time H endorsement requires completing the ELDT hazmat theory curriculum before the state gives the hazmat knowledge test. There is no behind-the-wheel component for H."}
      ]$j$::jsonb,
      '{getting-your-cdl,eldt,training,tpr,theory,behind-the-wheel}',
      8, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 5. CDL Classes A, B, and C Compared
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_gyc and slug = 'cdl-classes-compared') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_gyc,
      'cdl-classes-compared',
      'CDL Classes A, B, and C Compared',
      'The three CDL classes in plain English — the 26,001- and 10,000-pound lines that separate them, what each class lets you drive, how the class you test in shapes your career, and where endorsements fit on top.',
      $mdx$**Quick answer:** Federal rule sorts commercial vehicles into three groups ([49 CFR 383.91](https://www.ecfr.gov/current/title-49/part-383/section-383.91)): **Class A** — combination vehicles with a combined weight rating of **26,001+ pounds** whose towed unit(s) exceed **10,000 pounds**; **Class B** — single vehicles rated **26,001+ pounds**, towing **10,000 pounds or less**; **Class C** — smaller vehicles that still need a CDL because they carry **16+ people (including the driver)** or **placarded hazardous materials**. A Class A holder may, with the right endorsements, drive Class B and C vehicles too.

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026**. Vehicle groups are defined in [49 CFR 383.91](https://www.ecfr.gov/current/title-49/part-383/section-383.91) and the definitions in [383.5](https://www.ecfr.gov/current/title-49/part-383/section-383.5); states mirror them for CDL issuance. Confirm current rules with [FMCSA](https://www.fmcsa.dot.gov/) before relying on this. Not legal advice.

## The two numbers that draw the lines

Everything turns on two weights:

- **26,001 pounds** — the threshold that makes a vehicle (or combination) "commercial" for licensing.
- **10,000 pounds** — the towed-unit line that separates a Class A combination from a Class B truck pulling a light trailer.

The rule measures by **rating or actual weight, whichever is greater** — a truck rated at 25,999 but scaled at 27,000 is over the line. GVWR (the manufacturer's gross vehicle weight rating) and GCWR (the combination rating) are the numbers on the certification labels, and inspectors read labels.

## Who this choice faces

Every new applicant, once — the class you test in is the class you hold — plus every Class B or C holder weighing an upgrade, and anyone whose employer's equipment is changing under them.

## Class A — combinations

**What it is:** any combination with a GCWR (or actual combined weight) of 26,001+ pounds where the towed unit alone exceeds 10,000 pounds rated or actual.

**What it covers:** tractor-trailers of every kind — dry van, reefer, flatbed, [tanker](/practice-tests/tanker), and, with the T endorsement, doubles and triples. It's the license most freight jobs mean when they say "CDL," and the [combination-vehicles knowledge test](/practice-tests/combination-vehicles) exists because of it.

**Career shape:** widest job market, longest training, and the skills test happens in a combination — which is why most new drivers who can train in a Class A vehicle do.

## Class B — heavy straight trucks

**What it is:** a single vehicle rated 26,001+ pounds, towing nothing heavier than 10,000 pounds.

**What it covers:** dump trucks, box trucks, concrete mixers, many buses (with P or S endorsements), refuse trucks. Local, home-nightly work skews Class B.

**The trap to know:** a Class B license never grows into Class A privileges by experience. Moving up later means a Class A CLP, [ELDT for the upgrade](/knowledge/getting-your-cdl/eldt-requirements), and a new [skills test](/knowledge/getting-your-cdl/cdl-skills-test) in a combination.

## Class C — small but regulated

**What it is:** a vehicle that doesn't meet the A or B weight definitions but is designed for **16 or more occupants including the driver**, or hauls **hazardous materials in placardable quantities**.

**What it covers:** shuttle vans and small buses (P endorsement), small [hazmat](/practice-tests/hazmat) work (H endorsement). Class C exists so the cargo and passengers — not just the weight — trigger commercial standards.

## Classes vs endorsements — two different axes

The **class** says how big and what configuration; **endorsements** say what's inside or how many trailers. A Class A license doesn't authorize hazmat, and an H endorsement doesn't authorize a combination. The full overlay — H, N, P, S, T, X, and the restriction codes — is in [CDL Endorsements and Restrictions](/knowledge/getting-your-cdl/cdl-endorsements-restrictions). And because the class controls the **test vehicle**, it also controls restrictions: test in an automatic and you'll carry the no-manual restriction; test without full air brakes and air-braked trucks are off the table.

## A realistic example (illustration only)

Two friends start the same week. One tests in a Class A sleeper tractor pulling a 53-foot trailer; the other tests in a Class B dump truck because a paving company is hiring. Three years later the dump-truck driver wants OTR money: back to a CLP, an ELDT upgrade course, and a combination skills test — none of the Class B seat time substitutes for the Class A test. Choosing the bigger class first isn't always right (the paving job was real money sooner), but it's a choice you make **once at the start**, so make it looking at the whole map: [the step-by-step guide](/knowledge/getting-your-cdl/how-to-get-your-cdl).

## Common mistakes

- Reading 26,001 as "actual weight only." Rating counts, and the greater number wins.
- Assuming a heavy pickup-and-gooseneck combo is exempt — cross the two thresholds and it's Class A territory regardless of what the truck looks like.
- Getting Class B "to start" without pricing the later upgrade (new permit, ELDT, new skills test).
- Forgetting that 15-passenger-plus-driver equals 16 occupants — the Class C line counts the driver.
- Treating endorsements as substitutes for class. They stack on top; they never widen the vehicle group.

## Choosing-your-class checklist

- Target job's vehicle identified (combination vs straight truck vs passenger/hazmat)
- GVWR/GCWR of the training and test vehicle confirmed against the class definitions
- Endorsements you'll need on top listed
- Upgrade cost understood if starting below Class A
- Test-vehicle transmission and brakes checked against the restriction rules

## Keep learning

- The tests your class requires: [General Knowledge](/practice-tests/general-knowledge) · [Air Brakes](/practice-tests/air-brakes) · [Combination Vehicles](/practice-tests/combination-vehicles)
- What stacks on top: [CDL Endorsements and Restrictions](/knowledge/getting-your-cdl/cdl-endorsements-restrictions)
- **Plan the whole journey:** [TLWS Academy](/academy) · start free with [CDL Pre-School](/cdl-pre-school) · [join the email list](/#newsletter).$mdx$,
      'CDL Classes A, B, C Compared: What Each Covers | Trucking Life with Shawn',
      'Class A vs B vs C in plain English: the 26,001- and 10,000-pound lines, what each class lets you drive, upgrade costs, and how endorsements stack on top.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR 383.91 — Commercial motor vehicle groups (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.91"},
        {"label":"49 CFR 383.5 — Definitions (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.5"},
        {"label":"49 CFR 383.93 — Endorsements (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.93"},
        {"label":"FMCSA — Federal Motor Carrier Safety Administration","url":"https://www.fmcsa.dot.gov/"}
      ]$j$::jsonb,
      $j$[
        {"q":"What is the difference between Class A and Class B?","a":"Class A is a combination — 26,001+ pounds combined with a towed unit over 10,000 pounds. Class B is a single vehicle rated 26,001+ pounds towing 10,000 pounds or less. The towed-unit weight is the dividing line, and it decides which vehicle you must test in."},
        {"q":"Can a Class A driver operate Class B and C vehicles?","a":"Yes — 49 CFR 383.91 lets a driver licensed for a vehicle group operate vehicles in the lower groups, provided they hold any endorsement the specific vehicle requires, such as P for passengers or N for a tank."},
        {"q":"When does a pickup truck combination require a CDL?","a":"When the combination's rating or actual weight reaches 26,001+ pounds and the towed unit exceeds 10,000 pounds — the definitions use whichever is greater, rating or actual. A heavy pickup with a large loaded gooseneck can legally be a Class A combination."},
        {"q":"Why would a small van need a CDL?","a":"Class C covers vehicles under the weight thresholds that are designed for 16 or more occupants including the driver, or that haul placardable quantities of hazardous materials. The passengers or the cargo trigger the license, not the weight."},
        {"q":"Does experience in Class B count toward Class A?","a":"Not for licensing. Upgrading requires a Class A CLP, Entry-Level Driver Training for the upgrade, and passing the three-part skills test in a Class A combination — seat time in a straight truck does not substitute for any of it."}
      ]$j$::jsonb,
      '{getting-your-cdl,cdl-classes,class-a,class-b,class-c,gvwr}',
      8, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 6. CDL Endorsements and Restrictions
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_gyc and slug = 'cdl-endorsements-restrictions') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_gyc,
      'cdl-endorsements-restrictions',
      'CDL Endorsements and Restrictions Explained',
      'The letters that expand a CDL and the letters that shrink it — what H, N, P, S, T, and X authorize, which tests each requires, and what the E, K, L, M, N, O, V, and Z restriction codes mean on the back of a license.',
      $mdx$**Quick answer:** **Endorsements** widen what a CDL may haul or pull: **H** (hazardous materials), **N** (tank vehicles), **P** (passengers), **S** (school bus), **T** (double/triple trailers), and **X** (tank + hazmat combined) — defined in [49 CFR 383.93](https://www.ecfr.gov/current/title-49/part-383/section-383.93) with the standardized codes in [383.153](https://www.ecfr.gov/current/title-49/part-383/section-383.153). **Restrictions** narrow it: the federal code table includes **E** (no manual transmission), **K** (intrastate only), **L** (no air-brake CMV), **M**/**N** (passenger vehicles only below Class A/B), **O** (no tractor-trailer), **V** (medical variance), and **Z** (no full air brakes), largely driven by the testing rules in [383.95](https://www.ecfr.gov/current/title-49/part-383/section-383.95).

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026**. Endorsement and restriction requirements are federal; the letters your state prints and how it displays them can vary within the federal code framework. Confirm with [FMCSA](https://www.fmcsa.dot.gov/) and your state licensing agency. Not legal advice.

## What the two kinds of letters do

A CDL's class sets the vehicle group ([Classes A/B/C](/knowledge/getting-your-cdl/cdl-classes-compared)); the letters adjust it in both directions. Endorsements are earned — each has its own test or check. Restrictions are usually *acquired by omission* — test in an easier vehicle and the license permanently records what you skipped, until you retest.

## Who should read the code tables

Every applicant planning a career lane (the endorsement list IS the job list), and every licensed driver reading the back of a license before a job change — yours or a new hire's.

## The six endorsements

- **H — hazardous materials.** Knowledge test plus a **TSA security threat assessment**, and first-timers complete the [ELDT hazmat theory](/knowledge/getting-your-cdl/eldt-requirements) before the state may test them. H cannot ride on a learner's permit. Drill the material: [Hazmat practice test](/practice-tests/hazmat).
- **N — tank vehicles.** Knowledge test only. Required once you haul liquid or gas in tanks over 119 gallons apiece totaling 1,000+ gallons. Prep: [Tanker practice test](/practice-tests/tanker).
- **P — passenger.** Knowledge **and** skills tests in a passenger vehicle; carries sub-restrictions if you test in a smaller bus than your class allows.
- **S — school bus.** Everything P requires plus the school-bus knowledge and skills tests and the background checks states layer on.
- **T — double/triple trailers.** Knowledge test only — but pulling doubles safely is its own craft; the test is the floor, not the ceiling.
- **X — tank + hazmat combined.** One code covering both N and H authorities — the standard combination for fuel haulers.

## The restriction codes

From the federal table in 383.153(a)(10) — your state prints these (display conventions can differ slightly):

- **E — no manual transmission.** Earned by taking the [skills test](/knowledge/getting-your-cdl/cdl-skills-test) in an automatic.
- **K — intrastate only.** Usually age- or medical-certification-driven; it fences you inside your state.
- **L — no air-brake CMV.** From skipping/failing the air-brakes knowledge test or testing in a vehicle without air brakes. Avoid it: [Air Brakes practice test](/practice-tests/air-brakes).
- **M — Class B/C passenger vehicles only.** A Class A holder who took the P skills test in a Class B bus.
- **N — Class C passenger vehicles only.** Same idea, one class down. (Yes — the letter N does double duty: endorsement N is tank; restriction N is passenger-class.)
- **O — no tractor-trailer.** From testing in a Class A combination that wasn't a fifth-wheel connection (e.g., pintle hook).
- **V — medical variance.** Flags that you drive under a federal vision, diabetes, or similar variance — paperwork travels with you.
- **Z — no full air brakes.** From testing in an air-over-hydraulic vehicle.

## Why restrictions matter more than they look

Restrictions follow the license, and dispatch reads them. An **E** restriction quietly removes every manual truck from your job market; an **L** removes nearly every highway tractor. Clearing one means **retesting in the right vehicle** — a scheduling and rental problem that costs far more after licensing than avoiding it would have cost during training. Choose the test vehicle like it's a career decision, because it is.

## A realistic example (illustration only)

A student tests in her school's automatic day-cab with full air brakes: no L, no Z — but an **E**. Six months later the small fleet she wants to join runs 13-speeds. Fixing it takes a retest in a manual — finding one to rent, booking a slot, paying the fee. Her classmate, warned in week one, borrowed a manual for two extra practice days and tested clean. Same school, same money, different map of jobs.

## Common mistakes

- Testing in an automatic without deciding you're fine with **E** forever.
- Assuming T or N requires a road test — both are knowledge-only.
- Trying to add **H** on a CLP, or skipping the ELDT theory that must precede the hazmat knowledge test.
- Reading restriction **N** as "tanker" — context matters; on the restriction line it's passenger-class.
- Forgetting **K** exists — an 18-to-20-year-old's license carries it until the [interstate age rule](/knowledge/getting-your-cdl/cdl-requirements) is satisfied.

## Endorsement-planning checklist

- Target freight identified → endorsement list written (X for fuel, T for LTL doubles, P/S for buses)
- Knowledge-only vs knowledge+skills separated in the study plan
- TSA check timeline built in if H is on the list
- Test vehicle chosen against the restriction table (manual, full air, fifth wheel)
- State display conventions checked when reading an existing license

## Keep learning

- The tests behind the letters: [Hazmat](/practice-tests/hazmat) · [Tanker](/practice-tests/tanker) · [Air Brakes](/practice-tests/air-brakes) · [full hub](/practice-tests)
- Zoom out: [the step-by-step guide](/knowledge/getting-your-cdl/how-to-get-your-cdl) · [CDL Classes Compared](/knowledge/getting-your-cdl/cdl-classes-compared)
- **Build the endorsement plan with us:** [TLWS Academy](/academy) · start free with [CDL Pre-School](/cdl-pre-school) · [join the email list](/#newsletter).$mdx$,
      'CDL Endorsements and Restriction Codes Explained | Trucking Life with Shawn',
      'H, N, P, S, T, X endorsements and the E, K, L, M, N, O, V, Z restriction codes: what each allows or blocks, the tests required, and how test choices become restrictions.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR 383.93 — Endorsements (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.93"},
        {"label":"49 CFR 383.95 — Restrictions (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.95"},
        {"label":"49 CFR 383.153 — Information on the CLP and CDL document (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.153"},
        {"label":"49 CFR Part 380 — Entry-Level Driver Training (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-380"},
        {"label":"FMCSA — Federal Motor Carrier Safety Administration","url":"https://www.fmcsa.dot.gov/"}
      ]$j$::jsonb,
      $j$[
        {"q":"Which CDL endorsements only need a knowledge test?","a":"Tank (N) and double/triple trailers (T) are knowledge-only. Hazmat (H) is a knowledge test plus a TSA security threat assessment and ELDT theory for first-timers. Passenger (P) and school bus (S) require knowledge and skills tests in the right vehicle."},
        {"q":"What does the E restriction on a CDL mean?","a":"No manual-transmission commercial vehicles. It's applied when the skills test is taken in a vehicle with an automatic transmission, and it stays until you retest in a manual."},
        {"q":"What is the difference between the L and Z restrictions?","a":"Both limit air-brake vehicles: L bars CMVs equipped with air brakes entirely (from skipping or failing the air-brakes test, or testing in a non-air-braked vehicle), while Z bars vehicles with full air brakes after testing in an air-over-hydraulic vehicle."},
        {"q":"Is N an endorsement or a restriction?","a":"Both letters exist. As an endorsement, N authorizes tank vehicles. As a restriction code, N limits a driver to Class C passenger vehicles. Read the license line you're on — endorsements and restrictions print separately."},
        {"q":"What is the X endorsement?","a":"The combined code for tank vehicles plus hazardous materials — the authority a fuel hauler needs — standardized in 49 CFR 383.153. It carries the same TSA and testing requirements as H plus the tank knowledge test."}
      ]$j$::jsonb,
      '{getting-your-cdl,endorsements,restrictions,hazmat,tanker,codes}',
      8, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 7. The CDL Skills Test
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_gyc and slug = 'cdl-skills-test') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_gyc,
      'cdl-skills-test',
      'The CDL Skills Test: Inspection, Basic Control, and Road Test',
      'The three-part test that turns a permit into a license — what the vehicle inspection, basic-control maneuvers, and road test each measure, why the vehicle you bring decides your restrictions, and how testing and scheduling differ by state.',
      $mdx$**Quick answer:** The CDL skills test has **three parts**, taken in order in a vehicle **representative of the class you're licensing for** ([49 CFR 383.113](https://www.ecfr.gov/current/title-49/part-383/section-383.113)): the **vehicle inspection test** (prove the vehicle is safe and explain what you're checking), the **basic vehicle control test** (backing and positioning maneuvers), and the **road test** (real traffic). You must pass each part to move to the next, you must have held your [CLP at least 14 days](/knowledge/getting-your-cdl/cdl-permit-explained), and if ELDT applies to you the state must see your training certification first. States administer the test directly or through authorized third-party testers ([49 CFR 383.75](https://www.ecfr.gov/current/title-49/part-383/section-383.75)).

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026**. The test structure and scoring standards are federal ([49 CFR 383.113](https://www.ecfr.gov/current/title-49/part-383/section-383.113), [383.133](https://www.ecfr.gov/current/title-49/part-383/section-383.133)); scheduling, sites, retest fees, and third-party options are state-specific. Confirm with [FMCSA](https://www.fmcsa.dot.gov/) and your state licensing agency. Not legal advice.

## What the test is

The skills test is the practical half of licensing — the knowledge tests earned your [CLP](/knowledge/getting-your-cdl/cdl-permit-explained); this earns the license. Federal rule defines the three segments and minimum scoring standards so a pass means the same thing in every state; examiners work from standardized score sheets derived from them.

## Who takes it

Every first-time CDL applicant and every class upgrade — after the knowledge tests, the CLP's 14 days, and any required ELDT. Endorsement-only additions like tanker skip it; passenger and school bus repeat it in their vehicle type.

## Part 1: the vehicle inspection test

You walk the vehicle and **demonstrate that it's safe to operate** — pointing out components, saying what you're checking and *why*: leaks, hoses, belts, brakes, steering, suspension, lights, coupling, emergency equipment. It's spoken, physical proof that the daily inspection habit exists. Our full walkthrough of that habit — the same skill as a working driver's morning routine — is the [Complete CDL Pre-Trip Inspection Guide](/knowledge/cdl-training/cdl-pre-trip-inspection-guide). Blank on a section here and the day often ends before the truck moves.

## Part 2: basic vehicle control

On a closed range, you position the vehicle where the examiner says — forward stops, **straight-line backing**, **offset backing**, and the angled and parallel maneuvers your state scores, with pull-ups and looks counted. In a combination this is where trailer geometry gets honest: the tandems don't lie about your setup. This is the segment ELDT's range training exists to build ([the BTW curriculum](/knowledge/getting-your-cdl/eldt-requirements)).

## Part 3: the road test

Public streets, real traffic: intersections, lane changes, curves, expressway on/off, railroad crossings, grades where available, and constant scanning the examiner can *see* — mirror checks, head movement, space management. Speed control matters everywhere, and the surest scoring truths are the boring ones: full stops behind the line, signals early, following distance you could defend out loud.

## The vehicle you bring is a career decision

Two rules collide here: the test must be in a vehicle **representative of your class**, and [restrictions](/knowledge/getting-your-cdl/cdl-endorsements-restrictions) record the *specific* vehicle's equipment. Automatic transmission → **E**. No full air brakes → **L** or **Z**. A Class A combination without a fifth wheel → **O**. The ten minutes spent choosing the test vehicle can outlast every other decision in training.

## Scheduling — where states diverge

Some states test at agency sites, many authorize **third-party testers** (schools among them), and backlogs range from days to months. Three state-specific questions to ask early: How far out is the calendar? What does a retest cost and how long is the wait after a failed segment? Does my school's third-party tester have requirements beyond the state's? None of those answers are federal; all of them shape your timeline more than the 14-day rule does.

## A realistic example (illustration only)

Test day, 7 a.m. The inspection takes forty minutes — she narrates brakes, steering, coupling without touching her notes. Basic control: one pull-up on the offset, well inside tolerance. On the road, the examiner marks nothing until a yellow light — she's already braking, stopped square behind the line. Passed on the first attempt *because the pre-trip was automatic*; the classmate who treated inspection as memorization theater failed part 1 and never got to show his excellent backing.

## Common mistakes

- Memorizing a pre-trip script without understanding it — examiners probe, and understanding is what answers.
- Booking the earliest slot instead of the *right vehicle* — see the restriction rules above.
- Practicing backing only from the driver's seat angle you like. The test picks the angles.
- Rolling stops and late signals — the road test is lost in inches and seconds, not disasters.
- Arriving with a vehicle that fails its own inspection — examiners can refuse to test in a defective truck.

## Test-day checklist

- CLP (14+ days old), license, medical certificate, and state paperwork in hand
- ELDT certification transmitted (state can see it)
- Test vehicle matches your class — and your transmission/brake intentions
- Vehicle itself inspection-ready: lights, brakes, tires, leaks
- Pre-trip narration practiced aloud, not silently
- Retest policy and fee known, just in case

## Keep learning

- Build the inspection habit: [Complete CDL Pre-Trip Inspection Guide](/knowledge/cdl-training/cdl-pre-trip-inspection-guide)
- The knowledge behind the wheel: [General Knowledge](/practice-tests/general-knowledge) · [Combination Vehicles](/practice-tests/combination-vehicles) · [Air Brakes](/practice-tests/air-brakes)
- The full journey: [How to Get Your CDL](/knowledge/getting-your-cdl/how-to-get-your-cdl) · then [A Study Plan That Works](/knowledge/getting-your-cdl/cdl-study-plan)
- **Practice with instructors:** [TLWS Academy](/academy) · start free with [CDL Pre-School](/cdl-pre-school) · [join the email list](/#newsletter).$mdx$,
      'CDL Skills Test: The 3 Parts Explained | Trucking Life with Shawn',
      'The CDL skills test: vehicle inspection, basic-control maneuvers, and the road test — plus how your test vehicle decides restrictions and how state scheduling works.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR 383.113 — Required skills (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.113"},
        {"label":"49 CFR 383.133 — Test methods (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.133"},
        {"label":"49 CFR 383.75 — Third party testing (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.75"},
        {"label":"49 CFR 383.25 — Commercial learner's permit provisions (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.25"}
      ]$j$::jsonb,
      $j$[
        {"q":"What are the three parts of the CDL skills test?","a":"The vehicle inspection test, the basic vehicle control test, and the road test, defined in 49 CFR 383.113. They're taken in order and each must be passed — failing an earlier segment ends the attempt before the later ones."},
        {"q":"Can I take the skills test in an automatic?","a":"Yes, but the license will carry the E restriction — no manual-transmission CMVs — until you retest in a manual. The same logic applies to air brakes (L or Z) and to Class A combinations without a fifth-wheel connection (O)."},
        {"q":"Who administers the CDL skills test?","a":"Your state licensing agency, either directly or through third-party testers it authorizes under 49 CFR 383.75 — many training schools are also authorized testers. Scheduling, sites, and retest fees are set by the state."},
        {"q":"What happens if I fail one part of the skills test?","a":"The attempt ends at the failed segment, and state policy controls the retest — the wait, the fee, and whether previously passed segments carry over. Ask for your state's retest rules before test day so a stumble doesn't wreck the calendar."},
        {"q":"What should I bring to the CDL skills test?","a":"Your CLP (held at least 14 days), your regular license, medical certification your state requires, any state scheduling paperwork — and a test vehicle that's representative of your class, legally equipped, and clean enough to pass its own inspection."}
      ]$j$::jsonb,
      '{getting-your-cdl,skills-test,pre-trip,backing,road-test}',
      8, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 8. What Does It Cost to Get a CDL?
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_gyc and slug = 'cdl-cost') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_gyc,
      'cdl-cost',
      'What Does It Cost to Get a CDL?',
      'Every category of money between you and a CDL — the physical, permit and knowledge-test fees, training tuition, skills-test and licensing charges, endorsement extras, and the quiet costs like lodging and lost wages — and the three ways drivers actually pay.',
      $mdx$**Quick answer:** CDL money falls into predictable **categories** — the DOT physical, permit and knowledge-test fees, **training tuition** (much the largest), skills-test fees, license issuance, endorsement extras (including the TSA fee for [hazmat](/practice-tests/hazmat)), and the quiet costs of lodging, transportation, and weeks without a paycheck. **The amounts are set by states, schools, and examiners, not by federal rule** — so this guide maps the categories and the ways drivers pay, and deliberately quotes no national averages.

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026**. No federal regulation sets CDL fees or tuition; states publish their licensing fees and schools publish their own prices, and both change. Confirm every number directly with your state licensing agency and any school you consider. Not legal or financial advice.

## What you're paying for — and why there's no single number

The federal rules define the *steps* — [permit](/knowledge/getting-your-cdl/cdl-permit-explained), [ELDT](/knowledge/getting-your-cdl/eldt-requirements), [skills test](/knowledge/getting-your-cdl/cdl-skills-test) — but every price tag on those steps is state or private. Two students in neighboring states, or two schools in the same town, can see totals far apart. Any article quoting one "average cost of a CDL" is averaging things that aren't comparable; budget from the categories instead.

## Who this budget is for

Anyone paying their own way, anyone comparing a sponsorship against self-pay, and anyone advising either — the categories are the same no matter who writes the checks.

## The fee categories, in the order you'll meet them

1. **DOT physical.** Paid to the medical examiner; clinics set their own prices. If a condition needs follow-up documentation, that's a second cost. Background: [The DOT Medical Card](/knowledge/dot-compliance/dot-medical-card).
2. **Permit and knowledge-test fees.** States charge for the CLP itself and often per knowledge test — check whether a *retake* is another fee (in many states it is; free [practice tests](/practice-tests) exist to make retakes unnecessary).
3. **Training tuition — the big one.** Private-school tuition, a community-college program price, or a carrier academy's "free-with-strings" model. This category is where the sponsored-vs-private decision lives, because the *structure* of this cost matters more than its size.
4. **Skills-test fee.** Charged by the state or the third-party tester — and again per attempt in most places. Truck rental for the test, if your school's truck isn't included, is its own line.
5. **License issuance.** The state's CDL fee, sometimes priced by license term.
6. **Endorsements.** Per-test fees, plus for H the **TSA security threat assessment** — a separate federal-program fee paid to TSA's enrollment provider, priced by TSA, not your state.
7. **The quiet costs.** Lodging for residential programs, fuel or transportation to a range, and — largest of all for most career-changers — **weeks of reduced or zero income** during full-time training. Budget them explicitly; they sink more plans than tuition does.

## Three ways drivers actually pay

- **Self-pay.** Cleanest: no contract, every school on the table. The trade is cash up front — and for many people, that's decisive.
- **Financing or funding.** Private loans, state workforce-development and veterans programs, community-college aid. Terms vary by program and state; read them like the contracts they are.
- **Carrier-sponsored training.** The carrier fronts training and recovers it through a **work commitment and repayment clause**. The tuition number can be zero while the *obligation* is very real — the full trade-off analysis is in [Company-Sponsored Training vs. Private School](/knowledge/getting-your-cdl/sponsored-vs-private-cdl-school).

## A realistic example (illustration, not financial advice)

A career-changer builds a spreadsheet with one row per category above, then calls: the state (CLP, test, license fees — published on its site), a clinic (physical), two TPR-listed schools (tuition, truck-for-test policy, retest policy), and TSA's enrollment site (hazmat fee, since fuel hauling is the goal). She adds a row for six weeks of half-income. No two of her numbers came from the same place — which is exactly why the spreadsheet, not somebody's average, is the budget.

## Common mistakes

- Budgeting tuition and nothing else — the quiet costs are real money.
- Comparing schools on sticker price while ignoring what's *included*: truck for the skills test, retest policy, job-placement support.
- Treating "free" sponsored training as free rather than as a contract with a price expressed in months.
- Forgetting per-attempt fees — a failed knowledge test or skills segment usually costs cash as well as time.
- Skipping cheap prep and paying for retakes. The [study plan](/knowledge/getting-your-cdl/cdl-study-plan) and free practice tests exist to make every attempt the only attempt.

## Budget checklist

- One row per category above, each with a *source* (state site, school quote, clinic call)
- Retake and retest fees noted beside the first-attempt fees
- Sponsored offers translated into obligation-months, not just dollars
- Income gap during training counted
- Endorsement costs (tests + TSA for H) included if they're in your plan

## Keep learning

- The decision this budget feeds: [Sponsored vs. Private CDL School](/knowledge/getting-your-cdl/sponsored-vs-private-cdl-school)
- Cut the retake risk to zero, free: [practice-test hub](/practice-tests) · [General Knowledge](/practice-tests/general-knowledge)
- The whole journey in order: [How to Get Your CDL](/knowledge/getting-your-cdl/how-to-get-your-cdl)
- **Train without the guesswork:** [TLWS Academy](/academy) · start free with [CDL Pre-School](/cdl-pre-school) · [join the email list](/#newsletter).$mdx$,
      'What a CDL Costs: Every Fee Category Explained | Trucking Life with Shawn',
      'CDL cost categories explained: the physical, permit and test fees, tuition, the skills test, licensing, endorsements and the TSA hazmat fee, plus lodging and lost wages.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR Part 383 — Commercial Driver's License Standards (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383"},
        {"label":"49 CFR Part 380 — Entry-Level Driver Training (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-380"},
        {"label":"FMCSA Training Provider Registry","url":"https://tpr.fmcsa.dot.gov/"},
        {"label":"FMCSA — Federal Motor Carrier Safety Administration","url":"https://www.fmcsa.dot.gov/"}
      ]$j$::jsonb,
      $j$[
        {"q":"How much does it cost to get a CDL?","a":"There is no single honest number: every fee is set by a state, school, clinic, or federal program vendor, and they vary widely. Budget by category — physical, permit and knowledge tests, tuition, skills test, issuance, endorsements, and living costs during training — with a real source for each line."},
        {"q":"Is CDL school the biggest cost?","a":"Training tuition is usually the largest single line for self-pay students, but the quiet costs — lodging for residential programs and weeks of reduced income — often add up to a comparable amount and are the ones most budgets miss."},
        {"q":"What does 'free' company-sponsored CDL training really cost?","a":"The tuition is fronted by the carrier and recovered through a work commitment with a repayment clause if you leave early. The price is expressed in obligation-months and reduced choice rather than dollars up front — read the contract before comparing it to a school's sticker price."},
        {"q":"Are there extra costs for endorsements?","a":"Yes — states typically charge per endorsement knowledge test, and the hazmat endorsement adds the TSA security threat assessment, a separate federally set fee paid to TSA's enrollment provider. Skills-test endorsements like passenger add test-vehicle logistics too."},
        {"q":"Do I pay again if I fail a test?","a":"In most states, yes — knowledge-test retakes and skills-test retests usually carry their own fees, and third-party testers set retest charges as well. Free practice tests and a structured study plan are the cheapest insurance in the whole process."}
      ]$j$::jsonb,
      '{getting-your-cdl,cost,tuition,fees,budgeting}',
      8, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 9. Company-Sponsored CDL Training vs. Private CDL School
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_gyc and slug = 'sponsored-vs-private-cdl-school') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_gyc,
      'sponsored-vs-private-cdl-school',
      'Company-Sponsored CDL Training vs. Private CDL School',
      'The real trade-offs between carrier-paid training and paying your own way — contracts and repayment clauses, where you train and who you owe, job-placement claims, and an independent checklist for deciding which model fits your situation.',
      $mdx$**Quick answer:** **Company-sponsored training** trades money for obligation: the carrier fronts the cost and you sign a **work commitment with a repayment clause** if you leave early. **Private school** (or a community-college program) trades obligation for money: you pay — cash, financing, or a workforce grant — and graduate free to apply anywhere. Neither is "better"; they fit different bank accounts and risk tolerances. Whichever you choose, the provider must be on FMCSA's [Training Provider Registry](https://tpr.fmcsa.dot.gov/) for the training to count under [ELDT](/knowledge/getting-your-cdl/eldt-requirements) — and **contracts differ enormously from carrier to carrier**, so nothing here describes *your* contract.

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026**. Federal rule governs the training itself ([49 CFR Part 380](https://www.ecfr.gov/current/title-49/part-380)); it does not regulate tuition, sponsorship contracts, or repayment terms — those are private agreements plus applicable state law. Read every contract, and get real legal advice for contract questions. This isn't it.

## Who faces this decision

Almost every new driver without training savings — and plenty with them. If ELDT applies to you, someone must deliver (and someone must fund) the training; this page is about who that someone should be.

## The two models, honestly stated

Both paths end at the same [skills test](/knowledge/getting-your-cdl/cdl-skills-test) and the same license. What differs is **who pays, when, and what they get from you in return**:

- **Sponsored:** a carrier (or its academy) trains you at low or no upfront cost, then employs you under a commitment — commonly expressed in months of service — with the training bill coming due, in whole or prorated, if you exit early. Some programs also set where you'll be domiciled and what freight you'll run during the commitment.
- **Private/community college:** you cover tuition and choose freely afterward. Community-college programs sometimes bring state aid, veterans benefits, or workforce-development funding into reach.

## What a sponsorship contract can contain

No two are alike — evaluate the *document*, not the recruiter's summary. Terms seen in the wild include: the commitment length and start date (from hire? from upgrade to solo?); the **repayment schedule** if you leave (flat vs prorated, and what "leaving" includes — quitting, being terminated, failing a drug test); wage structure during training and the commitment; assignment terms (fleet, freight, domicile); and what happens to the debt if the *carrier* ends the relationship. A contract that answers all of those in writing is a contract you can compare; one that won't is its own answer.

## What paying your own way really buys

Choice, mostly — of school, of first employer, of timing. Its price is capital plus risk: if driving turns out not to fit, the tuition is spent either way. Between the extremes sit hybrids — carriers that **reimburse** graduates of outside schools monthly, workforce grants that pay private tuition, colleges with carrier relationships. The [cost categories](/knowledge/getting-your-cdl/cdl-cost) apply to every variant; only who writes the check changes.

## Job-placement claims — read them like ads

Both models advertise outcomes. "Placement rates" have no standard definition, "pre-hire letters" are not job offers, and a sponsored program's "guaranteed job" is conditional on finishing and passing everything. None of that makes the claims false — it makes them **marketing**, to be verified: ask for the numbers behind any rate, and ask current drivers what the first year actually looked like.

## A realistic example (illustration only — programs differ)

Two neighbors start the same month. One has savings, pays a community college, and interviews three carriers at graduation, picking the one with the home-time she wants. The other can't fund tuition, signs a sponsorship with a national fleet, and spends his commitment running the freight he's assigned — then leaves with experience, a clean record, and no debt, having paid with months instead of dollars. Both made the right call *for their balance sheet*. The wrong call would have been either of them signing paperwork they hadn't read.

## Common mistakes

- Comparing "free" to tuition without pricing the obligation — months of constrained choice are a cost.
- Not asking what triggers repayment, or whether it's prorated by months served.
- Assuming every sponsored program is predatory, or every private school is quality. Neither generalization survives contact with real programs.
- Skipping the [Training Provider Registry](https://tpr.fmcsa.dot.gov/) check because the brand is big.
- Choosing by recruiter charisma instead of by the written answers to the checklist below.

## The independent decision checklist

- Can I fund private training without hardship? (If no, sponsorship moves up the list.)
- Commitment length, start trigger, and repayment math — in writing?
- What counts as leaving early, and what does the carrier owe *me* if it ends the deal?
- Training quality: TPR-listed, instructor ratio, truck-per-student time, [skills-test](/knowledge/getting-your-cdl/cdl-skills-test) pass policy?
- Where will I live and what will I earn during training and the first year — from the document, not the pitch?
- Have I talked to two current or former drivers of this exact program?

## Keep learning

- The money map behind this choice: [What Does It Cost to Get a CDL?](/knowledge/getting-your-cdl/cdl-cost)
- The training the law requires either way: [ELDT Requirements](/knowledge/getting-your-cdl/eldt-requirements)
- Sharpen the knowledge side free while you decide: [the practice-test hub](/practice-tests)
- The whole road: [How to Get Your CDL](/knowledge/getting-your-cdl/how-to-get-your-cdl)
- **A third option — learn the fundamentals free first:** [CDL Pre-School](/cdl-pre-school) · then [TLWS Academy](/academy) · [join the email list](/#newsletter).$mdx$,
      'Company-Sponsored CDL Training vs. Private School | Trucking Life with Shawn',
      'Sponsored CDL training or private school? Contracts, repayment clauses, placement claims, and hybrids — with a checklist for choosing what fits your money and risk.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR Part 380 — Entry-Level Driver Training (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-380"},
        {"label":"FMCSA Training Provider Registry","url":"https://tpr.fmcsa.dot.gov/"},
        {"label":"FMCSA — Federal Motor Carrier Safety Administration","url":"https://www.fmcsa.dot.gov/"}
      ]$j$::jsonb,
      $j$[
        {"q":"Is company-sponsored CDL training really free?","a":"The upfront tuition can be zero, but the carrier recovers its cost through a work commitment with a repayment clause if you leave early. You pay with obligation-months and reduced choice instead of cash — which is a fine trade for some situations and a bad one for others."},
        {"q":"What should I look for in a CDL sponsorship contract?","a":"The commitment length and when it starts, the exact repayment schedule and what triggers it, wages during training and the commitment, assignment terms, and what happens if the carrier ends the relationship. Every answer should be in the document itself, not the recruiter's summary."},
        {"q":"Do private CDL schools guarantee jobs?","a":"No school can guarantee employment, and placement rates have no standardized definition. Pre-hire letters are conditional interest, not offers. Ask any program — sponsored or private — for the basis of its numbers and talk to recent graduates."},
        {"q":"Does ELDT apply to both sponsored and private training?","a":"Yes. Whoever provides the training must be listed on FMCSA's Training Provider Registry and must deliver the federal theory and behind-the-wheel curricula. Sponsorship changes who pays — it doesn't change the federal training requirement."},
        {"q":"Are there options between sponsored and self-pay?","a":"Several: carriers that reimburse tuition monthly after you're hired, state workforce-development grants, veterans benefits at eligible programs, and community-college financial aid. These hybrids buy private-school freedom with someone else's money — each with its own paperwork and conditions."}
      ]$j$::jsonb,
      '{getting-your-cdl,cdl-school,sponsored-training,contracts,tuition}',
      8, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 10. A CDL Study Plan That Works
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_gyc and slug = 'cdl-study-plan') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_gyc,
      'cdl-study-plan',
      'A CDL Study Plan That Works',
      'A week-by-week structure for passing every CDL knowledge test the first time — official manual reading paired with practice tests, missed-question drilling, bookmark review, and the pivot from knowledge prep to skills-test prep.',
      $mdx$**Quick answer:** The plan that works is boring and repeatable: **read the official state CDL manual section, then immediately drill the matching [practice test](/practice-tests)** — General Knowledge first, then Air Brakes and Combination Vehicles for Class A, then endorsement tests like Hazmat and Tanker — while letting **missed-question drills and bookmarks** tell you what to reread. Knowledge tests passed, the [CLP's 14-day window](/knowledge/getting-your-cdl/cdl-permit-explained) becomes skills-prep time. (The weekly structure below is a **recommendation** — the study method drivers report working — not a federal requirement.)

**Regulatory-change disclaimer:** Last reviewed **July 17, 2026**. The tests themselves are governed by [49 CFR Part 383](https://www.ecfr.gov/current/title-49/part-383) and administered by your state; your state's CDL manual is the official study text. Confirm test content and scheduling with your state licensing agency. Not legal advice.

## What makes the plan work: manual for input, tests for feedback

The state CDL manual is the source the tests are written from — but reading it cover-to-cover twice teaches less than reading it *once with a feedback loop*. Practice questions convert reading into recall, and every miss is a precise pointer to the paragraph you only thought you knew. That loop — read, drill, miss, reread — is the whole method. Everything below is scheduling.

## Who this plan fits

Anyone starting the knowledge tests — first-time applicants above all, but the same loop works for endorsement adds and for refreshing before an upgrade. Adjust the calendar, keep the loop.

## Week by week (a recommendation, not a rule)

**Week 1 — General knowledge.** Read the manual's general-knowledge chapters in two or three sittings; after each, run the [General Knowledge practice test](/practice-tests/general-knowledge) in Study Mode, where every answer explains itself with its citation. **Bookmark** any question that surprised you, right or wrong.

**Week 2 — Your vehicle's tests.** Class A means [Air Brakes](/practice-tests/air-brakes) and [Combination Vehicles](/practice-tests/combination-vehicles) — read each manual section, then drill the matching test the same day. Air brakes especially punishes skimming: the sequences (pump-down checks, warning thresholds) only stick with repetition, and skipping this test puts an L restriction on your license.

**Week 3 — Timed runs and the weak-spot purge.** Switch to Timed Mode to rehearse exam pressure, and work the **missed-questions drill** until it's empty: every question you've ever missed, grouped by test, re-asked until you clear it. Reread only the manual sections your misses point to — that's the efficiency the loop buys.

**Week 4 — Endorsements you've planned.** Adding letters at licensing is cheaper than coming back later. [Hazmat](/practice-tests/hazmat) needs the most runway (deepest material, plus TSA paperwork and [ELDT theory](/knowledge/getting-your-cdl/eldt-requirements) for first-timers); [Tanker](/practice-tests/tanker) is a knowledge test with an outsized real-world payoff. Check the [endorsement map](/knowledge/getting-your-cdl/cdl-endorsements-restrictions) so you study only what your plan needs.

**Then: the pivot.** Knowledge tests passed, CLP in hand, [14 days minimum](/knowledge/getting-your-cdl/cdl-permit-explained) before the skills test — spend them on the physical skills: pre-trip narration out loud (the [full guide](/knowledge/cdl-training/cdl-pre-trip-inspection-guide)), backing reps, and the [three test segments](/knowledge/getting-your-cdl/cdl-skills-test) in the vehicle you'll test in.

## Using the tools like a student, not a tourist

- **Study Mode** for learning (instant feedback + citations), **Timed Mode** for rehearsal — in that order.
- **Bookmarks** are your personal syllabus: anything you hesitated on goes in, and the bookmark drill is your warm-up each session.
- **Missed-question drills** are the highest-value minutes in the plan — they are, by construction, exactly what you don't know.
- Short daily sessions beat weekend marathons; twenty focused minutes with drills outteaches two glazed hours with the manual.

## A realistic example (illustration only)

A working parent studies 25 minutes a night. Manual chapter Monday and Tuesday, drills Wednesday, misses Thursday, a timed run Friday. General knowledge passes in week two, air brakes and combination in week four — every test on the first attempt, so the [per-attempt fees](/knowledge/getting-your-cdl/cdl-cost) got paid exactly once. Slower than a bootcamp, cheaper than a retake.

## Common mistakes

- Grinding practice tests without the manual — you'll memorize questions, not knowledge, and the state's wording will differ.
- Reading the manual without drills — recognition feels like recall until test day.
- Ignoring the missed-question drill because it's uncomfortable. It's uncomfortable *because it's working*.
- Cramming endorsements you don't need yet, while under-preparing air brakes, which gates your actual license.
- Spending the CLP's 14 days on more knowledge review instead of pre-trip and backing practice.

## Study-plan checklist

- State CDL manual downloaded (the official one, current edition)
- Test list mapped to your class and endorsement plan
- Daily slot on the calendar — 20+ minutes, same time
- Study Mode first pass done per test; bookmarks growing
- Missed-question drills cleared before any real test is booked
- Timed Mode pass at comfortable margin before test day
- CLP 14-day window reserved for skills prep

## Keep learning

- The tests, all free: [General Knowledge](/practice-tests/general-knowledge) · [Air Brakes](/practice-tests/air-brakes) · [Combination Vehicles](/practice-tests/combination-vehicles) · [Hazmat](/practice-tests/hazmat) · [Tanker](/practice-tests/tanker) — or the [whole hub](/practice-tests)
- Where the plan fits: [How to Get Your CDL](/knowledge/getting-your-cdl/how-to-get-your-cdl) · [The Skills Test](/knowledge/getting-your-cdl/cdl-skills-test)
- **Want the structure built for you?** [CDL Pre-School](/cdl-pre-school) is the free start · [TLWS Academy](/academy) is the full program · [join the email list](/#newsletter).$mdx$,
      'CDL Study Plan: Pass Every Test the First Time | Trucking Life with Shawn',
      'A week-by-week CDL study plan: manual reading paired with free practice tests, missed-question drilling, bookmarks, timed rehearsal, and skills-test prep.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR Part 383 — Commercial Driver's License Standards (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383"},
        {"label":"49 CFR 383.135 — Passing knowledge and skills tests (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.135"},
        {"label":"FMCSA — Federal Motor Carrier Safety Administration","url":"https://www.fmcsa.dot.gov/"}
      ]$j$::jsonb,
      $j$[
        {"q":"What is the best way to study for the CDL permit test?","a":"Pair the official state CDL manual with practice tests in a tight loop: read a section, drill the matching test immediately, then let missed questions point you back to the exact paragraphs to reread. The manual is the source; the tests are the feedback."},
        {"q":"How long should I study for the CDL knowledge tests?","a":"It depends on your starting point and schedule — there's no universal timeline. What matters is sequence and consistency: short daily sessions, general knowledge first, then your vehicle's tests, with missed-question drills cleared before you book the real thing."},
        {"q":"Should I study endorsements before getting my CDL?","a":"If your job plan needs them, yes — adding knowledge-test endorsements like tanker at licensing is cheaper than a separate trip later. Hazmat needs the most lead time because of the TSA check and, for first-timers, the ELDT theory requirement."},
        {"q":"Are practice tests enough to pass the CDL exam?","a":"Practice tests alone teach you questions; the state's exam will word things differently. Used with the manual — as the feedback half of a read-and-drill loop — they're the most efficient preparation there is, and they make first-attempt passes the norm."},
        {"q":"What should I study during the 14-day CLP waiting period?","a":"Shift from knowledge to skills: practice the pre-trip inspection out loud, get backing repetitions, and rehearse the three skills-test segments in the vehicle you'll actually test in. The knowledge phase is over — the waiting period is skills time."}
      ]$j$::jsonb,
      '{getting-your-cdl,study-plan,practice-tests,knowledge-tests,preparation}',
      8, false, 'published', true, '2026-07-17', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- Related-article rows (curated; ON CONFLICT DO NOTHING keeps re-runs clean)
  ---------------------------------------------------------------------------
  declare
    g1 uuid; g2 uuid; g3 uuid; g4 uuid; g5 uuid;
    g6 uuid; g7 uuid; g8 uuid; g9 uuid; g10 uuid;
    med uuid; clr uuid; pretrip uuid;
  begin
    select id into g1  from public.kc_articles where category_id = v_gyc and slug = 'how-to-get-your-cdl';
    select id into g2  from public.kc_articles where category_id = v_gyc and slug = 'cdl-requirements';
    select id into g3  from public.kc_articles where category_id = v_gyc and slug = 'cdl-permit-explained';
    select id into g4  from public.kc_articles where category_id = v_gyc and slug = 'eldt-requirements';
    select id into g5  from public.kc_articles where category_id = v_gyc and slug = 'cdl-classes-compared';
    select id into g6  from public.kc_articles where category_id = v_gyc and slug = 'cdl-endorsements-restrictions';
    select id into g7  from public.kc_articles where category_id = v_gyc and slug = 'cdl-skills-test';
    select id into g8  from public.kc_articles where category_id = v_gyc and slug = 'cdl-cost';
    select id into g9  from public.kc_articles where category_id = v_gyc and slug = 'sponsored-vs-private-cdl-school';
    select id into g10 from public.kc_articles where category_id = v_gyc and slug = 'cdl-study-plan';
    select id into med     from public.kc_articles where category_id = v_dot and slug = 'dot-medical-card';
    select id into clr     from public.kc_articles where category_id = v_dot and slug = 'drug-alcohol-testing-clearinghouse';
    select id into pretrip from public.kc_articles where category_id = v_cdl and slug = 'cdl-pre-trip-inspection-guide';

    insert into public.kc_related (article_id, related_id, sort_order) values
      (g1, g2, 1), (g1, g3, 2), (g1, g7, 3),
      (g3, g1, 1), (g3, g4, 2), (g3, g10, 3),
      (g4, g1, 1), (g4, g3, 2), (g4, g7, 3),
      (g5, g1, 1), (g5, g6, 2), (g5, g7, 3),
      (g6, g5, 1), (g6, g1, 2), (g6, g7, 3),
      (g8, g9, 1), (g8, g1, 2), (g8, g4, 3),
      (g9, g8, 1), (g9, g4, 2), (g9, g1, 3),
      (g10, g3, 1), (g10, g7, 2), (g10, g1, 3)
    on conflict (article_id, related_id) do nothing;

    if med is not null and clr is not null then
      insert into public.kc_related (article_id, related_id, sort_order) values
        (g2, g1, 1), (g2, g3, 2), (g2, med, 3), (g2, clr, 4)
      on conflict (article_id, related_id) do nothing;
    else
      insert into public.kc_related (article_id, related_id, sort_order) values
        (g2, g1, 1), (g2, g3, 2), (g2, g5, 3)
      on conflict (article_id, related_id) do nothing;
    end if;

    if pretrip is not null then
      insert into public.kc_related (article_id, related_id, sort_order) values
        (g7, g1, 1), (g7, g4, 2), (g7, pretrip, 3)
      on conflict (article_id, related_id) do nothing;
    else
      insert into public.kc_related (article_id, related_id, sort_order) values
        (g7, g1, 1), (g7, g4, 2), (g7, g10, 3)
      on conflict (article_id, related_id) do nothing;
    end if;
  end;
end $kc$;

-- ---------------------------------------------------------------------------
-- Cross-links INTO the new cluster from three existing pages (guarded,
-- slug-scoped, replace-based, idempotent — same doctrine as 038's block:
-- presence guard on the target text + absence guard on the new link, so a
-- re-run is a no-op and nothing else in the body can be touched).
-- ---------------------------------------------------------------------------

-- 1. DOT Medical Card (Batch 2) → CDL Requirements: the "Who needs it"
--    section now hands first-time applicants to the eligibility page.
update public.kc_articles a set body_mdx = replace(
    a.body_mdx,
    'Intrastate-only rules are the state''s, often parallel.',
    'Intrastate-only rules are the state''s, often parallel. Applying for your first CDL? The full eligibility picture — age, residency, record — is in [CDL Requirements](/knowledge/getting-your-cdl/cdl-requirements).')
from public.kc_categories c
where c.id = a.category_id and c.slug = 'dot-compliance'
  and a.slug = 'dot-medical-card'
  and a.body_mdx like '%Intrastate-only rules are the state''s, often parallel.%'
  and a.body_mdx not like '%/knowledge/getting-your-cdl/cdl-requirements%';

-- 2. Drug & Alcohol Testing / Clearinghouse (Batch 2) → CDL Requirements:
--    the pre-employment bullet now points new drivers at eligibility.
update public.kc_articles a set body_mdx = replace(
    a.body_mdx,
    'safety-sensitive functions for an employer (382.301).',
    'safety-sensitive functions for an employer (382.301) — for brand-new drivers this lands right after licensing, alongside the rest of the [CDL eligibility requirements](/knowledge/getting-your-cdl/cdl-requirements).')
from public.kc_categories c
where c.id = a.category_id and c.slug = 'dot-compliance'
  and a.slug = 'drug-alcohol-testing-clearinghouse'
  and a.body_mdx like '%safety-sensitive functions for an employer (382.301).%'
  and a.body_mdx not like '%/knowledge/getting-your-cdl/cdl-requirements%';

-- 3. CDL Pre-Trip Inspection Guide (Batch 1) → The CDL Skills Test: the
--    exam-segment mention now links the full skills-test walkthrough.
update public.kc_articles a set body_mdx = replace(
    a.body_mdx,
    'as the seven-step method.',
    'as the seven-step method. Where it fits in the exam: [The CDL Skills Test](/knowledge/getting-your-cdl/cdl-skills-test).')
from public.kc_categories c
where c.id = a.category_id and c.slug = 'cdl-training'
  and a.slug = 'cdl-pre-trip-inspection-guide'
  and a.body_mdx like '%as the seven-step method.%'
  and a.body_mdx not like '%/knowledge/getting-your-cdl/cdl-skills-test%';
