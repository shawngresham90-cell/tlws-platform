-- 034_seed_air_brakes.sql
-- CDL Practice Tests — Milestone 5: Air Brakes question bank (31 items).
--
-- ⚠️ COMMITTED; apply AFTER 029 (the questions columns this seed writes).
-- IDEMPOTENT: the tests row inserts-if-absent by slug, and the question insert
-- runs only when the bank is empty — re-running never duplicates or mutates.
--
-- Content rules (hard, from the Practice Tests blueprint — same as 032):
--   * Every question is ORIGINAL wording — written fresh against 49 CFR and
--     the AAMVA CDL manual air-brakes section (Section 5) structure, never
--     copied from any DMV test or commercial question bank.
--   * Every question carries a citation (49 CFR section or CDL Manual
--     section) and a verified_date. Verified 2026-07-16.
--   * `choices` is the canonical ARRAY shape: [{"key","text"}, ...] (029).
--   * The tests row slug MUST stay 'air-brakes' — it is the data layer's
--     join key to the TS catalog.
--
-- Content fixes BEFORE the admin Tests module ships: run a targeted UPDATE
-- keyed on sort_order. NEVER delete + reseed — that mints new question UUIDs,
-- zeroing miss_count history, orphaning the ids inside test_attempts.answers
-- and students' device-local bookmarks/misses, and wiping saved progress.

-- ---------------------------------------------------------------------------
-- 1. The test row (insert-if-absent; a re-run never mutates existing state,
--    so a deliberately unpublished test can't be silently re-published)
-- ---------------------------------------------------------------------------
insert into public.tests (slug, title, description, category, is_published, question_count)
values (
  'air-brakes',
  'Air Brakes',
  'The knowledge test that keeps the air-brake restriction off your CDL — system components, gauges and warning signals, inspection checks, and braking technique.',
  'air_brakes',
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
  select id into v_test from public.tests where slug = 'air-brakes';
  if v_test is null then
    raise exception 'air-brakes test row missing';
  end if;
  if exists (select 1 from public.questions where test_id = v_test) then
    raise notice 'Air Brakes bank already seeded — skipping';
    return;
  end if;

  insert into public.questions
    (test_id, prompt, choices, correct_key, explanation, cfr_cite, verified_date, difficulty, tags, sort_order)
  values
  (v_test,
   'An air-brake system is really three braking systems combined. What are they?',
   '[{"key":"a","text":"Service, parking, and emergency brakes"},{"key":"b","text":"Drum, disc, and wedge brakes"},{"key":"c","text":"Primary, secondary, and trailer brakes"},{"key":"d","text":"Hydraulic, electric, and air brakes"}]'::jsonb,
   'a',
   'One set of hardware does three jobs: the service brakes you use in normal driving, the parking brakes you set with the knob, and the emergency brakes that stop you when the system loses air. Knowing which system is acting is the foundation for everything else on this test.',
   'CDL Manual §5.1', '2026-07-16', 1, '{air-brakes,components}', 1),

  (v_test,
   'The air compressor on some engines is driven by a belt. What does that mean for your pre-trip inspection?',
   '[{"key":"a","text":"Nothing — belts never need checking"},{"key":"b","text":"Check the belt''s condition and tightness"},{"key":"c","text":"Remove the belt to inspect the pulley"},{"key":"d","text":"Spray the belt with penetrating oil"}]'::jsonb,
   'b',
   'A belt-driven compressor stops making air the moment the belt fails — and no air eventually means no service brakes. If your compressor is belt-driven, the belt''s condition and tension are a required pre-trip check.',
   'CDL Manual §5.1.1', '2026-07-16', 1, '{air-brakes,compressor,inspection}', 2),

  (v_test,
   'What does the air compressor governor control?',
   '[{"key":"a","text":"The top road speed of the truck"},{"key":"b","text":"When the compressor pumps air into the tanks and when it stops"},{"key":"c","text":"How hard the spring brakes clamp"},{"key":"d","text":"The engine''s idle speed"}]'::jsonb,
   'b',
   'The governor is the compressor''s on/off switch: it cuts the compressor out around 125 psi and cuts it back in when pressure falls to roughly 100 psi. It manages tank pressure — it has nothing to do with road speed on an air-brake system.',
   'CDL Manual §5.1.2', '2026-07-16', 2, '{air-brakes,governor}', 3),

  (v_test,
   'At about what pressure does a typical governor cut out (stop the compressor from pumping)?',
   '[{"key":"a","text":"60 psi"},{"key":"b","text":"100 psi"},{"key":"c","text":"125 psi"},{"key":"d","text":"150 psi"}]'::jsonb,
   'c',
   'Typical numbers to memorize: cut-out around 125 psi, cut-in around 100 psi. If you see the needle keep climbing well past cut-out, the governor or compressor has a problem — 150 psi is safety-valve territory, not normal operation.',
   'CDL Manual §5.1.2', '2026-07-16', 2, '{air-brakes,governor}', 4),

  (v_test,
   'Why must air tanks be drained regularly?',
   '[{"key":"a","text":"To keep the tanks from rusting shut"},{"key":"b","text":"Water and compressor oil collect inside and can freeze in cold weather, causing brake failure"},{"key":"c","text":"To reset the governor"},{"key":"d","text":"Draining raises the system pressure"}]'::jsonb,
   'b',
   'Compressed air carries water and a little compressor oil into the tanks. Left there, the water can freeze in winter and block valves and lines — a brake failure you caused by skipping a 30-second drain. With manual drain valves, drain at the end of each day of driving.',
   'CDL Manual §5.1.3', '2026-07-16', 1, '{air-brakes,tanks,inspection}', 5),

  (v_test,
   'The safety relief valve on an air tank normally opens at about what pressure?',
   '[{"key":"a","text":"100 psi"},{"key":"b","text":"125 psi"},{"key":"c","text":"150 psi"},{"key":"d","text":"200 psi"}]'::jsonb,
   'c',
   'The safety valve is the last line of defense against over-pressure, set to release around 150 psi. In normal operation the governor stops the compressor long before that.',
   'CDL Manual §5.1.5', '2026-07-16', 2, '{air-brakes,safety-valve}', 6),

  (v_test,
   'If the safety valve keeps releasing air, what should you do?',
   '[{"key":"a","text":"Nothing — that is what it is for"},{"key":"b","text":"Have the fault fixed by a mechanic — something is wrong with the system"},{"key":"c","text":"Plug the valve so pressure can build"},{"key":"d","text":"Drain the tanks and keep driving"}]'::jsonb,
   'b',
   'A safety valve that opens in service means pressure is climbing past 150 psi — usually a stuck governor or compressor fault. The valve saved the tank, but the underlying defect needs a mechanic. Never plug or ignore it.',
   'CDL Manual §5.1.5', '2026-07-16', 2, '{air-brakes,safety-valve}', 7),

  (v_test,
   'Which foundation brake design is found on most heavy vehicles with air brakes?',
   '[{"key":"a","text":"S-cam drum brakes"},{"key":"b","text":"Wedge disc brakes"},{"key":"c","text":"Band brakes"},{"key":"d","text":"Regenerative brakes"}]'::jsonb,
   'a',
   'The S-cam drum brake is the workhorse: air pressure moves the push rod and slack adjuster, twisting an S-shaped cam that forces the shoes against the drum. Knowing the chain — chamber, push rod, slack adjuster, cam — is what the adjustment checks are about.',
   'CDL Manual §5.1.6', '2026-07-16', 2, '{air-brakes,components}', 8),

  (v_test,
   'With the parking brakes released and wheels chocked, you pull hard on each slack adjuster. About how much movement means it needs adjustment?',
   '[{"key":"a","text":"Any movement at all"},{"key":"b","text":"More than about one inch where the push rod attaches"},{"key":"c","text":"More than three inches"},{"key":"d","text":"Slack adjusters are not an inspection item"}]'::jsonb,
   'b',
   'More than roughly an inch of free play at the push rod means that brake is out of adjustment — it will do less than its share of the stopping and overheat the ones that are in adjustment. Out-of-adjustment brakes are the most common problem found in roadside inspections.',
   'CDL Manual §5.2', '2026-07-16', 3, '{air-brakes,slack-adjusters,inspection}', 9),

  (v_test,
   'What holds the spring brakes OFF while you drive?',
   '[{"key":"a","text":"Air pressure"},{"key":"b","text":"Hydraulic fluid"},{"key":"c","text":"An electric solenoid"},{"key":"d","text":"The parking brake cable"}]'::jsonb,
   'a',
   'Powerful springs are always trying to apply those brakes; system air pressure is the only thing caging them back. That is the fail-safe design — lose the air, and the springs stop the truck whether you like it or not.',
   'CDL Manual §5.1.9', '2026-07-16', 1, '{air-brakes,spring-brakes}', 10),

  (v_test,
   'At about what pressure range do the spring brakes come fully on by themselves?',
   '[{"key":"a","text":"85 to 100 psi"},{"key":"b","text":"60 to 80 psi"},{"key":"c","text":"20 to 45 psi"},{"key":"d","text":"0 to 5 psi"}]'::jsonb,
   'c',
   'When system pressure bleeds down into the 20–45 psi range, the springs overcome the remaining air and apply fully. That is why you must safely stop as soon as the low-air warning sounds at 60 psi — waiting risks an abrupt spring-brake application wherever you happen to be.',
   'CDL Manual §5.1.9', '2026-07-16', 2, '{air-brakes,spring-brakes}', 11),

  (v_test,
   'The parking or emergency holding power of spring brakes depends on what?',
   '[{"key":"a","text":"The service brakes being in adjustment"},{"key":"b","text":"How full the fuel tank is"},{"key":"c","text":"The air compressor running"},{"key":"d","text":"The tractor protection valve"}]'::jsonb,
   'a',
   'Spring brakes act through the same slack adjusters, cams, shoes, and drums as the service brakes. If those are out of adjustment, neither your foot brake NOR your parking/emergency springs work at full strength — one adjustment problem weakens all three systems.',
   'CDL Manual §5.1.9', '2026-07-16', 3, '{air-brakes,spring-brakes,slack-adjusters}', 12),

  (v_test,
   'Which control applies the parking brakes in a truck with air brakes?',
   '[{"key":"a","text":"A red octagon button"},{"key":"b","text":"A yellow, diamond-shaped knob you pull out"},{"key":"c","text":"A floor pedal to the left of the clutch"},{"key":"d","text":"A toggle switch on the dash"}]'::jsonb,
   'b',
   'Pull the yellow diamond-shaped knob out to set the parking (spring) brakes; push it in to release them. Use them whenever you park — the shape and color are standardized so your hand finds it without looking.',
   'CDL Manual §5.1.10', '2026-07-16', 1, '{air-brakes,parking-brakes}', 13),

  (v_test,
   'Why should you avoid pressing the brake pedal while the spring (parking) brakes are applied?',
   '[{"key":"a","text":"It drains the fuel tank"},{"key":"b","text":"The combined spring and air forces could damage the brakes"},{"key":"c","text":"It releases the parking brakes"},{"key":"d","text":"It burns out the stop-light switch"}]'::jsonb,
   'b',
   'With springs already clamping the brakes, adding full air pressure on top stacks the two forces — and that compounding can bend or break brake components. Some vehicles limit it automatically, but the habit to build is: spring brakes on, foot off the pedal.',
   'CDL Manual §5.1.10', '2026-07-16', 3, '{air-brakes,parking-brakes}', 14),

  (v_test,
   'The low air pressure warning must come on before pressure drops below what value?',
   '[{"key":"a","text":"20 psi"},{"key":"b","text":"45 psi"},{"key":"c","text":"60 psi"},{"key":"d","text":"100 psi"}]'::jsonb,
   'c',
   'The warning — light, buzzer, or both — must activate before the system falls below 60 psi. That is your margin to get stopped under control before the spring brakes grab on their own in the 20–45 psi range.',
   'CDL Manual §5.1.7', '2026-07-16', 1, '{air-brakes,low-air-warning}', 15),

  (v_test,
   'Some older vehicles use a "wig wag" as the low-pressure warning. What does it do?',
   '[{"key":"a","text":"Flashes the headlights"},{"key":"b","text":"Drops a mechanical arm into your view when pressure falls below about 60 psi"},{"key":"c","text":"Vibrates the steering wheel"},{"key":"d","text":"Locks the throttle"}]'::jsonb,
   'b',
   'A wig wag swings a mechanical arm down into your line of sight when pressure drops below roughly 60 psi, and it will not stay up until pressure is restored — a warning you physically cannot miss or ignore.',
   'CDL Manual §5.1.7', '2026-07-16', 2, '{air-brakes,low-air-warning}', 16),

  (v_test,
   'In a dual air system, pressure should build from 85 to 100 psi within how long?',
   '[{"key":"a","text":"45 seconds"},{"key":"b","text":"3 minutes"},{"key":"c","text":"10 seconds"},{"key":"d","text":"5 minutes"}]'::jsonb,
   'a',
   'The build-up check: watch the gauges and time the climb from 85 to 100 psi — 45 seconds or less in a dual system. A slow build means pressure could fall faster than the compressor replaces it in hard use, so the fault must be fixed before driving.',
   'CDL Manual §5.2', '2026-07-16', 3, '{air-brakes,pressure-buildup,inspection}', 17),

  (v_test,
   'Engine off, service brakes released: what is the most air pressure a single vehicle may lose in one minute?',
   '[{"key":"a","text":"Less than 2 psi"},{"key":"b","text":"Less than 6 psi"},{"key":"c","text":"Less than 10 psi"},{"key":"d","text":"Any loss is acceptable"}]'::jsonb,
   'a',
   'The static leakage check: after the initial pressure drop settles, a single vehicle may lose less than 2 psi per minute (less than 3 for a combination vehicle). More than that is a leak big enough to fail the vehicle — find it before the road finds it for you.',
   'CDL Manual §5.2', '2026-07-16', 3, '{air-brakes,leakage-tests,inspection}', 18),

  (v_test,
   'With the brake pedal held fully applied (engine off), what leakage rate fails a single vehicle?',
   '[{"key":"a","text":"3 psi or more per minute"},{"key":"b","text":"1 psi per minute"},{"key":"c","text":"Any drop at all"},{"key":"d","text":"10 psi or more per minute"}]'::jsonb,
   'a',
   'The applied leakage check: hold the pedal down for a minute after the initial drop. Losing 3 psi or more per minute in a single vehicle (4 or more in a combination) means a leak in the applied side of the system — chambers, lines, or valves — that must be repaired first.',
   'CDL Manual §5.2', '2026-07-16', 3, '{air-brakes,leakage-tests,inspection}', 19),

  (v_test,
   'What is the main advantage of a dual air brake system?',
   '[{"key":"a","text":"It doubles your stopping power"},{"key":"b","text":"If one system loses air, the other can still stop the vehicle"},{"key":"c","text":"It removes the need for spring brakes"},{"key":"d","text":"It lets you drive with a known air leak"}]'::jsonb,
   'b',
   'Two separate systems share one set of controls: typically one covers the front brakes and the other the rear. A failure in one leaves the other working — enough to stop safely, not to keep on trucking. Stop and get it repaired.',
   'CDL Manual §5.1.11', '2026-07-16', 2, '{air-brakes,dual-systems}', 20),

  (v_test,
   'Before driving a vehicle with a dual air system, you should wait until at least what pressure in BOTH systems?',
   '[{"key":"a","text":"60 psi"},{"key":"b","text":"85 psi"},{"key":"c","text":"100 psi"},{"key":"d","text":"150 psi"}]'::jsonb,
   'c',
   'Give the compressor time to bring both the primary and secondary systems to at least 100 psi before rolling. Driving away earlier means less reserve behind every brake application — the reserve is the whole point of carrying tanks.',
   'CDL Manual §5.1.11', '2026-07-16', 2, '{air-brakes,dual-systems}', 21),

  (v_test,
   'The yellow ABS malfunction lamp comes on while you are driving. What does that mean for your brakes?',
   '[{"key":"a","text":"You have no brakes — stop immediately on the shoulder"},{"key":"b","text":"You still have normal brakes; the anti-lock function may not be working"},{"key":"c","text":"The spring brakes are about to apply"},{"key":"d","text":"Only the trailer brakes work"}]'::jsonb,
   'b',
   'ABS is an add-on to the brakes you already have. If it fails, you keep full normal braking — you just lose the computer''s anti-lock protection during hard stops. Get it repaired, but there is no need to panic-stop over the lamp.',
   '49 CFR 393.55', '2026-07-16', 2, '{air-brakes,abs}', 22),

  (v_test,
   'How should you brake a tractor equipped with ABS?',
   '[{"key":"a","text":"Pump the pedal rapidly to help the computer"},{"key":"b","text":"Brake as you always would — ABS only takes over when wheels are about to lock"},{"key":"c","text":"Use only the parking brake knob"},{"key":"d","text":"Press twice as hard as normal on every stop"}]'::jsonb,
   'b',
   'ABS changes nothing about normal driving: same pedal, same technique, same following distance. It works only in the moment a wheel is about to lock, releasing and reapplying that brake faster than you ever could. Pumping the pedal actually defeats it.',
   'CDL Manual §5.1.12', '2026-07-16', 2, '{air-brakes,abs}', 23),

  (v_test,
   'Compared with hydraulic brakes, why do air brakes add stopping distance?',
   '[{"key":"a","text":"Air brakes are weaker than hydraulic brakes"},{"key":"b","text":"Air takes about half a second to flow through the lines — roughly 32 more feet at 55 mph"},{"key":"c","text":"The driver must pump the pedal first"},{"key":"d","text":"They do not add any distance"}]'::jsonb,
   'b',
   'Brake lag: air has to travel from the valve to the chambers before anything clamps, about half a second at 55 mph — call it 32 feet you travel with your foot down and nothing happening yet. Build that lag into your following distance.',
   'CDL Manual §5.3.1', '2026-07-16', 2, '{air-brakes,stopping-distance}', 24),

  (v_test,
   'Total stopping distance with air brakes adds up from which parts?',
   '[{"key":"a","text":"Perception distance + reaction distance + brake lag distance + effective braking distance"},{"key":"b","text":"Reaction distance only"},{"key":"c","text":"Brake lag distance + tire wear distance"},{"key":"d","text":"Perception distance + engine braking distance"}]'::jsonb,
   'a',
   'Four pieces: the distance covered while you perceive the hazard, while you react, while the air travels (the lag unique to air brakes), and while the brakes actually slow the vehicle. At highway speed the total is longer than a football field.',
   'CDL Manual §5.3.1', '2026-07-16', 2, '{air-brakes,stopping-distance}', 25),

  (v_test,
   'What causes brake fade on a long downgrade?',
   '[{"key":"a","text":"Cold drums after a rest stop"},{"key":"b","text":"Excessive heat from using the brakes too much instead of the engine''s braking effect"},{"key":"c","text":"Too much air pressure in the tanks"},{"key":"d","text":"Driving with the ABS lamp on"}]'::jsonb,
   'b',
   'Ride the brakes downhill and the drums overheat; hot brakes grip less, so you press harder, which makes them hotter still — that spiral is fade. The engine in a low gear is your primary speed control on grade; the brakes are the supplement, not the other way around.',
   'CDL Manual §5.3.2', '2026-07-16', 2, '{air-brakes,brake-fade,mountain-driving}', 26),

  (v_test,
   'You are on a long downgrade at your safe speed of 40 mph in a low gear. What is the proper braking technique?',
   '[{"key":"a","text":"Hold light, steady pedal pressure the whole way down"},{"key":"b","text":"Brake firmly to about 35 mph, release, and repeat when you are back up to 40"},{"key":"c","text":"Coast in neutral and brake at the bottom"},{"key":"d","text":"Use the parking brake knob in short pulls"}]'::jsonb,
   'b',
   'Snub braking: apply the service brakes firmly enough to feel a real slowdown of about 5 mph, release fully to let them cool, and repeat when speed climbs back to your safe speed. Firm-then-off beats a constant drag that cooks the drums. Never coast downgrade in neutral.',
   'CDL Manual §5.4.2', '2026-07-16', 3, '{air-brakes,mountain-driving}', 27),

  (v_test,
   'In an emergency stop without ABS, what is "stab braking"?',
   '[{"key":"a","text":"Applying the brakes fully, releasing when the wheels lock, and reapplying when they roll again"},{"key":"b","text":"Tapping the brake pedal lightly and rapidly"},{"key":"c","text":"Pulling the parking brake knob in bursts"},{"key":"d","text":"Braking with only the trailer brakes"}]'::jsonb,
   'a',
   'Stab braking is a manual version of what ABS does: brake hard, release the instant the wheels lock so you can steer, then reapply as soon as they are rolling again. Locked wheels stop nothing and steer nowhere — the release is what keeps the rig under control.',
   'CDL Manual §5.4.3', '2026-07-16', 3, '{air-brakes,emergency-braking}', 28),

  (v_test,
   'What does a brake chamber do?',
   '[{"key":"a","text":"Stores the vehicle''s reserve air supply"},{"key":"b","text":"Converts air pressure into the push-rod force that applies the brake"},{"key":"c","text":"Dries the air before it reaches the tanks"},{"key":"d","text":"Warns the driver of low pressure"}]'::jsonb,
   'b',
   'The chamber is where air becomes muscle: pressure pushes a diaphragm, the diaphragm drives the push rod, and the push rod works the slack adjuster and cam to apply the brake. Storage is the tanks'' job; the chamber is the actuator at each wheel.',
   'CDL Manual §5.1.6', '2026-07-16', 2, '{air-brakes,brake-chambers,components}', 29),

  (v_test,
   'How do you test the low pressure warning signal during your pre-trip inspection?',
   '[{"key":"a","text":"Engine off, key on, fan the brake pedal to bleed pressure down until the warning activates"},{"key":"b","text":"Rev the engine to maximum rpm and listen"},{"key":"c","text":"Disconnect the air lines at the tank"},{"key":"d","text":"There is no way to test it without a shop"}]'::jsonb,
   'a',
   'With enough air in the system, shut the engine off, turn the key to on, and pump the brake pedal to bleed pressure down. The light or buzzer must come on before pressure falls below 60 psi. If it never activates, you would get no warning of a real air loss — do not drive until it works.',
   'CDL Manual §5.2', '2026-07-16', 2, '{air-brakes,low-air-warning,inspection}', 30),

  (v_test,
   'How do you check that the parking brake will actually hold during your pre-trip inspection?',
   '[{"key":"a","text":"Set it and gently try to pull forward against it in a low gear"},{"key":"b","text":"Look at the knob and confirm it is out"},{"key":"c","text":"Rock the steering wheel side to side"},{"key":"d","text":"Release it on a hill and see if the truck rolls"}]'::jsonb,
   'a',
   'Set the parking brake, put the truck in a low gear, and gently tug against it — the vehicle should not move. Looking at the knob only proves the control is set, not that the springs are holding. Then check the service brakes at about 5 mph: firm apply, no pulling to either side.',
   'CDL Manual §5.2', '2026-07-16', 2, '{air-brakes,parking-brakes,inspection}', 31);

  -- Keep the informational counter in step with the seeded bank.
  update public.tests
     set question_count = (select count(*) from public.questions where test_id = v_test)
   where id = v_test;
end $$;
