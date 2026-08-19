-- 055_seed_kc_class_a_vs_class_b.sql
-- Knowledge Center — one decision-intent page: "Class A vs Class B CDL:
-- Which One Should You Get?" in the existing getting-your-cdl category.
--
-- ⚠️ COMMITTED; apply AFTER 015 (schema) and 040 (Getting Your CDL cluster —
-- the cross-link update block at the end touches three Batch 3 bodies).
-- IDEMPOTENT AND NON-DESTRUCTIVE: the article inserts ONLY when no article
-- with the same (category, slug) exists; kc_related rows insert with
-- ON CONFLICT DO NOTHING; the cross-link UPDATEs are guarded (slug-scoped,
-- substring replacement, presence guard on the target text + absence guard
-- on the new link) so a re-run is a no-op and nothing else can be touched.
--
-- Content rules (hard, same as 037/038/040/042/045):
--   * Original wording only. Primary sources only (eCFR / FMCSA / the FMCSA
--     Training Provider Registry / Georgia DDS), cited per claim and listed
--     in `sources`. Federal rule vs Georgia procedure vs recommendation are
--     labeled in-text.
--   * No invented tuition figures, fees, salaries, pass rates, opening
--     dates, phone numbers, or school-status claims. The Academy CTA links
--     the canonical /academy page and asserts nothing beyond its existence.
--   * Cannibalization guard: cdl-classes-compared keeps the "CDL Classes
--     A, B, and C Compared" head term and the three-class taxonomy intent;
--     this page owns the two-way DECISION intent ("which one should you
--     get") plus the Georgia licensing path. The two cross-link each other.
--   * reg_verified = true, reg_verified_date 2026-08-19 (visible
--     last-reviewed date), in-body regulatory-change disclaimer.
--   * Slugs are stable identifiers.

do $kc$
declare
  v_gyc uuid;
  v_pub timestamptz := '2026-08-19 15:00:00+00';
  v_bio text := 'CDL-A driver and instructor — 17 years driving, zero violations. Founder of Trucking Life with Shawn and the TLWS truck driving school in Dalton, Georgia.';
begin
  select id into v_gyc from public.kc_categories where slug = 'getting-your-cdl';
  if v_gyc is null then
    raise exception 'Knowledge Center categories missing (getting-your-cdl)';
  end if;

  ---------------------------------------------------------------------------
  -- 1. Class A vs Class B CDL (decision guide)
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.kc_articles where category_id = v_gyc and slug = 'class-a-vs-class-b-cdl') then
    insert into public.kc_articles
      (category_id, slug, title, excerpt, body_mdx, meta_title, meta_description,
       author_name, author_bio, sources, faqs, tags, reading_time_min, featured,
       status, reg_verified, reg_verified_date, published_at)
    values (
      v_gyc,
      'class-a-vs-class-b-cdl',
      'Class A vs Class B CDL: Which One Should You Get?',
      'Class A or Class B is the first real decision of a trucking career. The federal definitions in plain English, the jobs each license actually supports, what a later B-to-A upgrade involves, and the Georgia licensing path for either class.',
      $mdx$**Quick answer:** The trailer draws the line. A **Class A** CDL covers **combination vehicles** — a power unit plus trailer(s) rated **26,001 pounds or more together**, where the towed unit(s) are rated **over 10,000 pounds** ([49 CFR 383.91](https://www.ecfr.gov/current/title-49/part-383/section-383.91)). A **Class B** CDL covers a **single vehicle rated 26,001 pounds or more** that tows **no more than 10,000 pounds**. Match the class to the vehicle your target job runs: tractor-trailer freight needs Class A; dump trucks, box trucks, mixers, and most buses run on Class B. With the required endorsements a Class A holder may also drive Class B and C vehicles — the reverse is never true.

**Regulatory-change disclaimer:** Last reviewed **August 19, 2026**. The vehicle groups are federal ([49 CFR Part 383](https://www.ecfr.gov/current/title-49/part-383)); the licensing steps for Georgia drivers come from the [Georgia Department of Driver Services](https://dds.georgia.gov/georgia-licenses-ids-and-permits/new-license-id-or-permit/how-do-i-cdl-license). Confirm current rules with [FMCSA](https://www.fmcsa.dot.gov/) and Georgia DDS before relying on this. Not legal advice.

## Who this decision faces

Every new driver, exactly once — the class you train and test in is the class you carry — plus every Class B holder who starts eyeing combination freight, and any driver whose next employer runs different equipment. If the whole licensing sequence is new to you, keep [How to Get Your CDL](/knowledge/getting-your-cdl/how-to-get-your-cdl) open beside this page: the steps are the same for both classes, and only the vehicle, the training, and one knowledge test change.

## What a Class A CDL is

Federal rule defines Group A as any **combination of vehicles** with a gross combination weight rating of **26,001 pounds or more**, provided the vehicle(s) being towed are rated **over 10,000 pounds** ([49 CFR 383.91](https://www.ecfr.gov/current/title-49/part-383/section-383.91)). Two details keep people honest. Both numbers must be crossed — a heavy truck pulling a light trailer is not a Group A combination. And when no combination rating appears on the power unit, the definitions in [49 CFR 383.5](https://www.ecfr.gov/current/title-49/part-383/section-383.5) build one from the ratings or actual weights of the units together, whichever produces the higher number — "the label does not say" is not an exemption.

What the license covers is the combination world: dry vans, reefers, flatbeds, and — with the [endorsements](/knowledge/getting-your-cdl/cdl-endorsements-restrictions) stacked on top — tank combinations and doubles. Under the same rule, a driver who passed the Class A knowledge and skills tests may also operate Group B and C vehicles, provided they hold any endorsement the specific vehicle requires. That one-way door is the heart of this decision.

## What a Class B CDL is

Group B is any **single vehicle** rated **26,001 pounds or more**, or such a vehicle towing another rated at **10,000 pounds or less**. This is the straight-truck license: dump trucks, box trucks, concrete mixers, refuse trucks, and — with the P or S endorsement — many buses. A Class B holder may operate Group C vehicles with the right endorsements, but no amount of seat time lets a Class B license pull a combination whose towed unit crosses the 10,000-pound line.

## Class A vs Class B at a glance

Row by row — built as a list so it reads cleanly on a phone:

- **Vehicle type:** Class A is a combination — tractor plus trailer(s). Class B is one heavy straight vehicle.
- **Trailer threshold:** Class A tows unit(s) rated over 10,000 pounds. Class B tows 10,000 pounds or less.
- **Combination capability:** Class A exists for combinations. Class B allows only light towing behind a heavy single vehicle.
- **What else it covers:** Class A reaches down to Group B and C vehicles with the required endorsements. Class B reaches down to Group C only.
- **Typical vehicles:** Class A — tractor-trailers, reefers, flatbeds, tank combinations. Class B — dump trucks, box trucks, mixers, refuse trucks, many buses.
- **Upgrading later:** Nothing sits above Class A. Moving from B to A means a new permit, upgrade training, and a combination skills test.

## The jobs each license supports

Match the license to the vehicle and the job map draws itself. Class A generally opens the broader range of commercial-driving jobs: most over-the-road, regional, and dedicated freight runs combinations, and the [OTR, regional, and local lanes](/knowledge/trucking-careers/otr-vs-regional-vs-local) differ more in home time than in license class. Class B supports vocational and local work built on straight trucks — construction fleets, final-mile and box-truck delivery, refuse routes, and passenger seats with the P or S endorsement. Home-nightly openings often run Class B equipment, but local combination work exists too — port drayage, LTL city routes — so read the equipment line in the posting before assuming. On money: pay varies by freight, region, and employer, so this page makes no pay comparison — [how driver pay is structured](/knowledge/trucking-careers/cdl-truck-driver-pay) is its own subject.

## When Class A makes sense

**Recommendation, not a federal requirement — the rule defines vehicle groups, not career advice.** Class A fits when you want the widest set of doors open. Combination freight is the largest slice of commercial driving, and the license also covers Group B and C vehicles when a job calls for one. If you want the broadest range of commercial-driving options, Class A is usually the more flexible choice — and if you already know combination freight is the goal, testing in a combination the first time beats repeating the licensing sequence later.

## When Class B makes sense

Class B fits when the job in hand — or the one you actually want — runs straight trucks: a construction fleet, a refuse route, a delivery operation, a bus seat. A real Class B offer today can be worth more than a broader license with no job attached; that trade is a judgment call, not a rule. It also fits drivers who want local, vocational work and have no interest in combination freight. Just walk in knowing the ceiling: if combination jobs enter the picture later, the upgrade below is the price.

## Upgrading from Class B to Class A

The upgrade is the same federal sequence again, not a formality:

- **A Class A commercial learner's permit** — which means passing the additional knowledge testing for combinations, drilled free in the [combination vehicles practice test](/practice-tests/combination-vehicles).
- **Entry-Level Driver Training for the upgrade.** Since February 7, 2022, federal rule requires a Class B holder upgrading to Class A to complete ELDT from a provider listed on FMCSA's [Training Provider Registry](https://tpr.fmcsa.dot.gov/) before taking the Class A skills test ([49 CFR Part 380](https://www.ecfr.gov/current/title-49/part-380)) — the full rule, including its narrow exceptions, is in [ELDT Requirements](/knowledge/getting-your-cdl/eldt-requirements).
- **The 14-day minimum permit hold, again** — the federal floor in [49 CFR 383.25](https://www.ecfr.gov/current/title-49/part-383/section-383.25) attaches to the new permit, not to you.
- **A skills test in a Class A combination** — the [three-part test](/knowledge/getting-your-cdl/cdl-skills-test), in the bigger vehicle this time.

Straight-truck experience helps you learn faster; it substitutes for none of the steps. And because training and testing get paid for on two occasions instead of one, the fee categories in [what a CDL costs](/knowledge/getting-your-cdl/cdl-cost) apply twice to the B-then-A road.

## Getting a Class A or Class B CDL in Georgia

Georgia mirrors the federal vehicle groups — the [Georgia DDS license-classes table](https://dds.georgia.gov/license-classes) draws the same 26,001- and 10,000-pound lines — and the Department of Driver Services administers the process. The Georgia steps, in order:

- **Hold a valid regular Georgia driver's license.** DDS requires one before any commercial permit or license.
- **Meet the age rule for the driving you want.** Georgia issues CDLs starting at 18, but drivers under 21 carry a Georgia-only (intrastate) restriction; on or after the 21st birthday, DDS removes it at a Customer Service Center.
- **Handle medical certification if your operating category requires it.** Most non-excepted drivers need a medical examiner's certificate on file with their self-certification — and since June 18, 2025, the examiner transmits that certificate to DDS electronically; DDS no longer accepts certificates from drivers directly. Requirements differ by operating category, so follow the [DDS CDL permit instructions](https://dds.georgia.gov/georgia-licenses-ids-and-permits/new-license-id-or-permit/how-do-i-cdl-permit) rather than assuming.
- **Pass the knowledge tests for your class and receive the commercial learner's permit.** Everyone takes general knowledge; Class A applicants add the combination vehicles test; air-brake testing follows the vehicle you test in. The permit's supervision rules, validity, and limits are in [The CDL Permit Explained](/knowledge/getting-your-cdl/cdl-permit-explained).
- **Complete ELDT before the skills test** if this is a first Class A or Class B or a B-to-A upgrade — the state verifies completion through the federal registry before it will test you.
- **Hold the permit at least 14 days, then take the skills test in the class of vehicle you will drive.** A Class A test happens in a combination, a Class B test in a heavy straight truck — and while you practice, a driver licensed for that class must be beside you.

One Georgia note worth underlining: choose the class before you choose the school, because the class decides the training vehicle, the extra knowledge test, and the skills-test vehicle — in that order.

## A tale of two offers (illustration, not career advice)

Two applicants finish their permits the same week. One holds a standing offer on a refuse route — Class B equipment, home every night, a seat waiting as soon as the license prints. The other has no offer yet but wants regional flatbed. The first tests in the fleet's straight truck and starts earning while the second is still scheduling range time in a combination. Three years on, the refuse driver decides to chase flatbed after all — new permit, upgrade ELDT, combination skills test. Neither driver chose wrong; they paid different prices at different times. The checklist below is how you price yours.

## Common mistakes

- Choosing a class before identifying the vehicle the target job actually runs — the equipment line in the posting outranks every generalization.
- Treating Class B as a stepping stone that shortens Class A later. It does not: the upgrade repeats the permit, adds ELDT, and ends in a combination skills test.
- Reading the weight thresholds as actual-weight-only. Ratings count, and the greater number governs — the threshold mechanics, including Class C, live in [CDL Classes A, B, and C Compared](/knowledge/getting-your-cdl/cdl-classes-compared).
- Testing in a vehicle that quietly narrows the license — an automatic transmission or a truck without full air brakes writes a [restriction](/knowledge/getting-your-cdl/cdl-endorsements-restrictions) onto whichever class you earn.
- Assuming bus endorsements transfer to freight. P and S ride on top of a class; they never widen the vehicle group.

## Your decision checklist

- Target job named — and the exact vehicle it runs identified
- Class matched to that vehicle: combination over the thresholds means A; heavy straight truck means B
- Endorsements listed on top of the class (N, T, P, S, or H as the job requires)
- If starting with B: the later upgrade priced in — new permit, upgrade ELDT, combination skills test
- Georgia path mapped: valid Georgia license, medical certification if required, knowledge tests, permit, ELDT, the 14-day hold, skills test in the right vehicle
- Studying started with the [general knowledge practice test](/practice-tests/general-knowledge)

## Keep learning

- The whole sequence: [How to Get Your CDL](/knowledge/getting-your-cdl/how-to-get-your-cdl) — and the full three-class map in [CDL Classes A, B, and C Compared](/knowledge/getting-your-cdl/cdl-classes-compared)
- Going deeper: [ELDT Requirements](/knowledge/getting-your-cdl/eldt-requirements) · [The CDL Skills Test](/knowledge/getting-your-cdl/cdl-skills-test) · [What Does It Cost to Get a CDL?](/knowledge/getting-your-cdl/cdl-cost)
- Drill the tests your class requires: [Air Brakes](/practice-tests/air-brakes) · [Combination Vehicles](/practice-tests/combination-vehicles)
- **Interested in Class A training in Dalton?** Learn more about [Trucking Life Academy](/academy) · get ahead early with [CDL Pre-School](/cdl-pre-school) · [new guides by email as they publish](/#newsletter).$mdx$,
      'Class A vs Class B CDL: Which One Should You Get? | Trucking Life with Shawn',
      'Class A covers combinations with trailers over 10,000 lb; Class B covers heavy single trucks. Compare the jobs each supports, the B-to-A upgrade, and the Georgia steps.',
      'Shawn Gresham', v_bio,
      $j$[
        {"label":"49 CFR 383.91 — Commercial motor vehicle groups (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.91"},
        {"label":"49 CFR 383.5 — Definitions, including GCWR (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.5"},
        {"label":"49 CFR 383.25 — Commercial learner's permit provisions (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-383/section-383.25"},
        {"label":"49 CFR Part 380 — Entry-Level Driver Training (eCFR)","url":"https://www.ecfr.gov/current/title-49/part-380"},
        {"label":"FMCSA Training Provider Registry","url":"https://tpr.fmcsa.dot.gov/"},
        {"label":"Georgia DDS — License Classes","url":"https://dds.georgia.gov/license-classes"},
        {"label":"Georgia DDS — Apply for a Commercial (CDL) License","url":"https://dds.georgia.gov/georgia-licenses-ids-and-permits/new-license-id-or-permit/how-do-i-cdl-license"},
        {"label":"Georgia DDS — CDL Permit (CLP)","url":"https://dds.georgia.gov/georgia-licenses-ids-and-permits/new-license-id-or-permit/how-do-i-cdl-permit"}
      ]$j$::jsonb,
      $j$[
        {"q":"Can I drive a tractor-trailer with a Class B CDL?","a":"No. A combination rated 26,001 pounds or more whose towed unit is rated over 10,000 pounds is a Group A vehicle under 49 CFR 383.91, and it requires a Class A CDL. A Class B license covers a heavy single vehicle towing 10,000 pounds or less — neither experience nor endorsements stretch it across the combination line."},
        {"q":"Does upgrading from Class B to Class A require ELDT?","a":"Yes. Since February 7, 2022, federal rule has required a driver upgrading from Class B to Class A to complete Entry-Level Driver Training from a provider listed on FMCSA's Training Provider Registry before taking the Class A skills test. The upgrade also means a Class A learner's permit, the 14-day minimum hold, and a skills test in a combination vehicle."},
        {"q":"Is Class A or Class B better for local work?","a":"Neither, by rule — it depends on the vehicle the local job runs. Many home-nightly jobs use Class B equipment such as dump trucks, box trucks, mixers, and refuse trucks, while some local combination work — port drayage, LTL city routes — requires Class A. Find the vehicle in the job posting first, then match the class to it."},
        {"q":"Which knowledge tests do Class A and Class B applicants take?","a":"Every CDL applicant takes the general knowledge test. Class A applicants add the combination vehicles test, and any applicant testing in a vehicle with air brakes takes the air brakes test — skipping it puts an air-brake restriction on the license. Endorsement tests such as tanker or passenger stack on top of either class."},
        {"q":"Is it smarter to get a Class B CDL first and upgrade to Class A later?","a":"Only when a real Class B job is part of the plan. Upgrading later repeats the licensing sequence — a new commercial learner's permit, Entry-Level Driver Training for the upgrade, and a skills test in a combination — so drivers who already know they want combination freight usually test in Class A from the start. A driver holding a Class B offer today has a legitimate reason to take it."}
      ]$j$::jsonb,
      '{getting-your-cdl,cdl-classes,class-a,class-b,upgrade,georgia}',
      8, false, 'published', true, '2026-08-19', v_pub
    );
  end if;

  ---------------------------------------------------------------------------
  -- Related-article rows (curated; ON CONFLICT DO NOTHING keeps re-runs clean)
  ---------------------------------------------------------------------------
  declare
    ab uuid; g1 uuid; g4 uuid; g5 uuid;
  begin
    select id into ab from public.kc_articles where category_id = v_gyc and slug = 'class-a-vs-class-b-cdl';
    select id into g1 from public.kc_articles where category_id = v_gyc and slug = 'how-to-get-your-cdl';
    select id into g4 from public.kc_articles where category_id = v_gyc and slug = 'eldt-requirements';
    select id into g5 from public.kc_articles where category_id = v_gyc and slug = 'cdl-classes-compared';

    if ab is not null and g1 is not null and g4 is not null and g5 is not null then
      insert into public.kc_related (article_id, related_id, sort_order) values
        (ab, g5, 1), (ab, g4, 2), (ab, g1, 3)
      on conflict (article_id, related_id) do nothing;
    end if;
  end;
end $kc$;

-- ---------------------------------------------------------------------------
-- Cross-links INTO the new page from three Batch 3 articles (guarded,
-- slug-scoped, replace-based, idempotent — same doctrine as 040/042/045:
-- presence guard on the target text + absence guard on the new link, so a
-- re-run is a no-op and nothing else in the body can be touched).
-- ---------------------------------------------------------------------------

-- 1. CDL Classes A, B, and C Compared → the decision guide: the "Who this
--    choice faces" line now hands two-way deciders to the new page.
update public.kc_articles a set body_mdx = replace(
    a.body_mdx,
    'and anyone whose employer''s equipment is changing under them.',
    'and anyone whose employer''s equipment is changing under them. Weighing the two big classes against each other? The decision framework — jobs, the upgrade math, and the Georgia path — is in [Class A vs Class B CDL: Which One Should You Get?](/knowledge/getting-your-cdl/class-a-vs-class-b-cdl).')
from public.kc_categories c
where c.id = a.category_id and c.slug = 'getting-your-cdl'
  and a.slug = 'cdl-classes-compared'
  and a.body_mdx like '%and anyone whose employer''s equipment is changing under them.%'
  and a.body_mdx not like '%/knowledge/getting-your-cdl/class-a-vs-class-b-cdl%';

-- 2. How to Get Your CDL (pillar) → the decision guide: the spokes line
--    grows an A-vs-B entry next to the three-class map.
update public.kc_articles a set body_mdx = replace(
    a.body_mdx,
    '[Classes A/B/C](/knowledge/getting-your-cdl/cdl-classes-compared)',
    '[Classes A/B/C](/knowledge/getting-your-cdl/cdl-classes-compared) · [A vs B — which one?](/knowledge/getting-your-cdl/class-a-vs-class-b-cdl)')
from public.kc_categories c
where c.id = a.category_id and c.slug = 'getting-your-cdl'
  and a.slug = 'how-to-get-your-cdl'
  and a.body_mdx like '%[Classes A/B/C](/knowledge/getting-your-cdl/cdl-classes-compared)%'
  and a.body_mdx not like '%/knowledge/getting-your-cdl/class-a-vs-class-b-cdl%';

-- 3. ELDT Requirements → the decision guide: the upgrade-scope mistake
--    bullet now routes still-deciding readers to the comparison.
update public.kc_articles a set body_mdx = replace(
    a.body_mdx,
    '- Forgetting ELDT applies to B-to-A **upgrades** and first-time H/P/S, not just brand-new drivers.',
    '- Forgetting ELDT applies to B-to-A **upgrades** and first-time H/P/S, not just brand-new drivers. Still deciding between the classes? Start at [Class A vs Class B CDL](/knowledge/getting-your-cdl/class-a-vs-class-b-cdl).')
from public.kc_categories c
where c.id = a.category_id and c.slug = 'getting-your-cdl'
  and a.slug = 'eldt-requirements'
  and a.body_mdx like '%- Forgetting ELDT applies to B-to-A **upgrades** and first-time H/P/S, not just brand-new drivers.%'
  and a.body_mdx not like '%/knowledge/getting-your-cdl/class-a-vs-class-b-cdl%';
