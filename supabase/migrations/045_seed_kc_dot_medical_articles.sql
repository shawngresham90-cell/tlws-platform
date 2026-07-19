-- 045_seed_kc_dot_medical_articles.sql
-- Knowledge Center Batch 5 — DOT Medical cluster (10 authority pages)
-- seeded into the EXISTING (empty) 'health-on-the-road' category.
--
-- ⚠️ COMMITTED; apply AFTER 015 (schema), 038 (Batch 2), 040 (Batch 3), and
-- 042 (Batch 4) — the cross-link update block at the end touches one body
-- from each of those three seed batches.
-- IDEMPOTENT AND NON-DESTRUCTIVE: every article inserts ONLY when no article
-- with the same (category, slug) exists; kc_related rows insert with
-- ON CONFLICT DO NOTHING; the cross-link UPDATEs are guarded so they run once
-- and never clobber other content (slug-scoped, substring replacement, skip
-- when the link is already present). This migration NEVER creates or edits a
-- category — it seeds into the pre-existing 'health-on-the-road' category —
-- and it leaves RLS, IDs, and every existing row untouched.
--
-- Content rules (hard, same as 037/038/040/042, with medical discipline):
--   * Original wording only. Official primary sources only (eCFR, FMCSA,
--     National Registry, Federal Register for rule history), cited per claim
--     and listed in `sources`.
--   * NO diagnosis, NO qualification promises: never "you will pass/fail",
--     never "X automatically disqualifies you" unless the current regulation
--     itself is categorical — and even then, phrased as what the rule says,
--     with the examiner as the decision-maker.
--   * Federal regulation vs FMCSA guidance vs examiner judgment vs carrier
--     policy are labeled in-text. Blood-pressure staging and certificate-
--     shortening practice are GUIDANCE, not 391.41 text. FMCSA has NO
--     standalone sleep-apnea regulation (2016 ANPRM withdrawn 2017). The
--     vision exemption program was REPLACED by 391.44 individual assessment
--     (2022); hearing still has an exemption program.
--   * Visible medical-information disclaimer + last-reviewed date on every
--     page; reg_verified = true, reg_verified_date 2026-07-19.
--   * Slugs are stable identifiers.

do $kc$
declare
  v_med uuid;
  v_dot uuid;
  v_gyc uuid;
  v_car uuid;
  v_pub timestamptz := '2026-07-19 17:00:00+00';
  v_bio text := 'CDL-A driver and instructor — 17 years driving, zero violations. Founder of Trucking Life with Shawn and the TLWS truck driving school in Dalton, Georgia.';
begin
  select id into v_med from public.kc_categories where slug = 'health-on-the-road';
  select id into v_dot from public.kc_categories where slug = 'dot-compliance';
  select id into v_gyc from public.kc_categories where slug = 'getting-your-cdl';
  select id into v_car from public.kc_categories where slug = 'trucking-careers';
  if v_med is null or v_dot is null or v_gyc is null or v_car is null then
    raise exception 'Knowledge Center categories missing (health-on-the-road / dot-compliance / getting-your-cdl / trucking-careers)';
  end if;

  ---------------------------------------------------------------------------
  -- 1. The DOT Physical: What to Expect (cluster pillar)
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_med and slug = 'dot-physical-exam-what-to-expect') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_med,
      'dot-physical-exam-what-to-expect',
      'The DOT Physical: What to Expect, Step by Step',
      'What actually happens at a DOT physical — the health-history form, the vitals and vision/hearing checks, the urinalysis that is not a drug test, the hands-on exam, and how the examiner decides between a two-year card, a shorter one, or none.',
      $mdx$**Quick answer:** A DOT physical is the federal medical exam for commercial drivers, performed only by a **certified medical examiner** on FMCSA's [National Registry](https://nationalregistry.fmcsa.dot.gov/) under [49 CFR 391.43](https://www.ecfr.gov/current/title-49/part-391/section-391.43). You complete the health-history section of the **Medical Examination Report (Form MCSA-5875)**, the examiner checks vitals, vision, hearing, and a urine sample (a kidney screen — **not** a drug test), examines you system by system against the [391.41(b) standards](https://www.ecfr.gov/current/title-49/part-391/section-391.41), and then decides: certify for up to **24 months**, certify for a **shorter period** when something needs monitoring, or not certify. If you're certified, you leave with a **Medical Examiner's Certificate (Form MCSA-5876)** — the "medical card."

**Medical-information disclaimer:** Last reviewed **July 19, 2026**. This is general information for drivers, **not medical advice** — only a certified medical examiner, applying the federal standards to your actual examination, decides qualification, and this article cannot predict any outcome. Rules and guidance change; confirm current requirements with [FMCSA](https://www.fmcsa.dot.gov/medical) before you rely on them. Not affiliated with FMCSA, the National Registry, or any clinic.

## What the DOT physical is

Interstate commercial driving requires being **medically certified** under [49 CFR 391.41](https://www.ecfr.gov/current/title-49/part-391/section-391.41). The exam that establishes it is standardized: same federal form, same standards, same two possible documents at the end — everywhere in the country. Who must take it is set by [49 CFR 391.45](https://www.ecfr.gov/current/title-49/part-391/section-391.45): first-time drivers, every driver whose certificate is expiring, and drivers whose health has changed in a way that could affect safe operation. The credential it produces — and how it attaches to your CDL — is covered in [The DOT Medical Card](/knowledge/dot-compliance/dot-medical-card).

## Who performs it

Only examiners certified and listed on FMCSA's **National Registry of Certified Medical Examiners** ([49 CFR Part 390, Subpart D](https://www.ecfr.gov/current/title-49/part-390)) can perform DOT physicals. Doctors, physician assistants, nurse practitioners, and chiropractors can all be on the registry when their state license allows. How to find and verify one — before you book — is its own guide: [Finding a Certified Medical Examiner](/knowledge/health-on-the-road/finding-a-dot-medical-examiner).

## Step by step: what happens in the room

1. **Paperwork first.** You fill out the driver section of **Form MCSA-5875** — medications, surgeries, conditions, symptoms. Answer completely and honestly: the form warns that false statements have federal consequences, and an undisclosed condition discovered later causes far more trouble than a disclosed, managed one.
2. **Vitals.** Height, weight, pulse, and **blood pressure**. Elevated readings are the most common reason a card comes back shorter than two years — the details (and what is regulation vs guidance) are in [Blood Pressure and the DOT Physical](/knowledge/health-on-the-road/dot-physical-blood-pressure).
3. **Vision and hearing.** An eye chart and field-of-vision check against the standards in 391.41(b)(10), and the whisper test or audiometry for 391.41(b)(11). Wear your glasses or hearing aids — the standards allow them. Details: [Vision and Hearing Standards](/knowledge/health-on-the-road/vision-and-hearing-dot-standards).
4. **Urinalysis — and what it is not.** The sample is dipped for **specific gravity, protein, blood, and sugar** — a kidney-and-diabetes screen required by the exam form. **It is not a DOT drug test**; drug and alcohol testing runs under an entirely separate program covered in [CDL Drug and Alcohol Testing and the Clearinghouse](/knowledge/dot-compliance/drug-alcohol-testing-clearinghouse).
5. **The hands-on exam.** The examiner works through the body systems on the form — heart, lungs, abdomen, spine, limbs, neurological function — against the thirteen standards mapped in [DOT Physical Requirements](/knowledge/health-on-the-road/dot-physical-requirements).
6. **The determination.** Certify up to 24 months, certify shorter for monitoring, request more information (a specialist letter, test results), or not certify. This is the examiner's judgment applying the federal standards and FMCSA's examiner guidance — no chart on the internet, including this one, makes the call.

## What to bring

- **Glasses, contacts, or hearing aids** you use — the standards let you meet them corrected.
- **A complete medication list** with doses and prescribers — see [Medications and the DOT Physical](/knowledge/health-on-the-road/medications-and-the-dot-physical) for how prescriptions are evaluated.
- **Records for any managed condition** — a recent specialist note or test results can be the difference between certifying today and being asked to come back.
- **CPAP compliance data** if you are treated for sleep apnea — the reporting expectations are examiner-driven; see [Sleep Apnea and the DOT Physical](/knowledge/health-on-the-road/sleep-apnea-and-the-dot-physical).
- **Your previous certificate**, if renewing.

*(Cost is set by the clinic, not by regulation, and varies — as does whether a carrier pays for it, which is company policy.)*

## A worked illustration (not medical advice)

A driver books a renewal, brings a medication list and a cardiologist's follow-up note for a managed condition, and wears the glasses he tests with. The exam is uneventful except a first blood-pressure reading the examiner rechecks later in the visit. Because the history is documented and the numbers settle, the examiner certifies — for one year rather than two, with a note about what next year's exam should show. Nothing dramatic happened: preparation turned a potential "come back with records" into a same-day card. *(Illustration of the process, not medical advice; outcomes depend on your examination.)*

## Common mistakes

- **Treating it like a formality.** A short-term certificate changes your renewal rhythm immediately — and an expired one parks you.
- **Leaving conditions off the form.** Disclosure with documentation usually goes better than discovery without it — and false statements on MCSA-5875 carry federal penalties.
- **Forgetting glasses or hearing aids.** You are allowed to meet the standards corrected; failing uncorrected when you own correction is a self-inflicted delay.
- **Confusing the urinalysis with a drug test.** Different program, different rules — know which is which.
- **Booking a non-registry provider.** An exam by anyone not on the National Registry does not count. Verify first.

## Your DOT-physical checklist

- Examiner **verified on the National Registry** before booking
- **MCSA-5875 history** answers ready (conditions, surgeries, medications)
- **Correction worn**: glasses/contacts/hearing aids
- **Records in hand** for managed conditions; CPAP data if applicable
- **Previous certificate** brought along, if renewing
- Calendar reminder set for **well before** the new card expires — see [Renewals, Self-Certification, and Your CDL](/knowledge/health-on-the-road/medical-card-renewal-and-self-certification)

## Keep learning

- The standards themselves: [DOT Physical Requirements](/knowledge/health-on-the-road/dot-physical-requirements) · the credential side: [The DOT Medical Card](/knowledge/dot-compliance/dot-medical-card)
- Condition-specific guides: [Blood Pressure](/knowledge/health-on-the-road/dot-physical-blood-pressure) · [Diabetes](/knowledge/health-on-the-road/diabetes-and-the-dot-physical) · [Sleep Apnea](/knowledge/health-on-the-road/sleep-apnea-and-the-dot-physical) · [Exemptions and the SPE certificate](/knowledge/health-on-the-road/dot-medical-exemptions-and-variances)
- **Getting your CDL?** The physical is step two of the whole road: [How to Get Your CDL](/knowledge/getting-your-cdl/how-to-get-your-cdl) · study free with [practice tests](/practice-tests) · [TLWS Academy](/academy) · [CDL Pre-School](/cdl-pre-school) · [join the email list](/#newsletter).$mdx$,
      'The DOT Physical: What to Expect, Step by Step | Trucking Life with Shawn',
      'What happens at a DOT physical: the MCSA-5875 history, vitals, vision and hearing checks, the urinalysis that is not a drug test, and how the examiner decides.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"eCFR — 49 CFR 391.41, Physical Qualifications for Drivers","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.41"},
        {"label":"eCFR — 49 CFR 391.43, Medical Examination; Certificate of Physical Examination","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.43"},
        {"label":"eCFR — 49 CFR 391.45, Persons Who Must Be Medically Examined and Certified","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.45"},
        {"label":"eCFR — 49 CFR Part 390, Subpart D (National Registry of Certified Medical Examiners)","url":"https://www.ecfr.gov/current/title-49/part-390"},
        {"label":"FMCSA — National Registry of Certified Medical Examiners","url":"https://nationalregistry.fmcsa.dot.gov/"},
        {"label":"FMCSA — Medical Program","url":"https://www.fmcsa.dot.gov/medical"}
      ]$j$::jsonb,
      $j$[
        {"q":"What happens at a DOT physical?","a":"You complete the health-history section of the Medical Examination Report (Form MCSA-5875); the examiner takes vitals including blood pressure, checks vision and hearing against the federal standards, dips a urine sample for specific gravity, protein, blood, and sugar, and examines you system by system under 49 CFR 391.41(b). The exam ends with a determination: certify for up to 24 months, certify for a shorter period, request more information, or not certify."},
        {"q":"Is the DOT physical urine test a drug test?","a":"No. The urinalysis in the DOT physical screens kidney function and sugar (specific gravity, protein, blood, glucose) as part of the medical exam. DOT drug and alcohol testing is a separate program with its own rules, collection procedures, and consequences — enrolling in it is an employment requirement, not part of the physical."},
        {"q":"How long is a DOT medical certificate valid?","a":"Up to 24 months. The examiner may issue a certificate for a shorter period when a condition warrants monitoring — a one-year card is common in that situation — and some qualification paths, such as insulin-treated diabetes under 49 CFR 391.46, carry a 12-month maximum by rule. The examiner sets the period within those limits."},
        {"q":"What should I bring to a DOT physical?","a":"Your glasses, contacts, or hearing aids (the standards allow you to qualify corrected), a complete medication list with prescribers, recent records or specialist notes for any managed condition, CPAP compliance data if you are treated for sleep apnea, and your previous certificate if renewing. Preparation converts many would-be delays into same-day certificates."},
        {"q":"Do I need to fast before a DOT physical?","a":"No federal rule requires fasting. The urine sample is a dipstick screen for specific gravity, protein, blood, and sugar — not a blood draw or drug test — so no fasting preparation is required by the exam itself. If your own clinician has given you instructions for a separate test the same day, follow their advice; for the DOT exam, arriving normally hydrated and taking prescribed medication as usual is the standard practice."}
      ]$j$::jsonb,
      '{health-on-the-road,dot-physical,medical-exam,mcsa-5875,medical-certificate}',
      9, true, 'published', true, '2026-07-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 2. DOT Physical Requirements: The 13 Standards of 391.41
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_med and slug = 'dot-physical-requirements') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_med,
      'dot-physical-requirements',
      'DOT Physical Requirements: The 13 Standards of 391.41',
      'The thirteen physical qualification standards in 49 CFR 391.41(b), in plain English — what each one addresses, which ones have alternative paths like 391.44, 391.46, and the SPE certificate, and where examiner judgment does the deciding.',
      $mdx$**Quick answer:** Federal physical qualification for interstate commercial driving is defined by **thirteen standards** in [49 CFR 391.41(b)](https://www.ecfr.gov/current/title-49/part-391/section-391.41) — covering limbs, diabetes, heart, lungs, blood pressure, musculoskeletal condition, seizures, mental health, vision, hearing, drug use, and alcoholism. Some standards are specific and measurable (vision's 20/40 and 70-degree field); many are written as "**no clinical diagnosis likely to interfere with safe operation**" — language a **certified medical examiner** applies to your case. Several have **alternative qualification paths**: [391.44](https://www.ecfr.gov/current/title-49/part-391/section-391.44) for vision, [391.46](https://www.ecfr.gov/current/title-49/part-391/section-391.46) for insulin-treated diabetes, the SPE certificate for limb impairments, and federal exemption programs. Not meeting a standard as written is the start of a process more often than the end of a career.

**Medical-information disclaimer:** Last reviewed **July 19, 2026**. This is general information, **not medical advice**, and it cannot tell you whether you qualify — only a certified medical examiner, applying these standards to your examination, makes that determination. Rules and guidance change; confirm current text with the [eCFR](https://www.ecfr.gov/current/title-49/part-391/section-391.41) and [FMCSA](https://www.fmcsa.dot.gov/medical). Not affiliated with FMCSA or any clinic.

## How to read these standards

Three things to understand before the list. First, the **regulation text** is what binds; FMCSA's examiner guidance shapes how examiners apply it but is guidance, not law. Second, most standards hinge on the phrase *likely to interfere with safe operation* — which makes the **examiner's judgment**, informed by your history and records, the deciding instrument. Third, "the standard as written" is not always the last word: **alternative paths** exist for several conditions, which is exactly what the [exemptions and variances guide](/knowledge/health-on-the-road/dot-medical-exemptions-and-variances) maps.

## The thirteen standards, in plain English

1. **Loss of limb** — 391.41(b)(1): loss of a hand, arm, foot, or leg. Not an automatic end: the **SPE certificate** path under [391.49](https://www.ecfr.gov/current/title-49/part-391/section-391.49) exists because skill can be demonstrated.
2. **Limb impairment** — (b)(2): an impairment that interferes with the ability to perform normal tasks of operating a CMV — same SPE path available.
3. **Diabetes** — (b)(3): the standard addresses diabetes requiring insulin; since 2018, [391.46](https://www.ecfr.gov/current/title-49/part-391/section-391.46) lets insulin-treated drivers qualify through their treating clinician plus the examiner. Full guide: [Diabetes and the DOT Physical](/knowledge/health-on-the-road/diabetes-and-the-dot-physical).
4. **Cardiovascular** — (b)(4): no current clinical diagnosis of heart conditions likely to cause sudden collapse — heart attack history, angina, and similar are evaluated with records, commonly with a cardiologist's input. Examiner judgment territory.
5. **Respiratory** — (b)(5): no respiratory dysfunction likely to interfere with safe operation. This is the standard under which examiners weigh conditions like untreated **sleep apnea** — there is **no separate federal sleep-apnea rule**, as the [sleep-apnea guide](/knowledge/health-on-the-road/sleep-apnea-and-the-dot-physical) explains.
6. **High blood pressure** — (b)(6): written qualitatively; the familiar numeric staging comes from **FMCSA guidance**, not the regulation. The distinction matters and gets its own page: [Blood Pressure and the DOT Physical](/knowledge/health-on-the-road/dot-physical-blood-pressure).
7. **Musculoskeletal** — (b)(7): no arthritic, orthopedic, muscular, or vascular condition likely to interfere — function is what the examiner is judging.
8. **Epilepsy and seizures** — (b)(8): no established medical history or clinical diagnosis of epilepsy or any condition likely to cause loss of consciousness or control. One of the stricter standards as written; a federal **seizure exemption program** exists for individually reviewed cases.
9. **Mental and psychiatric** — (b)(9): no mental, nervous, organic, or functional disease or psychiatric disorder likely to interfere. Treated, managed conditions are evaluated on evidence — this standard is about function, not a diagnosis label.
10. **Vision** — (b)(10): measurable — distant acuity of at least **20/40** in each eye and both together (corrective lenses allowed), at least a **70-degree** horizontal field in each eye, and the ability to recognize standard traffic-signal colors. The alternative path when one eye cannot meet it is [391.44's individual assessment](/knowledge/health-on-the-road/vision-and-hearing-dot-standards).
11. **Hearing** — (b)(11): measurable — perceive a **forced whisper at 5 feet** or meet the audiometric limit in the better ear, hearing aid permitted. An **exemption program** exists for drivers who cannot meet it.
12. **Drugs** — (b)(12): does not use certain controlled substances, with a narrow exception for a **non-Schedule-I substance prescribed by a practitioner** familiar with the driver's history and duties. The full mechanics: [Medications and the DOT Physical](/knowledge/health-on-the-road/medications-and-the-dot-physical).
13. **Alcoholism** — (b)(13): no current clinical diagnosis of alcoholism — "current" being the operative, clinically determined word.

## Where the deciding actually happens

The exam that applies all thirteen is [the DOT physical itself](/knowledge/health-on-the-road/dot-physical-exam-what-to-expect) — one appointment, one examiner, working through [Form MCSA-5875](https://www.fmcsa.dot.gov/medical) with your history in front of them. For most drivers most standards are a non-event; where one is in play, the examiner can certify, certify for a shorter monitoring period, ask for records, or decline — and disagreements between medical opinions have their own federal resolution process under [391.47](https://www.ecfr.gov/current/title-49/part-391/section-391.47).

## A worked illustration (not medical advice)

A driver with well-controlled type 2 diabetes (no insulin) and mild, treated high blood pressure reads the list above and worries about standards (b)(3) and (b)(6). At the exam, the diabetes is evaluated as an ordinary managed condition; the blood pressure earns a one-year certificate under the examiner's guidance-informed judgment rather than a two-year card. Neither standard "failed" the driver — both routed through the examiner's evaluation, which is how the system is built to work. *(Illustration of how the standards are applied, not medical advice; outcomes depend on your examination.)*

## Common mistakes

- **Reading the list as pass/fail switches.** Most standards route through examiner judgment and several have alternative paths — the list is a map, not a verdict.
- **Assuming a diagnosis equals disqualification.** The standards mostly target conditions *likely to interfere with safe operation* — managed and documented is a different conversation than untreated and undisclosed.
- **Not knowing the alternative paths exist.** 391.44, 391.46, the SPE certificate, and the exemption programs exist precisely for drivers who miss a standard as written.
- **Treating internet charts as regulation.** Numeric thresholds you see online for blood pressure are guidance — the regulation's own words are broader.
- **Skipping the records.** Standards that hinge on judgment are decided on evidence; arriving without it invites a delay.

## Your standards checklist

- The **thirteen categories** skimmed against your own history — before the appointment
- **Records gathered** for any condition an examiner will want evidence on
- **Alternative paths** understood if one applies (391.44 / 391.46 / SPE / exemption programs)
- **Medications listed** with prescribers — [how they are evaluated](/knowledge/health-on-the-road/medications-and-the-dot-physical)
- The exam itself previewed, start to finish

## Keep learning

- The exam walkthrough: [The DOT Physical: What to Expect](/knowledge/health-on-the-road/dot-physical-exam-what-to-expect) · the credential: [The DOT Medical Card](/knowledge/dot-compliance/dot-medical-card)
- Deep dives: [Vision and Hearing](/knowledge/health-on-the-road/vision-and-hearing-dot-standards) · [Blood Pressure](/knowledge/health-on-the-road/dot-physical-blood-pressure) · [Exemptions and the SPE](/knowledge/health-on-the-road/dot-medical-exemptions-and-variances)
- **Start your CDL journey right:** [TLWS Academy](/academy) · free [CDL Pre-School](/cdl-pre-school) · [join the email list](/#newsletter).$mdx$,
      'DOT Physical Requirements: The 13 Standards of 391.41 | Trucking Life with Shawn',
      'All thirteen DOT physical standards of 49 CFR 391.41(b) in plain English — what each covers, the alternative paths, and where examiner judgment decides.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"eCFR — 49 CFR 391.41, Physical Qualifications for Drivers","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.41"},
        {"label":"eCFR — 49 CFR 391.44, Physical Qualification Standards for Vision","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.44"},
        {"label":"eCFR — 49 CFR 391.46, Physical Qualification Standards for Insulin-Treated Diabetes","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.46"},
        {"label":"eCFR — 49 CFR 391.49, Alternative Physical Qualification Standards (SPE)","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.49"},
        {"label":"eCFR — 49 CFR 391.47, Resolution of Conflicts of Medical Evaluation","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.47"},
        {"label":"FMCSA — Medical Program","url":"https://www.fmcsa.dot.gov/medical"}
      ]$j$::jsonb,
      $j$[
        {"q":"What are the DOT physical requirements?","a":"49 CFR 391.41(b) lists thirteen physical qualification standards covering loss of limb, limb impairment, diabetes, cardiovascular and respiratory conditions, blood pressure, musculoskeletal conditions, epilepsy and seizures, mental health, vision, hearing, drug use, and alcoholism. Some are measurable (vision, hearing); most are written as no condition likely to interfere with safe operation, which a certified medical examiner applies to your case."},
        {"q":"Does a medical condition automatically disqualify me from a CDL?","a":"Most standards do not work that way. The majority hinge on whether a condition is likely to interfere with safe operation — an examiner-judged question decided on your history and records — and several standards have alternative qualification paths: 391.44 for vision, 391.46 for insulin-treated diabetes, SPE certificates for limb impairments, and federal exemption programs. Only the examiner's determination, applying the current rules, answers it for you."},
        {"q":"Which DOT physical standards are measurable and which are judgment calls?","a":"Vision and hearing are measurable — 20/40 acuity with a 70-degree field per eye, and the whisper-at-5-feet or 40 dB audiometric test. Most of the rest, including the cardiovascular, respiratory, musculoskeletal, and psychiatric standards, are written as no condition likely to interfere with safe operation, which makes them examiner-judgment questions decided on your history and records rather than a single number."},
        {"q":"Can I drive a truck if I have seizures or epilepsy?","a":"391.41(b)(8) is one of the stricter standards as written: no established medical history or clinical diagnosis of epilepsy or a condition likely to cause loss of consciousness or control. FMCSA operates a seizure exemption program that reviews individual cases. What that means for any one driver is a determination for the examiner and FMCSA's program — not something an article can promise either way."},
        {"q":"Is the DOT blood-pressure limit part of the regulation?","a":"The regulation itself, 391.41(b)(6), is written qualitatively — no current clinical diagnosis of high blood pressure likely to interfere with safe operation. The familiar numeric staging and shortened-certificate practice come from FMCSA's examiner guidance, which shapes examiner judgment but is not regulation text. That distinction is exactly why two drivers with similar numbers can leave with different certificate lengths."}
      ]$j$::jsonb,
      '{health-on-the-road,dot-physical,391-41,standards,qualification}',
      9, false, 'published', true, '2026-07-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 3. Blood Pressure and the DOT Physical
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_med and slug = 'dot-physical-blood-pressure') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_med,
      'dot-physical-blood-pressure',
      'Blood Pressure and the DOT Physical',
      'What the regulation actually says about blood pressure (less than you think), where the familiar numeric staging really comes from, how examiners commonly use it, and what drivers can do before the exam — without gaming anything.',
      $mdx$**Quick answer:** The regulation itself — [49 CFR 391.41(b)(6)](https://www.ecfr.gov/current/title-49/part-391/section-391.41) — says only that a driver must have **no current clinical diagnosis of high blood pressure likely to interfere with safe operation**. It contains **no numbers**. The numeric staging drivers hear about (readings grouped into stages, one-year certificates, short-term certificates at higher stages) comes from **FMCSA's examiner guidance**, which informs the **certified medical examiner's judgment** but is not regulation text. In practice: controlled blood pressure commonly means an ordinary certificate, elevated readings commonly mean a **shorter certificate and monitoring**, and very high readings can mean no certificate until a treating clinician is involved — with the examiner deciding every case on its own numbers and history.

**Medical-information disclaimer:** Last reviewed **July 19, 2026**. This is general information, **not medical advice** — it cannot predict your certificate length or tell you how to treat blood pressure; only your clinician can advise treatment and only a certified medical examiner decides qualification. Guidance changes; confirm current material with [FMCSA](https://www.fmcsa.dot.gov/medical). Not affiliated with FMCSA or any clinic.

## What is regulation and what is guidance

This page's most important sentence: **the numeric thresholds are guidance, not regulation.** The regulation's words are qualitative. FMCSA publishes examiner guidance — advisory criteria and the Medical Examiner Handbook — that describes a staging framework and certificate-interval practice, and examiners lean on it heavily. But because it is guidance applied through judgment, two drivers with similar readings can legitimately leave with different certificate lengths depending on history, treatment, and the rest of the exam. Any chart that presents hard cutoffs as federal law is misstating what [391.41(b)(6)](https://www.ecfr.gov/current/title-49/part-391/section-391.41) says.

## How examiners commonly handle it *(guidance-informed practice, not regulation)*

- **Controlled readings** with or without medication: commonly an ordinary certificate — up to the 24-month maximum, at the examiner's discretion.
- **Elevated readings**: commonly a **one-year certificate**, so the condition is rechecked sooner — the classic "why is my card only good for a year" answer.
- **Higher stages**: commonly a **short-term certificate** (to show treatment and improvement) or **no certificate** until readings are managed with a treating clinician.
- **Medication is not the problem**: being treated for high blood pressure is routine; what the examiner is judging is control and stability, not the existence of a prescription.

Every line above describes *common, guidance-informed practice* — the examiner's determination on your actual readings is the only one that counts.

## Why the program cares

Sustained high blood pressure raises the risk of exactly the events the [391.41(b) standards](/knowledge/health-on-the-road/dot-physical-requirements) exist to screen: sudden incapacitation behind the wheel of an 80,000-pound vehicle. The shortened-certificate practice is not punishment — it is the program's way of keeping a driver working while a manageable condition gets managed on a schedule.

## Before the exam — legitimately

- **Know your numbers early.** If a home or pharmacy check runs high **weeks before** your exam, that is time to see your clinician — treatment started early beats surprises in the exam room.
- **Take prescribed medication as prescribed**, including the day of the exam. Skipping doses to "test yourself" is a decision for your clinician, not exam strategy.
- **Bring your treatment record** — medication list, recent readings, your clinician's notes. Examiners certify on evidence.
- **Arrive unhurried.** Caffeine, nicotine, and rushing right before a reading do you no favors; many examiners recheck a high first reading later in the visit anyway.

What this list is **not**: a way to game a reading. A number that only looks good for one morning solves nothing — the next exam is at most a year or two away, and the [renewal rhythm](/knowledge/health-on-the-road/medical-card-renewal-and-self-certification) comes around fast.

## A worked illustration (not medical advice)

A driver's first reading at a renewal comes back elevated. The examiner rechecks it at the end of the visit — still elevated, though lower. With no prior diagnosis on file, the examiner issues a **one-year certificate** and recommends the driver see a clinician about the readings. The driver starts treatment; at the next exam the readings are controlled and documented. Same driver, same program — the difference across the two visits is a managed condition with evidence behind it. *(Illustration of guidance-informed practice, not medical advice; your outcome depends on your examination.)*

## Common mistakes

- **Treating internet staging charts as law.** The regulation has no numbers; the staging is examiner guidance.
- **Discovering high readings in the exam room.** Checking early — weeks out — converts a certificate problem into a routine treatment plan.
- **Stopping medication before the exam.** Control is what earns certificates; unmanaged readings are what shorten or stop them.
- **Resenting the one-year card.** It is the program's monitoring tool, not a demerit — and consistent control is the road back to longer certificates, at the examiner's discretion.
- **No records.** A managed condition without documentation looks unmanaged to an examiner who has one visit to decide.

## Your blood-pressure checklist

- Readings **checked well before** the exam, not discovered at it
- **Treatment current** and taken as prescribed, including exam day
- **Records brought**: medication list, recent readings, clinician notes
- The regulation-vs-guidance distinction understood across all thirteen standards
- The exam previewed: [what to expect](/knowledge/health-on-the-road/dot-physical-exam-what-to-expect)

## Keep learning

- The exam walkthrough: [The DOT Physical: What to Expect](/knowledge/health-on-the-road/dot-physical-exam-what-to-expect) · all thirteen standards: [DOT Physical Requirements](/knowledge/health-on-the-road/dot-physical-requirements)
- Keep the card current: [Renewals, Self-Certification, and Your CDL](/knowledge/health-on-the-road/medical-card-renewal-and-self-certification)
- **Build healthy road habits early:** [TLWS Academy](/academy) · free [CDL Pre-School](/cdl-pre-school) · [join the email list](/#newsletter).$mdx$,
      'Blood Pressure and the DOT Physical | Trucking Life with Shawn',
      'What the regulation actually says about DOT blood pressure (no numbers), where the numeric staging comes from, and how to prepare for the exam legitimately.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"eCFR — 49 CFR 391.41, Physical Qualifications for Drivers","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.41"},
        {"label":"eCFR — 49 CFR 391.43, Medical Examination; Certificate of Physical Examination","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.43"},
        {"label":"FMCSA — Medical Program (examiner guidance and advisory criteria)","url":"https://www.fmcsa.dot.gov/medical"},
        {"label":"FMCSA — National Registry of Certified Medical Examiners","url":"https://nationalregistry.fmcsa.dot.gov/"}
      ]$j$::jsonb,
      $j$[
        {"q":"What is the DOT physical blood-pressure limit?","a":"The regulation, 49 CFR 391.41(b)(6), contains no numeric limit — it requires no current clinical diagnosis of high blood pressure likely to interfere with safe operation. The numeric staging and certificate-interval practice drivers hear about come from FMCSA's examiner guidance, which informs the certified medical examiner's judgment but is not regulation text."},
        {"q":"Why did I only get a one-year DOT medical card?","a":"A shortened certificate is the program's monitoring tool. Under guidance-informed practice, elevated blood pressure (and other conditions that warrant watching) commonly result in a one-year certificate so the condition is rechecked sooner. Consistent, documented control is the usual road back toward longer certificates, always at the examiner's discretion within the 24-month maximum."},
        {"q":"Can I pass a DOT physical while taking blood-pressure medication?","a":"Being treated for high blood pressure is routine at DOT physicals. What the examiner evaluates is control and stability — your readings and history — not the fact that you have a prescription. Take medication as prescribed, including on exam day, and bring your treatment records; whether and for how long to certify remains the examiner's determination."},
        {"q":"What should I do if my blood pressure runs high before a DOT physical?","a":"Check your readings weeks before the exam, not the morning of it. If they run high, see your clinician — starting treatment early is the legitimate preparation. Bring your medication list, recent readings, and clinician notes to the exam. Attempting to produce one good reading solves nothing, because the next exam is at most a year or two away."},
        {"q":"Can high blood pressure end my driving career?","a":"For most drivers, no — high blood pressure is one of the most commonly managed conditions in the program. Very high, unmanaged readings can mean a short-term certificate or no certificate until a treating clinician is involved, but the guidance-informed framework is built to keep drivers working while the condition comes under control. The examiner decides each case on its own numbers and history."}
      ]$j$::jsonb,
      '{health-on-the-road,blood-pressure,dot-physical,guidance,certificate}',
      8, false, 'published', true, '2026-07-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 4. Diabetes and the DOT Physical
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_med and slug = 'diabetes-and-the-dot-physical') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_med,
      'diabetes-and-the-dot-physical',
      'Diabetes and the DOT Physical',
      'How diabetes is handled at the DOT physical — the ordinary path for non-insulin treatment, the 391.46 path that replaced the old exemption program for insulin-treated drivers, the MCSA-5870 form, and the 12-month certificate cap.',
      $mdx$**Quick answer:** Diabetes and commercial driving coexist every day. **Not treated with insulin?** Your diabetes is evaluated like any other managed condition at [the DOT physical](/knowledge/health-on-the-road/dot-physical-exam-what-to-expect) — control and stability are what the examiner judges. **Treated with insulin?** Since the 2018 final rule, [49 CFR 391.46](https://www.ecfr.gov/current/title-49/part-391/section-391.46) provides a direct qualification path — no exemption program needed: your **treating clinician** completes the **Insulin-Treated Diabetes Mellitus Assessment Form (MCSA-5870)**, and the medical examiner must complete the exam **no later than 45 days after the clinician signs it**. Insulin-treated drivers qualified this way can be certified for a maximum of **12 months** at a time. Sudden severe hypoglycemia is the safety concern the whole framework is built around — which is why documented control is the currency that matters.

**Medical-information disclaimer:** Last reviewed **July 19, 2026**. This is general information, **not medical advice** — it cannot evaluate your diabetes or predict certification; treatment questions belong to your clinician, and qualification is decided by a certified medical examiner applying the current rules. Confirm current requirements with [FMCSA](https://www.fmcsa.dot.gov/medical). Not affiliated with FMCSA or any clinic.

## The two paths, clearly separated

- **Diabetes managed without insulin** (diet, exercise, oral medication, non-insulin injectables): there is no special federal path because none is needed. The examiner evaluates it under the general standards in [391.41(b)](https://www.ecfr.gov/current/title-49/part-391/section-391.41) — the questions are control, stability, and complications, answered by your history and records. *(Federal regulation applied through examiner judgment.)*
- **Diabetes treated with insulin**: handled by [391.46](https://www.ecfr.gov/current/title-49/part-391/section-391.46), a **regulation**, not a waiver — created by the September 2018 final rule that ended the old exemption-program era. Two clinicians are involved: your **treating clinician** attests to stable control on **MCSA-5870**, then the **certified medical examiner** completes the DOT exam and makes the certification decision. *(Federal regulation.)*

## How the 391.46 path works, step by step

1. **See your treating clinician** — the professional who manages your insulin therapy. They complete and sign **Form MCSA-5870**, attesting that you maintain a stable insulin regimen and properly controlled diabetes.
2. **Book the DOT exam inside the window.** The medical examiner must complete the examination **no later than 45 days after** the clinician signs the form — miss the window and you need a fresh form.
3. **The examiner decides.** With the MCSA-5870 in hand, the examiner evaluates you like any applicant — and may certify for **up to 12 months**, the maximum the rule allows on this path (shorter is within their discretion).
4. **Repeat on schedule.** The 12-month cap means this is an annual rhythm: clinician form, exam, certificate. Build it into your [renewal calendar](/knowledge/health-on-the-road/medical-card-renewal-and-self-certification).

## What examiners and clinicians are looking at

The concern behind every diabetes evaluation is **severe hypoglycemia** — a low-blood-sugar episode that impairs or incapacitates a driver. Expect attention to: episodes of severe hypoglycemia (especially any requiring assistance or causing loss of consciousness), how you monitor blood glucose, treatment stability, and complications that touch other standards — eyes ([vision standards](/knowledge/health-on-the-road/vision-and-hearing-dot-standards)), circulation, kidneys. A driver who monitors as directed, keeps records, and brings them presents evidence; a driver who brings nothing presents a question mark. *(The evaluation factors reflect the regulation and FMCSA guidance; the weight given to each is clinician and examiner judgment.)*

## A worked illustration (not medical advice)

A driver newly started on insulin assumes the CDL is finished — a belief that was closer to true before 2018 than it is now. Instead: the endocrinologist completes MCSA-5870 at a routine visit; twelve days later a [registry examiner](/knowledge/health-on-the-road/finding-a-dot-medical-examiner) completes the exam with the form in hand and certifies for 12 months. The driver sets two recurring reminders — clinician visit, then exam — and treats the annual cycle as part of the job, like an [annual inspection](/knowledge/dot-compliance/annual-dot-inspection) for the body. *(Illustration of the 391.46 process, not medical advice; outcomes depend on your evaluation.)*

## Common mistakes

- **Believing insulin ends the career.** That era ended with the 2018 rule — 391.46 is a standing qualification path, not a waiver lottery.
- **Blowing the 45-day window.** The exam must be completed no later than 45 days after the clinician signs MCSA-5870; a stale form restarts the paperwork.
- **Arriving without records.** Monitoring logs and clinician notes are the evidence the framework runs on.
- **Hiding the diagnosis.** Nondisclosure on the MCSA-5875 history form carries federal consequences and reads worse than any managed condition ever will.
- **Forgetting the annual rhythm.** A 12-month certificate means renewal planning is now a yearly discipline, tied into your [self-certification obligations](/knowledge/health-on-the-road/medical-card-renewal-and-self-certification).

## Your diabetes-path checklist

- Path identified: **general evaluation** (no insulin) or **391.46** (insulin)
- If 391.46: **MCSA-5870** completed by your treating clinician
- **Exam booked** to complete within 45 days of the clinician signature
- **Monitoring records and clinician notes** in hand for the exam
- **Annual renewal rhythm** on the calendar (12-month maximum certificate)
- Complications checked against the [other standards](/knowledge/health-on-the-road/dot-physical-requirements) they can touch

## Keep learning

- The exam itself: [The DOT Physical: What to Expect](/knowledge/health-on-the-road/dot-physical-exam-what-to-expect) · all thirteen standards: [DOT Physical Requirements](/knowledge/health-on-the-road/dot-physical-requirements)
- Adjacent paths: [Exemptions, Variances, and the SPE Certificate](/knowledge/health-on-the-road/dot-medical-exemptions-and-variances)
- **Healthy career from day one:** [TLWS Academy](/academy) · free [CDL Pre-School](/cdl-pre-school) · [join the email list](/#newsletter).$mdx$,
      'Diabetes and the DOT Physical | Trucking Life with Shawn',
      'Diabetes at the DOT physical: the ordinary path without insulin, the 391.46 insulin path with form MCSA-5870, the 45-day window, and the 12-month cap.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"eCFR — 49 CFR 391.46, Physical Qualification Standards for Insulin-Treated Diabetes","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.46"},
        {"label":"eCFR — 49 CFR 391.41, Physical Qualifications for Drivers","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.41"},
        {"label":"Federal Register — Qualifications of Drivers; Diabetes Standard (2018 final rule)","url":"https://www.federalregister.gov/documents/2018/09/19/2018-20161/qualifications-of-drivers-diabetes-standard"},
        {"label":"FMCSA — Insulin-Treated Diabetes Mellitus Assessment Form (MCSA-5870)","url":"https://www.fmcsa.dot.gov/regulations/medical/insulin-treated-diabetes-mellitus-assessment-form-mcsa-5870"},
        {"label":"FMCSA — Medical Program","url":"https://www.fmcsa.dot.gov/medical"}
      ]$j$::jsonb,
      $j$[
        {"q":"Can I drive a truck if I use insulin?","a":"Insulin-treated drivers have a direct qualification path under 49 CFR 391.46, created by the 2018 final rule that replaced the old exemption program. Your treating clinician completes the MCSA-5870 assessment form attesting to a stable insulin regimen and properly controlled diabetes, and a certified medical examiner completes the DOT exam no later than 45 days after the clinician signs. Certification is the examiner's decision, with a 12-month maximum on this path."},
        {"q":"What is Form MCSA-5870?","a":"The Insulin-Treated Diabetes Mellitus Assessment Form. The clinician who manages your insulin therapy completes and signs it, attesting to your regimen and control. The DOT medical exam must then be completed no later than 45 days after the signature date — if the window lapses, a freshly completed form is needed."},
        {"q":"How long is a DOT medical certificate for insulin-treated diabetes?","a":"A maximum of 12 months under 49 CFR 391.46, compared with the general 24-month maximum. The examiner may certify for a shorter period. Practically, that makes the clinician-form-plus-exam cycle an annual rhythm worth building into your renewal calendar."},
        {"q":"Does type 2 diabetes without insulin affect a DOT physical?","a":"Diabetes managed without insulin is evaluated under the general standards like any managed condition — no special form or path is required. The examiner looks at control, stability, and complications, using your history and records. Well-documented management is evaluated on its evidence; the certificate decision and its length remain the examiner's judgment."},
        {"q":"What diabetes records should I bring to a DOT physical?","a":"Blood-glucose monitoring records, your medication or insulin regimen, recent clinician notes, and — if you are on the 391.46 insulin path — the signed MCSA-5870 dated within the 45-day window. Records showing stable control, and attention to complications involving eyes, circulation, or kidneys, are what the evaluation framework runs on."}
      ]$j$::jsonb,
      '{health-on-the-road,diabetes,insulin,391-46,mcsa-5870}',
      8, false, 'published', true, '2026-07-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 5. Sleep Apnea and the DOT Physical
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_med and slug = 'sleep-apnea-and-the-dot-physical') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_med,
      'sleep-apnea-and-the-dot-physical',
      'Sleep Apnea and the DOT Physical: What the Rules Actually Say',
      'The single most misunderstood topic in driver medicine: there is no standalone federal sleep-apnea regulation. What actually governs — examiner judgment under the general standards, FMCSA guidance, and carrier policy — and how treated drivers keep it routine.',
      $mdx$**Quick answer:** **FMCSA has no standalone sleep-apnea regulation.** No federal rule sets a neck size, BMI number, or automatic sleep-study trigger. A 2016 advance notice of proposed rulemaking on obstructive sleep apnea was **withdrawn in 2017**, and no rule has replaced it. What actually governs: the **general standards** of [49 CFR 391.41(b)](https://www.ecfr.gov/current/title-49/part-391/section-391.41) (a respiratory or other condition *likely to interfere with safe operation*), applied through **certified-medical-examiner judgment** informed by FMCSA guidance — plus, separately, **carrier policies** that can be stricter than anything federal. If you are treated (commonly with CPAP), the practical rule of the road is simple: **bring your compliance data** and the exam usually stays routine.

**Medical-information disclaimer:** Last reviewed **July 19, 2026**. This is general information, **not medical advice** — it cannot tell you whether you have sleep apnea (only a clinician and a sleep study can) or predict certification (only a certified medical examiner decides). Guidance and carrier policies change; confirm current material with [FMCSA](https://www.fmcsa.dot.gov/driver-safety/sleep-apnea/driving-when-you-have-sleep-apnea). Not affiliated with FMCSA or any clinic.

## What the rules actually say — and don't

Three layers, and keeping them straight defuses most of the internet noise:

- **Federal regulation:** [391.41(b)(5)](https://www.ecfr.gov/current/title-49/part-391/section-391.41) requires no respiratory dysfunction *likely to interfere with safe operation* — the standard under which obstructive sleep apnea is evaluated, alongside general alertness and fatigue concerns. The words "sleep apnea" set no specific test, threshold, or measurement in the regulation. **There is no standalone federal sleep-apnea rule**, and the 2016 FMCSA/FRA rulemaking attempt was [withdrawn in 2017](https://www.federalregister.gov/documents/2017/08/08/2017-16451/evaluation-of-safety-sensitive-personnel-for-moderate-to-severe-obstructive-sleep-apnea).
- **FMCSA guidance and examiner judgment:** examiners screen for risk factors and symptoms as part of applying the general standards. Whether to refer a driver for a sleep evaluation, and how to certify a treated driver, are **examiner-judgment calls informed by guidance** — which is why practice varies between examiners and why no article can promise what yours will do.
- **Carrier policy:** some carriers run their own sleep-apnea screening or treatment-verification programs as employment conditions. That is **company policy**, not federal law — a carrier can require more than FMCSA does, and disputes about it are employment matters, not certification ones.

## Why the topic exists at all

Untreated obstructive sleep apnea fragments sleep and degrades daytime alertness — precisely the kind of impairment the standards target in a job where [hours-of-service rules](/knowledge/hours-of-service/cdl-hours-of-service-rules) already fight fatigue. The program's concern is real even though the rulebook is thin; it is managed through the examiner's chair rather than a numbered regulation.

## If you are already diagnosed and treated

This is the well-worn path, and it is usually undramatic:

- **Use the treatment as prescribed** — for CPAP, the machine records usage.
- **Bring compliance data** to [the exam](/knowledge/health-on-the-road/dot-physical-exam-what-to-expect): a usage report covering the recent period, plus any sleep-clinic notes. Examiners commonly want to see regular use; the specific expectation is theirs to set.
- **Expect monitoring-style certification.** Treated, documented drivers are commonly certified with a shorter card (often a year) so treatment stays verified — examiner discretion, same as [blood pressure monitoring](/knowledge/health-on-the-road/dot-physical-blood-pressure).
- **Keep the rhythm.** Fold the data-gathering into your [renewal routine](/knowledge/health-on-the-road/medical-card-renewal-and-self-certification) and it becomes paperwork, not drama.

## If an examiner refers you for evaluation

An examiner who sees significant risk factors or symptoms may hold certification pending a sleep evaluation, or certify short-term while one is completed — their judgment. If you believe an evaluation demand is medically unfounded, options exist: discuss the basis with the examiner, involve your treating clinician's evidence, or — where two medical opinions genuinely conflict — the resolution process under [49 CFR 391.47](https://www.ecfr.gov/current/title-49/part-391/section-391.47). What rarely works: examiner-shopping with an incomplete story, which tends to catch up with a driver at the next exam.

## A worked illustration (not medical advice)

A driver diagnosed with obstructive sleep apnea two years ago uses CPAP nightly and brings a 90-day compliance report to every renewal. The exam takes ten extra seconds: the examiner reviews the report, notes continued treatment, and certifies for a year. Meanwhile a forum thread has convinced another driver that a certain neck size means an automatic sleep study "under the new federal rule" — a rule that does not exist. One driver managed a condition; the other managed a rumor. *(Illustration of examiner-judgment practice, not medical advice; outcomes depend on your examination.)*

## Common mistakes

- **Believing there is a federal sleep-apnea rule.** There is not — no automatic BMI trigger, no neck-size cutoff, no mandated sleep study in regulation. The withdrawn 2017 rulemaking is the receipt.
- **Skipping treatment before the exam.** Compliance data is the whole story for a treated driver; a gap in usage is the thing examiners act on.
- **Confusing carrier policy with federal law.** A company screening program is an employment condition — real, but not FMCSA.
- **Hiding symptoms on the form.** MCSA-5875 nondisclosure carries federal consequences; disclosure with management is the stronger position.
- **Fighting fatigue with denial.** Whatever the paperwork, degraded alertness in this job is a safety problem the [HOS rules](/knowledge/hours-of-service/cdl-hours-of-service-rules) alone cannot fix.

## Your sleep-apnea checklist

- The three layers straight: **regulation vs guidance/judgment vs carrier policy**
- If treated: **compliance data current** and brought to every exam
- Sleep-clinic **notes on hand**; treatment used as prescribed
- Renewal rhythm planned — [renewals and self-certification](/knowledge/health-on-the-road/medical-card-renewal-and-self-certification)
- Genuine medical-opinion conflicts handled through **391.47**, not examiner-shopping

## Keep learning

- Before the appointment: [The DOT Physical: What to Expect](/knowledge/health-on-the-road/dot-physical-exam-what-to-expect) · the full standard list: [DOT Physical Requirements](/knowledge/health-on-the-road/dot-physical-requirements)
- Life side of rest: [Home Time and Quality of Life](/knowledge/trucking-careers/home-time-and-quality-of-life)
- **Sleep is a career skill:** [TLWS Academy](/academy) · free [CDL Pre-School](/cdl-pre-school) · [join the email list](/#newsletter).$mdx$,
      'Sleep Apnea and the DOT Physical: What the Rules Say | Trucking Life with Shawn',
      'There is no standalone federal sleep-apnea rule. What actually governs the DOT physical: examiner judgment under 391.41, FMCSA guidance, and carrier policy.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"eCFR — 49 CFR 391.41, Physical Qualifications for Drivers","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.41"},
        {"label":"FMCSA — Driving When You Have Sleep Apnea","url":"https://www.fmcsa.dot.gov/driver-safety/sleep-apnea/driving-when-you-have-sleep-apnea"},
        {"label":"Federal Register — Withdrawal of OSA Rulemaking (2017)","url":"https://www.federalregister.gov/documents/2017/08/08/2017-16451/evaluation-of-safety-sensitive-personnel-for-moderate-to-severe-obstructive-sleep-apnea"},
        {"label":"eCFR — 49 CFR 391.47, Resolution of Conflicts of Medical Evaluation","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.47"}
      ]$j$::jsonb,
      $j$[
        {"q":"Is there a federal DOT sleep-apnea regulation?","a":"No. FMCSA has no standalone sleep-apnea regulation — no BMI trigger, neck-size cutoff, or mandated sleep study appears in the rules. A 2016 advance notice of proposed rulemaking on obstructive sleep apnea was withdrawn in 2017 and nothing has replaced it. Screening and certification decisions run through the certified medical examiner's judgment under the general standards of 49 CFR 391.41, informed by FMCSA guidance."},
        {"q":"Can a DOT examiner require a sleep study?","a":"An examiner who sees significant risk factors or symptoms may hold certification pending a sleep evaluation or certify short-term while one is completed — that is examiner judgment applying the general standards, not a numbered federal mandate. Practice varies between examiners. Where two medical opinions genuinely conflict, 49 CFR 391.47 provides a resolution process."},
        {"q":"I use CPAP — can I still be DOT certified?","a":"Treated sleep apnea is a routine part of the program. Drivers using CPAP as prescribed commonly bring machine compliance data and sleep-clinic notes to the exam and are certified, often on a monitoring-length card such as a year, at the examiner's discretion. Consistent documented treatment is what keeps the exam undramatic."},
        {"q":"What sleep-apnea documentation should I bring to a DOT physical?","a":"A recent CPAP usage/compliance report (examiners commonly want to see regular use over the recent period), plus sleep-clinic notes covering your diagnosis and treatment. The specific expectation is set by your examiner, so bringing more documentation than the minimum is the safer habit."},
        {"q":"Can my trucking company have its own sleep-apnea program?","a":"Yes — some carriers run screening or treatment-verification programs as a condition of employment, and a company can require more than FMCSA does. That is carrier policy, not federal regulation. It is real in the sense that it affects your job, but disputes about it are employment matters rather than federal certification questions."}
      ]$j$::jsonb,
      '{health-on-the-road,sleep-apnea,cpap,examiner-judgment,fatigue}',
      9, false, 'published', true, '2026-07-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 6. Vision and Hearing Standards
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_med and slug = 'vision-and-hearing-dot-standards') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_med,
      'vision-and-hearing-dot-standards',
      'Vision and Hearing Standards for the DOT Physical',
      'The two most measurable standards — 20/40 acuity with a 70-degree field, and the whisper-or-audiometric hearing test — plus the 2022 change everyone should know: vision moved from an exemption program to individual assessment under 391.44, while hearing kept its exemption path.',
      $mdx$**Quick answer:** Vision: [49 CFR 391.41(b)(10)](https://www.ecfr.gov/current/title-49/part-391/section-391.41) requires distant acuity of at least **20/40 in each eye and both eyes together** (glasses or contacts allowed), a horizontal field of at least **70 degrees in each eye**, and the ability to recognize standard **traffic-signal colors**. Hearing: (b)(11) requires perceiving a **forced whisper at 5 feet or more**, or an average hearing loss of **40 dB or less** in the better ear (500/1,000/2,000 Hz) — **hearing aids allowed**. The big 2022 change: drivers who cannot meet the vision standard in one eye no longer apply for an exemption — the **individual-assessment path of [391.44](https://www.ecfr.gov/current/title-49/part-391/section-391.44)** (an eye specialist completes **Form MCSA-5871**, then the examiner evaluates) replaced the vision exemption program, with certification capped at **12 months**. **Hearing kept its exemption program** — the two senses now travel different paths, and knowing which is which saves months.

**Medical-information disclaimer:** Last reviewed **July 19, 2026**. This is general information, **not medical advice** — vision and hearing are measured at your exam, and only a certified medical examiner (with a specialist's input where 391.44 applies) decides qualification. Confirm current requirements with [FMCSA](https://www.fmcsa.dot.gov/medical). Not affiliated with FMCSA or any clinic.

## The vision standard, unpacked *(federal regulation)*

Three measurable tests at [the DOT physical](/knowledge/health-on-the-road/dot-physical-exam-what-to-expect):

- **Distant acuity:** at least 20/40 (Snellen) in each eye *and* both eyes combined — **corrective lenses count**, so wear them.
- **Field of vision:** at least 70 degrees in the horizontal meridian of each eye.
- **Color:** the ability to recognize the standard red, green, and amber of traffic signals — recognition, not a full color-vision battery.

Meet all three (corrected is fine) and vision is a checkbox on the way to a certificate.

## The 2022 change: individual assessment replaced the vision exemption *(federal regulation)*

Before 2022, a driver who could not meet the standard in one eye needed a **federal vision exemption**. The January 2022 final rule (effective March 22, 2022) **replaced that program** with [391.44](https://www.ecfr.gov/current/title-49/part-391/section-391.44):

1. An **ophthalmologist or optometrist** examines you and completes the **Vision Evaluation Report (Form MCSA-5871)**.
2. A [certified medical examiner](/knowledge/health-on-the-road/finding-a-dot-medical-examiner) then performs the DOT exam — the MCSA-5871 must be recent (the exam ties to a 45-day window from the specialist's signature, mirroring the diabetes path).
3. The examiner makes an **individual assessment** — no federal application queue, no exemption grant to wait for.
4. Certification on this path is capped at **12 months**, so it is an annual rhythm like [391.46 diabetes](/knowledge/health-on-the-road/diabetes-and-the-dot-physical). *(Some drivers new to this path also complete a road test with their carrier under the rule's transition provisions — ask your carrier what applies.)*

If you read older material describing "applying to FMCSA for a vision exemption," it is describing the pre-2022 world. An older grandfathering provision (former § 391.64) once covered vision-waiver study participants, but certificates issued under it were voided after March 22, 2023 and the section has since been removed — it is not a path a driver can use today.

## The hearing standard, unpacked *(federal regulation)*

Either test works, and a **hearing aid is allowed** for both:

- **Forced whisper:** first perceive a forced whispered voice at **not less than 5 feet**, in the better ear; or
- **Audiometric:** average hearing loss in the better ear of **40 dB or less** at 500, 1,000, and 2,000 Hz.

If you use a hearing aid to meet the standard, the certificate reflects that you must wear it while driving — wear it to the exam.

## Hearing kept its exemption program *(federal program — the asymmetry to remember)*

Unlike vision, a driver who cannot meet the hearing standard even aided still applies to **FMCSA's hearing exemption program** — an application reviewed and granted federally, typically in renewable multi-year terms. Deaf and hard-of-hearing drivers hold CDLs today through exactly this path. The mechanics of exemption applications live in the [exemptions and variances guide](/knowledge/health-on-the-road/dot-medical-exemptions-and-variances). *(Vision → individual assessment at the examiner level; hearing → federal exemption program. Two different processes; do not let old articles cross the wires.)*

## A worked illustration (not medical advice)

A driver blind in one eye since childhood reads a 2019 forum post about the "vision exemption backlog" and nearly gives up. Current process instead: an optometrist completes MCSA-5871 on a Tuesday; the following week a registry examiner reviews it, completes the exam, and makes the individual assessment — certifying for 12 months. No federal application, no queue. The annual specialist-plus-exam rhythm is the trade for the streamlined path. *(Illustration of the post-2022 process, not medical advice; outcomes depend on your evaluation.)*

## Common mistakes

- **Testing uncorrected when you own correction.** Glasses, contacts, and hearing aids are allowed — bring and wear them.
- **Following pre-2022 vision advice.** The exemption program is gone; 391.44's individual assessment replaced it. Months of confusion live in that difference.
- **Assuming the hearing path matches the vision path.** It does not — hearing still runs through a federal exemption program.
- **Letting the specialist form go stale.** The MCSA-5871 ties to a 45-day window, like the diabetes form — book the DOT exam promptly.
- **Forgetting the 12-month rhythm.** 391.44 certification is annual; plan the specialist visit and exam as a pair in your [renewal calendar](/knowledge/health-on-the-road/medical-card-renewal-and-self-certification).

## Your vision-and-hearing checklist

- **Correction brought and worn**: glasses/contacts/hearing aids
- Standard-eye numbers known: **20/40 each and both · 70-degree field · signal colors**
- Hearing: **whisper at 5 feet** or **≤40 dB average** in the better ear
- One-eye path: **MCSA-5871 + 391.44 individual assessment**, exam within the window, annual renewals
- Hearing shortfall even aided: a **federal hearing exemption** application is the route

## Keep learning

- The exam: [The DOT Physical: What to Expect](/knowledge/health-on-the-road/dot-physical-exam-what-to-expect) · all thirteen: [DOT Physical Requirements](/knowledge/health-on-the-road/dot-physical-requirements)
- Alternative paths in depth: [Exemptions, Variances, and the SPE Certificate](/knowledge/health-on-the-road/dot-medical-exemptions-and-variances)
- **See the whole licensing road:** [How to Get Your CDL](/knowledge/getting-your-cdl/how-to-get-your-cdl) · [TLWS Academy](/academy) · [CDL Pre-School](/cdl-pre-school) · [newsletter](/#newsletter).$mdx$,
      'Vision and Hearing Standards for the DOT Physical | Trucking Life with Shawn',
      'DOT vision and hearing standards: 20/40 acuity, 70-degree fields, the whisper test, the 2022 shift to 391.44 individual assessment, and hearing exemptions.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"eCFR — 49 CFR 391.41, Physical Qualifications for Drivers","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.41"},
        {"label":"eCFR — 49 CFR 391.44, Physical Qualification Standards for Vision","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.44"},
        {"label":"Federal Register — Qualifications of Drivers; Vision Standard (2022 final rule)","url":"https://www.federalregister.gov/documents/2022/01/21/2022-01021/qualifications-of-drivers-vision-standard"},
        {"label":"FMCSA — Vision Evaluation Report Form (MCSA-5871)","url":"https://www.fmcsa.dot.gov/regulations/medical/vision-evaluation-report-form-mcsa-5871"},
        {"label":"FMCSA — Hearing Standard, 391.41(b)(11)","url":"https://www.fmcsa.dot.gov/regulations/medical/section-ss-39141b11-driver-safety-health-medical-requirements"}
      ]$j$::jsonb,
      $j$[
        {"q":"What is the DOT vision requirement?","a":"49 CFR 391.41(b)(10): distant visual acuity of at least 20/40 in each eye and both eyes combined, with corrective lenses allowed; a field of vision of at least 70 degrees in the horizontal meridian of each eye; and the ability to recognize standard traffic-signal colors. Meet all three — corrected is fine — and vision is a routine part of the exam."},
        {"q":"Can I get a CDL with vision in only one eye?","a":"Since March 2022 there is an individual-assessment path under 49 CFR 391.44 that replaced the old vision exemption program. An ophthalmologist or optometrist completes Form MCSA-5871, then a certified medical examiner performs the DOT exam and makes an individual assessment — no federal exemption application. Certification on this path is capped at 12 months, and the examiner's determination decides each case."},
        {"q":"What is the DOT hearing test?","a":"Either of two tests under 391.41(b)(11), with a hearing aid allowed for both: first perceive a forced whispered voice at not less than 5 feet in the better ear, or show average hearing loss of 40 dB or less in the better ear at 500, 1,000, and 2,000 Hz on audiometry. If a hearing aid is used to qualify, the certificate requires wearing it while driving."},
        {"q":"Is there still a hearing exemption for truck drivers?","a":"Yes — unlike vision, the hearing standard kept its federal exemption program. Drivers who cannot meet the whisper or audiometric test even with a hearing aid can apply to FMCSA for a hearing exemption, granted in renewable terms, and deaf and hard-of-hearing drivers hold CDLs today through that path. Vision and hearing now follow different processes."},
        {"q":"Do glasses or contacts disqualify me from a CDL?","a":"No. The vision standard explicitly allows corrective lenses — 20/40 with correction meets the acuity requirement. Wear your usual correction to the exam. If you qualify with correction, the certificate reflects that you must wear it while driving, the same way a qualifying hearing aid must be worn."}
      ]$j$::jsonb,
      '{health-on-the-road,vision,hearing,391-44,mcsa-5871}',
      9, false, 'published', true, '2026-07-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 7. Exemptions, Variances, and the SPE Certificate
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_med and slug = 'dot-medical-exemptions-and-variances') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_med,
      'dot-medical-exemptions-and-variances',
      'DOT Medical Exemptions, Variances, and the SPE Certificate',
      'Missing a standard as written is the start of a process, not the end of a career. The map of alternative paths — 391.44 and 391.46 regulation paths, the federal exemption programs, the SPE certificate for limb impairments, and the 391.47 dispute process.',
      $mdx$**Quick answer:** When a driver cannot meet a [391.41(b) standard](/knowledge/health-on-the-road/dot-physical-requirements) as written, federal law offers **several distinct alternative paths** — and using the right one matters. **Regulation paths** (no application to FMCSA): [391.44](https://www.ecfr.gov/current/title-49/part-391/section-391.44) individual assessment for **vision**, [391.46](https://www.ecfr.gov/current/title-49/part-391/section-391.46) for **insulin-treated diabetes**. **Federal exemption programs** (application to FMCSA, renewable grants): **hearing** and **seizure** are the prominent ones. **The SPE certificate** ([391.49](https://www.ecfr.gov/current/title-49/part-391/section-391.49)): a Skill Performance Evaluation for **limb loss or impairment**, where demonstrated skill substitutes for the standard. And when two medical opinions genuinely conflict, [391.47](https://www.ecfr.gov/current/title-49/part-391/section-391.47) provides the **dispute-resolution process**. Each path has its own paperwork and rhythm — this page is the map.

**Medical-information disclaimer:** Last reviewed **July 19, 2026**. This is general information, **not medical or legal advice** — whether any path applies to you is decided by certified medical examiners, specialists, and FMCSA's programs under current rules, which change. Confirm details with [FMCSA](https://www.fmcsa.dot.gov/medical) before relying on them. Not affiliated with FMCSA or any clinic.

## First, sort the paths — they are not interchangeable

The word "exemption" gets used loosely in driver conversation for all of these, but the processes differ sharply:

- **Regulation paths** are standing rules — you qualify through specialists and the examiner, with **no application queue**. Vision (391.44, since 2022) and insulin-treated diabetes (391.46, since 2018) both **used to be exemption programs and no longer are** — the two most common wires that old internet advice crosses.
- **Exemption programs** are **federal grants**: you apply to FMCSA, the application is reviewed (public notice is part of the process), and a grant runs for a limited, renewable term. Hearing and seizure are the flagship programs.
- **The SPE certificate** is its own animal — a **skills demonstration** attached to your qualification, historically for limb loss and impairment.
- **391.47** is not a qualification path at all — it is the **referee** when medical evaluations conflict.

## The regulation paths (no FMCSA application)

- **Vision — 391.44:** eye specialist completes **MCSA-5871**, examiner makes the individual assessment, 12-month maximum certificates. Full walkthrough: [Vision and Hearing Standards](/knowledge/health-on-the-road/vision-and-hearing-dot-standards).
- **Insulin-treated diabetes — 391.46:** treating clinician completes **MCSA-5870**, exam within the 45-day window, 12-month maximum. Full walkthrough: [Diabetes and the DOT Physical](/knowledge/health-on-the-road/diabetes-and-the-dot-physical).

If an article tells you to "apply for a federal vision or diabetes exemption," it predates these rules — follow the current regulation path instead.

## The federal exemption programs (application to FMCSA)

- **Hearing:** for drivers who cannot meet the whisper or audiometric standard even aided. Applications are reviewed by FMCSA and granted in renewable terms; deaf and hard-of-hearing drivers hold CDLs through this program today.
- **Seizure:** for individually reviewed cases against the epilepsy/seizure standard — one of the strictest standards as written, with the exemption program as its relief valve.
- **Mechanics to expect:** application with medical evidence, federal review (with public-notice steps), a grant with conditions, and **renewal obligations** — an exemption is a credential with its own expiration, and letting it lapse means stopping. *(Federal program procedures; the specifics and processing rhythms are FMCSA's.)*

## The SPE certificate — skill where the standard measures anatomy

The **Skill Performance Evaluation** under [391.49](https://www.ecfr.gov/current/title-49/part-391/section-391.49) exists for the fixed-deficit standards — **loss or impairment of a limb** — where the safety question is not a fluctuating condition but whether *this driver, with this body and possibly this prosthesis or vehicle modification, can control the vehicle*. The evaluation answers it by demonstration. An SPE certificate rides alongside the medical certificate, with its own terms and renewals, and carriers see plenty of them: drivers with SPEs are a normal part of the industry.

## When medical opinions conflict — 391.47

Driver's clinician says qualified; carrier's examiner disagrees — or the reverse. [391.47](https://www.ecfr.gov/current/title-49/part-391/section-391.47) provides the formal resolution process through FMCSA, weighing the conflicting evaluations. It is deliberate and evidence-driven — slower than examiner-shopping, but it produces an answer that sticks, which examiner-shopping never does.

## A worked illustration (not medical advice)

A driver with a below-knee amputation assumes disqualification; a recruiter mentions the SPE program. The driver completes the medical exam (fine on every other standard), then the SPE process — demonstrating vehicle control with a prosthesis. Certificate plus SPE in hand, the driver runs freight for a carrier that has seen dozens of SPE drivers. Meanwhile a second driver, refused certification over a years-old seizure history his neurologist considers resolved, files through the seizure exemption program with full records rather than trying another exam cold. Two different paths — both of them built for exactly these cases. *(Illustration of the alternative-path landscape, not medical or legal advice; outcomes depend on individual review.)*

## Common mistakes

- **Using pre-2022/pre-2018 advice.** Vision and insulin-treated diabetes are **regulation paths** now, not exemption applications.
- **Not knowing the SPE exists.** Limb loss and impairment have a purpose-built skills path — recruiters and examiners know it; many drivers do not.
- **Letting an exemption lapse.** Federal grants expire on their own schedule, separate from the medical certificate — track both dates.
- **Examiner-shopping instead of 391.47.** Genuine conflicts have a referee; shopping with an incomplete story compounds the problem.
- **Going in without records.** Every path on this page runs on medical evidence — the file you bring is the case you make.

## Your alternative-paths checklist

- The right path identified: **regulation path / exemption program / SPE / 391.47**
- Vision or insulin case? Use **391.44 / 391.46** — no FMCSA application
- Hearing or seizure case? **Exemption program** application with full records
- Limb loss/impairment? Ask about the **SPE certificate** early
- Conflicting opinions? **391.47**, with your clinician's evidence organized
- Every credential's **expiration tracked** — exemptions and SPEs renew on their own clocks

## Keep learning

- The standards these paths serve: [DOT Physical Requirements](/knowledge/health-on-the-road/dot-physical-requirements) · the exam: [What to Expect](/knowledge/health-on-the-road/dot-physical-exam-what-to-expect)
- The specific paths: [Vision and Hearing](/knowledge/health-on-the-road/vision-and-hearing-dot-standards) · [Diabetes](/knowledge/health-on-the-road/diabetes-and-the-dot-physical)
- **Build the career on solid ground:** [TLWS Academy](/academy) · free [CDL Pre-School](/cdl-pre-school) · [join the email list](/#newsletter).$mdx$,
      'DOT Medical Exemptions, Variances, and the SPE Certificate | Trucking Life with Shawn',
      'DOT medical alternative paths mapped: the 391.44 and 391.46 regulation paths, hearing and seizure exemptions, the SPE certificate, and 391.47 disputes.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"eCFR — 49 CFR 391.49, Alternative Physical Qualification Standards (SPE)","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.49"},
        {"label":"eCFR — 49 CFR 391.47, Resolution of Conflicts of Medical Evaluation","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.47"},
        {"label":"eCFR — 49 CFR 391.44, Physical Qualification Standards for Vision","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.44"},
        {"label":"eCFR — 49 CFR 391.46, Physical Qualification Standards for Insulin-Treated Diabetes","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.46"},
        {"label":"FMCSA — Medical Program (exemption programs)","url":"https://www.fmcsa.dot.gov/medical"}
      ]$j$::jsonb,
      $j$[
        {"q":"What is a DOT medical exemption?","a":"A federal grant from FMCSA allowing a driver who cannot meet a specific 391.41 standard to drive interstate under conditions, for a limited renewable term. Hearing and seizure are the prominent current programs. Vision and insulin-treated diabetes are no longer exemption programs — they became standing regulation paths (391.44 in 2022 and 391.46 in 2018) with no FMCSA application required."},
        {"q":"What is an SPE certificate?","a":"A Skill Performance Evaluation certificate under 49 CFR 391.49, for drivers with loss or impairment of a limb. Instead of measuring the driver against the anatomical standard, the SPE process evaluates actual vehicle control — with a prosthesis or vehicle modification where applicable — and issues a certificate that rides alongside the medical certificate with its own terms and renewals."},
        {"q":"How do I dispute a DOT physical result?","a":"Where two medical evaluations genuinely conflict — for example your treating clinician and a carrier's examiner disagree about qualification — 49 CFR 391.47 provides a formal resolution process through FMCSA that weighs the conflicting evidence. It is slower than simply visiting another examiner, but it produces a durable answer, which examiner-shopping does not."},
        {"q":"Is there still a seizure exemption for CDL drivers?","a":"FMCSA operates a seizure exemption program that reviews individual cases against the epilepsy/seizure standard of 391.41(b)(8), one of the strictest standards as written. Applications are reviewed federally with medical evidence and granted for renewable terms with conditions. What the program decides in any one case is its determination — no article can promise an outcome."},
        {"q":"Do medical exemptions expire?","a":"Yes. Exemption grants and SPE certificates run on their own limited terms, separate from the medical certificate itself, and must be renewed on schedule. A lapsed exemption means the driver no longer qualifies under it, so tracking both expiration dates — certificate and exemption — is part of the discipline."}
      ]$j$::jsonb,
      '{health-on-the-road,exemptions,spe-certificate,391-49,391-47}',
      9, false, 'published', true, '2026-07-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 8. Medications and the DOT Physical
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_med and slug = 'medications-and-the-dot-physical') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_med,
      'medications-and-the-dot-physical',
      'Medications and the DOT Physical: How 391.41(b)(12) Works',
      'What the medication clause actually says — the Schedule I bar, the prescribing-practitioner exception, why marijuana remains barred as of this review date, and how examiners weigh any medication against safe operation.',
      $mdx$**Quick answer:** The medication standard — [49 CFR 391.41(b)(12)](https://www.ecfr.gov/current/title-49/part-391/section-391.41) — bars drivers who use **Schedule I substances**, amphetamines, narcotics, or other habit-forming drugs, with one narrow exception: a **non-Schedule-I** substance **prescribed by a licensed medical practitioner who is familiar with the driver's medical history and assigned duties** and has advised that it will not adversely affect safe operation. That exception is the working heart of the rule: many prescriptions are compatible with certification **when the prescriber signs off with your job in view**. **Marijuana:** as of this page's review date it remains **Schedule I federally**, so the exception cannot reach it — state legality and state medical cards change nothing federally — and DOT **drug testing** (a separate program) tests for it regardless. Beyond (b)(12), the examiner also weighs **any** medication's effects — sedation, alertness — under the general standards.

**Medical-information disclaimer:** Last reviewed **July 19, 2026**. This is general information, **not medical advice** — never start, stop, or change medication because of an article; that is a decision for your prescriber. Only a certified medical examiner decides certification, and federal drug scheduling can change — confirm current status with [FMCSA](https://www.fmcsa.dot.gov/medical) and your examiner. Not affiliated with FMCSA or any clinic.

## What the clause actually says *(federal regulation)*

(b)(12) is a bar with an exception, and precision matters:

- **The bar:** no use of a Schedule I controlled substance, amphetamine, narcotic, or other habit-forming drug.
- **The exception:** does **not** apply to Schedule I substances — but for the others, use is permitted when **prescribed by a licensed medical practitioner** who (1) is familiar with the driver's medical history and assigned duties, and (2) has advised the driver that the substance will not adversely affect the ability to safely operate a CMV.

Read that twice, because it is the difference between rumor and rule: the clause does not publish a banned-medication list. It builds a **process** — an informed prescriber standing behind the prescription with your driving duties in view. FMCSA even provides an optional attestation form for that sign-off; asking your prescriber to document it is the practical move.

## Marijuana, precisely *(federal regulation — date-stamped)*

As of **July 19, 2026**, marijuana remains a **Schedule I** substance under federal law, which means: the (b)(12) exception **cannot** apply, a state medical-marijuana card does not change the federal answer, and state-legal recreational use does not either. Two separate federal systems enforce this — the medical standard here, and the [DOT drug-and-alcohol testing program](/knowledge/dot-compliance/drug-alcohol-testing-clearinghouse), which tests for marijuana and reports violations to the Clearinghouse regardless of any medical opinion. **Scheduling is under active federal review** as of this writing; if it changes, what follows for drivers will take time to settle — check the current status with FMCSA rather than a forum. *(What the rules say today is the only safe basis for a decision today.)*

## The exam-room reality: any medication can matter

Beyond (b)(12)'s named categories, [the examiner](/knowledge/health-on-the-road/dot-physical-exam-what-to-expect) evaluates whether **any** medication — prescription or over-the-counter — affects alertness, coordination, or judgment under the general *likely to interfere with safe operation* standards. Sedating antihistamines, sleep aids, muscle relaxers, some anxiety and pain medications: all are conversations, not automatic outcomes. The examiner may certify, certify with a shorter [monitoring period](/knowledge/health-on-the-road/dot-physical-blood-pressure), ask for a prescriber's statement, or in some cases not certify — **their judgment, on your regimen and history**. *(Examiner judgment informed by FMCSA guidance.)*

## How to walk in prepared

- **Complete medication list** — every prescription, dose, prescriber; include regular OTC use.
- **Prescriber statements** for anything in (b)(12) territory or anything sedating — the attestation that the prescriber knows your duties and stands behind the prescription is exactly what the exception contemplates.
- **Disclose everything on the MCSA-5875.** The form carries federal false-statement consequences, and an undisclosed prescription discovered through records or testing is a far worse conversation.
- **Never self-adjust before an exam.** Stopping a medication to "look clean" is a medical decision you are not licensed to make for yourself — and examiners recognize the pattern.

## A worked illustration (not medical advice)

A driver recovering from shoulder surgery is prescribed a short course of a narcotic pain medication. Instead of guessing, the driver: tells the prescriber about the job, gets a written statement addressing safe operation and expected duration, discloses it all on the exam form, and brings the paperwork. The examiner reviews it, discusses timing (driving while actively taking a sedating dose is its own question the prescriber addressed), and certifies with the documentation in the file. The process worked exactly as (b)(12) designs it — prescriber informed, examiner deciding on evidence. *(Illustration of the process, not medical advice; outcomes depend on your evaluation.)*

## Common mistakes

- **Believing in a federal "banned meds list."** (b)(12) publishes a process, not a list — the prescriber's informed sign-off is the mechanism.
- **Treating state marijuana law as the answer.** Federal scheduling controls both the medical standard and drug testing — as of this review date, marijuana remains barred either way.
- **Hiding a prescription.** Disclosure with documentation is the strong position; discovery without it is the weak one.
- **Confusing the physical with the drug test.** The testing program is separate law with separate consequences — a certificate does not immunize a test result.
- **Following forum pharmacology.** Your prescriber knows your case; a thread does not.

## Your medication checklist

- **Full list** written out: drug, dose, prescriber — including OTC
- **Prescriber statement** obtained for anything sedating or in (b)(12) territory
- **Everything disclosed** on the MCSA-5875
- Marijuana status understood: **federally barred as of this review date**, regardless of state law
- The testing program treated as **separate**, with its own rules and consequences
- Zero self-adjustment of medication without your prescriber

## Keep learning

- The exam: [The DOT Physical: What to Expect](/knowledge/health-on-the-road/dot-physical-exam-what-to-expect) · the standards: [DOT Physical Requirements](/knowledge/health-on-the-road/dot-physical-requirements)
- The other federal drug program: [CDL Drug and Alcohol Testing and the Clearinghouse](/knowledge/dot-compliance/drug-alcohol-testing-clearinghouse)
- **Clean career, clean record:** [TLWS Academy](/academy) · free [CDL Pre-School](/cdl-pre-school) · [join the email list](/#newsletter).$mdx$,
      'Medications and the DOT Physical: 391.41(b)(12) | Trucking Life with Shawn',
      'How the DOT medication rule works: the Schedule I bar, the prescribing-practitioner exception, marijuana''s federal status, and examiner review.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"eCFR — 49 CFR 391.41, Physical Qualifications for Drivers (b)(12)","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.41"},
        {"label":"eCFR — 49 CFR 391.43, Medical Examination; Certificate of Physical Examination","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.43"},
        {"label":"FMCSA — Medications and Driver Qualification (no prohibited-medications list)","url":"https://www.fmcsa.dot.gov/regulations/medical/federal-motor-carrier-safety-regulations-fmcsrs-does-not-include-list-prohibited"},
        {"label":"FMCSA — Medical Program","url":"https://www.fmcsa.dot.gov/medical"}
      ]$j$::jsonb,
      $j$[
        {"q":"Is there a list of medications banned for DOT physicals?","a":"No. 49 CFR 391.41(b)(12) does not publish a banned-medication list — it bars Schedule I substances, amphetamines, narcotics, and habit-forming drugs, then provides an exception for non-Schedule-I substances prescribed by a licensed practitioner who knows the driver's medical history and duties and has advised that the substance will not adversely affect safe operation. FMCSA confirms the regulations include no prohibited list; the informed prescriber's sign-off is the mechanism."},
        {"q":"Can I drive a truck while taking prescription pain medication?","a":"It depends on the prescription and the process. Non-Schedule-I narcotics can fall within the (b)(12) exception when prescribed by a practitioner familiar with your history and driving duties who advises they will not adversely affect safe operation — documentation of that advice is the practical key. The examiner weighs the regimen and may certify, ask for prescriber statements, shorten the certificate, or not certify. Never adjust medication yourself to influence an exam."},
        {"q":"Does a medical marijuana card work for DOT physicals?","a":"No. As of this page's review date, marijuana remains Schedule I federally, and the (b)(12) exception explicitly cannot apply to Schedule I substances — state medical cards and state-legal use do not change the federal answer. DOT drug testing, a separate program, also tests for marijuana regardless of medical authorization. Federal scheduling is under active review, so check current status with FMCSA."},
        {"q":"Will over-the-counter medications affect my DOT physical?","a":"They can. Beyond the named categories of (b)(12), the examiner evaluates whether any substance — including OTC sleep aids and sedating antihistamines — affects alertness or safe operation under the general standards. Regular OTC use belongs on your medication list, and timing questions (what you take while actually driving) are worth raising with both prescriber and examiner."},
        {"q":"Should I stop a medication before my DOT physical?","a":"Not on your own. Starting, stopping, or pausing a prescription is a medical decision for your prescriber, and stopping a medication to appear clean at an exam leaves the underlying condition unmanaged — which is what the standards actually target. The strong position is disclosure, a prescriber statement addressing safe operation, and records the examiner can act on."}
      ]$j$::jsonb,
      '{health-on-the-road,medications,391-41-b12,marijuana,prescriptions}',
      9, false, 'published', true, '2026-07-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 9. Renewals, Self-Certification, and Your CDL
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_med and slug = 'medical-card-renewal-and-self-certification') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_med,
      'medical-card-renewal-and-self-certification',
      'Medical Card Renewals, Self-Certification, and Your CDL',
      'The clock that never stops: renewal timing, the four self-certification categories every CDL holder picks with their state, the electronic reporting transition, and how a lapsed medical certificate turns into a downgraded CDL.',
      $mdx$**Quick answer:** Your medical certificate expires — **up to 24 months** after issue, often sooner — and renewing means a **full new [DOT physical](/knowledge/health-on-the-road/dot-physical-exam-what-to-expect)**, not a rubber stamp. Separately, every CDL/CLP holder must **self-certify** one of four operation categories with their state licensing agency under [49 CFR 383.71](https://www.ecfr.gov/current/title-49/part-383/section-383.71): **non-excepted interstate** (most for-hire freight — requires the medical certificate on file), excepted interstate, non-excepted intrastate, or excepted intrastate. Let a required certificate lapse and [383.73](https://www.ecfr.gov/current/title-49/part-383/section-383.73) obligates the state to mark you not-certified and **downgrade the CDL** on its statutory clock. One more moving part: since **June 23, 2025**, exam results flow **electronically** from the National Registry to the states, and CDL/CLP holders are generally **no longer issued the paper card as ongoing proof** — you may present it for only about **15 days** after issuance while the electronic record posts, after which the **state's record is the proof** — so **confirm your state shows you certified**.

**Medical-information disclaimer:** Last reviewed **July 19, 2026**. This is general information, **not medical or legal advice**. Certificate decisions belong to certified medical examiners; state submission mechanics vary and are mid-transition — confirm current requirements with [FMCSA](https://www.fmcsa.dot.gov/medical) and your state licensing agency. Not affiliated with FMCSA or any state agency.

## The renewal clock *(federal regulation)*

[391.45](https://www.ecfr.gov/current/title-49/part-391/section-391.45) requires a current certificate — re-examination when the old one runs out, and **sooner** if an injury or illness has impaired your ability to drive. Three rhythms to know:

- **Standard:** up to 24 months, examiner's discretion to certify shorter.
- **Monitoring:** one-year (or shorter) cards for conditions being watched — [blood pressure](/knowledge/health-on-the-road/dot-physical-blood-pressure) is the classic.
- **12-month-by-rule paths:** [insulin-treated diabetes under 391.46](/knowledge/health-on-the-road/diabetes-and-the-dot-physical) and [vision qualification under 391.44](/knowledge/health-on-the-road/vision-and-hearing-dot-standards) cap at 12 months.

A renewal is a complete exam against all [thirteen standards](/knowledge/health-on-the-road/dot-physical-requirements) — book it **weeks before** expiration so a request for records or a specialist note does not park you.

## The four self-certification categories *(federal regulation, administered by your state)*

Every CDL or CLP holder tells their state licensing agency which kind of driving they do — once at licensing and whenever it changes:

- **Non-excepted interstate (NI):** interstate commerce, full medical-certification requirement — the category for most freight drivers, and the one that ties your medical status to your license.
- **Excepted interstate (EI):** interstate driving that federal rules except from medical certification (specific niches — verify yours actually qualifies before choosing it).
- **Non-excepted intrastate (NA):** in-state-only driving under your state's medical rules.
- **Excepted intrastate (EA):** in-state driving your state excepts.

Choose wrong and problems follow both directions: an NI driver without a current certificate on file faces downgrade; a driver who picked EA to dodge paperwork and then crosses a state line is out of category entirely. *(The categories are federal; the submission workflow is your state's.)*

## The downgrade machinery *(federal regulation)*

For non-excepted interstate drivers, [383.73](https://www.ecfr.gov/current/title-49/part-383/section-383.73) is unsentimental: certificate expires → state records you as **not-certified** → state initiates **CDL downgrade** on the statutory timetable. This is not a carrier policy or a maybe — it is the state doing what federal rule obligates. Recovering a downgraded license means a new exam, paperwork, state processing, and lost working days. The entire mechanism is beaten by a calendar reminder.

## The electronic transition — what changed in 2025 *(federal program, in transition)*

Historically, drivers hand-delivered the paper certificate (Form MCSA-5876) to the licensing agency. Under the National Registry upgrade that took effect **June 23, 2025**, the examiner reports results to FMCSA and FMCSA transmits certification information **electronically to the states**, and CDL/CLP holders are **generally no longer issued the paper certificate as durable proof** — a driver may present it for only the **first 15 days** after issuance while the electronic record posts, after which the **state's electronic record is the proof**. (Non-CDL drivers still receive a paper card.) The practical takeaway is not to memorize the plumbing — it is: **confirm your state's record shows you certified, and keep any paperwork the examiner does give you.** *(Time-sensitive; this paragraph reflects the transition status as of the review date above.)*

## A worked illustration (not medical or legal advice)

A driver's card expires on a Tuesday nobody was watching. Wednesday, the state's not-certified process is already in motion; the carrier's compliance department catches it Thursday and pulls the driver off dispatch. The exam itself, taken Friday, goes fine — but the state's paperwork cycle takes its own time, and the driver spends days parked over a condition-free renewal that a phone reminder ninety days earlier would have made a non-event. *(Illustration of the administrative machinery, not advice; state timelines vary.)*

## Common mistakes

- **Treating expiration like a soft deadline.** The downgrade machinery is automatic — the state is required to act on a lapse.
- **Booking the renewal at the last minute.** A records request or short-term card at the exam leaves no runway if you booked on expiration week.
- **Wrong self-certification category.** NI vs the others determines whether your medical status is tied to your license — verify, don't guess.
- **Assuming the electronic system did it.** Mid-transition, verification beats assumption: confirm your state shows you current.
- **Assuming the paper card is still your durable proof.** For CDL/CLP holders it generally is not after the first 15 days — the state's electronic record is; confirm that record shows you certified.

## Your renewal checklist

- **Expiration date** on two calendars (yours and someone else's) with a 90-day warning
- **Exam booked early** — weeks before expiry, records in hand
- **Self-certification category** verified with the state (NI for most freight)
- **State submission status** confirmed after each exam — electronic or paper, show current
- **Paper certificate** obtained and kept during the transition period
- Shorter-card paths planned as **annual rhythms** (391.44 / 391.46 / monitoring cards)

## Keep learning

- The exam you are renewing: [The DOT Physical: What to Expect](/knowledge/health-on-the-road/dot-physical-exam-what-to-expect) · the credential: [The DOT Medical Card](/knowledge/dot-compliance/dot-medical-card)
- Getting licensed in the first place: [CDL Requirements](/knowledge/getting-your-cdl/cdl-requirements)
- **Career discipline from day one:** [TLWS Academy](/academy) · free [CDL Pre-School](/cdl-pre-school) · [join the email list](/#newsletter).$mdx$,
      'Medical Card Renewals, Self-Certification, and Your CDL | Trucking Life with Shawn',
      'Medical card renewals and the CDL: the renewal clock, the four 383.71 self-certification categories, and how a lapsed certificate becomes a downgrade.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"eCFR — 49 CFR 391.45, Persons Who Must Be Medically Examined and Certified","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.45"},
        {"label":"eCFR — 49 CFR 383.71, Driver Application and Certification Procedures","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.71"},
        {"label":"eCFR — 49 CFR 383.73, State Procedures (medical certification and downgrade)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.73"},
        {"label":"FMCSA — National Registry of Certified Medical Examiners","url":"https://nationalregistry.fmcsa.dot.gov/"},
        {"label":"FMCSA — Medical Program","url":"https://www.fmcsa.dot.gov/medical"}
      ]$j$::jsonb,
      $j$[
        {"q":"How often do I need to renew my DOT medical card?","a":"A medical certificate is valid for up to 24 months, and examiners may issue shorter cards for monitoring — one-year cards are common, and the insulin-treated diabetes (391.46) and vision individual-assessment (391.44) paths cap at 12 months by rule. Renewal means a complete new DOT physical, so book weeks before expiration to leave runway for records requests."},
        {"q":"What are the CDL self-certification categories?","a":"Under 49 CFR 383.71, every CDL or CLP holder certifies one of four operation types with their state: non-excepted interstate (full medical certification tied to the license — most freight drivers), excepted interstate, non-excepted intrastate, and excepted intrastate. The category determines whether your medical status is linked to your CDL, so verify before choosing rather than guessing."},
        {"q":"What happens if my DOT medical card expires?","a":"For non-excepted interstate drivers, 49 CFR 383.73 obligates the state to record you as not-certified and initiate a CDL downgrade on the statutory timetable once the certificate lapses. Recovery requires a new exam plus state processing time, which typically costs working days. A calendar reminder well before expiration defeats the entire mechanism."},
        {"q":"Do I still need to bring my paper medical card to the DMV?","a":"For CDL and CLP holders, usually no. Since June 23, 2025, the examiner reports your results electronically and FMCSA transmits your certification to the state, so drivers are generally no longer issued the paper card as ongoing proof — you may present it for only about 15 days after issuance while the electronic record posts, after which the state's record is the proof. The safe practice is to confirm your state's record shows you certified. Non-CDL drivers still receive a paper card."},
        {"q":"Can I drive while my medical recertification is being processed?","a":"The controlling facts are your certificate's validity and your state record's status — questions of federal rule and state processing, not opinion. If your certificate is current and your state shows you certified, you drive; if either has lapsed, driving a CMV that requires certification is a violation regardless of paperwork in the pipeline. Confirm your status with your carrier and state before dispatch, and build renewal timing so the question never arises."}
      ]$j$::jsonb,
      '{health-on-the-road,medical-card,renewal,self-certification,383-71}',
      9, false, 'published', true, '2026-07-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 10. Finding a Certified Medical Examiner
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_med and slug = 'finding-a-dot-medical-examiner') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_med,
      'finding-a-dot-medical-examiner',
      'Finding a Certified DOT Medical Examiner',
      'Only examiners on FMCSA''s National Registry can perform a DOT physical that counts. How the registry works, how to search and verify a listing before you book, who can be an examiner, and how to choose well when any listing is legal.',
      $mdx$**Quick answer:** A DOT physical only counts when performed by an examiner **certified and listed on FMCSA's National Registry of Certified Medical Examiners** — the requirement of [49 CFR Part 390, Subpart D](https://www.ecfr.gov/current/title-49/part-390) and [391.43](https://www.ecfr.gov/current/title-49/part-391/section-391.43). **Search and verify at [nationalregistry.fmcsa.dot.gov](https://nationalregistry.fmcsa.dot.gov/)** before you book: an exam by an unlisted provider is money spent on a certificate that does not exist. Examiners can be physicians, physician assistants, nurse practitioners, or chiropractors — whatever their state license allows — all trained and tested on the federal standards. **Price and availability are set by clinics, not by regulation**, and whether your carrier pays is company policy. Verified listing first; convenience and cost second.

**Medical-information disclaimer:** Last reviewed **July 19, 2026**. This is general information, **not medical advice**, and it does not recommend any specific examiner or clinic. Registry status can change — verify a listing yourself, close to booking, at the official site. Not affiliated with FMCSA, the National Registry, or any clinic.

## Why the registry exists *(federal regulation)*

Before the National Registry, any licensed medical provider could sign a DOT card, trained on the federal standards or not. The registry — [Part 390, Subpart D](https://www.ecfr.gov/current/title-49/part-390) — changed that: examiners complete **federal training and testing** on the [391.41 standards](/knowledge/health-on-the-road/dot-physical-requirements), are listed publicly, report exam results to FMCSA, and can be audited and removed. When [the exam](/knowledge/health-on-the-road/dot-physical-exam-what-to-expect) decides your career's paperwork, the registry is what makes the decision-maker accountable to the standards they apply.

## Who can be an examiner

**Physicians (MD/DO), physician assistants, nurse practitioners, and chiropractors** — eligibility follows their **state scope of practice**, then federal certification on top. Registry examiners work everywhere from hospital occupational-health departments to chiropractic offices to clinics at truck stops. All apply the same standards with the same forms; experience with *drivers* is the variable worth shopping for.

## How to search — and actually verify

1. Go to **[nationalregistry.fmcsa.dot.gov](https://nationalregistry.fmcsa.dot.gov/)** and use the examiner search by city, state, or ZIP.
2. **Verify the specific person** who will examine you is listed and current — clinics employ multiple providers, and the registry certification belongs to the individual, not the building.
3. Ask the clinic to confirm **which listed examiner** you are booked with.
4. Re-verify if the appointment is far out or the clinic substitutes providers on exam day.

The registry certification is individual and revocable — thirty seconds of verification protects the whole exam.

## Choosing well when every listing is legal

- **Driver volume.** Occupational-health and truck-stop clinics see CDL physicals all day; familiarity with [monitoring-card practice](/knowledge/health-on-the-road/dot-physical-blood-pressure), [391.46 paperwork](/knowledge/health-on-the-road/diabetes-and-the-dot-physical), and carrier processes shows.
- **Paperwork logistics.** Since mid-2025 examiners transmit results into the federal system, and for CDL/CLP holders the [state's electronic record](/knowledge/health-on-the-road/medical-card-renewal-and-self-certification) — not the paper card — is the durable proof; keep whatever the clinic gives you and confirm your state shows you certified.
- **Records handling.** If your case involves specialist forms (MCSA-5870/5871) or prescriber statements, a clinic that reviews them before exam day beats one that discovers them during it.
- **Price and scheduling.** Set by the clinic — comparison shopping is fair game. Whether a **carrier pays** or designates a clinic is company policy; you always retain the right to a listed examiner.

*(All four bullets are practical judgment, not regulation — the only federal requirement is a listed, certified examiner.)*

## A worked illustration (not medical advice)

A new driver books "a DOT physical" at the nearest urgent care from a maps search. Exam day: the provider on shift is not on the National Registry — the clinic's *other* location does DOT work. Out the fee and a morning, the driver rebooks at an occupational-health clinic after verifying the examiner by name on the registry site, brings the prepared records, and walks out with the certificate. The thirty-second search was the difference. *(Illustration of the verification habit, not medical advice.)*

## Common mistakes

- **Booking by proximity alone.** The federal question is *listed or not* — verify before, not after.
- **Verifying the clinic, not the person.** Certification is individual; confirm the examiner you will actually see.
- **Assuming any provider can sign the form.** Pre-registry rules are long gone; unlisted exams do not count.
- **Assuming the paper card is still your proof.** For CDL/CLP holders the state's electronic record is what counts after the first 15 days; keep any paperwork you are given, but verify your state's record shows you certified.
- **Ignoring driver-volume experience.** Any listed examiner is legal; one who processes drivers daily makes complicated cases smoother.

## Your examiner-search checklist

- Examiner **verified by name** at [nationalregistry.fmcsa.dot.gov](https://nationalregistry.fmcsa.dot.gov/), close to booking
- Clinic confirms **which listed examiner** performs your exam
- **Paper certificate** issued same-day — confirmed before booking
- Specialist forms and records **reviewed in advance** where applicable
- Price and carrier-payment status understood *(clinic pricing and company policy — not federal)*
- Exam prep done — the walkthrough and what-to-bring list reviewed

## Keep learning

- The exam itself: [The DOT Physical: What to Expect](/knowledge/health-on-the-road/dot-physical-exam-what-to-expect) · the standards: [DOT Physical Requirements](/knowledge/health-on-the-road/dot-physical-requirements)
- Keep it current: [Renewals, Self-Certification, and Your CDL](/knowledge/health-on-the-road/medical-card-renewal-and-self-certification)
- **Start the career right:** [TLWS Academy](/academy) · free [CDL Pre-School](/cdl-pre-school) · [practice tests](/practice-tests) · [join the email list](/#newsletter).$mdx$,
      'Finding a Certified DOT Medical Examiner | Trucking Life with Shawn',
      'Only National Registry examiners can perform a DOT physical that counts. How to search and verify a listing, who can be an examiner, and how to choose.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"FMCSA — National Registry of Certified Medical Examiners","url":"https://nationalregistry.fmcsa.dot.gov/"},
        {"label":"eCFR — 49 CFR Part 390, Subpart D (National Registry)","url":"https://www.ecfr.gov/current/title-49/part-390"},
        {"label":"eCFR — 49 CFR 391.43, Medical Examination; Certificate of Physical Examination","url":"https://www.ecfr.gov/current/title-49/part-391/section-391.43"},
        {"label":"FMCSA — Medical Program","url":"https://www.fmcsa.dot.gov/medical"}
      ]$j$::jsonb,
      $j$[
        {"q":"How do I verify a DOT medical examiner is certified?","a":"Search the official registry at nationalregistry.fmcsa.dot.gov and confirm the individual provider — not just the clinic — appears with a current listing. Certification under 49 CFR Part 390 Subpart D belongs to the person, clinics employ multiple providers, and listings can change, so verify the specific examiner you are booked with close to the appointment. An exam by an unlisted provider does not produce a valid certificate."},
        {"q":"How do I find a DOT medical examiner near me?","a":"Search the official registry at nationalregistry.fmcsa.dot.gov by city, state, or ZIP code. Then verify the specific examiner you will see — certification belongs to the individual provider, not the clinic — and ask the clinic to confirm which listed examiner you are booked with. Re-verify close to the appointment if it was booked far in advance."},
        {"q":"How much does a DOT physical cost?","a":"Prices are set by clinics, not by federal regulation, and vary by market and provider type — occupational-health clinics, chiropractic offices, urgent cares, and truck-stop clinics all compete. Comparison shopping among listed examiners is fair game. Whether your carrier pays for the exam, or designates a clinic, is company policy rather than federal rule."},
        {"q":"Can a chiropractor do a DOT physical?","a":"Yes, in states whose scope-of-practice rules allow it — chiropractors who complete the federal training and testing and are listed on the National Registry perform DOT physicals under the same standards and forms as any other listed examiner. The federal requirement is registry listing, not a specific degree."},
        {"q":"Do I get my medical certificate the same day as the exam?","a":"When the examiner certifies you, a Medical Examiner's Certificate (Form MCSA-5876) is typically provided at the visit, and the examiner also reports your results into the federal system. For CDL and CLP holders the paper card is proof only for about 15 days after issuance while the electronic record posts — after that the state's record is what counts, so confirm your state shows you certified."}
      ]$j$::jsonb,
      '{health-on-the-road,medical-examiner,national-registry,dot-physical,booking}',
      8, false, 'published', true, '2026-07-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- Related-article rows (within-cluster + cross-cluster where present)
  ---------------------------------------------------------------------------
  declare
    m1  uuid; m2  uuid; m3  uuid; m4  uuid; m5  uuid;
    m6  uuid; m7  uuid; m8  uuid; m9  uuid; m10 uuid;
    x_card uuid; x_clr uuid; x_req uuid;
  begin
    select id into m1  from public.kc_articles where category_id = v_med and slug = 'dot-physical-exam-what-to-expect';
    select id into m2  from public.kc_articles where category_id = v_med and slug = 'dot-physical-requirements';
    select id into m3  from public.kc_articles where category_id = v_med and slug = 'dot-physical-blood-pressure';
    select id into m4  from public.kc_articles where category_id = v_med and slug = 'diabetes-and-the-dot-physical';
    select id into m5  from public.kc_articles where category_id = v_med and slug = 'sleep-apnea-and-the-dot-physical';
    select id into m6  from public.kc_articles where category_id = v_med and slug = 'vision-and-hearing-dot-standards';
    select id into m7  from public.kc_articles where category_id = v_med and slug = 'dot-medical-exemptions-and-variances';
    select id into m8  from public.kc_articles where category_id = v_med and slug = 'medications-and-the-dot-physical';
    select id into m9  from public.kc_articles where category_id = v_med and slug = 'medical-card-renewal-and-self-certification';
    select id into m10 from public.kc_articles where category_id = v_med and slug = 'finding-a-dot-medical-examiner';
    select id into x_card from public.kc_articles where category_id = v_dot and slug = 'dot-medical-card';
    select id into x_clr  from public.kc_articles where category_id = v_dot and slug = 'drug-alcohol-testing-clearinghouse';
    select id into x_req  from public.kc_articles where category_id = v_gyc and slug = 'cdl-requirements';

    insert into public.kc_related (article_id, related_id, sort_order) values
      (m1, m2, 1), (m1, m10, 2), (m1, m9, 3),
      (m2, m1, 1), (m2, m6, 2), (m2, m7, 3),
      (m3, m1, 1), (m3, m2, 2), (m3, m9, 3),
      (m4, m1, 1), (m4, m2, 2), (m4, m7, 3),
      (m5, m1, 1), (m5, m2, 2), (m5, m9, 3),
      (m6, m2, 1), (m6, m7, 2), (m6, m1, 3),
      (m7, m2, 1), (m7, m6, 2), (m7, m4, 3),
      (m8, m1, 1), (m8, m2, 2), (m8, m9, 3),
      (m9, m1, 1), (m9, m3, 2), (m9, m10, 3),
      (m10, m1, 1), (m10, m9, 2), (m10, m2, 3)
    on conflict (article_id, related_id) do nothing;

    -- cross-cluster: bridge the pillar, medications, and renewal pages to the
    -- established compliance/licensing pages where those exist
    if x_card is not null then
      insert into public.kc_related (article_id, related_id, sort_order) values
        (m1, x_card, 4)
      on conflict (article_id, related_id) do nothing;
    end if;
    if x_clr is not null then
      insert into public.kc_related (article_id, related_id, sort_order) values
        (m8, x_clr, 4)
      on conflict (article_id, related_id) do nothing;
    end if;
    if x_req is not null then
      insert into public.kc_related (article_id, related_id, sort_order) values
        (m9, x_req, 4)
      on conflict (article_id, related_id) do nothing;
    end if;
  end;
end $kc$;

-- ---------------------------------------------------------------------------
-- Cross-links INTO the new cluster from three existing pages (guarded,
-- slug-scoped, replace-based, idempotent — same doctrine as 038/040/042:
-- presence guard on the target text + absence guard on the new link, so a
-- re-run is a no-op and nothing else in the body can be touched).
-- ---------------------------------------------------------------------------

-- 1. The DOT Medical Card (Batch 2) → the new pillar: the exam-steps section
--    now hands readers to the full exam walkthrough.
update public.kc_articles a set body_mdx = replace(
    a.body_mdx,
    'and the rest of the listed categories.',
    'and the rest of the listed categories. The full appointment, step by step: [The DOT Physical: What to Expect](/knowledge/health-on-the-road/dot-physical-exam-what-to-expect).')
from public.kc_categories c
where c.id = a.category_id and c.slug = 'dot-compliance'
  and a.slug = 'dot-medical-card'
  and a.body_mdx like '%and the rest of the listed categories.%'
  and a.body_mdx not like '%/knowledge/health-on-the-road/dot-physical-exam-what-to-expect%';

-- 2. How to Get Your CDL (Batch 3 pillar) → the new pillar: step two of the
--    licensing sequence now links what the physical itself looks like.
update public.kc_articles a set body_mdx = replace(
    a.body_mdx,
    'Full details: [The DOT Medical Card](/knowledge/dot-compliance/dot-medical-card).',
    'Full details: [The DOT Medical Card](/knowledge/dot-compliance/dot-medical-card). What the appointment itself looks like: [The DOT Physical: What to Expect](/knowledge/health-on-the-road/dot-physical-exam-what-to-expect).')
from public.kc_categories c
where c.id = a.category_id and c.slug = 'getting-your-cdl'
  and a.slug = 'how-to-get-your-cdl'
  and a.body_mdx like '%Full details: [The DOT Medical Card](/knowledge/dot-compliance/dot-medical-card).%'
  and a.body_mdx not like '%/knowledge/health-on-the-road/dot-physical-exam-what-to-expect%';

-- 3. Home Time and Quality of Life (Batch 4) → the sleep-apnea page: the
--    health-and-rest section now bridges into the medical cluster.
update public.kc_articles a set body_mdx = replace(
    a.body_mdx,
    'A schedule that never lets you rest properly isn''t sustainable no matter what it pays.',
    'A schedule that never lets you rest properly isn''t sustainable no matter what it pays — and untreated sleep problems have a medical-certification side too: [Sleep Apnea and the DOT Physical](/knowledge/health-on-the-road/sleep-apnea-and-the-dot-physical).')
from public.kc_categories c
where c.id = a.category_id and c.slug = 'trucking-careers'
  and a.slug = 'home-time-and-quality-of-life'
  and a.body_mdx like '%A schedule that never lets you rest properly isn''t sustainable no matter what it pays.%'
  and a.body_mdx not like '%/knowledge/health-on-the-road/sleep-apnea-and-the-dot-physical%';
