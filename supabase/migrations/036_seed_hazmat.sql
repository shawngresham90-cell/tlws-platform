-- 036_seed_hazmat.sql
-- CDL Practice Tests — Milestone 8: Hazmat (H endorsement) question bank (35 items).
--
-- ⚠️ COMMITTED; apply AFTER 029 (the questions columns this seed writes).
-- IDEMPOTENT: the tests row inserts-if-absent by slug, and the question insert
-- runs only when the bank is empty — re-running never duplicates or mutates.
--
-- Content rules (hard, from the Practice Tests blueprint — same as 032/034/035):
--   * Every question is ORIGINAL wording — written fresh against 49 CFR
--     Parts 171–180 (plus the Part 392/397 driving rules) and the AAMVA CDL
--     manual hazardous-materials section (Section 9) structure, never copied
--     from any DMV test or commercial question bank.
--   * Every question carries a citation (49 CFR section or CDL Manual
--     section) and a verified_date. Verified 2026-07-17.
--   * `choices` is the canonical ARRAY shape: [{"key","text"}, ...] (029).
--   * Answer keys are deliberately balanced across a–d (M5 review rule:
--     a lopsided key lets test-wise students game the choices).
--   * The tests row slug MUST stay 'hazmat' — it is the data layer's join
--     key to the TS catalog.
--
-- Content fixes: use the Admin → Tests module (M7) or a targeted UPDATE keyed
-- on sort_order. NEVER delete + reseed — that mints new question UUIDs,
-- zeroing miss_count history, orphaning the ids inside test_attempts.answers
-- and students' device-local bookmarks/misses, and wiping saved progress.

-- ---------------------------------------------------------------------------
-- 1. The test row (insert-if-absent; a re-run never mutates existing state,
--    so a deliberately unpublished test can't be silently re-published)
-- ---------------------------------------------------------------------------
insert into public.tests (slug, title, description, category, is_published, question_count)
values (
  'hazmat',
  'Hazmat',
  'The H-endorsement knowledge test — hazard classes, placards, shipping papers, and the loading, parking, and emergency rules that keep dangerous cargo legal.',
  'hazmat',
  true,
  0
)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 2. The question bank (only when empty)
-- ---------------------------------------------------------------------------
do $$
declare
  v_test uuid;
begin
  select id into v_test from public.tests where slug = 'hazmat';
  if v_test is null then
    raise exception 'hazmat test row missing';
  end if;
  if exists (select 1 from public.questions where test_id = v_test) then
    raise notice 'Hazmat bank already seeded — skipping';
    return;
  end if;

  insert into public.questions
    (test_id, prompt, choices, correct_key, explanation, cfr_cite, verified_date, difficulty, tags, sort_order)
  values
  (v_test,
   'The hazardous materials regulations exist to serve three goals. Which list states them?',
   '[{"key":"a","text":"Speed up freight movement, standardize industry paperwork, and lower carriers'' insurance costs"},{"key":"b","text":"License shippers, tax dangerous cargo, and track foreign freight"},{"key":"c","text":"Contain the material, communicate the risk, and assure safe drivers and equipment"},{"key":"d","text":"Protect cargo value, prevent theft, and simplify customs inspections"}]'::jsonb,
   'c',
   'Everything in the rules hangs on those three ideas: packaging that keeps the product in the package, papers and placards that tell everyone what is inside, and training and inspection standards that keep the people and trucks moving it safe.',
   'CDL Manual §9.1', '2026-07-17', 1, '{hazmat,regulations}', 1),

  (v_test,
   'Before you can legally haul placarded loads, what must you add to your CDL?',
   '[{"key":"a","text":"The H endorsement — a knowledge test plus a TSA security threat assessment"},{"key":"b","text":"A federal hazmat license issued separately from your CDL"},{"key":"c","text":"Nothing, as long as your carrier holds a hazmat safety permit"},{"key":"d","text":"The X endorsement, which every tank driver already carries"}]'::jsonb,
   'a',
   'Placarded loads require the hazardous materials endorsement on your own license: pass the knowledge test and clear the TSA background check. A carrier''s permits never substitute for the driver''s endorsement.',
   'CDL Manual §9.1', '2026-07-17', 1, '{hazmat,endorsement}', 2),

  (v_test,
   'Whose job is it to package the material, mark and label the packages, and prepare the shipping papers?',
   '[{"key":"a","text":"The driver''s"},{"key":"b","text":"The shipper''s"},{"key":"c","text":"The carrier''s"},{"key":"d","text":"The consignee''s"}]'::jsonb,
   'b',
   'The shipper knows the product, so the shipper packages it, marks and labels it, and certifies the shipping papers. The carrier moves it and the driver checks it — but the paperwork and packaging start at the dock that ships it.',
   'CDL Manual §9.2', '2026-07-17', 1, '{hazmat,responsibilities}', 3),

  (v_test,
   'Which of these is specifically the DRIVER''s responsibility?',
   '[{"key":"a","text":"Certifying that the shipment was prepared under the regulations"},{"key":"b","text":"Choosing the packing group for the material"},{"key":"c","text":"Filing the carrier''s annual hazmat registration"},{"key":"d","text":"Refusing leaking packages and keeping the placards on the vehicle"}]'::jsonb,
   'd',
   'The driver is the last check: refuse damaged or leaking shipments, placard the vehicle, keep the papers in reach, and deliver without unnecessary delay. Certification and classification belong to the shipper.',
   'CDL Manual §9.2', '2026-07-17', 2, '{hazmat,responsibilities}', 4),

  (v_test,
   'How many hazard classes do the regulations sort dangerous materials into?',
   '[{"key":"a","text":"Six"},{"key":"b","text":"Nine"},{"key":"c","text":"Twelve"},{"key":"d","text":"Four"}]'::jsonb,
   'b',
   'There are nine hazard classes, from Class 1 explosives through Class 9 miscellaneous. The class tells you the kind of danger on board, and it drives every placard, loading, and parking decision that follows.',
   'CDL Manual §9.2', '2026-07-17', 1, '{hazmat,hazard-classes}', 5),

  (v_test,
   'A shipping paper''s basic description must appear in a fixed sequence. Which order is correct?',
   '[{"key":"a","text":"ID number, proper shipping name, hazard class, packing group"},{"key":"b","text":"Proper shipping name, ID number, packing group, hazard class"},{"key":"c","text":"Hazard class, ID number, proper shipping name, packing group"},{"key":"d","text":"Packing group, hazard class, ID number, proper shipping name"}]'::jsonb,
   'a',
   'The required order is identification number first, then the proper shipping name, the hazard class, and the packing group — for example: UN1203, Gasoline, 3, PG II. Emergency crews read that line under pressure, so the sequence never varies.',
   '49 CFR 172.202', '2026-07-17', 3, '{hazmat,shipping-papers}', 6),

  (v_test,
   'On a shipping paper that mixes hazmat with ordinary freight, how are the hazardous entries made to stand out?',
   '[{"key":"a","text":"They are listed at the bottom, after all other freight"},{"key":"b","text":"They are attached in a separate sealed envelope"},{"key":"c","text":"They are entered first, highlighted in a contrasting color, or marked with an X in the HM column"},{"key":"d","text":"They are written entirely in red ink"}]'::jsonb,
   'c',
   'Any of those three treatments works: hazmat entries listed before the rest, printed in a contrasting color, or flagged with an X (or RQ, for a reportable quantity) in the hazardous-materials column. Without one of them, the entry is not identified as hazmat.',
   'CDL Manual §9.3', '2026-07-17', 2, '{hazmat,shipping-papers}', 7),

  (v_test,
   'While you are driving a placarded load, where must the shipping papers be?',
   '[{"key":"a","text":"In a pouch on the driver''s door, or in clear view within your reach with the seat belt on"},{"key":"b","text":"Locked in the glove box so they cannot be stolen"},{"key":"c","text":"Taped inside the trailer next to the cargo they describe"},{"key":"d","text":"On file at the carrier''s main office"}]'::jsonb,
   'a',
   'The papers ride where a responder can find them without you: the driver''s-door pouch, or in clear view within immediate reach while you are belted. A locked box or a trailer wall defeats the purpose.',
   '49 CFR 177.817', '2026-07-17', 1, '{hazmat,shipping-papers}', 8),

  (v_test,
   'You step out of the cab at a rest stop. Where do the shipping papers go?',
   '[{"key":"a","text":"In your pocket, so the load is never separated from its papers"},{"key":"b","text":"Under the windshield wiper, facing out"},{"key":"c","text":"Wherever they were kept while you were driving"},{"key":"d","text":"On the driver''s seat or in the driver''s-door pouch"}]'::jsonb,
   'd',
   'When you leave the cab, the papers go on the driver''s seat or into the door pouch — the fixed spots every emergency responder is trained to check. Carrying them away with you leaves a burning truck with no information in it.',
   '49 CFR 177.817', '2026-07-17', 2, '{hazmat,shipping-papers}', 9),

  (v_test,
   'Besides the shipping paper itself, what emergency information must travel with a hazmat shipment?',
   '[{"key":"a","text":"A printed route survey signed by the carrier''s safety officer"},{"key":"b","text":"Emergency response information for the material, and a phone number monitored around the clock"},{"key":"c","text":"The shipper''s certificate of insurance"},{"key":"d","text":"A copy of the driver''s hazmat training record"}]'::jsonb,
   'b',
   'Responders need to know what the material does and who to call: written emergency response information (or the ERG page for the material) kept with the shipping paper, plus an emergency phone number answered at all times while the shipment moves.',
   '49 CFR 172.602', '2026-07-17', 2, '{hazmat,emergency-response}', 10),

  (v_test,
   'The Emergency Response Guidebook (ERG) is indexed so responders can look a material up by its:',
   '[{"key":"a","text":"Carrier name or trailer number"},{"key":"b","text":"Packing group or net weight"},{"key":"c","text":"Identification number or proper shipping name"},{"key":"d","text":"State of origin or delivery address"}]'::jsonb,
   'c',
   'The ERG''s lookup sections key every guide page to the four-digit ID number and the proper shipping name — the same two identifiers on the shipping paper and the vehicle. That is why those identifiers must be visible and accurate.',
   'CDL Manual §9.7', '2026-07-17', 1, '{hazmat,erg,emergency-response}', 11),

  (v_test,
   'Placards on a placarded vehicle must be displayed:',
   '[{"key":"a","text":"On all four sides, turned square-on-point, at least three inches clear of other markings"},{"key":"b","text":"On the rear and the driver''s side, where inspectors normally approach"},{"key":"c","text":"Anywhere on the vehicle they fit, as long as at least two are visible from the road"},{"key":"d","text":"On the front bumper and both doors of the tractor"}]'::jsonb,
   'a',
   'Four placards — front, rear, and both sides — each readable from the direction it faces, hung point-up like a diamond, and kept clear of anything (equipment, dirt, other markings) that would hide the message.',
   '49 CFR 172.516', '2026-07-17', 2, '{hazmat,placards}', 12),

  (v_test,
   'For materials in placard Table 2, placards are required once the load reaches:',
   '[{"key":"a","text":"Any amount at all"},{"key":"b","text":"1,001 pounds aggregate gross weight or more"},{"key":"c","text":"5,000 pounds in a single package"},{"key":"d","text":"Half the vehicle''s rated payload"}]'::jsonb,
   'b',
   'Table 2 materials placard at 1,001 pounds aggregate gross weight — packaging plus contents, all Table 2 classes added together. Under that total the packages still carry their labels, but the vehicle itself needs no placard.',
   '49 CFR 172.504', '2026-07-17', 2, '{hazmat,placards}', 13),

  (v_test,
   'For the high-danger materials in placard Table 1, the placarding threshold is:',
   '[{"key":"a","text":"1,001 pounds aggregate, the same as Table 2"},{"key":"b","text":"119 gallons of liquid capacity"},{"key":"c","text":"One full pallet or more"},{"key":"d","text":"Any quantity"}]'::jsonb,
   'd',
   'Table 1 covers the worst actors — Division 1.1 explosives and dangerous-when-wet materials among them — and any amount of a Table 1 material placards the vehicle. There is no minimum weight to reach first.',
   '49 CFR 172.504', '2026-07-17', 2, '{hazmat,placards}', 14),

  (v_test,
   'A packaging counts as bulk — and must display the ID number of its contents — when it can hold more than:',
   '[{"key":"a","text":"55 gallons"},{"key":"b","text":"1,000 pounds"},{"key":"c","text":"500 liters"},{"key":"d","text":"119 gallons"}]'::jsonb,
   'd',
   'A single container holding more than 119 gallons of liquid is bulk packaging. Cargo tanks and other bulk containers display the four-digit ID number on placards or orange panels, so the contents can be identified from a distance.',
   'CDL Manual §9.5', '2026-07-17', 3, '{hazmat,bulk-packaging,id-numbers}', 15),

  (v_test,
   'The four-digit numbers preceded by "UN" or "NA" on packages and shipping papers are:',
   '[{"key":"a","text":"Carrier fleet codes"},{"key":"b","text":"Packing-group serial numbers"},{"key":"c","text":"Identification numbers that match the material to its emergency guide"},{"key":"d","text":"Customs tariff codes"}]'::jsonb,
   'c',
   'Those are identification numbers from the hazardous materials table. UN numbers are international, NA numbers are North American, and either one leads a responder straight to the correct guide page for the material.',
   'CDL Manual §9.3', '2026-07-17', 1, '{hazmat,id-numbers}', 16),

  (v_test,
   'Which is a general rule when loading or unloading any hazardous material?',
   '[{"key":"a","text":"Keep the engine running so the vehicle can be moved quickly"},{"key":"b","text":"Set the parking brake, keep heat sources away, and never use hooks or tools that could damage packages"},{"key":"c","text":"Load the hazmat last so it always rides near the doors"},{"key":"d","text":"Stack packages tightly against the trailer doors so unloading at the dock goes faster"}]'::jsonb,
   'b',
   'Loading rules come down to protecting the packages: vehicle braked, engine off unless it must run a pump, no smoking or open flame nearby, no package-piercing tools, and everything braced so it cannot shift or fall in transit.',
   'CDL Manual §9.4', '2026-07-17', 1, '{hazmat,loading}', 17),

  (v_test,
   'How close may anyone smoke to a vehicle being loaded with explosives, oxidizers, or flammables?',
   '[{"key":"a","text":"Ten feet, if the wind carries the smoke away from the trailer"},{"key":"b","text":"There is no distance rule — only \"not inside the trailer\""},{"key":"c","text":"Anywhere outside the cargo space"},{"key":"d","text":"No closer than 25 feet"}]'::jsonb,
   'd',
   'Keep every ignition source — lit cigarettes included — at least 25 feet away while Class 1, Class 3, Class 4, or Class 5 materials are being handled. One spark near vapors or oxidizer dust is all a fire needs.',
   'CDL Manual §9.4', '2026-07-17', 2, '{hazmat,smoking,loading}', 18),

  (v_test,
   'You are offered a mixed load: drums of poison and boxed groceries. What does the rule say?',
   '[{"key":"a","text":"Never load poisons in the same vehicle with food for people or animals"},{"key":"b","text":"Allowed, if the food is stacked against the opposite trailer wall"},{"key":"c","text":"Allowed, if the poison drums ride on the floor and the food is racked above them"},{"key":"d","text":"Allowed, with the receiver''s written consent on the shipping paper"}]'::jsonb,
   'a',
   'Poisons (Division 6.1) and poison gases never share a vehicle with anything meant to be eaten by people or animals. Contamination you cannot see is the danger — separation inside the same box is not protection.',
   '49 CFR 177.841', '2026-07-17', 2, '{hazmat,segregation,poison}', 19),

  (v_test,
   'A package is marked "Inhalation Hazard." What does that marking require?',
   '[{"key":"a","text":"Carry it in the cab, where you can watch it for leaks"},{"key":"b","text":"Display the POISON INHALATION HAZARD or POISON GAS placard whatever the amount, and never carry it in the cab"},{"key":"c","text":"Placard only past 1,001 pounds, like other poisons"},{"key":"d","text":"Double-wrap the package in plastic sheeting before loading"}]'::jsonb,
   'b',
   'For inhalation-hazard materials the vapor, not a puddle you can step around, is what kills — so the placard goes up no matter how small the package, and the material never rides in the driver''s compartment.',
   '49 CFR 172.313', '2026-07-17', 2, '{hazmat,poison,inhalation-hazard}', 20),

  (v_test,
   'Before loading Division 1.1 explosives, you must check that the cargo space has:',
   '[{"key":"a","text":"A working dome light and a mounted fire axe"},{"key":"b","text":"Steel flooring, washed down and still damp"},{"key":"c","text":"No sharp points that could damage cargo, and a tight floor lining with no exposed metal"},{"key":"d","text":"At least one open vent on each side wall"}]'::jsonb,
   'c',
   'Explosives ride only in a clean box: inspect for anything that could pierce or chafe a package, and Division 1.1–1.3 loads need a tight floor liner of non-metallic or non-ferrous material. Cargo heaters stay off and disconnected.',
   '49 CFR 177.835', '2026-07-17', 3, '{hazmat,explosives,loading}', 21),

  (v_test,
   'The transport-index numbers on the radioactive packages in one vehicle may add up to no more than:',
   '[{"key":"a","text":"10"},{"key":"b","text":"100"},{"key":"c","text":"25"},{"key":"d","text":"50"}]'::jsonb,
   'd',
   'Each package''s transport index states how much radiation control it needs, and one (non-exclusive-use) vehicle is capped at a combined total of 50. Distance and shielding only protect people if the total stays limited.',
   '49 CFR 173.441', '2026-07-17', 3, '{hazmat,radioactive}', 22),

  (v_test,
   'What does a radioactive package''s transport index tell the people handling it?',
   '[{"key":"a","text":"The degree of control the package needs during transportation"},{"key":"b","text":"The half-life of the isotope inside"},{"key":"c","text":"The maximum road speed for the vehicle carrying it"},{"key":"d","text":"How many days the package may remain in transit"}]'::jsonb,
   'a',
   'The transport index expresses how much radiation surrounds the package, which sets its spacing from people, film, and other packages. It is a handling-control number — not a timer, and not a speed limit.',
   'CDL Manual §9.4', '2026-07-17', 2, '{hazmat,radioactive}', 23),

  (v_test,
   'When filling a flammable-liquid cargo tank through an open filling hole, you must first:',
   '[{"key":"a","text":"Turn on the tank''s running lights so dock workers can see the hatch"},{"key":"b","text":"Open every dome cover to equalize the pressure"},{"key":"c","text":"Ground the tank, and keep the connection in place until the filling hole is closed"},{"key":"d","text":"Run the tank one-quarter full, then wait ten minutes before continuing"}]'::jsonb,
   'c',
   'Flowing fuel builds a static charge, and a static spark over an open hole ignites vapor. Ground before the hole opens and keep the bond until after it closes — the charge needs somewhere to go besides a spark.',
   'CDL Manual §9.5', '2026-07-17', 2, '{hazmat,bulk-packaging,flammables}', 24),

  (v_test,
   'The person watching a cargo tank being loaded or unloaded with hazardous materials must be:',
   '[{"key":"a","text":"A supervisor with at least two years of tank experience"},{"key":"b","text":"Alert, within 25 feet of the tank, with a clear view of it, and able to move it if needed"},{"key":"c","text":"Inside the cab with the engine idling"},{"key":"d","text":"Anywhere on the terminal property, as long as they can be reached by radio at all times"}]'::jsonb,
   'b',
   'Tank transfers must be attended by a qualified person the entire time: awake, within 25 feet, an unobstructed view of the tank, knowing the hazards and the procedures, and authorized and able to move the tank. A radio somewhere on the lot is not attendance.',
   '49 CFR 177.834', '2026-07-17', 3, '{hazmat,bulk-packaging,attendance}', 25),

  (v_test,
   'A parked placarded vehicle counts as "attended" only while someone who knows the hazards:',
   '[{"key":"a","text":"Is on the vehicle awake (not in the sleeper), or within 100 feet of it with an unobstructed view"},{"key":"b","text":"Holds the keys, anywhere within a mile of the vehicle"},{"key":"c","text":"Walks out and checks on it at least once every hour"},{"key":"d","text":"Watches it on a closed-circuit camera monitored continuously from inside the building"}]'::jsonb,
   'a',
   'Attendance means presence: on the vehicle and awake, or within 100 feet with the vehicle in plain sight — and the attendant must know the hazards and be able to move the vehicle if something goes wrong.',
   '49 CFR 397.5', '2026-07-17', 2, '{hazmat,attendance,parking}', 26),

  (v_test,
   'You are hauling Division 1.2 explosives and need to stop. Where may you NEVER park, even briefly?',
   '[{"key":"a","text":"A carrier terminal''s fenced yard"},{"key":"b","text":"A designated safe haven"},{"key":"c","text":"A shipper''s dock while waiting to unload"},{"key":"d","text":"Within five feet of the traveled part of the road"}]'::jsonb,
   'd',
   'Explosives loads keep hard setbacks: never within 5 feet of the traveled roadway, and — outside brief, necessary operational stops — not within 300 feet of buildings, bridges, tunnels, or gathered crowds. Terminals, docks, and safe havens exist for exactly these stops.',
   '49 CFR 397.7', '2026-07-17', 2, '{hazmat,explosives,parking}', 27),

  (v_test,
   'A "safe haven" is:',
   '[{"key":"a","text":"Any truck stop with 24-hour security cameras"},{"key":"b","text":"The shoulder of a divided highway, during daylight hours"},{"key":"c","text":"A location approved in writing for parking unattended explosives"},{"key":"d","text":"Any garage or yard the carrier owns"}]'::jsonb,
   'c',
   'Safe havens are specifically approved locations — the only places a Division 1.1–1.3 load may sit with nobody attending it. Without one, someone qualified stays with the vehicle, period.',
   'CDL Manual §9.6', '2026-07-17', 1, '{hazmat,parking,explosives}', 28),

  (v_test,
   'When fueling a placarded vehicle, the rules require:',
   '[{"key":"a","text":"A high idle, to keep the air system charged while pumping"},{"key":"b","text":"Engine off, with a person in control of the nozzle the entire time"},{"key":"c","text":"Fueling only at the carrier''s own terminal pumps"},{"key":"d","text":"Filling both tanks in under five minutes"}]'::jsonb,
   'b',
   'Two rules, both about ignition and overflow: the engine is shut off before fuel flows, and someone stays at the pump controlling the flow from start to finish. An unattended nozzle on a placarded rig is how a small spill becomes a fire.',
   '49 CFR 397.15', '2026-07-17', 1, '{hazmat,fueling}', 29),

  (v_test,
   'On a placarded vehicle, the tires must be examined:',
   '[{"key":"a","text":"Only during the pre-trip inspection"},{"key":"b","text":"Once per week, by a mechanic"},{"key":"c","text":"Every 500 miles"},{"key":"d","text":"At the start of the trip and each time the vehicle is parked"}]'::jsonb,
   'd',
   'Check every tire when the trip begins and again at every stop. An underinflated or overheated tire is a rolling ignition source under a hazmat load — an overheated one comes off and goes a safe distance from the vehicle, not back on it.',
   '49 CFR 397.17', '2026-07-17', 2, '{hazmat,tires,parking}', 30),

  (v_test,
   'Approaching a railroad crossing with a placarded load or a chlorine shipment, you must:',
   '[{"key":"a","text":"Stop 15 to 50 feet before the nearest rail, then cross without shifting gears"},{"key":"b","text":"Slow to 10 mph and roll across without stopping"},{"key":"c","text":"Stop only when the warning lights are flashing"},{"key":"d","text":"Sound the horn and cross in your highest gear"}]'::jsonb,
   'a',
   'Placarded vehicles, chlorine loads, and hazmat cargo tanks stop at every crossing: 15 to 50 feet from the nearest rail, look and listen both ways, then cross in a gear that carries you all the way over without a shift.',
   '49 CFR 392.10', '2026-07-17', 2, '{hazmat,railroad}', 31),

  (v_test,
   'How is the route chosen for a placarded shipment of Division 1.1–1.3 explosives?',
   '[{"key":"a","text":"The driver picks the fastest interstate routing while en route"},{"key":"b","text":"Dispatch phones in turn-by-turn directions each morning"},{"key":"c","text":"The carrier prepares a written route plan in advance, and the driver carries and follows it"},{"key":"d","text":"Any route is legal as long as toll roads are avoided"}]'::jsonb,
   'c',
   'Explosives moves run on a written route plan prepared before the trip, avoiding heavily populated areas, and the plan rides with the driver. For other placarded loads, state and local permit routes still control — check before rolling, not after.',
   '49 CFR 397.67', '2026-07-17', 2, '{hazmat,routing}', 32),

  (v_test,
   'After a hazmat release, which situation requires an IMMEDIATE report to the National Response Center?',
   '[{"key":"a","text":"A death, an injury requiring hospitalization, or an evacuation caused by the release"},{"key":"b","text":"Any transit delay of more than two hours"},{"key":"c","text":"Every release, no matter how small"},{"key":"d","text":"Only releases involving radioactive material"}]'::jsonb,
   'a',
   'The phone call goes in at the earliest practical moment when a release kills or hospitalizes someone, forces an evacuation or a major road closure, causes $50,000 or more in damage, or involves radioactive or infectious materials. A detailed written report (DOT Form 5800.1) follows within 30 days.',
   '49 CFR 171.15', '2026-07-17', 3, '{hazmat,incident-reporting,emergencies}', 33),

  (v_test,
   'En route, you discover one package leaking. What is the right sequence?',
   '[{"key":"a","text":"Drive straight through to the consignee — the product is theirs"},{"key":"b","text":"Park, secure the area, stay with the vehicle, and send someone else for help"},{"key":"c","text":"Set the leaking package out at the roadside and continue the trip"},{"key":"d","text":"Hose down the trailer floor at the next truck stop"}]'::jsonb,
   'b',
   'Do not drive farther than safety requires, do not touch or walk through the leaked material, and keep people away while a bystander carries your shipping-paper information to a phone. Moving a leaking load draws a contaminated line down the highway that someone else must close and clean.',
   'CDL Manual §9.7', '2026-07-17', 2, '{hazmat,leaks,emergencies}', 34),

  (v_test,
   'Which habit belongs in hazmat security awareness?',
   '[{"key":"a","text":"Posting your route online so family can follow the trip"},{"key":"b","text":"Leaving the rig idling during quick stops so thieves see it is occupied"},{"key":"c","text":"Announcing the cargo on the CB so nearby drivers keep their distance"},{"key":"d","text":"Verifying who you deliver to, and keeping route and cargo details private"}]'::jsonb,
   'd',
   'Hazmat is a theft and sabotage target. Confirm identities at pickup and delivery, keep cargo and routing details off the airwaves and the internet, never leave the truck running unattended, and report suspicious interest in your load.',
   '49 CFR 172.800', '2026-07-17', 2, '{hazmat,security}', 35);

  -- Keep the informational counter in step with the seeded bank.
  update public.tests
     set question_count = (select count(*) from public.questions where test_id = v_test)
   where id = v_test;
end $$;
