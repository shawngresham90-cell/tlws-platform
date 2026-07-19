-- 046_seed_kc_hazmat_articles.sql
-- Knowledge Center Batch 6 — Hazmat Knowledge cluster (10 authority pages)
-- in a NEW 'hazmat-knowledge' category (created here, guarded).
--
-- ⚠️ COMMITTED; apply AFTER 015 (schema), 038 (Batch 2), and 040 (Batch 3) —
-- the cross-link update block at the end touches three getting-your-cdl bodies.
-- IDEMPOTENT AND NON-DESTRUCTIVE: the category inserts only if its slug is
-- absent; every article inserts ONLY when no article with the same
-- (category, slug) exists; kc_related rows insert with ON CONFLICT DO NOTHING;
-- the cross-link UPDATEs are guarded (slug- and category-scoped, substring
-- replacement, skipped when the link is already present). This migration
-- NEVER edits an existing category or article except the three guarded
-- cross-links, and leaves RLS, IDs, and every existing row untouched.
--
-- Content rules (hard, same as 037/038/040/042/045, with hazmat discipline):
--   * Original wording only. Official primary sources only: 49 CFR Parts
--     171-180 (via eCFR), PHMSA, FMCSA, TSA, and the DOT Emergency Response
--     Guidebook — cited per claim and listed in `sources`.
--   * NO invented fees, penalties, or pass rates. TSA/PHMSA fees change and
--     are pointed to, never hardcoded. Regulation vs agency guidance vs
--     carrier policy vs worked example are labeled in-text.
--   * NO "you will pass/fail" promises; the knowledge test and the TSA
--     security threat assessment are described as processes with the agency
--     as decision-maker.
--   * Regulatory-change disclaimer + last-reviewed date on every page;
--     reg_verified = true, reg_verified_date 2026-07-19.
--   * Slugs are stable identifiers.

do $kc$
declare
  v_haz uuid;
  v_gyc uuid;
  v_dot uuid;
  v_pub timestamptz := '2026-07-19 17:00:00+00';
  v_bio text := 'CDL-A driver and instructor — 17 years driving, zero violations. Founder of Trucking Life with Shawn and the TLWS truck driving school in Dalton, Georgia.';
begin
  -- Create the hazmat-knowledge category if it does not already exist.
  insert into public.kc_categories (slug, name, description, icon, sort_order, is_active, meta_description)
  select
    'hazmat-knowledge',
    'Hazmat Knowledge',
    'The H endorsement and the rules behind it — placards, shipping papers, the ERG, segregation, security, and registration, in plain English.',
    'hazard',
    7,
    true,
    'Hazmat for truck drivers: the H endorsement, placards, shipping papers, the Emergency Response Guidebook, segregation, security plans, and registration.'
  where not exists (select 1 from public.kc_categories where slug = 'hazmat-knowledge');

  select id into v_haz from public.kc_categories where slug = 'hazmat-knowledge';
  select id into v_gyc from public.kc_categories where slug = 'getting-your-cdl';
  select id into v_dot from public.kc_categories where slug = 'dot-compliance';
  if v_haz is null then
    raise exception 'Knowledge Center category hazmat-knowledge missing after insert';
  end if;

  ---------------------------------------------------------------------------
  -- 1. How to Pass the Hazmat Endorsement Test (cluster pillar)
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_haz and slug = 'how-to-pass-the-hazmat-endorsement-test') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_haz,
      'how-to-pass-the-hazmat-endorsement-test',
      'How to Pass the Hazmat Endorsement Test',
      'The H endorsement takes two separate tracks that run at once — a written knowledge test on the hazmat rules and a TSA security threat assessment — plus ELDT theory for first-timers. What each one covers and how to prepare for both.',
      $mdx$**Quick answer:** The **hazardous materials (H) endorsement** requires **two things at once**: passing a **written knowledge test** on the hazmat rules ([49 CFR 383.121](https://www.ecfr.gov/current/title-49/part-383/section-383.121)) and clearing a **TSA security threat assessment** — a fingerprint-based background check under [49 CFR Part 1572](https://www.ecfr.gov/current/title-49/part-1572). First-time H applicants must also complete **ELDT hazmat theory** from a registered provider before the state may give the knowledge test ([49 CFR Part 380](https://www.ecfr.gov/current/title-49/part-380)). The knowledge test comes from the hazmat section of your state **CDL manual**; the security check and its fee run through TSA. Start the TSA application early — it can take weeks. Drill the material with free [hazmat practice tests](/practice-tests/hazmat).

**Regulatory-change disclaimer:** Last reviewed **July 19, 2026**. Hazmat rules (49 CFR Parts 171–180), the TSA assessment ([Part 1572](https://www.ecfr.gov/current/title-49/part-1572)), and their fees change. Confirm the current rules on the [eCFR](https://www.ecfr.gov/current/title-49) and the process with [TSA](https://www.tsa.gov/for-industry/hazmat-endorsement) and your state licensing agency. This is general information, not legal advice.

## What the H endorsement actually is

The **H endorsement** is the authority to drive a vehicle carrying **placardable amounts** of hazardous materials. It rides on your CDL and is governed by [49 CFR 383.93](https://www.ecfr.gov/current/title-49/part-383/section-383.93). Unlike tank (N) or doubles/triples (T), which are knowledge-only, **H uniquely adds a federal security check** — so it is the one endorsement where passing the test is only half the job. *(Federal requirement.)*

## The two tracks, run in parallel

- **Track 1 — the knowledge test.** A written exam drawn from your state CDL manual's hazmat section, covering the rules summarized across this cluster: [placards](/knowledge/hazmat-knowledge/hazmat-placards-explained), [shipping papers](/knowledge/hazmat-knowledge/shipping-papers-explained), [the Emergency Response Guidebook](/knowledge/hazmat-knowledge/the-emergency-response-guidebook), [loading and segregation](/knowledge/hazmat-knowledge/hazmat-load-segregation-rules), and security. *(Federal knowledge standard, 383.121; state-administered.)*
- **Track 2 — the TSA security threat assessment.** A fingerprint-based background check under [49 CFR Part 1572](https://www.ecfr.gov/current/title-49/part-1572) — the same standard behind the process explained in [The TSA Threat Assessment Process](/knowledge/hazmat-knowledge/tsa-threat-assessment-process). You apply through TSA's enrollment provider, pay TSA's fee, and wait for a determination. *(Federal security requirement.)*

Because Track 2 can take weeks, the practical move is to **start the TSA application first** and study for the knowledge test while it processes.

## ELDT theory comes first for first-timers

If this is your **first-ever hazmat endorsement**, federal **Entry-Level Driver Training** rule requires you to complete the **hazmat theory** curriculum from a provider on FMCSA's [Training Provider Registry](https://tpr.fmcsa.dot.gov/) *before* the state may administer the knowledge test ([49 CFR Part 380](https://www.ecfr.gov/current/title-49/part-380)). H is **theory only** — there is no behind-the-wheel requirement for the endorsement itself. Background on the rule: [Entry-Level Driver Training](/knowledge/getting-your-cdl/eldt-requirements). *(Federal requirement.)*

## How to prepare for the knowledge test

1. **Read the hazmat section of your state CDL manual** end to end — it is the source the test is written from.
2. **Learn the systems, not trivia:** how the [Hazardous Materials Table](/knowledge/hazmat-knowledge/hazmat-table-explained) drives everything, when placards are required, what a complete shipping paper contains, and how to use the Emergency Response Guidebook.
3. **Drill with practice questions** until the vocabulary is automatic — free [hazmat practice tests](/practice-tests/hazmat).
4. **Understand the driver's role:** placarding, paperwork, segregation, and incident response are the day-one responsibilities the test targets.

*(The manual is the authority; practice tests are a study aid, not the exam.)*

## A worked example (not legal advice)

A driver already holding a CDL wants to haul fuel, so needs **X** (tank + hazmat). Week one: they enroll in ELDT hazmat theory with a TPR-listed provider and start the TSA application online. Weeks two–four: they study the manual's hazmat section and drill practice tests while TSA processes the background check. Once the ELDT theory is recorded and TSA issues a favorable determination, they pass the state's hazmat and tank knowledge tests and the state adds the endorsements. The gating item was the **TSA timeline**, not the studying — which is why it went first. *(Illustration of the sequence, not a promise; your state's steps and timing vary.)*

## Common mistakes

- **Starting the TSA check last.** It is usually the longest step; start it first.
- **Skipping ELDT theory.** For a first-time H, the state cannot test you until registered-provider theory is recorded.
- **Studying only practice questions.** They reinforce the manual; they do not replace it.
- **Assuming H can ride on a permit.** It cannot — H is not available on a CLP.
- **Letting the endorsement lapse.** The TSA assessment must be renewed on its cycle to keep H.

## Your hazmat-endorsement checklist

- ELDT hazmat theory (first-timers) booked with a [TPR](https://tpr.fmcsa.dot.gov/) provider
- TSA security threat assessment **application started early**
- State CDL manual hazmat section read in full
- Practice tests drilled until fluent — [start here](/practice-tests/hazmat)
- Knowledge test scheduled once theory is recorded
- Renewal cycle for the TSA assessment noted

## Keep learning

- The rules the test covers: [Hazmat Placards](/knowledge/hazmat-knowledge/hazmat-placards-explained) · [Shipping Papers](/knowledge/hazmat-knowledge/shipping-papers-explained) · [The ERG](/knowledge/hazmat-knowledge/the-emergency-response-guidebook) · [Segregation Rules](/knowledge/hazmat-knowledge/hazmat-load-segregation-rules)
- The security side: [The TSA Threat Assessment Process](/knowledge/hazmat-knowledge/tsa-threat-assessment-process) · [Hazmat Endorsement Requirements](/knowledge/hazmat-knowledge/hazmat-endorsement-requirements)
- **Study free:** [hazmat practice tests](/practice-tests/hazmat) · [TLWS Academy](/academy) · [CDL Pre-School](/cdl-pre-school) · [the newsletter](/#newsletter). More on your CDL YouTube channel at [Trucking Life with Shawn](https://youtu.be/PDeJF0CMoUw).$mdx$,
      'How to Pass the Hazmat Endorsement Test | Trucking Life with Shawn',
      'How to get the hazmat (H) endorsement: the written knowledge test, the TSA security threat assessment, and ELDT theory for first-timers — and how to prepare for each.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"eCFR — 49 CFR 383.93, Endorsements and Restrictions","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.93"},
        {"label":"eCFR — 49 CFR 383.121, Requirements for Hazardous Materials Endorsement","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.121"},
        {"label":"eCFR — 49 CFR Part 1572, Credentialing and Security Threat Assessments","url":"https://www.ecfr.gov/current/title-49/part-1572"},
        {"label":"TSA — Hazardous Materials Endorsement Threat Assessment Program","url":"https://www.tsa.gov/for-industry/hazmat-endorsement"},
        {"label":"eCFR — 49 CFR Part 380, Entry-Level Driver Training","url":"https://www.ecfr.gov/current/title-49/part-380"}
      ]$j$::jsonb,
      $j$[
        {"q":"What does the hazmat endorsement require?","a":"Two things at once: passing a written knowledge test on the hazmat rules (49 CFR 383.121) and clearing a TSA security threat assessment, a fingerprint-based background check under 49 CFR Part 1572. First-time applicants must also complete ELDT hazmat theory from a registered provider before the state may give the knowledge test. The endorsement is governed by 49 CFR 383.93."},
        {"q":"How long does the hazmat endorsement take to get?","a":"The knowledge test itself is a single sitting, but the TSA security threat assessment can take several weeks to process, and first-timers must finish ELDT hazmat theory before testing. Because the TSA check is usually the longest step, the practical approach is to start that application first and study for the knowledge test while it processes."},
        {"q":"Is there a driving (behind-the-wheel) test for hazmat?","a":"No. The hazmat endorsement is theory only — for first-timers, ELDT requires the hazmat theory curriculum from a registered provider, but there is no separate behind-the-wheel test for H. You demonstrate knowledge of the rules on the written test and clear the TSA background check; there is no skills-test component for the endorsement itself."},
        {"q":"Can I add hazmat to a commercial learner's permit?","a":"No. The hazmat (H) endorsement cannot be issued on a CLP — it is added to a full CDL. First-timers also need registered-provider ELDT hazmat theory recorded before the state administers the knowledge test, and the TSA security threat assessment must return a favorable determination before the endorsement is granted."},
        {"q":"Does the X (tank plus hazmat) endorsement also need the TSA check?","a":"Yes. X is the combined code for tank vehicles plus hazardous materials — the authority a fuel hauler needs — and because it includes the H (hazmat) authority, it carries the same TSA security threat assessment requirement. You still pass the underlying tank and hazmat knowledge tests; X simply reflects holding both authorities on one CDL."}
      ]$j$::jsonb,
      '{hazmat-knowledge,endorsement,tsa,eldt,knowledge-test}',
      9, true, 'published', true, '2026-07-19', v_pub
    );
  end if;


  ---------------------------------------------------------------------------
  -- 2. Hazmat Endorsement Requirements
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_haz and slug = 'hazmat-endorsement-requirements') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_haz,
      'hazmat-endorsement-requirements',
      'Hazmat Endorsement Requirements: Who Needs H and What It Takes',
      'When federal rule requires the H endorsement, who is eligible, the knowledge test and TSA security threat assessment behind it, and the renewal cycle — the requirements, separate from how to study for the test.',
      $mdx$**Quick answer:** You need the **hazardous materials (H) endorsement** to drive a vehicle that requires **hazmat placards** ([49 CFR 383.93](https://www.ecfr.gov/current/title-49/part-383/section-383.93)). Getting it requires **U.S. citizenship or lawful status**, passing the **hazmat knowledge test** ([383.121](https://www.ecfr.gov/current/title-49/part-383/section-383.121)), and clearing a **TSA security threat assessment** under [49 CFR Part 1572](https://www.ecfr.gov/current/title-49/part-1572) — which screens **criminal history, immigration status, and mental capacity**. First-time applicants also complete **ELDT hazmat theory**. The endorsement is renewed on the **TSA assessment's cycle** (generally up to five years). Certain criminal convictions are **disqualifying** under Part 1572.

**Regulatory-change disclaimer:** Last reviewed **July 19, 2026**. The endorsement rules (49 CFR Part 383), the security threat assessment ([Part 1572](https://www.ecfr.gov/current/title-49/part-1572)), and disqualifying-offense lists change. Confirm current requirements on the [eCFR](https://www.ecfr.gov/current/title-49) and with [TSA](https://www.tsa.gov/for-industry/hazmat-endorsement) and your state. Not legal advice.

## When you must have H

The trigger is **placards**. If the shipment requires hazmat placards under [Part 172 Subpart F](https://www.ecfr.gov/current/title-49/part-172/subpart-F), the driver must hold the H (or X) endorsement. Hauling smaller, non-placardable quantities generally does not require H — but the [Hazardous Materials Table](/knowledge/hazmat-knowledge/hazmat-table-explained) and the [placarding rules](/knowledge/hazmat-knowledge/hazmat-placards-explained) decide that, not a guess. *(Federal requirement.)*

## Who is eligible

- **Lawful status.** Under [Part 1572](https://www.ecfr.gov/current/title-49/part-1572), applicants must be a U.S. citizen or national, or a lawful permanent resident or other eligible non-citizen category. *(Federal requirement.)*
- **No disqualifying offense.** Part 1572 lists **permanent** and **interim** disqualifying criminal offenses (for example certain terrorism, espionage, explosives, and violent felonies). A conviction in those categories bars the endorsement. *(Federal requirement.)*
- **Mental capacity and immigration checks** are part of the same assessment.

## The two requirements behind the letter

1. **Knowledge test.** State-administered, drawn from the CDL manual's hazmat section ([383.121](https://www.ecfr.gov/current/title-49/part-383/section-383.121)). How to prepare: [How to Pass the Hazmat Endorsement Test](/knowledge/hazmat-knowledge/how-to-pass-the-hazmat-endorsement-test).
2. **TSA security threat assessment.** The fingerprint-based background check under [Part 1572](https://www.ecfr.gov/current/title-49/part-1572), explained step by step in [The TSA Threat Assessment Process](/knowledge/hazmat-knowledge/tsa-threat-assessment-process). *(Federal requirements.)*

First-time H applicants must also finish **ELDT hazmat theory** from a [registered provider](https://tpr.fmcsa.dot.gov/) before the state may test them ([Part 380](https://www.ecfr.gov/current/title-49/part-380)).

## Renewal and keeping the endorsement

The security threat assessment is not permanent. To keep H, you **renew the TSA assessment on its cycle** — generally up to **five years**, though states may set the endorsement's own validity — and re-verify as your state requires. Let the assessment lapse and the endorsement goes with it. *(Federal framework; state renewal mechanics vary.)*

## A worked example (not legal advice)

A driver moving from dry van to fuel hauling checks the load: it requires placards, so H (as part of X) is mandatory. They confirm eligibility (citizen, no disqualifying offense), start the TSA assessment, complete ELDT hazmat theory, and pass the knowledge test. Five years later, a renewal notice for the TSA assessment arrives; they reapply before it expires so the endorsement never lapses. *(Illustration of the requirements, not a promise; verify specifics with your state and TSA.)*

## Common mistakes

- **Assuming any hazmat load needs H.** Only **placardable** amounts trigger the endorsement.
- **Not checking disqualifying offenses first.** Part 1572 lists them; check before paying fees.
- **Forgetting the renewal.** The TSA assessment expires; a lapse drops the endorsement.
- **Confusing H with registration.** The [PHMSA registration](/knowledge/hazmat-knowledge/hazmat-registration-requirements) of a company is a different obligation from a driver's endorsement.

## Your requirements checklist

- Load actually requires **placards** (endorsement is triggered)
- **Eligibility** confirmed (lawful status, no disqualifying offense)
- **ELDT hazmat theory** done (first-timers)
- **Knowledge test** passed
- **TSA security threat assessment** cleared
- **Renewal date** for the TSA assessment recorded

## Keep learning

- The how-to: [How to Pass the Hazmat Endorsement Test](/knowledge/hazmat-knowledge/how-to-pass-the-hazmat-endorsement-test) · the security check, [The TSA Threat Assessment Process](/knowledge/hazmat-knowledge/tsa-threat-assessment-process)
- What the load requires: [The Hazmat Table](/knowledge/hazmat-knowledge/hazmat-table-explained) · [Hazmat Placards Explained](/knowledge/hazmat-knowledge/hazmat-placards-explained)
- Where H sits among the letters: [CDL Endorsements and Restrictions](/knowledge/getting-your-cdl/cdl-endorsements-restrictions) · drill it free: [hazmat practice tests](/practice-tests/hazmat) · [TLWS Academy](/academy) · [CDL Pre-School](/cdl-pre-school) · [the newsletter](/#newsletter).$mdx$,
      'Hazmat Endorsement Requirements: Who Needs H | Trucking Life with Shawn',
      'Hazmat (H) endorsement requirements: when placards trigger it, eligibility and disqualifying offenses under 49 CFR Part 1572, the knowledge test and TSA check, and renewal.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"eCFR — 49 CFR 383.93, Endorsements and Restrictions","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.93"},
        {"label":"eCFR — 49 CFR 383.121, Requirements for Hazardous Materials Endorsement","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.121"},
        {"label":"eCFR — 49 CFR Part 1572, Credentialing and Security Threat Assessments","url":"https://www.ecfr.gov/current/title-49/part-1572"},
        {"label":"TSA — Hazardous Materials Endorsement Threat Assessment Program","url":"https://www.tsa.gov/for-industry/hazmat-endorsement"}
      ]$j$::jsonb,
      $j$[
        {"q":"Who needs a hazmat endorsement?","a":"Any driver operating a vehicle that requires hazardous materials placards under 49 CFR Part 172 needs the H (or X) endorsement. The trigger is placards — set by the material and quantity via the Hazardous Materials Table and the placarding rules — not simply carrying any hazardous material. Non-placardable quantities generally do not require the endorsement."},
        {"q":"What disqualifies you from a hazmat endorsement?","a":"49 CFR Part 1572 lists permanent and interim disqualifying criminal offenses — including certain terrorism, espionage, sedition, explosives, and violent felony convictions — as well as failing the immigration or mental-capacity checks. A conviction in a listed category bars the endorsement. Because the lists are specific, check Part 1572 before applying and paying fees."},
        {"q":"How often do you renew a hazmat endorsement?","a":"The endorsement depends on the TSA security threat assessment, which is generally valid for up to five years, though states may set the endorsement's own validity period. To keep H you must renew the TSA assessment before it expires and re-verify as your state requires; if the assessment lapses, the endorsement is lost until you clear a new one."},
        {"q":"Do you need to be a U.S. citizen for a hazmat endorsement?","a":"You must be a U.S. citizen or national, a lawful permanent resident, or fall within another eligible non-citizen category defined in 49 CFR Part 1572. The TSA security threat assessment verifies immigration status as part of the check, so lawful status is a core eligibility requirement for the H endorsement."},
        {"q":"Is the hazmat endorsement the same as company hazmat registration?","a":"No. The H endorsement is a driver credential on a CDL. PHMSA hazmat registration under 49 CFR Part 107 Subpart G is a separate obligation on companies that offer or transport certain hazardous materials. A driver can hold H while the carrier separately handles its registration; the two are different requirements."}
      ]$j$::jsonb,
      '{hazmat-knowledge,endorsement,requirements,tsa,renewal}',
      9, false, 'published', true, '2026-07-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 3. Hazmat Placards Explained
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_haz and slug = 'hazmat-placards-explained') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_haz,
      'hazmat-placards-explained',
      'Hazmat Placards Explained: When and How They Go On',
      'The diamond-shaped placards on a hazmat load are a federal code, not decoration. What they mean, the two placarding tables that decide when they are required, where they go, and the driver''s responsibility.',
      $mdx$**Quick answer:** **Placards** are the ~10¾-inch **square-on-point (diamond)** signs that identify a load's hazard class, required by [49 CFR Part 172 Subpart F](https://www.ecfr.gov/current/title-49/part-172/subpart-F). Whether a shipment needs them is decided by **two tables** in [172.504](https://www.ecfr.gov/current/title-49/part-172/section-172.504): **Table 1** materials require placards in **any amount**; **Table 2** materials require them once the total is **1,001 pounds (454 kg) or more** aggregate gross weight. Placards go on **all four sides** of the vehicle and must match the hazard class on the [shipping paper](/knowledge/hazmat-knowledge/shipping-papers-explained). The driver must refuse a load that is placarded wrong.

**Regulatory-change disclaimer:** Last reviewed **July 19, 2026**. Placarding rules (49 CFR Part 172, Subparts E–F) change. Confirm current tables and specifications on the [eCFR](https://www.ecfr.gov/current/title-49/part-172) and with [PHMSA](https://www.phmsa.dot.gov/). Not legal advice.

## What a placard tells you

A placard encodes three things at a glance: the **hazard class or division number** (bottom corner), a **symbol** (top corner), and often a **color** tied to the hazard (red for flammable, orange for explosive, and so on). Some placards also show the four-digit **UN/NA identification number** for the specific material. The point is fast recognition — for responders, inspectors, and you. *(Federal framework, Part 172 Subpart F.)*

## The two tables that decide "placard or not"

- **Table 1 (172.504).** The highest-hazard categories — including **Explosives 1.1–1.3, Poison Inhalation Hazard (PIH) materials, and certain others** — require placards in **any quantity**. *(Federal requirement.)*
- **Table 2 (172.504).** Most other hazard classes require placards only when the **aggregate gross weight** of all Table 2 hazmat on the vehicle reaches **1,001 lb (454 kg) or more**. Below that, placards are generally not required (with exceptions). *(Federal requirement.)*

This threshold is exactly what triggers the [H endorsement](/knowledge/hazmat-knowledge/hazmat-endorsement-requirements): a **placarded** load requires it.

## Where placards go and what they must look like

- **All four sides** — front, rear, and both sides of the vehicle ([172.504](https://www.ecfr.gov/current/title-49/part-172/section-172.504)).
- **Square-on-point**, at least **250 mm (9.84 in)** on each side, durable and weather-resistant, with specified colors and format ([172.519](https://www.ecfr.gov/current/title-49/part-172/section-172.519)).
- **Readable and unobstructed**, away from other markings, and matching the material's hazard class. *(Federal specifications.)*

## Placard the right hazard

The hazard class comes from the [Hazardous Materials Table](/knowledge/hazmat-knowledge/hazmat-table-explained) and appears on the **shipping paper**. When a material has a **subsidiary hazard**, additional placards may be required. Some placards use the specific **ID number** on an orange panel or across the placard. When in doubt, the shipper's description on the paperwork and the regulation govern — never the driver's guess. *(Federal requirement; shipper describes, driver verifies.)*

## The driver's responsibility

You are not the shipper, but you are the last check. Confirm the **placards match the shipping papers**, that they are on **all four sides**, and that they are **legible and secure**. If a required placard is missing or wrong, **do not move the load** until it is corrected — a mis-placarded vehicle is an out-of-service and enforcement risk. *(Driver duty.)*

## A worked example (not legal advice)

A driver is handed a load with a single flammable-liquid placard on the rear only. Checking the shipping paper, the material is a Table 2 flammable liquid over 1,001 lb — so placards are required on **all four sides**, not one. The driver has the shipper add the missing three before leaving. Ten minutes at the dock avoids a roadside out-of-service. *(Illustration of the driver check, not a rule citation for any specific load.)*

## Common mistakes

- **Placarding one side.** All four sides are required.
- **Ignoring the 1,001-lb aggregate.** For Table 2, it is the **total** of all such hazmat on the vehicle, not per package.
- **Mismatched placards.** They must match the hazard class on the shipping paper.
- **Missing a Table 1 material.** Those need placards in **any** amount — no threshold.
- **Moving a mis-placarded load.** Fix it first; do not drive it.

## Your placard checklist

- Placards match the **hazard class on the shipping paper**
- Present on **all four sides**, legible and secure
- Table 1 material placarded in **any** amount
- Table 2 aggregate **1,001 lb+** correctly triggered
- Subsidiary-hazard placards added where required

## Keep learning

- Where the class comes from: [The Hazmat Table](/knowledge/hazmat-knowledge/hazmat-table-explained) · what rides with the load, [Shipping Papers Explained](/knowledge/hazmat-knowledge/shipping-papers-explained)
- When things go wrong: [The Emergency Response Guidebook](/knowledge/hazmat-knowledge/the-emergency-response-guidebook) · the endorsement behind it all, [How to Pass the Hazmat Endorsement Test](/knowledge/hazmat-knowledge/how-to-pass-the-hazmat-endorsement-test)
- **Drill it free:** [hazmat practice tests](/practice-tests/hazmat) · [TLWS Academy](/academy) · [CDL Pre-School](/cdl-pre-school) · [the newsletter](/#newsletter).$mdx$,
      'Hazmat Placards Explained: When and How They Go On | Trucking Life with Shawn',
      'How hazmat placards work: the two placarding tables in 49 CFR 172.504, the 1,001-lb rule, all-four-sides placement, and matching placards to the papers.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"eCFR — 49 CFR Part 172 Subpart F, Placarding","url":"https://www.ecfr.gov/current/title-49/part-172/subpart-F"},
        {"label":"eCFR — 49 CFR 172.504, General Placarding Requirements","url":"https://www.ecfr.gov/current/title-49/part-172/section-172.504"},
        {"label":"eCFR — 49 CFR 172.519, General Specifications for Placards","url":"https://www.ecfr.gov/current/title-49/part-172/section-172.519"},
        {"label":"PHMSA — Hazardous Materials Safety","url":"https://www.phmsa.dot.gov/hazmat"}
      ]$j$::jsonb,
      $j$[
        {"q":"When are hazmat placards required?","a":"Two tables in 49 CFR 172.504 decide. Table 1 materials — the highest-hazard categories such as Explosives 1.1 through 1.3 and Poison Inhalation Hazard materials — require placards in any amount. Table 2 materials require placards only when the aggregate gross weight of all such hazmat on the vehicle reaches 1,001 pounds (454 kg) or more."},
        {"q":"How many sides of a truck need placards?","a":"All four: the front, the rear, and both sides of the vehicle, under 49 CFR 172.504. A common and citable error is placarding only the rear. The placards must also be square-on-point (diamond), at least 250 mm (9.84 inches) per side, legible, durable, and matched to the material's hazard class."},
        {"q":"What does the 1,001-pound rule mean for placards?","a":"For Table 2 hazard classes, placards become required once the aggregate gross weight of all such hazardous materials on the vehicle reaches 1,001 pounds (454 kg) or more — it is the combined total, not a per-package figure. Below that threshold, Table 2 materials generally do not require placards, though exceptions exist."},
        {"q":"What do I do if a load is placarded wrong?","a":"Do not move it. As the driver you are the final check that placards match the hazard class on the shipping paper, appear on all four sides, and are legible and secure. If a required placard is missing or incorrect, have it corrected before leaving; driving a mis-placarded vehicle is an out-of-service condition and an enforcement risk."},
        {"q":"Do placards show what the material is?","a":"They show the hazard class or division by number, a symbol, and a color, and some placards also display the four-digit UN/NA identification number for the specific material. Combined with the shipping paper, that is enough for responders and inspectors to identify the hazard and look it up in the Emergency Response Guidebook."}
      ]$j$::jsonb,
      '{hazmat-knowledge,placards,172,marking,driver-duty}',
      9, false, 'published', true, '2026-07-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 4. Shipping Papers Explained
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_haz and slug = 'shipping-papers-explained') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_haz,
      'shipping-papers-explained',
      'Hazmat Shipping Papers Explained',
      'The shipping paper is the document that tells everyone — driver, inspector, responder — exactly what is on the truck. The required entries, the emergency information and phone number, and where the paper must be kept.',
      $mdx$**Quick answer:** A hazmat **shipping paper** describes the regulated material on the truck, in a required format set by [49 CFR Part 172 Subpart C](https://www.ecfr.gov/current/title-49/part-172/subpart-C). The **basic description** must include, in order, the **UN/NA identification number, proper shipping name, hazard class/division, and packing group** ([172.202](https://www.ecfr.gov/current/title-49/part-172/section-172.202)), plus quantity and number of packages. It must carry **emergency response information** ([Subpart G](https://www.ecfr.gov/current/title-49/part-172/subpart-G)) and a monitored **24-hour emergency phone number** ([172.604](https://www.ecfr.gov/current/title-49/part-172/section-172.604)), and a **shipper's certification** ([172.204](https://www.ecfr.gov/current/title-49/part-172/section-172.204)). The driver must keep it **within reach and clearly identifiable** ([177.817](https://www.ecfr.gov/current/title-49/part-177/section-177.817)).

**Regulatory-change disclaimer:** Last reviewed **July 19, 2026**. Shipping-paper rules (49 CFR Part 172 Subparts C and G; Part 177) change. Confirm current requirements on the [eCFR](https://www.ecfr.gov/current/title-49/part-172) and with [PHMSA](https://www.phmsa.dot.gov/). Not legal advice.

## What the shipping paper is for

It is the **single source of truth** for what is on the truck. Inspectors use it to verify placards and loading; emergency responders use it to identify the hazard and act; the driver uses it to confirm the load matches. If the paperwork and the load disagree, something is wrong. *(Federal framework, Part 172 Subpart C.)*

## The basic description — in the right order

The core entry (the "basic description") must appear in this sequence under [172.202](https://www.ecfr.gov/current/title-49/part-172/section-172.202):

1. **Identification number** (UN or NA, four digits)
2. **Proper shipping name** (from the [Hazmat Table](/knowledge/hazmat-knowledge/hazmat-table-explained))
3. **Hazard class or division** number
4. **Packing group** (I, II, or III) where assigned

Then the **total quantity** and number/type of packages. Additional words like "RQ," "Marine Pollutant," or technical names may be required depending on the material. *(Federal requirement.)*

## Emergency information and the 24-hour number

Every hazmat shipping paper must be accompanied by **emergency response information** ([Subpart G](https://www.ecfr.gov/current/title-49/part-172/subpart-G)) — the immediate hazards, response steps, and precautions, often supplied via the [Emergency Response Guidebook](/knowledge/hazmat-knowledge/the-emergency-response-guidebook) guide number or an equivalent document — and a **24-hour emergency telephone number** that is **monitored the whole time the material is in transit** ([172.604](https://www.ecfr.gov/current/title-49/part-172/section-172.604)). A number that goes to voicemail does not satisfy the rule. *(Federal requirement.)*

## The shipper's certification

The shipper signs a **certification** ([172.204](https://www.ecfr.gov/current/title-49/part-172/section-172.204)) stating the shipment is properly classed, described, packaged, marked, and labeled and is in condition for transport. It is the shipper's legal attestation — but the driver still verifies the load matches before accepting it. *(Federal requirement; shipper certifies, driver verifies.)*

## Where the paper must be kept

Under [177.817](https://www.ecfr.gov/current/title-49/part-177/section-177.817), while driving the shipping paper must be **within immediate reach** (and readable without leaving the seat) or in a **holder on the driver's door**; when not at the controls, in that holder or on the seat. It must be **clearly distinguished** from other paperwork — tabbed or on top — so a responder can find it fast if the driver cannot point to it. *(Federal requirement.)*

## A worked example (not legal advice)

An officer at a scale asks for the shipping papers. The driver hands over a tabbed sheet whose basic description reads, in order, the ID number, proper shipping name, class, and packing group, with the emergency phone at the top and the ERG guide number noted. The placards match the class listed. The inspection moves quickly because the **paper, the placards, and the load all agree**. *(Illustration of a clean paper, not a template for any specific shipment.)*

## Common mistakes

- **Wrong entry order.** ID number, proper shipping name, class, packing group — in that sequence.
- **Dead emergency number.** It must be monitored while the material is in transit, not a voicemail.
- **Buried paperwork.** It must be within reach and clearly identifiable, not mixed into a stack.
- **Accepting a mismatch.** If placards or load do not match the paper, do not take it.
- **No emergency information.** Subpart G data must accompany the paper.

## Your shipping-paper checklist

- Basic description in the **right order** (ID#, name, class, packing group)
- Quantity and package count present
- **Emergency response information** included
- **24-hour phone** number listed and monitored
- **Shipper's certification** signed
- Paper **within reach** and clearly identifiable

## Keep learning

- Where the description comes from: [The Hazmat Table](/knowledge/hazmat-knowledge/hazmat-table-explained) · the signs it drives, [Hazmat Placards Explained](/knowledge/hazmat-knowledge/hazmat-placards-explained)
- Using the emergency data: [The Emergency Response Guidebook](/knowledge/hazmat-knowledge/the-emergency-response-guidebook) · the endorsement, [How to Pass the Hazmat Endorsement Test](/knowledge/hazmat-knowledge/how-to-pass-the-hazmat-endorsement-test)
- **Study it free:** [hazmat practice tests](/practice-tests/hazmat) · [TLWS Academy](/academy) · [CDL Pre-School](/cdl-pre-school) · [the newsletter](/#newsletter).$mdx$,
      'Hazmat Shipping Papers Explained | Trucking Life with Shawn',
      'What a hazmat shipping paper needs: the basic description order (ID number, name, class, packing group), emergency info and 24-hour phone, and where to keep it.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"eCFR — 49 CFR Part 172 Subpart C, Shipping Papers","url":"https://www.ecfr.gov/current/title-49/part-172/subpart-C"},
        {"label":"eCFR — 49 CFR 172.202, Description of Hazardous Material on Shipping Papers","url":"https://www.ecfr.gov/current/title-49/part-172/section-172.202"},
        {"label":"eCFR — 49 CFR 172.604, Emergency Response Telephone Number","url":"https://www.ecfr.gov/current/title-49/part-172/section-172.604"},
        {"label":"eCFR — 49 CFR 177.817, Shipping Paper Requirements (Carriage by Highway)","url":"https://www.ecfr.gov/current/title-49/part-177/section-177.817"}
      ]$j$::jsonb,
      $j$[
        {"q":"What must a hazmat shipping paper include?","a":"A basic description in a required order under 49 CFR 172.202 — UN/NA identification number, proper shipping name, hazard class or division, and packing group — plus total quantity and package count. It must also carry emergency response information under Subpart G and a monitored 24-hour emergency telephone number, and bear the shipper's certification under 172.204."},
        {"q":"What order do the shipping-paper entries go in?","a":"The basic description sequence is: identification number (UN or NA), proper shipping name, hazard class or division, then packing group where assigned. Additional required words — such as RQ or a technical name — appear as the material demands. Getting the order right is a common exam and inspection point under 49 CFR 172.202."},
        {"q":"Does the emergency phone number on a shipping paper have to be answered?","a":"Yes. Under 49 CFR 172.604 the 24-hour emergency telephone number must be monitored at all times the hazardous material is in transit, by someone who knows the hazards or has immediate access to that information. A number that only reaches voicemail does not meet the requirement."},
        {"q":"Where does a driver keep hazmat shipping papers?","a":"Under 49 CFR 177.817, while at the controls the paper must be within immediate reach and readable without leaving the seat, or in a holder on the driver's door; when not at the controls, in that door holder or on the driver's seat. It must be clearly distinguishable from other documents so responders can find it quickly."},
        {"q":"Who is responsible if the shipping paper is wrong?","a":"The shipper certifies that the shipment is properly described, classed, packaged, and labeled under 172.204, so the shipper bears that legal responsibility. But the driver is the final check and should not accept a load whose placards or contents do not match the paper — accepting an obvious mismatch puts the driver and carrier at risk too."}
      ]$j$::jsonb,
      '{hazmat-knowledge,shipping-papers,172,emergency-info,driver-duty}',
      9, false, 'published', true, '2026-07-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 5. The Emergency Response Guidebook
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_haz and slug = 'the-emergency-response-guidebook') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_haz,
      'the-emergency-response-guidebook',
      'The Emergency Response Guidebook (ERG): How to Use It',
      'The orange ERG is the first tool at a hazmat incident. What its color-coded sections do, how to go from a placard or ID number to the right response, and the driver''s role before responders arrive.',
      $mdx$**Quick answer:** The **Emergency Response Guidebook (ERG)** is the free reference published by **PHMSA** (with Transport Canada and Mexico's SCT) that first responders and drivers use in the first minutes of a hazmat incident. You go from an **ID number** (yellow section) or **proper shipping name** (blue section) to a **guide number**, then read that **guide** (orange section) for hazards, protective clothing, fire and spill actions, and first aid. The **green section** gives **initial isolation and protective-action distances** for toxic-inhalation and water-reactive materials. It is a **first-response** tool, not a cleanup manual — the driver's job is to protect life, call for help, and hand responders the [shipping papers](/knowledge/hazmat-knowledge/shipping-papers-explained).

**Regulatory-change disclaimer:** Last reviewed **July 19, 2026**. The ERG is reissued periodically (the 2024 edition is current at review time). Use the latest edition and confirm requirements with [PHMSA](https://www.phmsa.dot.gov/hazmat/erg/emergency-response-guidebook-erg). Not legal advice.

## What the ERG is

The ERG is a pocket-to-glovebox guidebook mapping thousands of materials to a manageable set of **response guides**. It is designed for the **first 30 minutes** of an incident, before technical experts and cleanup crews arrive. PHMSA distributes it free and reissues it about every four years. *(Agency-published reference.)*

## The four color sections

- **Yellow** — materials listed **by ID number** (the four-digit UN/NA number), each pointing to a guide number.
- **Blue** — the same materials listed **by proper shipping name**, for when you have the name but not the number.
- **Orange** — the **numbered response guides** themselves: potential hazards (health, fire/explosion), public-safety steps, protective clothing, evacuation, and emergency actions for fire, spill/leak, and first aid.
- **Green** — **initial isolation and protective-action distances** for materials that are **toxic by inhalation (TIH/PIH)** or water-reactive (which produce toxic gases), including day-vs-night distances. *(Reference structure.)*

## How to use it, step by step

1. From the **placard, shipping paper, or ID number**, look the material up in **yellow** (by number) or **blue** (by name).
2. Note the **guide number** it points to.
3. Turn to that **orange** guide and read the hazards and actions.
4. If the entry is **highlighted** (or the guide directs you), go to the **green** section for **isolation and protective-action distances**.
5. **Isolate the area, deny entry, and call** — then give responders the shipping papers. *(How-to; the guidebook and responders govern the actual response.)*

## The driver's role — and its limits

Your job at an incident is **not** to be the hazmat team. It is to **protect yourself and the public**, **move to safety and upwind/uphill** where appropriate, **call 911 and the emergency number** on the shipping paper, and **give responders the paperwork and ERG guide number**. Do not attempt cleanup or firefighting beyond what is safe and trained. The ERG's green-section distances exist precisely because some materials require **large evacuations**. *(Driver duty and safety limit.)*

## A worked example (not legal advice)

A trailer develops a leak from a drum placarded with an ID number. The driver stops upwind, keeps bystanders back, and calls 911 and the shipping paper's 24-hour number. Looking the ID number up in the ERG's **yellow** section gives a guide; the guide is highlighted, so the driver checks the **green** section for the initial isolation distance and relays it to the dispatcher. When the fire department arrives, the driver hands over the **shipping papers** and points to the guide number. The driver never touched the leak. *(Illustration of first-response steps, not incident-specific instructions.)*

## Common mistakes

- **Using an old edition.** Guides and distances change; carry the current ERG.
- **Trying to fix it.** The driver isolates and calls — responders handle the hazard.
- **Skipping the green section.** For TIH/water-reactive materials, isolation distances matter most.
- **Not finding the papers.** Responders need the shipping paper and guide number immediately.
- **Standing downwind.** Position upwind and uphill where you can.

## Your ERG checklist

- **Current-edition** ERG in the cab
- Can find a material by **ID number (yellow)** and **name (blue)**
- Can read an **orange guide** for hazards and actions
- Know when to use **green** isolation distances
- Incident plan: protect life, **isolate, call, hand over papers**

## Keep learning

- What points you into it: [Hazmat Placards Explained](/knowledge/hazmat-knowledge/hazmat-placards-explained) · [Shipping Papers Explained](/knowledge/hazmat-knowledge/shipping-papers-explained)
- Loading it safely in the first place: [Hazmat Load Segregation Rules](/knowledge/hazmat-knowledge/hazmat-load-segregation-rules) · the endorsement, [How to Pass the Hazmat Endorsement Test](/knowledge/hazmat-knowledge/how-to-pass-the-hazmat-endorsement-test)
- **Practice free:** [hazmat practice tests](/practice-tests/hazmat) · [TLWS Academy](/academy) · [CDL Pre-School](/cdl-pre-school) · [the newsletter](/#newsletter).$mdx$,
      'The Emergency Response Guidebook (ERG): How to Use It | Trucking Life with Shawn',
      'How to use the DOT Emergency Response Guidebook: the yellow, blue, orange, and green sections, going from an ID number to the response, and the driver''s role.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"PHMSA — Emergency Response Guidebook (ERG)","url":"https://www.phmsa.dot.gov/hazmat/erg/emergency-response-guidebook-erg"},
        {"label":"eCFR — 49 CFR Part 172 Subpart G, Emergency Response Information","url":"https://www.ecfr.gov/current/title-49/part-172/subpart-G"},
        {"label":"eCFR — 49 CFR 172.602, Emergency Response Information Required","url":"https://www.ecfr.gov/current/title-49/part-172/section-172.602"},
        {"label":"PHMSA — Hazardous Materials Safety","url":"https://www.phmsa.dot.gov/hazmat"}
      ]$j$::jsonb,
      $j$[
        {"q":"What is the Emergency Response Guidebook?","a":"The ERG is a free first-response reference published by PHMSA with Transport Canada and Mexico's SCT. It maps hazardous materials to a set of numbered response guides so drivers and first responders can act in the first minutes of an incident. It is reissued about every four years, and the 2024 edition is current at the time of review."},
        {"q":"What do the ERG color sections mean?","a":"Yellow lists materials by four-digit ID number, blue lists them by proper shipping name, and both point to a guide number. Orange holds the numbered response guides — hazards, protective clothing, fire, spill, and first-aid actions. Green gives initial isolation and protective-action distances for toxic-inhalation and water-reactive materials, including day and night distances."},
        {"q":"How do I use the ERG at a hazmat incident?","a":"Get the ID number or name from the placard or shipping paper, look it up in yellow (by number) or blue (by name) to find the guide number, then read that orange guide. If the entry is highlighted or the guide directs you, use the green section for isolation and protective-action distances. Then isolate the area, call for help, and give responders the papers."},
        {"q":"Is the driver supposed to clean up a hazmat spill?","a":"No. The driver's role is to protect life, move to safety upwind and uphill where possible, keep people away, call 911 and the shipping paper's 24-hour number, and hand responders the shipping papers and ERG guide number. Cleanup and firefighting are for trained responders; the green-section distances exist because some materials require large evacuations."},
        {"q":"Do truck drivers have to carry the ERG?","a":"Hazmat shipments must be accompanied by emergency response information under 49 CFR Part 172 Subpart G, and the ERG guide is a common way to satisfy that for the materials on board. Carrying a current-edition ERG in the cab is standard practice so the required information is immediately available to the driver and to responders."}
      ]$j$::jsonb,
      '{hazmat-knowledge,erg,emergency-response,phmsa,incident}',
      9, false, 'published', true, '2026-07-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 6. Hazmat Load Segregation Rules
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_haz and slug = 'hazmat-load-segregation-rules') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_haz,
      'hazmat-load-segregation-rules',
      'Hazmat Load Segregation Rules',
      'Some hazardous materials cannot ride together. How the federal segregation table works, what its codes mean, and the general loading, bracing, and handling rules that keep a mixed hazmat load safe.',
      $mdx$**Quick answer:** Certain hazardous materials **cannot be loaded, transported, or stored together** because they react dangerously. The federal **segregation table** in [49 CFR 177.848](https://www.ecfr.gov/current/title-49/part-177/section-177.848) sets which hazard classes must be kept apart. Its codes are simple: a **blank** means no restriction, an **"O"** means the materials must be **kept "away from"** each other, an **"X"** means they **may not be loaded or transported together** at all, and an **asterisk** points to added rules for explosives. On top of the table, general rules in [177.834](https://www.ecfr.gov/current/title-49/part-177/section-177.834) require secure **blocking and bracing** and safe handling. When in doubt, keep incompatible classes apart.

**Regulatory-change disclaimer:** Last reviewed **July 19, 2026**. Segregation and loading rules (49 CFR Part 177) change. Confirm the current table and provisions on the [eCFR](https://www.ecfr.gov/current/title-49/part-177) and with [PHMSA](https://www.phmsa.dot.gov/). Not legal advice.

## Why segregation exists

Mixed hazmat loads can turn one problem into a catastrophe: an oxidizer next to a flammable, an acid next to a cyanide, materials that together produce toxic gas or fire. The **segregation table** encodes decades of chemistry into a grid of hazard classes so a loader does not have to be a chemist. *(Federal framework, 177.848.)*

## Reading the segregation table

The table crosses hazard **classes and divisions** against each other. At each intersection:

- **Blank** — no specific segregation required by the table (other rules may still apply).
- **"O"** — keep the materials **"away from"** one another (separated so they cannot interact in an incident, per the defined spacing).
- **"X"** — the materials **may not be loaded, transported, or stored together**.
- **"\*"** — see the **additional explosives** segregation requirements referenced by the table.

You find each material's class from the [Hazardous Materials Table](/knowledge/hazmat-knowledge/hazmat-table-explained) and the [shipping paper](/knowledge/hazmat-knowledge/shipping-papers-explained), then check the intersection. *(Federal requirement.)*

## General loading and handling rules

Beyond the table, [177.834](https://www.ecfr.gov/current/title-49/part-177/section-177.834) and related sections require that packages be **secured against shifting** (blocking and bracing), handled carefully, and — for many flammables and explosives — kept away from **smoking and ignition sources**. Some classes (like certain explosives and poisons) carry **extra loading, attendance, or routing** rules. *(Federal requirements.)*

## The driver's role

You are usually not the loader, but you are responsible for the vehicle you drive. Confirm the load is **secured**, that obviously incompatible placarded materials are **not mixed against the table**, and that nothing is leaking. If the segregation looks wrong, **do not haul it** until it is corrected. *(Driver duty.)*

## A worked example (not legal advice)

A driver is asked to add a few packages of an oxidizer to a trailer already holding a flammable liquid. Checking the classes on the papers and the segregation table, the intersection shows a restriction. The driver has the packages **reloaded to comply** — separated as the table requires, or moved to another trailer — before leaving. The two minutes with the table prevented a reactive-cargo hazard. *(Illustration of using the table, not a ruling for any specific pair of materials.)*

## Common mistakes

- **Ignoring the table on mixed loads.** Check every incompatible-looking pair.
- **Confusing "O" and "X."** "O" means separated; "X" means not together at all.
- **Poor blocking and bracing.** Shifting packages can breach containment.
- **Ignoring ignition sources.** Flammables and explosives have handling limits.
- **Assuming it is only the shipper's problem.** The driver hauls the risk.

## Your segregation checklist

- Each material's **class** identified from the papers
- Incompatible pairs checked against the **177.848 table**
- **"X"** pairs never loaded together; **"O"** pairs kept "away from"
- Packages **blocked and braced** against shifting
- **Ignition-source** and class-specific rules observed
- Anything unclear **corrected before departure**

## Keep learning

- Where the classes come from: [The Hazmat Table](/knowledge/hazmat-knowledge/hazmat-table-explained) · [Hazmat Placards Explained](/knowledge/hazmat-knowledge/hazmat-placards-explained)
- If something goes wrong: [The Emergency Response Guidebook](/knowledge/hazmat-knowledge/the-emergency-response-guidebook) · the endorsement, [How to Pass the Hazmat Endorsement Test](/knowledge/hazmat-knowledge/how-to-pass-the-hazmat-endorsement-test)
- **Get exam-ready free:** [hazmat practice tests](/practice-tests/hazmat) · [TLWS Academy](/academy) · [CDL Pre-School](/cdl-pre-school) · [the newsletter](/#newsletter).$mdx$,
      'Hazmat Load Segregation Rules | Trucking Life with Shawn',
      'How hazmat segregation works: the 49 CFR 177.848 table and its blank/O/X codes, the general blocking-and-bracing and handling rules, and the driver''s duty on mixed loads.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"eCFR — 49 CFR 177.848, Segregation of Hazardous Materials","url":"https://www.ecfr.gov/current/title-49/part-177/section-177.848"},
        {"label":"eCFR — 49 CFR 177.834, General Loading and Unloading Requirements","url":"https://www.ecfr.gov/current/title-49/part-177/section-177.834"},
        {"label":"eCFR — 49 CFR Part 177, Carriage by Public Highway","url":"https://www.ecfr.gov/current/title-49/part-177"},
        {"label":"PHMSA — Hazardous Materials Safety","url":"https://www.phmsa.dot.gov/hazmat"}
      ]$j$::jsonb,
      $j$[
        {"q":"What are hazmat segregation rules?","a":"They are federal rules in 49 CFR 177.848 that keep incompatible hazardous materials apart because they can react dangerously together — for example an oxidizer with a flammable, or an acid with a cyanide. A segregation table crosses hazard classes against each other and tells you which combinations must be separated or may not travel together at all."},
        {"q":"What do the segregation table codes mean?","a":"A blank means the table requires no specific segregation for that pair. An O means the materials must be kept away from each other with the defined separation. An X means they may not be loaded, transported, or stored together at all. An asterisk points to additional segregation requirements for explosives referenced by the table."},
        {"q":"What is the difference between away from and not loaded together?","a":"O — away from — means the materials may ride on the same vehicle but must be separated so they cannot interact in an incident, per the rule's spacing. X — may not be loaded or transported together — means the two materials cannot be on the same vehicle at all. Confusing the two is a common and dangerous error on mixed loads."},
        {"q":"Who is responsible for hazmat segregation on the truck?","a":"The shipper and loader arrange the load, but the driver is responsible for the vehicle in transit. A driver should confirm the load is secured and that obviously incompatible placarded materials are not mixed against the 177.848 table, and should refuse to haul a load whose segregation looks wrong until it is corrected."},
        {"q":"Do segregation rules cover load securement too?","a":"Segregation itself is about which materials can ride together, but the general loading rules in 49 CFR 177.834 require packages to be secured against shifting through blocking and bracing and handled safely, and add ignition-source and class-specific limits. Together they keep a mixed hazmat load from becoming a reactive or spilled-cargo hazard."}
      ]$j$::jsonb,
      '{hazmat-knowledge,segregation,loading,177,driver-duty}',
      9, false, 'published', true, '2026-07-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 7. TSA Threat Assessment Process
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_haz and slug = 'tsa-threat-assessment-process') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_haz,
      'tsa-threat-assessment-process',
      'The TSA Threat Assessment Process for Hazmat',
      'The security check that stands between you and the H endorsement. What TSA reviews, the disqualifying offenses, how to apply, how long it lasts, and the appeal and waiver options if you are denied.',
      $mdx$**Quick answer:** Before a state can grant the **hazmat (H) endorsement**, you must clear a **TSA security threat assessment** under [49 CFR Part 1572](https://www.ecfr.gov/current/title-49/part-1572). It is a **fingerprint-based background check** that reviews your **criminal history, immigration status, and mental capacity**. You apply through **TSA's enrollment provider**, submit fingerprints and documents, and pay **TSA's fee**. Certain convictions are **permanently** or **temporarily disqualifying** ([1572.103](https://www.ecfr.gov/current/title-49/part-1572/section-1572.103)). A favorable result is generally valid for **up to five years**. If denied, there are **appeal and waiver** rights ([1572.141](https://www.ecfr.gov/current/title-49/part-1572/section-1572.141)).

**Regulatory-change disclaimer:** Last reviewed **July 19, 2026**. The assessment rules ([Part 1572](https://www.ecfr.gov/current/title-49/part-1572)), disqualifying-offense lists, fees, and enrollment providers change. Confirm the current process with [TSA](https://www.tsa.gov/for-industry/hazmat-endorsement) and the [eCFR](https://www.ecfr.gov/current/title-49/part-1572). Not legal advice.

## Why the check exists

The hazmat endorsement is the one CDL endorsement tied to **national security**: a placarded load can be dangerous in the wrong hands. Congress directed TSA to screen applicants, and [Part 1572](https://www.ecfr.gov/current/title-49/part-1572) is the result — the same threat-assessment standard behind the TWIC credential. *(Federal security requirement.)*

## What TSA reviews

- **Criminal history** — via fingerprint-based FBI records, against the **permanent** and **interim** disqualifying offense lists in [1572.103](https://www.ecfr.gov/current/title-49/part-1572/section-1572.103).
- **Immigration status** — you must be a U.S. citizen or national, lawful permanent resident, or other eligible category.
- **Mental capacity** — an adjudication of lacking mental capacity can be disqualifying.

*(Federal criteria.)*

## Disqualifying offenses

Part 1572 splits disqualifiers into **permanent** (for example espionage, sedition, terrorism, treason, and certain explosives and weapons offenses) and **interim** (a longer list — such as certain felonies within a look-back period — that bars the endorsement for a set time after conviction or release). Because the categories are specific, **read [1572.103](https://www.ecfr.gov/current/title-49/part-1572/section-1572.103) before applying** if your record is a question. *(Federal requirement.)*

## How to apply

1. Start the application with **TSA's enrollment provider** (online, then an in-person visit).
2. Provide **fingerprints and identity/immigration documents**.
3. Pay **TSA's fee** (set by TSA; confirm the current amount).
4. TSA runs the checks and issues a **determination** to your state, which then adds the endorsement after you pass the knowledge test.

Because processing can take **weeks**, start this **before** studying is finished. *(Process; TSA and the state govern timing.)*

## How long it lasts, and renewal

A favorable determination is generally valid for **up to five years**. To keep H you **renew before it expires**; a lapse means reapplying and clearing a new assessment. Some drivers align this with a TWIC renewal, since both rest on Part 1572. *(Federal framework; state validity may differ.)*

## If you are denied — appeal and waiver

A denial is not always final. Part 1572 provides:

- **Appeal** ([1572.141](https://www.ecfr.gov/current/title-49/part-1572/section-1572.141)) — to correct records or show you do not have a disqualifying offense.
- **Waiver** — to argue that, despite a disqualifying offense, you do not pose a security threat, based on the circumstances and rehabilitation.

There is also a **redress** path for identity mix-ups. Deadlines are strict; act quickly. *(Federal rights; outcomes are TSA determinations.)*

## A worked example (not legal advice)

A driver planning to add hazmat starts the TSA application first, reviews the [1572.103](https://www.ecfr.gov/current/title-49/part-1572/section-1572.103) disqualifier lists to confirm nothing applies, and enrolls in person with fingerprints and documents. Weeks later a favorable determination reaches the state, and after the driver passes the knowledge test the endorsement is added. Five years on, a renewal notice arrives; the driver reapplies before it expires so the endorsement never lapses. The long pole was the **background-check timeline**, which is exactly why it went first. *(Illustration of the sequence, not a promise; TSA and your state govern the actual timing and outcome.)*

## Common mistakes

- **Starting late.** The check is usually the longest step; begin first.
- **Not checking 1572.103.** Know the disqualifiers before paying.
- **Missing renewal.** The assessment expires; a lapse drops the endorsement.
- **Giving up on a denial.** Appeal and waiver rights exist with deadlines.

## Your TSA-assessment checklist

- Eligibility and **disqualifying offenses** reviewed ([1572.103](https://www.ecfr.gov/current/title-49/part-1572/section-1572.103))
- Application started **early** with TSA's provider
- **Fingerprints and documents** submitted; fee paid
- Determination sent to the **state**
- **Renewal date** tracked; **appeal/waiver** used if denied

## Keep learning

- The endorsement it gates: [Hazmat Endorsement Requirements](/knowledge/hazmat-knowledge/hazmat-endorsement-requirements) · [How to Pass the Hazmat Endorsement Test](/knowledge/hazmat-knowledge/how-to-pass-the-hazmat-endorsement-test)
- Company-side security: [Hazmat Security Plans](/knowledge/hazmat-knowledge/hazmat-security-plans) · where H sits, [CDL Endorsements and Restrictions](/knowledge/getting-your-cdl/cdl-endorsements-restrictions)
- **Prep free:** [hazmat practice tests](/practice-tests/hazmat) · [TLWS Academy](/academy) · [CDL Pre-School](/cdl-pre-school) · [the newsletter](/#newsletter).$mdx$,
      'The TSA Threat Assessment Process for Hazmat | Trucking Life with Shawn',
      'The TSA security threat assessment for the hazmat endorsement: what TSA reviews under 49 CFR Part 1572, disqualifying offenses, applying, validity, and appeal rights.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"eCFR — 49 CFR Part 1572, Credentialing and Security Threat Assessments","url":"https://www.ecfr.gov/current/title-49/part-1572"},
        {"label":"eCFR — 49 CFR 1572.103, Disqualifying Criminal Offenses","url":"https://www.ecfr.gov/current/title-49/part-1572/section-1572.103"},
        {"label":"eCFR — 49 CFR 1572.141, Appeal Procedures","url":"https://www.ecfr.gov/current/title-49/part-1572/section-1572.141"},
        {"label":"TSA — Hazardous Materials Endorsement Threat Assessment Program","url":"https://www.tsa.gov/for-industry/hazmat-endorsement"}
      ]$j$::jsonb,
      $j$[
        {"q":"What is the TSA threat assessment for hazmat?","a":"It is a fingerprint-based security background check required under 49 CFR Part 1572 before a state can grant the hazmat (H) endorsement. TSA reviews the applicant's criminal history against permanent and interim disqualifying-offense lists, verifies immigration status, and checks mental capacity. You apply through TSA's enrollment provider, submit fingerprints, and pay TSA's fee."},
        {"q":"What criminal offenses disqualify you from a hazmat endorsement?","a":"49 CFR 1572.103 lists permanent disqualifiers — such as espionage, sedition, treason, terrorism, and certain explosives and weapons crimes — and interim disqualifiers, a broader set of felonies that bar the endorsement for a defined period after conviction or release. The categories are specific, so anyone with a record in question should read 1572.103 before applying."},
        {"q":"How long does the TSA hazmat threat assessment last?","a":"A favorable determination is generally valid for up to five years, after which you must renew before it expires to keep the endorsement. States may set the endorsement's own validity too. Because both the hazmat assessment and the TWIC rest on 49 CFR Part 1572, some drivers align the two renewals."},
        {"q":"How long does the TSA hazmat check take?","a":"Processing commonly takes several weeks from the in-person enrollment visit, depending on the records involved. Because it is usually the longest step in getting the endorsement, the practical approach is to start the TSA application before you finish studying for the knowledge test, so the two tracks run in parallel."},
        {"q":"Can you appeal a denied hazmat threat assessment?","a":"Yes. 49 CFR Part 1572 provides an appeal process under 1572.141 to correct records or show you do not have a disqualifying offense, and a waiver process to argue that, despite a disqualifying offense, you do not pose a security threat. There is also a redress path for identity mix-ups. Deadlines are strict, so act quickly after a denial."}
      ]$j$::jsonb,
      '{hazmat-knowledge,tsa,security,1572,background-check}',
      9, false, 'published', true, '2026-07-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 8. The Hazmat Table Explained
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_haz and slug = 'hazmat-table-explained') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_haz,
      'hazmat-table-explained',
      'The Hazmat Table Explained (49 CFR 172.101)',
      'The Hazardous Materials Table is the master index that drives every other hazmat decision. What its ten columns mean, how to read a row, and why the proper shipping name and ID number start everything.',
      $mdx$**Quick answer:** The **Hazardous Materials Table** in [49 CFR 172.101](https://www.ecfr.gov/current/title-49/part-172/section-172.101) is the master list that ties a material to its **proper shipping name, hazard class, ID number, packing group, labels, packaging, and quantity limits**. You find your material by name, read across its **ten columns**, and everything else — the shipping-paper description, the placards, the packaging, the segregation — flows from that row. Column 1 **symbols** (like +, A, D, G, I, W) change how the entry is used. The table is where hazmat classification **starts**.

**Regulatory-change disclaimer:** Last reviewed **July 19, 2026**. The table and its provisions (49 CFR 172.101 and 172.102) change. Confirm the current entry on the [eCFR](https://www.ecfr.gov/current/title-49/part-172/section-172.101) and with [PHMSA](https://www.phmsa.dot.gov/). Not legal advice.

## Why the table matters

Nearly every hazmat requirement points back to the table. Get the **row** right and the placards, paperwork, packaging, and segregation follow; get it wrong and everything downstream is wrong too. That is why the [knowledge test](/knowledge/hazmat-knowledge/how-to-pass-the-hazmat-endorsement-test) leans on knowing how the table works. *(Federal framework, 172.101.)*

## The ten columns, in plain English

1. **Symbols** — flags that modify the entry: **+** (name/class fixed), **A** (applies mainly to air), **D** (domestic), **G** (a generic name needing a technical name), **I** (international), **W** (mainly water).
2. **Proper shipping name and description** — the exact name to use on papers.
3. **Hazard class or division** — the primary hazard.
4. **Identification number** — the UN or NA four-digit number.
5. **Packing group** — I (great danger), II (medium), III (minor), where assigned.
6. **Label codes** — the labels the package must bear.
7. **Special provisions** — codes referring to [172.102](https://www.ecfr.gov/current/title-49/part-172/section-172.102).
8. **Packaging** — the sections in Part 173 for exceptions, non-bulk, and bulk packaging.
9. **Quantity limitations** — the maximum per package for passenger and cargo aircraft.
10. **Vessel stowage** — requirements for transport by water.

*(Reference structure.)*

## How to read a row

Start with the **proper shipping name** (or ID number) and read across: note the **class**, **ID number**, and **packing group** for the shipping paper; the **labels** for the package; the **special provisions** and **packaging** columns for how it must be contained. A **"G"** in column 1 means you must add the **technical name** in parentheses. The row is the recipe; the other rules are the cooking. *(How-to.)*

## Where the table sends you next

- **Column 3 (class)** drives [placarding](/knowledge/hazmat-knowledge/hazmat-placards-explained) and [segregation](/knowledge/hazmat-knowledge/hazmat-load-segregation-rules).
- **Columns 2–5** populate the [shipping-paper](/knowledge/hazmat-knowledge/shipping-papers-explained) basic description.
- **Columns 7–8** govern packaging via Part 173.

*(Federal cross-references.)*

## The driver's use of the table

Shippers classify and describe the material, but a driver who can **read the table** can spot a mismatch — a proper shipping name that does not fit the placards, a missing packing group, a generic name with no technical name. That literacy is what turns a required check into a real one. *(Driver benefit; shipper classifies.)*

## A worked example (not legal advice)

A driver reviewing papers sees a generic proper shipping name flagged **"G"** in the table but **no technical name** in parentheses on the shipping paper. Knowing column 1, the driver flags it; the shipper adds the technical name to comply. The fix came from **reading the row**, not memorizing the material. *(Illustration of table literacy, not a ruling for any specific entry.)*

## Common mistakes

- **Skipping column 1 symbols.** A "G" entry needs a technical name.
- **Wrong proper shipping name.** Use the exact table name, not a trade name.
- **Missing the packing group.** It is part of the description where assigned.
- **Ignoring special provisions.** Column 7 codes can change everything.
- **Reading the wrong row.** Similar names differ by class and ID number.

## Your hazmat-table checklist

- Material found by **proper shipping name / ID number**
- **Class, ID number, packing group** read for the papers
- **Labels** and **packaging** columns checked
- **Column 1 symbols** (e.g., "G" → technical name) handled
- **Special provisions** (172.102) reviewed

## Keep learning

- What the row feeds: [Shipping Papers Explained](/knowledge/hazmat-knowledge/shipping-papers-explained) · [Hazmat Placards Explained](/knowledge/hazmat-knowledge/hazmat-placards-explained) · [Segregation Rules](/knowledge/hazmat-knowledge/hazmat-load-segregation-rules)
- The endorsement: [How to Pass the Hazmat Endorsement Test](/knowledge/hazmat-knowledge/how-to-pass-the-hazmat-endorsement-test)
- **Train up free:** [hazmat practice tests](/practice-tests/hazmat) · [TLWS Academy](/academy) · [CDL Pre-School](/cdl-pre-school) · [the newsletter](/#newsletter).$mdx$,
      'The Hazmat Table Explained (49 CFR 172.101) | Trucking Life with Shawn',
      'How to read the Hazardous Materials Table in 49 CFR 172.101: the ten columns, the column-1 symbols, and how the row drives every other hazmat rule.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"eCFR — 49 CFR 172.101, Purpose and Use of Hazardous Materials Table","url":"https://www.ecfr.gov/current/title-49/part-172/section-172.101"},
        {"label":"eCFR — 49 CFR 172.102, Special Provisions","url":"https://www.ecfr.gov/current/title-49/part-172/section-172.102"},
        {"label":"eCFR — 49 CFR Part 173, Shippers — General Requirements for Shipments and Packagings","url":"https://www.ecfr.gov/current/title-49/part-173"},
        {"label":"PHMSA — Hazardous Materials Safety","url":"https://www.phmsa.dot.gov/hazmat"}
      ]$j$::jsonb,
      $j$[
        {"q":"What is the Hazardous Materials Table?","a":"It is the master list in 49 CFR 172.101 that ties each regulated material to its proper shipping name, hazard class or division, UN/NA identification number, packing group, label codes, special provisions, packaging sections, quantity limits, and vessel stowage. You find the material and read across its row; the placards, shipping-paper description, packaging, and segregation all flow from that entry."},
        {"q":"What do the columns in the hazmat table mean?","a":"The ten columns are: column 1 symbols, proper shipping name and description, hazard class or division, identification number, packing group, label codes, special provisions (referring to 172.102), packaging sections in Part 173, quantity limitations for passenger and cargo aircraft, and vessel stowage. Columns 2 through 5 build the shipping-paper basic description; column 3 drives placarding and segregation."},
        {"q":"What do the column 1 symbols in the hazmat table mean?","a":"They modify how an entry is used. Common symbols include + (the shipping name and class are fixed), A (applies mainly to air transport), D (domestic transport), G (a generic name that requires an added technical name in parentheses), I (international), and W (applies mainly to transport by water). Missing a G, in particular, leads to an incomplete shipping description."},
        {"q":"How does the hazmat table relate to placards and papers?","a":"The class in column 3 determines which placards are required and how the material segregates from others, while the proper shipping name, class, ID number, and packing group in columns 2 through 5 make up the shipping-paper basic description. Columns 7 and 8 point to the packaging rules in Part 173. Get the row right and everything downstream follows."},
        {"q":"Do truck drivers need to read the hazmat table?","a":"Shippers classify and describe the material, but a driver who can read the table can catch a mismatch — a proper shipping name that does not fit the placards, a missing packing group, or a generic G entry with no technical name. That table literacy turns the driver's required paperwork check into a meaningful one and is a core topic on the hazmat knowledge test."}
      ]$j$::jsonb,
      '{hazmat-knowledge,hazmat-table,172-101,classification,shipping-name}',
      9, false, 'published', true, '2026-07-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 9. Hazmat Security Plans
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_haz and slug = 'hazmat-security-plans') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_haz,
      'hazmat-security-plans',
      'Hazmat Security Plans: What Part 172 Subpart I Requires',
      'Certain hazmat shipments require a written security plan and security training for everyone who handles them. Who needs a plan, the three areas it must cover, and the driver''s part in carrying it out.',
      $mdx$**Quick answer:** Companies that offer or transport **higher-risk hazardous materials** must have a written **security plan** under [49 CFR Part 172 Subpart I](https://www.ecfr.gov/current/title-49/part-172/subpart-I). The plan must address **three areas** ([172.802](https://www.ecfr.gov/current/title-49/part-172/section-172.802)): **personnel security**, **unauthorized access**, and **en route security** — based on a risk assessment. Separately, **all hazmat employees** must receive **security awareness training** ([172.704](https://www.ecfr.gov/current/title-49/part-172/section-172.704)). The plan applies to specific materials and quantities listed in [172.800](https://www.ecfr.gov/current/title-49/part-172/section-172.800) — not every hazmat shipment — and drivers are expected to know and follow their company's plan.

**Regulatory-change disclaimer:** Last reviewed **July 19, 2026**. Security-plan rules (49 CFR Part 172 Subpart I) change. Confirm the current applicability list and requirements on the [eCFR](https://www.ecfr.gov/current/title-49/part-172/subpart-I) and with [PHMSA](https://www.phmsa.dot.gov/). Not legal advice.

## What a security plan is

It is a **written program** to keep dangerous materials out of the wrong hands in transit and at rest. Where the [TSA threat assessment](/knowledge/hazmat-knowledge/tsa-threat-assessment-process) screens the **person**, the security plan governs the **operation**. It is a company obligation, but it lives or dies on what drivers and handlers actually do. *(Federal requirement, Subpart I.)*

## Who needs one

A plan is required for the **materials and quantities listed in [172.800](https://www.ecfr.gov/current/title-49/part-172/section-172.800)** — the higher-risk set, which includes things like certain **placarded quantities**, **poison-inhalation-hazard** materials, **explosives**, **certain radioactive materials**, and **select agents**, among others. Many everyday placarded loads fall under it; smaller or lower-risk shipments may not. The list, not intuition, decides. *(Federal requirement.)*

## The three required components

Under [172.802](https://www.ecfr.gov/current/title-49/part-172/section-172.802), the plan must address:

- **Personnel security** — confirming background and suitability of people who handle the materials.
- **Unauthorized access** — keeping the material, vehicles, and facilities secure from tampering or theft.
- **En route security** — protecting the shipment while it moves (routing, tracking, communication, and response).

It must be based on an **assessment of security risks** and be **in writing, dated, and kept current**. *(Federal requirement.)*

## Security awareness training for everyone

Beyond the plan, **every hazmat employee** must get **security awareness training** ([172.704](https://www.ecfr.gov/current/title-49/part-172/section-172.704)) covering security risks and how to recognize and respond to them, plus **in-depth training** for those with security-plan responsibilities. Training is **recurrent** and must be documented. *(Federal requirement.)*

## The driver's part

You may not write the plan, but you **carry it out**: keeping the vehicle and load **secure at stops**, controlling **who approaches** the freight, following **routing and communication** procedures, and reporting anything suspicious. A strong plan is worthless if the driver leaves a placarded trailer unlocked and unattended. *(Driver duty.)*

## A worked example (not legal advice)

A carrier hauling a Subpart-I material trains its drivers on the security plan: park in lit, monitored areas; never leave the loaded trailer unattended where avoidable; verify anyone handling the freight; and call dispatch on a set schedule. On a long run, a driver notices someone loitering near the trailer at a stop, moves to a secure lot, and reports it — exactly what the **en route security** component is for. *(Illustration of a plan in practice, not a specific compliance instruction.)*

## Common mistakes

- **Assuming every hazmat load needs a plan.** Only the 172.800 list triggers it.
- **Skipping security awareness training.** It applies to **all** hazmat employees.
- **Treating the plan as paperwork.** En route security is a driver behavior.
- **Leaving loads unattended.** Unauthorized-access control is central.
- **Not updating the plan.** It must be kept current and dated.

## Your security-plan checklist

- Whether the material is on the **172.800** list confirmed
- Company **security plan** read and understood
- **Security awareness training** completed and documented
- **En route** procedures (routing, check-ins) followed
- Loads kept **secure and attended**; suspicious activity reported

## Keep learning

- The personnel side: [The TSA Threat Assessment Process](/knowledge/hazmat-knowledge/tsa-threat-assessment-process) · [Hazmat Endorsement Requirements](/knowledge/hazmat-knowledge/hazmat-endorsement-requirements) · the endorsement itself, [How to Pass the Hazmat Endorsement Test](/knowledge/hazmat-knowledge/how-to-pass-the-hazmat-endorsement-test)
- What you are protecting: [The Hazmat Table](/knowledge/hazmat-knowledge/hazmat-table-explained) · [Hazmat Registration Requirements](/knowledge/hazmat-knowledge/hazmat-registration-requirements)
- **Sharpen up free:** [hazmat practice tests](/practice-tests/hazmat) · [TLWS Academy](/academy) · [CDL Pre-School](/cdl-pre-school) · [the newsletter](/#newsletter).$mdx$,
      'Hazmat Security Plans: What Part 172 Subpart I Requires | Trucking Life with Shawn',
      'Hazmat security plans under 49 CFR Part 172 Subpart I: who needs one via the 172.800 list, the three required components, security awareness training, and the driver''s role.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"eCFR — 49 CFR Part 172 Subpart I, Safety and Security Plans","url":"https://www.ecfr.gov/current/title-49/part-172/subpart-I"},
        {"label":"eCFR — 49 CFR 172.800, Purpose and Applicability (Security Plans)","url":"https://www.ecfr.gov/current/title-49/part-172/section-172.800"},
        {"label":"eCFR — 49 CFR 172.802, Components of a Security Plan","url":"https://www.ecfr.gov/current/title-49/part-172/section-172.802"},
        {"label":"eCFR — 49 CFR 172.704, Training Requirements","url":"https://www.ecfr.gov/current/title-49/part-172/section-172.704"}
      ]$j$::jsonb,
      $j$[
        {"q":"Who needs a hazmat security plan?","a":"Companies that offer for transport or transport the higher-risk hazardous materials and quantities listed in 49 CFR 172.800 must have a written security plan. That list includes certain placarded quantities, poison-inhalation-hazard materials, explosives, certain radioactive materials, and select agents, among others. Lower-risk or smaller shipments not on the list do not require a plan."},
        {"q":"What must a hazmat security plan include?","a":"Under 49 CFR 172.802 the plan must address three areas based on a risk assessment: personnel security (suitability of people who handle the materials), unauthorized access (keeping material, vehicles, and facilities secure), and en route security (protecting the shipment in transit through routing, tracking, and communication). It must be written, dated, and kept current."},
        {"q":"Do all hazmat employees need security training?","a":"Yes. Under 49 CFR 172.704, every hazmat employee must receive security awareness training covering security risks and how to recognize and respond to them, and those with responsibilities under a security plan need additional in-depth training. The training is recurrent and must be documented, separate from the written plan itself."},
        {"q":"What is the driver's role in a hazmat security plan?","a":"Drivers carry out the plan's en route security: keeping the vehicle and load secure at stops, controlling who approaches the freight, following routing and communication procedures, and reporting suspicious activity. A written plan does not protect anything if a driver leaves a placarded trailer unlocked and unattended, so the driver's behavior is central to the plan working."},
        {"q":"Is a hazmat security plan the same as the TSA threat assessment?","a":"No. The TSA security threat assessment under 49 CFR Part 1572 screens the individual driver before granting the H endorsement. A security plan under Part 172 Subpart I is a company program governing how higher-risk materials are secured in operation. One vets the person; the other governs the operation, and a hazmat driver is subject to both."}
      ]$j$::jsonb,
      '{hazmat-knowledge,security-plan,172-subpart-i,training,driver-duty}',
      9, false, 'published', true, '2026-07-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- 10. Hazmat Registration Requirements
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_haz and slug = 'hazmat-registration-requirements') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_haz,
      'hazmat-registration-requirements',
      'Hazmat Registration Requirements (PHMSA)',
      'Beyond the driver''s endorsement, companies that ship or carry certain hazardous materials must register with PHMSA each year. Who must register, what the program is, and how it differs from the endorsement and the security plan.',
      $mdx$**Quick answer:** Separate from the driver's endorsement, **companies that offer or transport certain hazardous materials** must register with **PHMSA** every year under [49 CFR Part 107 Subpart G](https://www.ecfr.gov/current/title-49/part-107/subpart-G). Registration applies to **higher-risk categories** — for example **highway route-controlled radioactive material, large quantities of explosives, poison-inhalation-hazard materials, bulk shipments, and any quantity requiring placards** for certain classes ([107.601](https://www.ecfr.gov/current/title-49/part-107/section-107.601)). The **registration year runs July 1–June 30**, there is a **fee paid to PHMSA**, and proof of current registration must be **carried on the vehicle**. This is a **company** obligation, distinct from the H endorsement and the security plan.

**Regulatory-change disclaimer:** Last reviewed **July 19, 2026**. Registration rules and fees (49 CFR Part 107 Subpart G) change. Confirm current applicability and fees with [PHMSA](https://www.phmsa.dot.gov/hazmat-program-management-data-and-statistics/data-operations/hazardous-materials-registration) and the [eCFR](https://www.ecfr.gov/current/title-49/part-107/subpart-G). Not legal advice.

## Three different hazmat obligations

It is easy to blur them, so keep them straight:

- **H endorsement** — a **driver** credential (this cluster's [pillar](/knowledge/hazmat-knowledge/how-to-pass-the-hazmat-endorsement-test)).
- **Security plan** — a **company operations** program for higher-risk loads ([Subpart I](/knowledge/hazmat-knowledge/hazmat-security-plans)).
- **PHMSA registration** — a **company federal registration and fee** for certain shipments (this article).

A driver can hold H while the carrier separately registers and maintains its plan. *(Federal framework; three distinct requirements.)*

## Who must register

Registration under [107.601](https://www.ecfr.gov/current/title-49/part-107/section-107.601) is required to offer or transport hazmat in the **higher-risk categories**, which include (among others):

- **Highway route-controlled quantity** of Class 7 radioactive material.
- **More than 25 kg** of a Division 1.1, 1.2, or 1.3 **explosive**.
- **Any quantity** of a material **extremely toxic by inhalation** (Hazard Zone A).
- **Bulk** shipments above set thresholds (e.g., large-volume tanks).
- **Any quantity requiring placarding** for certain listed classes.

Smaller, lower-risk shipments may be exempt. The regulation's list governs. *(Federal requirement.)*

## How the program works

1. A company files the **registration statement** with PHMSA (online).
2. It pays the **registration fee** (a national fee that funds emergency-response grants; the amount differs for small vs. other businesses and is set by PHMSA).
3. PHMSA issues a **certificate and registration number**.
4. A copy of the **current registration** (or number) must be **kept on the vehicle** transporting the covered material.

The **registration year is July 1 through June 30**, so it renews annually. *(Federal process.)*

## Why it exists

The fees fund **emergency-response training and planning grants** for the states and localities that would respond to a hazmat incident. Registration also gives regulators a picture of who is moving the highest-risk materials. It is infrastructure behind the placards and papers a driver sees every day. *(Program purpose.)*

## The driver's connection

Drivers do not usually file the registration, but they may need to **show the current registration (or number) on the vehicle** when carrying a covered material, and they benefit from knowing whether a load falls into a registered category. If your carrier hauls the higher-risk materials above, the registration is part of the compliance picture around your trip. *(Driver awareness; company files.)*

## A worked example (not legal advice)

A small carrier lands a contract hauling a poison-inhalation-hazard material. Before the first load, the office confirms the material is on the [107.601](https://www.ecfr.gov/current/title-49/part-107/section-107.601) list, files the PHMSA registration, pays the fee, and puts a copy of the certificate in the truck. The endorsement (driver) and the security plan (operations) were already handled; registration was the **third, company-level** box to check. *(Illustration of the three obligations lining up, not a compliance ruling.)*

## Common mistakes

- **Confusing registration with the endorsement.** One is a company filing; the other is a driver credential.
- **Assuming all hazmat requires registration.** Only the higher-risk list does.
- **Letting it lapse.** The registration year ends June 30; renew annually.
- **No copy on the vehicle.** Current registration must be carried for covered loads.

## Your registration checklist

- Material checked against the **107.601** categories
- **Registration statement** filed with PHMSA and **fee** paid
- **Certificate/number** received
- Copy **carried on the vehicle** for covered loads
- **Annual renewal** (July 1–June 30) tracked

## Keep learning

- The other two obligations: [How to Pass the Hazmat Endorsement Test](/knowledge/hazmat-knowledge/how-to-pass-the-hazmat-endorsement-test) · [Hazmat Security Plans](/knowledge/hazmat-knowledge/hazmat-security-plans)
- What defines a covered load: [The Hazmat Table](/knowledge/hazmat-knowledge/hazmat-table-explained) · [Hazmat Placards Explained](/knowledge/hazmat-knowledge/hazmat-placards-explained)
- **Review it free:** [hazmat practice tests](/practice-tests/hazmat) · [TLWS Academy](/academy) · [CDL Pre-School](/cdl-pre-school) · [the newsletter](/#newsletter).$mdx$,
      'Hazmat Registration Requirements (PHMSA) | Trucking Life with Shawn',
      'PHMSA hazmat registration under 49 CFR Part 107 Subpart G: who must register, the higher-risk categories, the annual fee, and how it differs from the endorsement.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"eCFR — 49 CFR Part 107 Subpart G, Registration of Hazmat Persons","url":"https://www.ecfr.gov/current/title-49/part-107/subpart-G"},
        {"label":"eCFR — 49 CFR 107.601, Applicability (Registration)","url":"https://www.ecfr.gov/current/title-49/part-107/section-107.601"},
        {"label":"PHMSA — Hazardous Materials Registration Program","url":"https://www.phmsa.dot.gov/hazmat-program-management-data-and-statistics/data-operations/hazardous-materials-registration"},
        {"label":"PHMSA — Hazardous Materials Safety","url":"https://www.phmsa.dot.gov/hazmat"}
      ]$j$::jsonb,
      $j$[
        {"q":"What is PHMSA hazmat registration?","a":"It is an annual federal registration and fee program under 49 CFR Part 107 Subpart G for companies that offer or transport certain higher-risk hazardous materials. The company files a registration statement with PHMSA, pays a fee that funds emergency-response grants, and receives a certificate and registration number. It is a company obligation, separate from a driver's endorsement."},
        {"q":"Who has to register with PHMSA for hazmat?","a":"Under 49 CFR 107.601, registration is required to offer or transport higher-risk hazmat — for example a highway route-controlled quantity of radioactive material, more than 25 kg of a Division 1.1 to 1.3 explosive, any quantity of a material extremely toxic by inhalation (Hazard Zone A), bulk shipments above set thresholds, and any quantity requiring placarding for certain classes. Lower-risk shipments may be exempt."},
        {"q":"How is hazmat registration different from the hazmat endorsement?","a":"The H endorsement is a driver credential on a CDL, earned through a knowledge test and a TSA security threat assessment. PHMSA registration is a company-level annual federal filing and fee for transporting certain higher-risk materials. They are separate requirements: a driver can hold the endorsement while the carrier independently handles its PHMSA registration and its security plan."},
        {"q":"When does hazmat registration need to be renewed?","a":"The PHMSA registration year runs from July 1 through June 30, so covered companies renew annually. A copy of the current registration or the registration number must be kept on the vehicle when it transports a material covered by the program, and letting the registration lapse while still hauling covered materials is a compliance violation."},
        {"q":"Does a driver need to carry the hazmat registration?","a":"When transporting a material covered by the registration program, a copy of the company's current registration certificate or its registration number must be carried on the vehicle. Drivers typically do not file the registration themselves — the company does — but they should know whether a load falls into a registered category and be able to produce the proof on the vehicle."}
      ]$j$::jsonb,
      '{hazmat-knowledge,registration,phmsa,part-107,company-duty}',
      9, false, 'published', true, '2026-07-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- Related-article rows (within-cluster + cross-cluster where present)
  ---------------------------------------------------------------------------
  declare
    h1 uuid; h2 uuid; h3 uuid; h4 uuid; h5 uuid;
    h6 uuid; h7 uuid; h8 uuid; h9 uuid; h10 uuid;
    gyc_endorse uuid; gyc_eldt uuid;
  begin
    select id into h1  from public.kc_articles where category_id = v_haz and slug = 'how-to-pass-the-hazmat-endorsement-test';
    select id into h2  from public.kc_articles where category_id = v_haz and slug = 'hazmat-endorsement-requirements';
    select id into h3  from public.kc_articles where category_id = v_haz and slug = 'hazmat-placards-explained';
    select id into h4  from public.kc_articles where category_id = v_haz and slug = 'shipping-papers-explained';
    select id into h5  from public.kc_articles where category_id = v_haz and slug = 'the-emergency-response-guidebook';
    select id into h6  from public.kc_articles where category_id = v_haz and slug = 'hazmat-load-segregation-rules';
    select id into h7  from public.kc_articles where category_id = v_haz and slug = 'tsa-threat-assessment-process';
    select id into h8  from public.kc_articles where category_id = v_haz and slug = 'hazmat-table-explained';
    select id into h9  from public.kc_articles where category_id = v_haz and slug = 'hazmat-security-plans';
    select id into h10 from public.kc_articles where category_id = v_haz and slug = 'hazmat-registration-requirements';
    select id into gyc_endorse from public.kc_articles where category_id = v_gyc and slug = 'cdl-endorsements-restrictions';
    select id into gyc_eldt    from public.kc_articles where category_id = v_gyc and slug = 'eldt-requirements';

    insert into public.kc_related (article_id, related_id, sort_order) values
      (h1, h2, 1), (h1, h7, 2), (h1, h3, 3),
      (h2, h1, 1), (h2, h7, 2), (h2, h8, 3),
      (h3, h8, 1), (h3, h4, 2), (h3, h1, 3),
      (h4, h8, 1), (h4, h3, 2), (h4, h5, 3),
      (h5, h4, 1), (h5, h3, 2), (h5, h6, 3),
      (h6, h8, 1), (h6, h3, 2), (h6, h5, 3),
      (h7, h2, 1), (h7, h1, 2), (h7, h9, 3),
      (h8, h4, 1), (h8, h3, 2), (h8, h6, 3),
      (h9, h7, 1), (h9, h10, 2), (h9, h1, 3),
      (h10, h1, 1), (h10, h9, 2), (h10, h8, 3)
    on conflict (article_id, related_id) do nothing;

    -- cross-cluster: the pillar and requirements bridge to the licensing cluster
    if gyc_endorse is not null then
      insert into public.kc_related (article_id, related_id, sort_order) values
        (h1, gyc_endorse, 4), (h2, gyc_endorse, 4)
      on conflict (article_id, related_id) do nothing;
    end if;
    if gyc_eldt is not null then
      insert into public.kc_related (article_id, related_id, sort_order) values
        (h1, gyc_eldt, 5)
      on conflict (article_id, related_id) do nothing;
    end if;
  end;
end $kc$;

-- ---------------------------------------------------------------------------
-- Cross-links INTO the new cluster from three existing Batch 3 pages (guarded,
-- slug- and category-scoped, replace-based, idempotent — same doctrine as
-- 040/042/045: presence guard on the target text + absence guard on the new
-- link, so a re-run is a no-op and nothing else in the body can be touched).
-- ---------------------------------------------------------------------------

-- 1. CDL Endorsements and Restrictions (Batch 3) → the hazmat pillar: the H
--    bullet now hands readers the full endorsement path.
update public.kc_articles a set body_mdx = replace(
    a.body_mdx,
    'H cannot ride on a learner''s permit.',
    'H cannot ride on a learner''s permit. The full endorsement path, start to finish: [How to Pass the Hazmat Endorsement Test](/knowledge/hazmat-knowledge/how-to-pass-the-hazmat-endorsement-test).')
from public.kc_categories c
where c.id = a.category_id and c.slug = 'getting-your-cdl'
  and a.slug = 'cdl-endorsements-restrictions'
  and a.body_mdx like '%H cannot ride on a learner''s permit.%'
  and a.body_mdx not like '%/knowledge/hazmat-knowledge/%';

-- 2. What Does It Cost to Get a CDL? (Batch 3) → the TSA process: the
--    endorsement-cost bullet now explains what the TSA fee buys.
update public.kc_articles a set body_mdx = replace(
    a.body_mdx,
    'priced by TSA, not your state.',
    'priced by TSA, not your state. What the check involves: [The TSA Threat Assessment Process](/knowledge/hazmat-knowledge/tsa-threat-assessment-process).')
from public.kc_categories c
where c.id = a.category_id and c.slug = 'getting-your-cdl'
  and a.slug = 'cdl-cost'
  and a.body_mdx like '%priced by TSA, not your state.%'
  and a.body_mdx not like '%/knowledge/hazmat-knowledge/%';

-- 3. Entry-Level Driver Training (Batch 3) → the hazmat pillar: the "For H"
--    theory note now bridges to the whole endorsement.
update public.kc_articles a set body_mdx = replace(
    a.body_mdx,
    'before the state may administer the hazmat knowledge test.',
    'before the state may administer the hazmat knowledge test. The whole endorsement, start to finish: [How to Pass the Hazmat Endorsement Test](/knowledge/hazmat-knowledge/how-to-pass-the-hazmat-endorsement-test).')
from public.kc_categories c
where c.id = a.category_id and c.slug = 'getting-your-cdl'
  and a.slug = 'eldt-requirements'
  and a.body_mdx like '%before the state may administer the hazmat knowledge test.%'
  and a.body_mdx not like '%/knowledge/hazmat-knowledge/%';
