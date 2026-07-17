-- 035_seed_combination_vehicles.sql
-- CDL Practice Tests — Milestone 6: Combination Vehicles question bank (30 items).
--
-- ⚠️ COMMITTED; apply AFTER 029 (the questions columns this seed writes).
-- IDEMPOTENT: the tests row inserts-if-absent by slug, and the question insert
-- runs only when the bank is empty — re-running never duplicates or mutates.
--
-- Content rules (hard, from the Practice Tests blueprint — same as 032/034):
--   * Every question is ORIGINAL wording — written fresh against 49 CFR and
--     the AAMVA CDL manual combination-vehicles section (Section 6)
--     structure, never copied from any DMV test or commercial question bank.
--   * Every question carries a citation (49 CFR section or CDL Manual
--     section) and a verified_date. Verified 2026-07-17.
--   * `choices` is the canonical ARRAY shape: [{"key","text"}, ...] (029).
--   * Answer keys are deliberately balanced across a–d (M5 review rule:
--     a lopsided key lets test-wise students game the choices).
--   * The tests row slug MUST stay 'combination-vehicles' — it is the data
--     layer's join key to the TS catalog.
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
  'combination-vehicles',
  'Combination Vehicles',
  'Required for every Class A license — coupling and uncoupling, trailer air lines, the tractor protection system, and keeping a rig upright.',
  'combination',
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
  select id into v_test from public.tests where slug = 'combination-vehicles';
  if v_test is null then
    raise exception 'combination-vehicles test row missing';
  end if;
  if exists (select 1 from public.questions where test_id = v_test) then
    raise notice 'Combination Vehicles bank already seeded — skipping';
    return;
  end if;

  insert into public.questions
    (test_id, prompt, choices, correct_key, explanation, cfr_cite, verified_date, difficulty, tags, sort_order)
  values
  (v_test,
   'Compared with an empty combination, how does a fully loaded rig''s rollover risk in a crash change?',
   '[{"key":"a","text":"It is about the same"},{"key":"b","text":"It is lower — the weight plants the trailer"},{"key":"c","text":"It is roughly ten times higher"},{"key":"d","text":"Loaded rigs cannot roll over"}]'::jsonb,
   'c',
   'Load raises the center of gravity, and a high center of gravity is what tips trailers. Fully loaded rigs are on the order of ten times more likely to roll in a crash than empty ones — the load does not plant you, it towers over you.',
   'CDL Manual §6.1', '2026-07-17', 2, '{combination,rollover}', 1),

  (v_test,
   'What are the two things that most help prevent a combination-vehicle rollover?',
   '[{"key":"a","text":"Keep the cargo low and take turns slowly"},{"key":"b","text":"Use the trailer hand valve and brake hard in curves"},{"key":"c","text":"Load the cargo high and centered"},{"key":"d","text":"Keep the fifth wheel greased and tires warm"}]'::jsonb,
   'a',
   'Rollover prevention comes down to center of gravity and speed: keep the load as close to the ground as you can, and slow down before curves and ramps. Posted ramp speeds are for cars — a loaded combination needs less than that.',
   'CDL Manual §6.1', '2026-07-17', 1, '{combination,rollover}', 2),

  (v_test,
   'Why must you steer gently in a combination vehicle?',
   '[{"key":"a","text":"Quick steering wears the kingpin"},{"key":"b","text":"The \"crack-the-whip\" effect amplifies sudden moves at the trailer, which can tip it over"},{"key":"c","text":"Power steering can overheat"},{"key":"d","text":"Gentle steering saves fuel"}]'::jsonb,
   'b',
   'Rearward amplification: a quick flick of the wheel gets magnified as it travels back through the rig, and the trailer swings much harder than the tractor did. Trailers have tipped in lane changes the driver barely felt up front.',
   'CDL Manual §6.1', '2026-07-17', 2, '{combination,rollover,steering}', 3),

  (v_test,
   'How does stopping distance for a bobtail tractor (no trailer) compare with a loaded combination?',
   '[{"key":"a","text":"The bobtail stops much shorter — less weight"},{"key":"b","text":"They stop in the same distance"},{"key":"c","text":"Neither can stop without trailer brakes"},{"key":"d","text":"The bobtail can take longer to stop than the loaded rig"}]'::jsonb,
   'd',
   'Counterintuitive but true: brakes are designed to work with weight on the axles. A bobtail is so light over its drive axles that the wheels lock easily, and it can need more distance than the same tractor pulling a loaded trailer. Give bobtails extra room.',
   'CDL Manual §6.1', '2026-07-17', 3, '{combination,braking,stopping-distance}', 4),

  (v_test,
   'Your trailer starts to skid and swing out behind you. What is the way to straighten it out?',
   '[{"key":"a","text":"Release the brakes and let the wheels grip again"},{"key":"b","text":"Brake harder to scrub off speed"},{"key":"c","text":"Apply the trailer hand valve"},{"key":"d","text":"Accelerate sharply"}]'::jsonb,
   'a',
   'A trailer skids because its wheels have locked and lost grip. Get off the brakes so the wheels turn again and regain traction — the trailer will follow the tractor back into line. More brake (especially the hand valve) keeps the wheels locked and the jackknife growing.',
   'CDL Manual §6.1', '2026-07-17', 2, '{combination,skid-control,jackknife}', 5),

  (v_test,
   'What is "off-tracking" in a combination vehicle?',
   '[{"key":"a","text":"The trailer bouncing on rough pavement"},{"key":"b","text":"The rear wheels following a shorter path than the front wheels in a turn"},{"key":"c","text":"The tractor drifting between lanes"},{"key":"d","text":"The trailer swaying at highway speed"}]'::jsonb,
   'b',
   'In any turn, the rear wheels cut inside the path the steering axle takes — and the longer the vehicle, the deeper the cut. That is why the back of a rig climbs curbs and clips poles that the tractor cleared with room to spare.',
   'CDL Manual §6.1', '2026-07-17', 1, '{combination,off-tracking,turning}', 6),

  (v_test,
   'To keep the trailer''s rear wheels off the curb on a tight right turn, you should:',
   '[{"key":"a","text":"Swing wide to the left before you start the turn"},{"key":"b","text":"Turn from the center lane at higher speed"},{"key":"c","text":"Steer wide as you complete the turn, keeping the rear of your vehicle close to the curb"},{"key":"d","text":"Stop in the intersection and reverse first"}]'::jsonb,
   'c',
   'Swing wide THROUGH the finish of the turn, not before it starts. Swinging wide early (the "jug handle") opens a gap on your right that cars dive into — exactly where your trailer is about to sweep.',
   'CDL Manual §6.1', '2026-07-17', 3, '{combination,off-tracking,turning}', 7),

  (v_test,
   'While crossing railroad tracks in a combination vehicle, you should never:',
   '[{"key":"a","text":"Look both ways"},{"key":"b","text":"Use a low gear"},{"key":"c","text":"Keep both hands on the wheel"},{"key":"d","text":"Shift gears"}]'::jsonb,
   'd',
   'A missed shift on the tracks can leave you stalled in the path of a train. Pick the gear that will carry you all the way across before you reach the crossing, and stay in it.',
   'CDL Manual §6.1', '2026-07-17', 1, '{combination,railroad}', 8),

  (v_test,
   'When you must back a trailer, which habit makes it safest?',
   '[{"key":"a","text":"Back toward the driver''s side, using a helper, and re-check often"},{"key":"b","text":"Back toward the passenger side for a wider view"},{"key":"c","text":"Back quickly to keep the trailer from drifting"},{"key":"d","text":"Rely on the mirrors alone and never stop mid-back"}]'::jsonb,
   'a',
   'Back to the driver''s side whenever you can — you can watch the trailer out your window instead of trusting the blind passenger side. Use a helper, agree on signals, and stop and get out to look as often as it takes.',
   'CDL Manual §6.1', '2026-07-17', 2, '{combination,backing}', 9),

  (v_test,
   'Which color identifies the emergency (supply) air line between tractor and trailer?',
   '[{"key":"a","text":"Blue"},{"key":"b","text":"Red"},{"key":"c","text":"Green"},{"key":"d","text":"Yellow"}]'::jsonb,
   'b',
   'Red is the emergency/supply line; blue is the service line. The colors exist so a glance tells you the lines are hooked up right — crossed lines are a coupling error with real consequences.',
   'CDL Manual §6.2', '2026-07-17', 1, '{combination,air-lines}', 10),

  (v_test,
   'When does the blue service air line carry air to the trailer?',
   '[{"key":"a","text":"Constantly, whenever the engine runs"},{"key":"b","text":"Only when the trailer is uncoupled"},{"key":"c","text":"When you press the brake pedal or use the trailer hand valve"},{"key":"d","text":"Only below 60 psi"}]'::jsonb,
   'c',
   'The service line is the messenger for normal braking: it carries air only when you apply the brakes, telling the trailer how hard to brake. The red supply line is the one that constantly charges the trailer''s tanks.',
   'CDL Manual §6.2', '2026-07-17', 2, '{combination,air-lines}', 11),

  (v_test,
   'The emergency line loses pressure while you drive. What happens on the trailer?',
   '[{"key":"a","text":"The trailer emergency brakes come on"},{"key":"b","text":"Nothing until you press the pedal"},{"key":"c","text":"The trailer brakes release completely"},{"key":"d","text":"Only the trailer ABS lamp lights"}]'::jsonb,
   'a',
   'Loss of emergency-line pressure applies the trailer''s emergency brakes automatically — that is the fail-safe that stops a breakaway trailer. The tractor protection valve also closes to save the tractor''s own air.',
   'CDL Manual §6.2', '2026-07-17', 2, '{combination,air-lines,emergency-brakes}', 12),

  (v_test,
   'What is the job of the tractor protection valve?',
   '[{"key":"a","text":"It boosts braking power on downgrades"},{"key":"b","text":"It locks the fifth wheel jaws"},{"key":"c","text":"It keeps air in the tractor if the trailer breaks away or springs a bad leak"},{"key":"d","text":"It warns you when trailer brakes are out of adjustment"}]'::jsonb,
   'c',
   'If the trailer rips its lines loose or leaks heavily, the tractor protection valve seals the tractor''s air system off so YOU still have brakes. Without it, a trailer failure would bleed the whole rig''s air away.',
   '49 CFR 393.43', '2026-07-17', 2, '{combination,tractor-protection}', 13),

  (v_test,
   'At about what tractor air pressure does the tractor protection valve close automatically?',
   '[{"key":"a","text":"100 to 125 psi"},{"key":"b","text":"60 to 80 psi"},{"key":"c","text":"Exactly 50 psi"},{"key":"d","text":"20 to 45 psi"}]'::jsonb,
   'd',
   'When tractor pressure falls into the 20–45 psi range, the trailer air supply control pops out and the protection valve closes, sealing the tractor''s remaining air away from the trailer. By then you should already have stopped — the low-air warning came long before.',
   'CDL Manual §6.2', '2026-07-17', 3, '{combination,tractor-protection}', 14),

  (v_test,
   'Which control is the trailer air supply valve in the cab?',
   '[{"key":"a","text":"A blue round knob"},{"key":"b","text":"A red eight-sided knob"},{"key":"c","text":"A yellow diamond-shaped knob"},{"key":"d","text":"A green lever on the steering column"}]'::jsonb,
   'b',
   'The red eight-sided knob controls the trailer''s air supply: pushed in, it charges the trailer; pulled out (or popped out by low pressure), it applies the trailer emergency brakes. The yellow diamond is the tractor parking brake — a different control.',
   'CDL Manual §6.2', '2026-07-17', 1, '{combination,air-lines,controls}', 15),

  (v_test,
   'What is the trailer hand valve (trolley valve) properly used for?',
   '[{"key":"a","text":"Parking the trailer overnight"},{"key":"b","text":"Slowing the rig on long downgrades"},{"key":"c","text":"Testing that the trailer brakes work"},{"key":"d","text":"Straightening a tractor skid"}]'::jsonb,
   'c',
   'Its one proper job is the test: apply it at low speed to confirm the trailer brakes hold. Using it in traffic can lock the trailer wheels and start a jackknife, and using it to park lets the rig roll the moment the air leaks down.',
   'CDL Manual §6.2', '2026-07-17', 2, '{combination,controls,hand-valve}', 16),

  (v_test,
   'Why must you never park a combination by leaving the trailer hand valve applied?',
   '[{"key":"a","text":"Air can leak away and release the brakes — use the spring brakes instead"},{"key":"b","text":"It drains the batteries"},{"key":"c","text":"It sets the trailer ABS fault lamp"},{"key":"d","text":"It is fine — that is what the valve is for"}]'::jsonb,
   'a',
   'The hand valve holds the trailer with air pressure only. Air leaks; when it does, the brakes let go and the rig rolls. Parking is the spring brakes'' job — steel springs do not bleed off overnight.',
   'CDL Manual §6.2', '2026-07-17', 2, '{combination,hand-valve,parking-brakes}', 17),

  (v_test,
   'You cross the glad hands (emergency to service) on an old trailer that has no spring brakes. What is the danger?',
   '[{"key":"a","text":"The tractor brakes lock immediately"},{"key":"b","text":"You could drive away with no working trailer brakes at all"},{"key":"c","text":"The trailer tanks overpressurize"},{"key":"d","text":"There is none — the lines are interchangeable"}]'::jsonb,
   'b',
   'On a no-spring-brake trailer, crossed lines mean the emergency system never charges and nothing forces the error to your attention — you can pull away towing a trailer that simply has no brakes. It is exactly why you test the trailer brakes before every trip.',
   'CDL Manual §6.2', '2026-07-17', 3, '{combination,air-lines,inspection}', 18),

  (v_test,
   'What should you check on the glad hands when connecting the air lines?',
   '[{"key":"a","text":"That both couplers spin freely"},{"key":"b","text":"That the metal faces are painted"},{"key":"c","text":"That grease covers the seals"},{"key":"d","text":"That the seals are clean and in good condition, and each line goes to its matching coupler"}]'::jsonb,
   'd',
   'Dirty or cracked seals leak air; crossed connections put the wrong line on the wrong system. Wipe the seals, check their condition, and match service to service and emergency to emergency — the color codes exist to make that a two-second check.',
   'CDL Manual §6.2', '2026-07-17', 1, '{combination,air-lines,inspection}', 19),

  (v_test,
   'Where is the ABS malfunction lamp on a trailer built since the ABS requirement?',
   '[{"key":"a","text":"On the left rear corner of the trailer"},{"key":"b","text":"Inside the cab only"},{"key":"c","text":"On the trailer nose"},{"key":"d","text":"Trailers have no ABS lamp"}]'::jsonb,
   'a',
   'Air-braked trailers built since March 1998 must have ABS, and the yellow malfunction lamp sits on the left rear corner where you can see it in your mirror. Lamp on means the anti-lock function may be out — normal trailer brakes still work.',
   '49 CFR 393.55', '2026-07-17', 2, '{combination,abs}', 20),

  (v_test,
   'How should the tractor be positioned to back under a trailer when coupling?',
   '[{"key":"a","text":"At a slight angle so you can watch the kingpin"},{"key":"b","text":"Squarely, directly in front of the trailer"},{"key":"c","text":"Offset one lane to the left"},{"key":"d","text":"Position does not matter if you back slowly"}]'::jsonb,
   'b',
   'Back under squarely — never at an angle. Backing in crooked can push the trailer sideways off its landing gear or miss the kingpin entirely, and either mistake is expensive.',
   'CDL Manual §6.4', '2026-07-17', 1, '{combination,coupling}', 21),

  (v_test,
   'Before backing under, the front of the trailer should sit at what height relative to the fifth wheel?',
   '[{"key":"a","text":"Well above the fifth wheel so it drops on"},{"key":"b","text":"Exactly level with the fifth wheel plate"},{"key":"c","text":"Slightly lower than the middle of the fifth wheel, so the tractor raises it as it backs under"},{"key":"d","text":"Height makes no difference"}]'::jsonb,
   'c',
   'Set the landing gear so the trailer nose is just below the center of the fifth wheel: backing under then lifts the trailer slightly and seats the kingpin properly. Too low and the tractor strikes the nose; too high and you can slide under without ever coupling.',
   'CDL Manual §6.4', '2026-07-17', 3, '{combination,coupling}', 22),

  (v_test,
   'After the fifth wheel locks, what is the "tug test"?',
   '[{"key":"a","text":"Pulling gently forward against the locked trailer brakes to prove the coupling holds"},{"key":"b","text":"Yanking the release arm by hand"},{"key":"c","text":"Rocking the cab side to side"},{"key":"d","text":"Pulling at highway speed to settle the kingpin"}]'::jsonb,
   'a',
   'With the trailer brakes locked, ease the tractor forward. If the coupling is bad, you find out at one mile an hour in the yard — not on the on-ramp with the trailer staying behind.',
   'CDL Manual §6.4', '2026-07-17', 1, '{combination,coupling,inspection}', 23),

  (v_test,
   'In the visual coupling check, what proves the fifth wheel connection is right?',
   '[{"key":"a","text":"The trailer nose touches the cab"},{"key":"b","text":"The release arm points straight up"},{"key":"c","text":"You can slide a hand between the coupler plates"},{"key":"d","text":"No gap between the upper and lower fifth wheel, and the jaws are closed around the kingpin''s shank"}]'::jsonb,
   'd',
   'Get under with a light and look: the plates must sit flush with no daylight between them, and the locking jaws must grip the kingpin''s narrow shank — jaws closed around the head instead will let go under load.',
   'CDL Manual §6.4', '2026-07-17', 3, '{combination,coupling,inspection}', 24),

  (v_test,
   'Before driving away coupled, the landing gear must be:',
   '[{"key":"a","text":"Touching the ground for backup support"},{"key":"b","text":"Fully raised, with the crank handle secured"},{"key":"c","text":"Halfway up to save time at the next stop"},{"key":"d","text":"Removed"}]'::jsonb,
   'b',
   'Landing gear left low will catch on crests, tracks, and curbs — and tearing it off can drop the trailer. All the way up, handle stowed, every time.',
   'CDL Manual §6.4', '2026-07-17', 1, '{combination,coupling,landing-gear}', 25),

  (v_test,
   'You are uncoupling on soft ground. What should you do before lowering the landing gear?',
   '[{"key":"a","text":"Lower it anyway — the trailer weight will firm the soil"},{"key":"b","text":"Leave the trailer resting on the tractor overnight"},{"key":"c","text":"Place solid boards or supports under the landing gear feet"},{"key":"d","text":"Drop the trailer on its nose"}]'::jsonb,
   'c',
   'Landing gear on soft ground sinks, and a sunk trailer is a crane job. Boards or pads spread the weight so the trailer stays where you left it, upright and at coupling height.',
   'CDL Manual §6.4', '2026-07-17', 2, '{combination,uncoupling,landing-gear}', 26),

  (v_test,
   'During inspection, which fifth-wheel condition means the rig is NOT safe to pull?',
   '[{"key":"a","text":"The release arm is seated and the safety latch is over it"},{"key":"b","text":"The plate is greased"},{"key":"c","text":"The mounting bolts are all tight"},{"key":"d","text":"The safety latch is not engaged over the release arm"}]'::jsonb,
   'd',
   'The safety latch is what keeps the release arm from creeping open and unlocking the jaws while you drive. Latch not engaged = the coupling can open itself. Fix it before the wheels turn.',
   'CDL Manual §6.5', '2026-07-17', 2, '{combination,inspection,fifth-wheel}', 27),

  (v_test,
   'On a single-trailer rig, the air shut-off valves at the rear of the trailer should be:',
   '[{"key":"a","text":"Closed"},{"key":"b","text":"Open"},{"key":"c","text":"One open, one closed"},{"key":"d","text":"Removed for inspection"}]'::jsonb,
   'a',
   'Shut-off valves exist so air can be sent on to a second trailer. With nothing behind your trailer, the rear valves must be closed — open ones dump your brake air out the back of the rig.',
   'CDL Manual §6.5', '2026-07-17', 2, '{combination,inspection,air-lines}', 28),

  (v_test,
   'How do you test the trailer emergency brakes before a trip?',
   '[{"key":"a","text":"Drive at 30 mph and brake hard"},{"key":"b","text":"Charge the system, pull out the trailer air supply knob, and tug gently to confirm the trailer holds"},{"key":"c","text":"Unhook the red line at speed"},{"key":"d","text":"Watch the dashboard gauges for one minute"}]'::jsonb,
   'b',
   'Charge the trailer''s air, pull the red eight-sided knob to apply the trailer emergency brakes, then ease against them in low gear. If the rig creeps, the emergency system that is supposed to stop a runaway trailer is not doing its job.',
   'CDL Manual §6.5', '2026-07-17', 2, '{combination,inspection,emergency-brakes}', 29),

  (v_test,
   'How do you test the trailer service brakes before a trip?',
   '[{"key":"a","text":"Set the tractor parking brake and rev the engine"},{"key":"b","text":"Pull the trailer air supply knob at 20 mph"},{"key":"c","text":"Move forward slowly and apply the trailer hand valve — you should feel the trailer brakes work"},{"key":"d","text":"They cannot be tested outside a shop"}]'::jsonb,
   'c',
   'With normal pressure, brakes released, roll forward at a crawl and apply the hand valve alone. Feeling the trailer drag the rig down proves its service brakes answer — the one situation where using the hand valve is exactly right.',
   'CDL Manual §6.5', '2026-07-17', 2, '{combination,inspection,hand-valve}', 30);

  -- Keep the informational counter in step with the seeded bank.
  update public.tests
     set question_count = (select count(*) from public.questions where test_id = v_test)
   where id = v_test;
end $$;
