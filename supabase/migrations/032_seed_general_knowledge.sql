-- 032_seed_general_knowledge.sql
-- CDL Practice Tests — Milestone 2: General Knowledge question bank (52 items).
--
-- ⚠️ COMMITTED; apply AFTER 029 (the questions columns this seed writes).
-- IDEMPOTENT: the tests row upserts by slug, and the question insert runs only
-- when the bank is empty — re-running the migration never duplicates rows.
--
-- Content rules (hard, from the Practice Tests blueprint):
--   * Every question is ORIGINAL wording — written fresh against 49 CFR and
--     the AAMVA CDL manual structure, never copied from any DMV test or
--     commercial question bank.
--   * Every question carries a citation (49 CFR section or CDL Manual section)
--     and a verified_date. Verified 2026-07-16 against the eCFR.
--   * `choices` is the canonical ARRAY shape: [{"key","text"}, ...] (029).
--   * The tests row slug MUST stay 'general-knowledge' — it is the data
--     layer's join key to the TS catalog.
--
-- Content fixes BEFORE the admin Tests module ships: run a targeted UPDATE
-- keyed on sort_order (e.g. `update public.questions set correct_key = 'b'
-- where test_id = ... and sort_order = 17`). NEVER delete + reseed — that
-- mints new question UUIDs, zeroing miss_count history, orphaning the ids
-- inside test_attempts.answers, and wiping every student's saved progress.

-- ---------------------------------------------------------------------------
-- 1. The test row (insert-if-absent; a re-run never mutates existing state,
--    so a deliberately unpublished test can't be silently re-published)
-- ---------------------------------------------------------------------------
insert into public.tests (slug, title, description, category, is_published, question_count)
values (
  'general-knowledge',
  'General Knowledge',
  'The base CDL knowledge exam every applicant takes first — vehicle inspection, safe operating, cargo, and the rules of the road.',
  'general_knowledge',
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
  select id into v_test from public.tests where slug = 'general-knowledge';
  if v_test is null then
    raise exception 'general-knowledge test row missing';
  end if;
  if exists (select 1 from public.questions where test_id = v_test) then
    raise notice 'General Knowledge bank already seeded — skipping';
    return;
  end if;

  insert into public.questions
    (test_id, prompt, choices, correct_key, explanation, cfr_cite, verified_date, difficulty, tags, sort_order)
  values
  (v_test,
   'Before driving, what must you be satisfied of as the driver of a commercial motor vehicle?',
   '[{"key":"a","text":"That the vehicle is in safe operating condition"},{"key":"b","text":"That the fuel tank is completely full"},{"key":"c","text":"That the trailer is loaded to its maximum weight"},{"key":"d","text":"That the CB radio is working"}]'::jsonb,
   'a',
   'The regulation puts the pre-trip duty on you personally: no driving unless you are satisfied the vehicle is in safe operating condition. A full tank or a working radio is convenience — safe condition is the law.',
   '49 CFR 392.7', '2026-07-16', 1, '{inspection}', 1),

  (v_test,
   'During your inspection you check steering wheel free play. On a 20-inch wheel, about how much looseness means the steering is out of limits?',
   '[{"key":"a","text":"Any looseness at all"},{"key":"b","text":"More than about 2 inches (roughly 10 degrees)"},{"key":"c","text":"More than 6 inches"},{"key":"d","text":"Free play is not an inspection item"}]'::jsonb,
   'b',
   'Steering lash beyond roughly 10 degrees — about 2 inches of rim travel on a 20-inch wheel — means the steering system fails the standard and the truck should not be driven until repaired.',
   '49 CFR 393.209', '2026-07-16', 2, '{inspection,steering}', 2),

  (v_test,
   'What is the minimum tread depth for tires on the steering axle?',
   '[{"key":"a","text":"2/32 of an inch"},{"key":"b","text":"1/32 of an inch"},{"key":"c","text":"4/32 of an inch"},{"key":"d","text":"8/32 of an inch"}]'::jsonb,
   'c',
   'Front (steering) tires must have at least 4/32-inch tread depth in every major groove. They steer the truck, so the standard is twice as strict as the 2/32 allowed on other axles.',
   '49 CFR 393.75(b)', '2026-07-16', 2, '{tires,inspection}', 3),

  (v_test,
   'What is the minimum tread depth for tires that are NOT on the steering axle?',
   '[{"key":"a","text":"4/32 of an inch"},{"key":"b","text":"2/32 of an inch"},{"key":"c","text":"6/32 of an inch"},{"key":"d","text":"There is no minimum for drive tires"}]'::jsonb,
   'b',
   'Drive and trailer tires must have at least 2/32-inch tread depth. Below that the tire is out of service — and bald tires are a leading roadside violation.',
   '49 CFR 393.75(c)', '2026-07-16', 2, '{tires,inspection}', 4),

  (v_test,
   'When must you wear your seat belt in a commercial motor vehicle?',
   '[{"key":"a","text":"Only on interstates"},{"key":"b","text":"Only when carrying passengers"},{"key":"c","text":"Whenever the vehicle has one and you are driving"},{"key":"d","text":"Only in bad weather"}]'::jsonb,
   'c',
   'If the seat has a belt, you must have it properly restraining you any time you drive. It is a federal rule for CMV drivers, not a suggestion — and in a rollover it is what keeps you inside the cab.',
   '49 CFR 392.16', '2026-07-16', 1, '{safe-driving}', 5),

  (v_test,
   'Texting while driving a commercial motor vehicle is:',
   '[{"key":"a","text":"Allowed if you are stopped in traffic"},{"key":"b","text":"Prohibited — it can disqualify your CDL after repeat offenses"},{"key":"c","text":"Allowed with a company phone"},{"key":"d","text":"Only restricted in work zones"}]'::jsonb,
   'b',
   'Texting behind the wheel of a CMV is banned outright. Convictions carry heavy fines and repeat offenses disqualify your CDL. Being stopped at a light still counts as driving under the rule.',
   '49 CFR 392.80', '2026-07-16', 1, '{safe-driving,distraction}', 6),

  (v_test,
   'What does the rule on mobile phones allow a CMV driver to do while driving?',
   '[{"key":"a","text":"Hold the phone to talk if the call is short"},{"key":"b","text":"Dial any number while moving slowly"},{"key":"c","text":"Use one-touch, hands-free calling only"},{"key":"d","text":"Use the phone freely in traffic jams"}]'::jsonb,
   'c',
   'Reaching for, holding, or dialing a handheld phone is prohibited. One-touch or voice-activated hands-free use is the only calling the rule permits while driving.',
   '49 CFR 392.82', '2026-07-16', 1, '{safe-driving,distraction}', 7),

  (v_test,
   'At what blood alcohol concentration is a CMV driver considered to be driving under the influence under federal rules?',
   '[{"key":"a","text":"0.08 or higher"},{"key":"b","text":"0.04 or higher"},{"key":"c","text":"0.02 or higher"},{"key":"d","text":"Any amount"}]'::jsonb,
   'b',
   'For commercial drivers the federal limit is 0.04 — half the common 0.08 passenger-car limit. At 0.04 or above in a CMV you are DUI, with a one-year disqualification for a first offense.',
   '49 CFR 382.201', '2026-07-16', 1, '{alcohol-drugs}', 8),

  (v_test,
   'An officer finds you operating a CMV with a detectable amount of alcohol below 0.04. What happens?',
   '[{"key":"a","text":"Nothing — you are under the limit"},{"key":"b","text":"You are placed out of service for 24 hours"},{"key":"c","text":"You get a warning only"},{"key":"d","text":"Your CDL is revoked permanently"}]'::jsonb,
   'b',
   'Any detectable alcohol on duty puts you out of service for 24 hours even below the 0.04 DUI threshold. The rule bans consuming or being under the influence of alcohol within 4 hours of duty entirely.',
   '49 CFR 392.5', '2026-07-16', 2, '{alcohol-drugs}', 9),

  (v_test,
   'A first conviction for driving a CMV under the influence disqualifies your CDL for at least:',
   '[{"key":"a","text":"30 days"},{"key":"b","text":"6 months"},{"key":"c","text":"1 year"},{"key":"d","text":"90 days"}]'::jsonb,
   'c',
   'Major offenses — DUI, leaving the scene of an accident, using the vehicle to commit a felony — each carry a minimum one-year disqualification on the first conviction (three years if hauling placarded hazmat).',
   '49 CFR 383.51', '2026-07-16', 2, '{licensing,alcohol-drugs}', 10),

  (v_test,
   'Which combination requires a Class A CDL?',
   '[{"key":"a","text":"Any vehicle towing a trailer"},{"key":"b","text":"A combination with a GCWR of 26,001 lbs or more, towing a unit over 10,000 lbs"},{"key":"c","text":"A single truck of 26,001 lbs or more"},{"key":"d","text":"Any vehicle carrying 16 or more passengers"}]'::jsonb,
   'b',
   'Class A covers combinations rated 26,001 pounds or more where the towed unit exceeds 10,000 pounds — the classic tractor-trailer. A heavy single truck is Class B; 16+ passengers is a Class C matter when the vehicle is smaller.',
   '49 CFR 383.91', '2026-07-16', 1, '{licensing}', 11),

  (v_test,
   'A single vehicle with a GVWR of 26,001 lbs or more, towing nothing heavier than 10,000 lbs, requires which license class?',
   '[{"key":"a","text":"Class A"},{"key":"b","text":"Class C"},{"key":"c","text":"Class B"},{"key":"d","text":"No CDL is required"}]'::jsonb,
   'c',
   'That is the Class B definition: a heavy single vehicle (26,001+ GVWR) with any towed unit at 10,000 pounds or less. Dump trucks and straight trucks commonly fall here.',
   '49 CFR 383.91', '2026-07-16', 2, '{licensing}', 12),

  (v_test,
   'What does the H endorsement on a CDL authorize?',
   '[{"key":"a","text":"Driving double and triple trailers"},{"key":"b","text":"Hauling placarded hazardous materials"},{"key":"c","text":"Operating a school bus"},{"key":"d","text":"Driving a tank vehicle"}]'::jsonb,
   'b',
   'H is the hazardous materials endorsement, required to haul placarded hazmat. It takes a knowledge test plus a TSA security threat assessment. Doubles/triples is T, tank is N, school bus is S.',
   '49 CFR 383.93', '2026-07-16', 1, '{licensing}', 13),

  (v_test,
   'Driving under 40 mph, how much following distance does the standard rule of thumb give a 60-foot truck?',
   '[{"key":"a","text":"3 seconds"},{"key":"b","text":"6 seconds"},{"key":"c","text":"10 seconds"},{"key":"d","text":"2 seconds"}]'::jsonb,
   'b',
   'One second per 10 feet of vehicle length below 40 mph: a 60-foot rig needs 6 seconds. Above 40 mph, add one more second. Count off a fixed roadside point to check yourself.',
   'CDL Manual §2.7', '2026-07-16', 1, '{safe-driving,space-management}', 14),

  (v_test,
   'Total stopping distance is made up of which three parts?',
   '[{"key":"a","text":"Perception distance + reaction distance + braking distance"},{"key":"b","text":"Reaction distance + braking distance + skid distance"},{"key":"c","text":"Thinking distance + coasting distance + rolling distance"},{"key":"d","text":"Perception distance + shifting distance + braking distance"}]'::jsonb,
   'a',
   'You must first SEE the hazard (perception), then MOVE your foot (reaction), then the brakes must STOP the weight (braking). At 55 mph the three together can exceed the length of a football field.',
   'CDL Manual §2.6', '2026-07-16', 2, '{safe-driving,braking}', 15),

  (v_test,
   'At highway speed on dry pavement, about how far can a loaded tractor-trailer need to come to a complete stop?',
   '[{"key":"a","text":"About 50 feet"},{"key":"b","text":"About 100 feet"},{"key":"c","text":"The length of a football field or more"},{"key":"d","text":"About one truck length"}]'::jsonb,
   'c',
   'At 55 mph, perception, reaction, and braking distance can add to well over 300 feet — a football field or more, and far more when loaded, wet, or downhill. That is why tailgating a CMV is never survivable math.',
   'CDL Manual §2.6', '2026-07-16', 3, '{safe-driving,braking}', 16),

  (v_test,
   'What is the safe way to take a curve or highway ramp in a loaded truck?',
   '[{"key":"a","text":"Brake hard in the middle of the curve"},{"key":"b","text":"Slow to a safe speed BEFORE entering, then power gently through"},{"key":"c","text":"Take it at the posted car speed limit"},{"key":"d","text":"Downshift while turning"}]'::jsonb,
   'b',
   'Posted ramp speeds are set for cars, not for a high center of gravity. Slow down before the curve — braking inside it can trigger a skid or rollover — then keep light power through it.',
   'CDL Manual §2.6', '2026-07-16', 1, '{safe-driving,rollover}', 17),

  (v_test,
   'Hydroplaning can begin at speeds as low as:',
   '[{"key":"a","text":"55 mph"},{"key":"b","text":"65 mph"},{"key":"c","text":"30 mph"},{"key":"d","text":"Hydroplaning only affects cars"}]'::jsonb,
   'c',
   'With enough standing water, low tread, or low tire pressure, tires can ride up on the water film at just 30 mph. If it happens: off the accelerator, do not brake, let the wheels regain grip.',
   'CDL Manual §2.6', '2026-07-16', 2, '{safe-driving,weather}', 18),

  (v_test,
   'When is the road usually MOST slippery during rain?',
   '[{"key":"a","text":"After it has rained for several hours"},{"key":"b","text":"Just as rain begins, when water mixes with surface oil"},{"key":"c","text":"Only during heavy downpours"},{"key":"d","text":"Rain does not change traction"}]'::jsonb,
   'b',
   'The first minutes of rain lift the oil film off the pavement before washing it away — the road is slickest right when drivers least expect it. Ease off the speed as soon as rain starts.',
   'CDL Manual §2.6', '2026-07-16', 2, '{safe-driving,weather}', 19),

  (v_test,
   'What is black ice?',
   '[{"key":"a","text":"Thick, visible ice on bridges"},{"key":"b","text":"A thin, clear ice layer that makes the road look merely wet"},{"key":"c","text":"Ice mixed with asphalt"},{"key":"d","text":"Frost on the mirrors"}]'::jsonb,
   'b',
   'Black ice is thin enough to see the pavement through it — the road looks wet, not icy. Any time it is below freezing and the road looks wet, treat it as ice; watch for spray from other vehicles disappearing.',
   'CDL Manual §2.6', '2026-07-16', 1, '{weather,winter}', 20),

  (v_test,
   'With low-beam headlights at night, about how far ahead can you see — and what does that mean for speed?',
   '[{"key":"a","text":"About 250 feet — keep a speed that lets you stop within what you can see"},{"key":"b","text":"About 1,000 feet — night speed does not matter"},{"key":"c","text":"About 500 feet — same as high beams"},{"key":"d","text":"About 50 feet — always drive under 20 mph"}]'::jsonb,
   'a',
   'Low beams show roughly 250 feet, high beams 350–500. "Overdriving your headlights" means you could not stop inside the distance you can actually see — at night, sight distance sets your speed limit.',
   'CDL Manual §2.11', '2026-07-16', 2, '{night-driving,safe-driving}', 21),

  (v_test,
   'The best advice for driving in heavy fog is:',
   '[{"key":"a","text":"Use your high beams to cut through it"},{"key":"b","text":"Do not drive — pull off at a safe stopping area and wait"},{"key":"c","text":"Follow the taillights ahead closely"},{"key":"d","text":"Turn on your 4-ways and keep highway speed"}]'::jsonb,
   'b',
   'The manual is blunt: the best fog strategy is not to drive in it. If you must, slow down and use LOW beams — high beams bounce off fog and blind you. Never hug the taillights in front.',
   'CDL Manual §2.12', '2026-07-16', 1, '{weather,safe-driving}', 22),

  (v_test,
   'Escape ramps on mountain downgrades are there to:',
   '[{"key":"a","text":"Let slow trucks pull over for traffic"},{"key":"b","text":"Safely stop a vehicle whose brakes have failed"},{"key":"c","text":"Provide truck parking"},{"key":"d","text":"Serve as chain-up areas"}]'::jsonb,
   'b',
   'Ramps of loose gravel or an upgrade are engineered to swallow a runaway truck with dead brakes. If you lose braking on a grade, use the ramp — every driver who has argues it beats every alternative.',
   'CDL Manual §2.16', '2026-07-16', 1, '{mountain,braking}', 23),

  (v_test,
   'Using the proper braking technique on a long downgrade, you brake until you are 5 mph below your safe speed, then:',
   '[{"key":"a","text":"Hold the brakes steadily to the bottom"},{"key":"b","text":"Release, and repeat when you drift back up to safe speed"},{"key":"c","text":"Shift to neutral and coast"},{"key":"d","text":"Pump the pedal rapidly"}]'::jsonb,
   'b',
   'That on-off rhythm (snub braking) lets the brakes cool between applications. Riding them continuously overheats them into fade; coasting in neutral downhill is both illegal and deadly.',
   'CDL Manual §2.16', '2026-07-16', 3, '{mountain,braking}', 24),

  (v_test,
   'What gear should you be in before starting down a steep grade?',
   '[{"key":"a","text":"The highest gear the truck will hold"},{"key":"b","text":"Neutral, to save fuel"},{"key":"c","text":"A gear lower than the one needed to climb the same hill"},{"key":"d","text":"It does not matter with engine brakes"}]'::jsonb,
   'c',
   'Select the low gear BEFORE the descent and let engine braking carry the load. Modern rigs are so aerodynamic they need a lower gear going down than up — and downshifting mid-grade may be impossible.',
   'CDL Manual §2.16', '2026-07-16', 2, '{mountain,braking}', 25),

  (v_test,
   'Brake fade on a downgrade is caused by:',
   '[{"key":"a","text":"Cold brake drums"},{"key":"b","text":"Overheating from excessive, continuous braking"},{"key":"c","text":"Too much air pressure"},{"key":"d","text":"New brake linings"}]'::jsonb,
   'b',
   'Heat is the enemy: constant application glazes linings and expands drums until the same pedal pressure produces less and less stopping power. Control speed with gears and snubbing so the brakes stay cool enough to work.',
   'CDL Manual §2.16', '2026-07-16', 2, '{braking,mountain}', 26),

  (v_test,
   'Most front-wheel skids are caused by:',
   '[{"key":"a","text":"Underinflated rear tires"},{"key":"b","text":"Driving too fast for conditions"},{"key":"c","text":"Too much weight on the drive axle"},{"key":"d","text":"Worn brake pads"}]'::jsonb,
   'b',
   'A front-wheel skid means the steer tires have lost grip — and the usual reason is simply too much speed for the surface. The truck goes straight regardless of steering input; the only fix is to slow down and let grip return.',
   'CDL Manual §2.19', '2026-07-16', 2, '{skids,safe-driving}', 27),

  (v_test,
   'Your drive wheels lock up while braking and the rear starts to slide. What is the first correction?',
   '[{"key":"a","text":"Brake harder to stop the slide"},{"key":"b","text":"Get off the brakes so the wheels roll and regain grip"},{"key":"c","text":"Accelerate out of it"},{"key":"d","text":"Pull the trailer hand valve"}]'::jsonb,
   'b',
   'A locked wheel has no directional grip. Release the brakes, let the wheels turn, and steer where you want to go — then be ready to counter-steer as the rig snaps back. The trailer hand valve makes a jackknife worse.',
   'CDL Manual §2.19', '2026-07-16', 3, '{skids,braking}', 28),

  (v_test,
   'What is the main benefit of an anti-lock braking system (ABS)?',
   '[{"key":"a","text":"It always shortens stopping distance"},{"key":"b","text":"It keeps the wheels from locking so you keep steering control"},{"key":"c","text":"It lets you brake later"},{"key":"d","text":"It replaces proper braking technique"}]'::jsonb,
   'b',
   'ABS prevents wheel lockup during hard braking, which preserves steering and reduces jackknife risk. It does not necessarily stop you shorter — it stops you STRAIGHTER.',
   'CDL Manual §2.23', '2026-07-16', 2, '{braking}', 29),

  (v_test,
   'How should you brake in an emergency stop with ABS?',
   '[{"key":"a","text":"Pump the pedal rapidly"},{"key":"b","text":"Brake as you normally would and let the system do its job"},{"key":"c","text":"Tap it lightly several times"},{"key":"d","text":"Use only the trailer brakes"}]'::jsonb,
   'b',
   'With ABS you press and hold with the braking the situation demands — the computer handles lockup for you. Pumping an ABS pedal defeats the system it took decades to build.',
   'CDL Manual §2.23', '2026-07-16', 2, '{braking}', 30),

  (v_test,
   'You break down on a two-lane road at night. Where do your three warning triangles go?',
   '[{"key":"a","text":"All three directly behind the trailer"},{"key":"b","text":"One within 10 ft of the rear, one about 100 ft behind, one about 100 ft ahead"},{"key":"c","text":"One at the front bumper, two on the roof"},{"key":"d","text":"100, 200, and 300 ft behind"}]'::jsonb,
   'b',
   'Two-way traffic must be warned from BOTH directions: one triangle on the traffic side within 10 feet of the vehicle, one about 100 feet behind, one about 100 feet ahead. On divided highways all three go rearward (10/100/200).',
   '49 CFR 392.22(b)', '2026-07-16', 3, '{emergency,communication}', 31),

  (v_test,
   'After stopping on the shoulder, how quickly must your warning devices be placed?',
   '[{"key":"a","text":"Within 10 minutes"},{"key":"b","text":"Within 30 minutes"},{"key":"c","text":"Within an hour"},{"key":"d","text":"Only if you will be there overnight"}]'::jsonb,
   'a',
   'The rule gives you 10 minutes. Flashers go on immediately when you stop, then the triangles go out — a parked rig on a shoulder is one of the most-hit objects on the highway.',
   '49 CFR 392.22', '2026-07-16', 2, '{emergency}', 32),

  (v_test,
   'Which emergency equipment is required on a power unit?',
   '[{"key":"a","text":"Fire extinguisher, spare electrical fuses (unless breakers), and warning devices such as three triangles"},{"key":"b","text":"Flares, a tow chain, and a first-aid kit"},{"key":"c","text":"A CB radio and jumper cables"},{"key":"d","text":"Tire chains and a shovel"}]'::jsonb,
   'a',
   'Federal minimums: a securely mounted, charged fire extinguisher; spare fuses if the truck uses them; and warning devices for stopped vehicles (typically three reflective triangles). Everything else is smart, not required.',
   '49 CFR 393.95', '2026-07-16', 1, '{emergency,inspection}', 33),

  (v_test,
   'What is the right way to fight a tire fire?',
   '[{"key":"a","text":"A small B:C extinguisher"},{"key":"b","text":"Large amounts of water to cool the tire"},{"key":"c","text":"Smother it with a tarp and keep driving"},{"key":"d","text":"Let it burn out on its own"}]'::jsonb,
   'b',
   'A tire fire lives on heat — extinguisher powder knocks the flame down but the rubber reignites. It takes a LOT of water to cool it below ignition. Without water, keep clear and let the professionals handle it.',
   'CDL Manual §2.20', '2026-07-16', 2, '{fires,emergency}', 34),

  (v_test,
   'Which fires must you NEVER fight with water?',
   '[{"key":"a","text":"Burning paper in the cab"},{"key":"b","text":"Electrical fires and gasoline/diesel fires"},{"key":"c","text":"Tire fires"},{"key":"d","text":"Burning brush beside the road"}]'::jsonb,
   'b',
   'Water conducts electricity and spreads burning fuel. Electrical and fuel fires call for a B:C-rated extinguisher. Knowing WHAT is burning before you fight it is the first rule of vehicle fires.',
   'CDL Manual §2.20', '2026-07-16', 2, '{fires,emergency}', 35),

  (v_test,
   'Your engine compartment catches fire. What should you do about the hood?',
   '[{"key":"a","text":"Open it wide to see the fire"},{"key":"b","text":"Keep it shut if you can, and shoot the extinguisher through louvers or from underneath"},{"key":"c","text":"Remove it entirely"},{"key":"d","text":"Pour water over it first"}]'::jsonb,
   'b',
   'Opening the hood feeds the fire a rush of oxygen. Shut the engine off, get the rig stopped away from buildings and traffic, and attack through the gap or louvers without giving the fire air.',
   'CDL Manual §2.20', '2026-07-16', 2, '{fires,emergency}', 36),

  (v_test,
   'When crossing railroad tracks you should never:',
   '[{"key":"a","text":"Look both ways"},{"key":"b","text":"Shift gears while on the tracks"},{"key":"c","text":"Turn on your 4-way flashers"},{"key":"d","text":"Slow down before the crossing"}]'::jsonb,
   'b',
   'A missed shift can stall you on the rails. Pick the gear before the crossing and stay in it until you are fully across — and never start across unless there is room to clear the far side completely.',
   'CDL Manual §2.15', '2026-07-16', 1, '{railroad,safe-driving}', 37),

  (v_test,
   'Vehicles required to stop at railroad crossings (buses, placarded hazmat) must stop within what distance of the nearest rail?',
   '[{"key":"a","text":"5 to 10 feet"},{"key":"b","text":"15 to 50 feet"},{"key":"c","text":"50 to 100 feet"},{"key":"d","text":"Exactly 25 feet"}]'::jsonb,
   'b',
   'The stop zone is 15 to 50 feet from the nearest rail — close enough to see and hear, far enough to be clear of overhang. Then look and listen both ways before proceeding in a gear that needs no shifting.',
   '49 CFR 392.10', '2026-07-16', 3, '{railroad}', 38),

  (v_test,
   'After starting a trip, when must you first stop and re-check your cargo securement?',
   '[{"key":"a","text":"Within the first 50 miles"},{"key":"b","text":"After the first fuel stop"},{"key":"c","text":"At 150 miles"},{"key":"d","text":"Only at the end of the day"}]'::jsonb,
   'a',
   'Loads settle and straps loosen as the trailer starts working. The rule requires a securement re-examination within the first 50 miles, and adjustments as needed.',
   '49 CFR 392.9(b)(2)', '2026-07-16', 2, '{cargo}', 39),

  (v_test,
   'After the 50-mile check, how often must cargo securement be re-examined en route?',
   '[{"key":"a","text":"Every 3 hours or 150 miles, or at each duty change — whichever comes first"},{"key":"b","text":"Once per day"},{"key":"c","text":"Every 500 miles"},{"key":"d","text":"Only when cargo is visible from the cab"}]'::jsonb,
   'a',
   'The recurring rhythm is 3 hours / 150 miles / any change of duty status, whichever arrives first. Sealed loads you cannot inspect are the exception — but weight limits still apply to you.',
   '49 CFR 392.9', '2026-07-16', 2, '{cargo}', 40),

  (v_test,
   'What is the minimum number of tie-downs for a 20-foot length of cargo?',
   '[{"key":"a","text":"One"},{"key":"b","text":"Two"},{"key":"c","text":"Four"},{"key":"d","text":"Three"}]'::jsonb,
   'b',
   'The floor is one tie-down per 10 feet of cargo, and never fewer than two total. Twenty feet of freight needs at least two properly rated, tensioned tie-downs.',
   '49 CFR 393.110', '2026-07-16', 2, '{cargo}', 41),

  (v_test,
   'Why should heavy freight be loaded as low as possible?',
   '[{"key":"a","text":"To make unloading faster"},{"key":"b","text":"A high center of gravity makes rollover far more likely"},{"key":"c","text":"To protect the roof"},{"key":"d","text":"Low freight rides more quietly"}]'::jsonb,
   'b',
   'Rollover risk rises directly with the height of the load''s center of gravity. Heavy on the bottom, balanced between axles — a top-heavy trailer can roll at speeds that feel completely normal.',
   'CDL Manual §3.1', '2026-07-16', 1, '{cargo,rollover}', 42),

  (v_test,
   'What does a driver do with a DVIR (driver vehicle inspection report)?',
   '[{"key":"a","text":"Files it with the state DMV"},{"key":"b","text":"Prepares it in writing at the end of each driving day, listing any defects found"},{"key":"c","text":"Signs it once a year"},{"key":"d","text":"Only completes one after a crash"}]'::jsonb,
   'b',
   'The end-of-day written report covers each vehicle operated and lists any defect that would affect safety or cause a breakdown. The carrier must fix listed safety defects before the truck runs again.',
   '49 CFR 396.11', '2026-07-16', 2, '{inspection}', 43),

  (v_test,
   'How often must every commercial vehicle pass a periodic (annual-type) inspection?',
   '[{"key":"a","text":"Every 6 months"},{"key":"b","text":"Every 24 months"},{"key":"c","text":"At least once every 12 months"},{"key":"d","text":"Only when registration renews"}]'::jsonb,
   'c',
   'Every CMV must pass the full periodic inspection at least every 12 months, with documentation carried on or retrievable for the vehicle. Roadside inspections do not replace it.',
   '49 CFR 396.17', '2026-07-16', 3, '{inspection}', 44),

  (v_test,
   'How often must an interstate CMV driver pass a DOT medical examination, at most?',
   '[{"key":"a","text":"Every 12 months"},{"key":"b","text":"Every 24 months"},{"key":"c","text":"Every 36 months"},{"key":"d","text":"Once, at hiring"}]'::jsonb,
   'b',
   'The medical certificate is good for a maximum of 24 months — shorter if the examiner requires monitoring for a condition such as controlled blood pressure. No valid card, no driving.',
   '49 CFR 391.45', '2026-07-16', 2, '{licensing,health}', 45),

  (v_test,
   'Under the property-carrier hours rules, how many hours may you drive after 10 consecutive hours off duty?',
   '[{"key":"a","text":"10 hours"},{"key":"b","text":"11 hours"},{"key":"c","text":"14 hours"},{"key":"d","text":"8 hours"}]'::jsonb,
   'b',
   'The limit is 11 hours of driving inside a 14-hour on-duty window after 10 consecutive hours off. The 14-hour clock does not pause for lunch — plan the day around it.',
   '49 CFR 395.3', '2026-07-16', 2, '{hos}', 46),

  (v_test,
   'What is the only real cure for drowsiness while driving?',
   '[{"key":"a","text":"Coffee and cold air"},{"key":"b","text":"Loud music"},{"key":"c","text":"Sleep"},{"key":"d","text":"Eating a large meal"}]'::jsonb,
   'c',
   'Coffee, windows, and radio tricks buy minutes at best and mask the warning signs. When your body demands sleep, the safe move is to get off the road and take it — nothing else resets the clock.',
   'CDL Manual §2.25', '2026-07-16', 1, '{health,safe-driving}', 47),

  (v_test,
   'Objects seen in a convex ("spot") mirror appear:',
   '[{"key":"a","text":"Larger and closer than they are"},{"key":"b","text":"Smaller and farther away than they are"},{"key":"c","text":"Exactly as they are"},{"key":"d","text":"Upside down"}]'::jsonb,
   'b',
   'The curved glass buys a wider field of view and pays for it in distortion — everything looks smaller and farther than reality. That car in the convex mirror is closer than it appears.',
   'CDL Manual §2.4', '2026-07-16', 1, '{safe-driving,mirrors}', 48),

  (v_test,
   'When you must back a tractor-trailer, the preferred method is to:',
   '[{"key":"a","text":"Back toward the passenger side quickly"},{"key":"b","text":"Back slowly toward the driver''s side, using a helper when possible"},{"key":"c","text":"Rely on the mirrors alone in all cases"},{"key":"d","text":"Back only in a straight line, never at an angle"}]'::jsonb,
   'b',
   'Driver-side backing keeps the trailer visible out your window instead of hiding it in the blind side. Get out and look first, go slow, and agree on signals with your helper — especially the STOP signal.',
   'CDL Manual §2.2', '2026-07-16', 1, '{backing}', 49),

  (v_test,
   'Another driver is waiting to pull out in front of you. Should you flash your lights or wave them through?',
   '[{"key":"a","text":"Yes — it is courteous"},{"key":"b","text":"No — never direct another driver''s movement; you cannot guarantee their path is clear"},{"key":"c","text":"Only at night"},{"key":"d","text":"Only for other trucks"}]'::jsonb,
   'b',
   'Signaling others to proceed puts you in charge of a move you cannot see the whole of. If they get hit acting on your wave, you own a piece of it. Communicate your OWN intentions — signal early, brake early — and let others make their own calls.',
   'CDL Manual §2.5', '2026-07-16', 1, '{communication,safe-driving}', 50),

  (v_test,
   'When should you use your 4-way emergency flashers on the road?',
   '[{"key":"a","text":"Whenever traffic is heavy"},{"key":"b","text":"When driving well below the speed of traffic or stopped where legal, to warn drivers behind"},{"key":"c","text":"In place of turn signals"},{"key":"d","text":"Only in rain"}]'::jsonb,
   'b',
   'Flashers say one thing: "I am a hazard — I am moving much slower than you or not moving at all." Climbing a steep grade at 25 mph in a 65 zone is exactly when the drivers behind you need that warning.',
   'CDL Manual §2.5', '2026-07-16', 1, '{communication,safe-driving}', 51),

  (v_test,
   'A bridge is posted 13'' 6" and your rig is 13'' 6". Why should you still be cautious?',
   '[{"key":"a","text":"Posted clearances can be wrong — repaving or packed snow can reduce the real clearance"},{"key":"b","text":"Posted heights include a legally required 12-inch buffer"},{"key":"c","text":"Trucks compress their suspensions at speed"},{"key":"d","text":"There is no reason — posted means guaranteed"}]'::jsonb,
   'a',
   'The number on the sign was true the day it was measured. Repaving raises the road; snowpack raises it more; a loaded trailer can also sit lower than an empty one, changing YOUR height. If it is close, slow down and be sure.',
   'CDL Manual §2.8', '2026-07-16', 1, '{space-management}', 52);

  -- Keep the informational counter in step with the seeded bank.
  update public.tests
     set question_count = (select count(*) from public.questions where test_id = v_test)
   where id = v_test;
end $$;
