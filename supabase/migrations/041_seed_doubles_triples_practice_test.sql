-- 041_seed_doubles_triples_practice_test.sql
-- CDL Practice Tests — Doubles & Triples milestone: Doubles & Triples
-- (T endorsement) question bank (32 items).
--
-- ⚠️ COMMITTED; apply AFTER 029 (the questions columns this seed writes).
-- IDEMPOTENT: the tests row inserts-if-absent by slug, and the question insert
-- runs only when the bank is empty — re-running never duplicates or mutates.
--
-- Content rules (hard, from the Practice Tests blueprint — same as 032/034/035/036/039):
--   * Every question is ORIGINAL wording — written fresh against the AAMVA CDL
--     manual doubles-and-triples section (Section 7) structure and 49 CFR
--     Parts 383 (endorsement definitions/codes) and 393 (coupling and brake
--     rules), never copied from any DMV test or commercial question bank.
--   * Every question carries a citation (49 CFR section or CDL Manual
--     section) and a verified_date. Verified 2026-07-17.
--   * `choices` is the canonical ARRAY shape: [{"key","text"}, ...] (029).
--   * Answer keys are deliberately balanced across a–d, and no key is the
--     longest choice more often than chance (M5/Tanker review rules: a
--     lopsided key OR a longest-answer tell lets test-wise students game it).
--   * The tests row slug MUST stay 'doubles-triples' — it is the data layer's
--     join key to the TS catalog.
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
  'doubles-triples',
  'Doubles & Triples',
  'The T-endorsement knowledge test — rearward amplification, coupling and uncoupling converter dollies, air-line hookup, and keeping two or three trailers upright and tracking.',
  'doubles_triples',
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
  select id into v_test from public.tests where slug = 'doubles-triples';
  if v_test is null then
    raise exception 'doubles-triples test row missing';
  end if;
  if exists (select 1 from public.questions where test_id = v_test) then
    raise notice 'Doubles & Triples bank already seeded — skipping';
    return;
  end if;

  insert into public.questions
    (test_id, prompt, choices, correct_key, explanation, cfr_cite, verified_date, difficulty, tags, sort_order)
  values
  (v_test,
   'What extra authority does a driver need before pulling two or three trailers on public roads?',
   '[{"key":"a","text":"Nothing beyond a Class A CDL as long as the load stays under the placard weight limit"},{"key":"b","text":"A separate oversize-load permit issued by each state the route crosses"},{"key":"c","text":"The double or triple-trailer (T) endorsement added to your CDL"},{"key":"d","text":"Only a current medical card and a clean three-year driving record"}]'::jsonb,
   'c',
   'Pulling doubles or triples requires the T endorsement added to a Class A CDL. It is a knowledge test — there is no separate skills test for T — but you cannot legally pull the extra trailers without the code on your license.',
   '49 CFR 383.93', '2026-07-17', 1, '{doubles-triples,endorsement,rules}', 1),

  (v_test,
   'Why do doubles and triples demand more care than a single trailer?',
   '[{"key":"a","text":"They add coupling points and roll or fold more easily than a single trailer"},{"key":"b","text":"They tend to be loaded heavier, so the brakes can fade faster on a long downgrade"},{"key":"c","text":"They are longer overall, so only the passenger-side mirrors stay useful in traffic"},{"key":"d","text":"They are barred from the interstate system and must run slower surface routes"}]'::jsonb,
   'a',
   'Every extra trailer adds coupling points to inspect and multiplies the ways the rig can roll or jackknife. The manual treats doubles and triples as a higher-skill vehicle for exactly that reason: more connections, less stability, less room for error.',
   'CDL Manual §7.1', '2026-07-17', 1, '{doubles-triples,fundamentals,rollover}', 2),

  (v_test,
   'What is the "crack-the-whip" effect, also called rearward amplification?',
   '[{"key":"a","text":"The trailing brakes grab harder than the tractor brakes during a hard panic stop"},{"key":"b","text":"The converter dolly bounces and hops whenever the rig crosses rough railroad tracks"},{"key":"c","text":"The rear trailer drifts wide on every right turn purely because of off-tracking"},{"key":"d","text":"A quick steering move at the tractor is magnified into a larger swing at the last trailer"}]'::jsonb,
   'd',
   'Rearward amplification means a sudden steering input up front is amplified down the line — a small, quick move at the tractor becomes a large, violent one at the rearmost trailer.',
   'CDL Manual §7.1', '2026-07-17', 2, '{doubles-triples,rearward-amplification,rollover}', 3),

  (v_test,
   'Because of the crack-the-whip effect, which trailer is most likely to turn over?',
   '[{"key":"a","text":"The front trailer, because it carries the most weight of the whole set"},{"key":"b","text":"The rear trailer of the set, where the amplified motion is worst"},{"key":"c","text":"Whichever trailer the heaviest part of the load happens to sit on"},{"key":"d","text":"The converter dolly, since it rides on only a single axle underneath"}]'::jsonb,
   'b',
   'Rearward amplification concentrates the worst of a sudden move at the back, so the last trailer is the one most likely to roll. A steering or evasive move that feels mild at the wheel can put the rear trailer on its side.',
   'CDL Manual §7.1', '2026-07-17', 1, '{doubles-triples,rearward-amplification,rollover}', 4),

  (v_test,
   'How should a doubles or triples driver steer and change lanes to hold the rig steady?',
   '[{"key":"a","text":"With quick, decisive inputs so the trailers have less time to react and sway"},{"key":"b","text":"By braking through every lane change to keep the whole set stretched out straight"},{"key":"c","text":"Gently and gradually, avoiding sudden moves so the rear trailers are not thrown"},{"key":"d","text":"By speeding up slightly during each lane change so the trailers settle behind you"}]'::jsonb,
   'c',
   'Smooth, gradual steering is the whole defense against the crack-the-whip effect. Sudden inputs are exactly what get amplified into the rear trailer; gentle, planned moves and early lane changes keep the set tracking behind you.',
   'CDL Manual §7.1', '2026-07-17', 1, '{doubles-triples,steering,lane-position}', 5),

  (v_test,
   'How does the extra length of doubles or triples change the way you plan a lane change or a merge?',
   '[{"key":"a","text":"You need a bigger gap and more lead time, since the rig is slow to clear a lane"},{"key":"b","text":"It shortens the gap you need, because the long trailers block following traffic anyway"},{"key":"c","text":"It has no real effect once you are above 40 mph and all the trailers are tracking"},{"key":"d","text":"You should change lanes in two quick stages to keep each trailer aligned in turn"}]'::jsonb,
   'a',
   'A long combination needs a larger gap and more time for everything — clearing the lane you leave, reaching the speed of the lane you enter, and letting all the trailers settle. Plan lane changes and merges early and never rush them.',
   'CDL Manual §7.1', '2026-07-17', 2, '{doubles-triples,lane-position,space-management}', 6),

  (v_test,
   'What is off-tracking, and why does it matter more with multiple trailers?',
   '[{"key":"a","text":"The trailer brakes lag behind the tractor brakes, and more trailers add more lag"},{"key":"b","text":"The rear wheels follow inside the front wheels in a turn, worse with more trailers"},{"key":"c","text":"The rig drifts toward the shoulder in a crosswind, worse with more trailer sail area"},{"key":"d","text":"The tires wear unevenly across a long run, and faster with each added trailer axle"}]'::jsonb,
   'b',
   'Off-tracking (or cheating) is the rear wheels following a tighter path than the front wheels through a turn. Each trailer adds to it, so a set of doubles or triples swings its rear wheels well inside the tractor path, and the more trailers, the bigger that inside sweep becomes.',
   'CDL Manual §7.1', '2026-07-17', 2, '{doubles-triples,off-tracking,turns}', 7),

  (v_test,
   'Taking a right turn with a set of doubles, how do you keep the rear trailer from climbing the curb?',
   '[{"key":"a","text":"Turn early and sharp so the tractor is around before the trailers reach the corner"},{"key":"b","text":"Keep the tractor close to the curb and simply let the rear trailer off-track over it"},{"key":"c","text":"Turn from the far outside lane so all of the trailers stay centered on the roadway"},{"key":"d","text":"Swing the tractor wide enough that the rear trailer wheels still clear the curb"}]'::jsonb,
   'd',
   'Because the trailers off-track to the inside, you swing the tractor wide enough that the rear trailer wheels still clear the curb through the turn — without swinging so far left that you invite a vehicle up your right side. Watch the trailer, not just the tractor, all the way around.',
   'CDL Manual §7.1', '2026-07-17', 2, '{doubles-triples,off-tracking,turns}', 8),

  (v_test,
   'What does the manual say about following distance and stopping with doubles or triples on a slippery road?',
   '[{"key":"a","text":"You need extra following distance and gentle braking — the long rig skids easily"},{"key":"b","text":"Following distance can stay normal, because the extra axles add braking traction"},{"key":"c","text":"The rig stops shorter than a single, since the weight spreads over more axles"},{"key":"d","text":"The lead trailer sets the stopping distance and the others just follow it along"}]'::jsonb,
   'a',
   'A long combination on a slick surface is a jackknife and skid waiting to happen. Leave more following distance than you would with a single, look far ahead, and brake early and smoothly so no trailer breaks traction.',
   'CDL Manual §7.1', '2026-07-17', 1, '{doubles-triples,following-distance,stopping}', 9),

  (v_test,
   'What is a converter dolly?',
   '[{"key":"a","text":"A hydraulic jack built into the trailer to raise it during the coupling step"},{"key":"b","text":"The sliding tandem axle assembly mounted underneath the rear trailer of the set"},{"key":"c","text":"A coupling unit with one or two axles and a fifth wheel, used to tow a trailer"},{"key":"d","text":"A short rigid hitch that bolts two trailer frames directly together end to end"}]'::jsonb,
   'c',
   'A converter dolly is a small coupling unit — one or two axles with a fifth wheel and a drawbar — that turns a trailer into something the trailer ahead can pull. It is the piece that makes a double or triple possible, and it is one of the most important things you inspect.',
   'CDL Manual §7.2', '2026-07-17', 1, '{doubles-triples,converter-dolly,coupling}', 10),

  (v_test,
   'What connects a converter dolly to the trailer in front of it?',
   '[{"key":"a","text":"The dolly kingpin drops down and locks into the trailer''s own fifth wheel"},{"key":"b","text":"The dolly drawbar eye locks onto the pintle hook at the rear of the trailer ahead"},{"key":"c","text":"A glad-hand air coupler carries the entire towing load between the two units"},{"key":"d","text":"A single safety chain alone, rated for the fully loaded weight of the trailer"}]'::jsonb,
   'b',
   'The dolly''s drawbar has an eye that drops onto the pintle hook mounted at the rear of the trailer ahead; that hook-and-eye is the towing connection. The dolly''s own fifth wheel then receives the kingpin of the next trailer back.',
   'CDL Manual §7.2', '2026-07-17', 2, '{doubles-triples,pintle-hook,coupling}', 11),

  (v_test,
   'After you latch the towing coupling between the trailers, what must you check about it?',
   '[{"key":"a","text":"That the dolly tires are running hotter than the trailer tires above them"},{"key":"b","text":"That the drawbar is at least a foot longer than the trailer''s rear overhang"},{"key":"c","text":"That the pintle hook is greased enough to swivel freely while under tow load"},{"key":"d","text":"That the hook is closed and locked, with its safety latch or keeper in place"}]'::jsonb,
   'd',
   'A pintle hook holds the tow only when it is closed AND its latch (keeper) is secured. An open or unlatched hook can release the dolly and trailer on the road, so confirming the latch is down and locked is a mandatory coupling check.',
   'CDL Manual §7.2', '2026-07-17', 2, '{doubles-triples,pintle-hook,coupling,inspection}', 12),

  (v_test,
   'When coupling a second trailer, in what order should the trailers end up so the setup is safe?',
   '[{"key":"a","text":"Heavier trailer in front, lighter trailer to the rear, to cut the rollover risk"},{"key":"b","text":"The lighter trailer in front and the heavier trailer riding in the rear position"},{"key":"c","text":"Whichever trailer is already loaded goes first, regardless of how much it weighs"},{"key":"d","text":"The two trailers must weigh within 500 pounds of each other or the set is illegal"}]'::jsonb,
   'a',
   'The manual''s rule is heavier trailer first, lighter trailer to the rear. A heavy trailer at the back worsens the crack-the-whip rollover risk, so the lighter load rides last where rearward amplification is strongest.',
   'CDL Manual §7.2', '2026-07-17', 2, '{doubles-triples,coupling,trailer-order,rollover}', 13),

  (v_test,
   'Before backing the second trailer onto a converter dolly, why must the trailer brakes be locked and the wheels chocked?',
   '[{"key":"a","text":"So it can bleed the air out of the emergency line before you begin coupling"},{"key":"b","text":"So the kingpin lines itself up with the fifth wheel automatically as you back"},{"key":"c","text":"So the trailer cannot roll while it sits unsupported by any tractor underneath"},{"key":"d","text":"To keep the trailer''s landing gear from retracting down on its own during coupling"}]'::jsonb,
   'c',
   'A trailer waiting to be coupled has nothing holding it but its own brakes and chocks. If it rolls when you back the dolly and tractor under it, it can be pushed away or knocked over — so you secure it before it is coupled, not after.',
   'CDL Manual §7.2', '2026-07-17', 2, '{doubles-triples,coupling,inspection}', 14),

  (v_test,
   'When you couple a converter dolly under a trailer, how high should the fifth wheel be set first?',
   '[{"key":"a","text":"Level with the ground, so the fifth-wheel plate slides straight in underneath"},{"key":"b","text":"High enough that the trailer lifts slightly as the dolly rolls under it"},{"key":"c","text":"Low enough that the trailer rests on the dolly frame instead of the fifth wheel"},{"key":"d","text":"At the very same height as the tractor fifth wheel, purely for consistency"}]'::jsonb,
   'b',
   'Set the dolly fifth wheel so that as it rolls under, it lifts the trailer just slightly — that height guarantees the kingpin seats fully and the jaws close around it. Too low and it slides under without locking; too high and it can miss the plate.',
   'CDL Manual §7.2', '2026-07-17', 3, '{doubles-triples,converter-dolly,coupling}', 15),

  (v_test,
   'After coupling a dolly to a trailer, how do you confirm the connection actually locked?',
   '[{"key":"a","text":"Look that the release lever moved back, and from that assume the jaws closed"},{"key":"b","text":"Bounce the trailer by hand, then trust the kingpin if you feel no play in it"},{"key":"c","text":"Check only that the glad hands sealed and the trailer air pressure held steady"},{"key":"d","text":"Pull-test with the dolly brakes set, then look for closed jaws and no plate gap"}]'::jsonb,
   'd',
   'You confirm a lock two ways: a gentle pull-test against the connection with the dolly brakes set, and a look under the trailer to see the jaws closed on the kingpin with no gap between the fifth-wheel plates. Air pressure alone does not prove the mechanical coupling is locked.',
   'CDL Manual §7.2', '2026-07-17', 3, '{doubles-triples,coupling,inspection}', 16),

  (v_test,
   'What are the two air lines you connect between trailers, and what does each do?',
   '[{"key":"a","text":"The primary line, which runs the trailer lights, and a secondary line for the brakes"},{"key":"b","text":"The intake line and the exhaust line that feed the trailer''s own air compressor"},{"key":"c","text":"The service line, which applies the brakes, and the supply line, which charges the tanks"},{"key":"d","text":"A high-pressure line and a low-pressure line that alternate their roles under load"}]'::jsonb,
   'c',
   'Every trailer gets a service (control) line that applies its brakes on command and an emergency (supply) line that charges its reservoir and holds the spring brakes off. Cross or miss one when coupling and the trailer brakes will not work the way you expect.',
   'CDL Manual §7.2', '2026-07-17', 2, '{doubles-triples,air-lines,coupling}', 17),

  (v_test,
   'How do glad hands help you avoid crossing the service and emergency air lines between trailers?',
   '[{"key":"a","text":"They are keyed and often color-coded or shaped so the wrong pair will not seal"},{"key":"b","text":"They automatically swap themselves over to the correct port once the system charges"},{"key":"c","text":"They are built to one common size, so any air hose fits any port well enough"},{"key":"d","text":"They will only lock together when the trailer service brakes are already applied"}]'::jsonb,
   'a',
   'Glad hands are built and often color-coded or offset so the service and supply couplers only mate with their correct partners. Even so, you check by function after coupling — crossed lines are a classic doubles/triples mistake that leaves a trailer with no brakes or no supply.',
   'CDL Manual §7.2', '2026-07-17', 2, '{doubles-triples,air-lines,glad-hands}', 18),

  (v_test,
   'What is the purpose of the trailer air-supply shutoff valves (cut-out cocks) at the rear of trailers in a combination?',
   '[{"key":"a","text":"They quickly vent the trailer air tanks whenever you park the rig for the night"},{"key":"b","text":"They set how hard each trailer brakes relative to the tractor pulling the set"},{"key":"c","text":"They drain water out of the air lines automatically as system pressure builds up"},{"key":"d","text":"Open where another trailer is coupled behind, closed at the rear of the last trailer"}]'::jsonb,
   'd',
   'Shutoff (cut-out) valves at the back of each trailer must be open wherever another trailer is coupled behind, and closed on the rearmost trailer so the air system stays sealed. A valve left closed mid-set starves the trailers behind it of air; one left open at the very rear dumps your supply.',
   'CDL Manual §7.4', '2026-07-17', 3, '{doubles-triples,shutoff-valves,air-lines}', 19),

  (v_test,
   'How do you check that air actually reaches the brakes of the rearmost trailer before driving?',
   '[{"key":"a","text":"Watch the tractor dash air gauge climb all the way up to governor cutout pressure"},{"key":"b","text":"Crack the shutoff at the rear of the last trailer and listen for air, then close it"},{"key":"c","text":"Count the trailers and assume each one charged in order from front to the back"},{"key":"d","text":"Apply the tractor parking brake and feel for the whole rig to settle in place"}]'::jsonb,
   'b',
   'The rear-trailer air check is a manual proof: with the system charged, crack the shutoff at the rear of the last trailer and you should hear air — proof the supply passed through every trailer and open valve to the back. No air means a closed valve or a break somewhere ahead of it.',
   'CDL Manual §7.4', '2026-07-17', 3, '{doubles-triples,air-lines,inspection}', 20),

  (v_test,
   'What does the trailer hand valve (trolley or "Johnson" bar) do, and why is it not for normal stops?',
   '[{"key":"a","text":"It applies only the tractor drive-axle brakes and is the primary service control"},{"key":"b","text":"It releases the spring brakes for a smooth rolling start when stopped on a grade"},{"key":"c","text":"It applies only the trailer brakes; using it to slow the rig can cause a skid"},{"key":"d","text":"It locks every axle evenly and is the safest way to make a hard emergency stop"}]'::jsonb,
   'c',
   'The hand valve applies the trailer service brakes alone. Braking a long combination with the trailer brakes only invites a skid or jackknife, so it is never the normal stopping method — the foot brake, which balances tractor and trailer, is.',
   'CDL Manual §6.2', '2026-07-17', 2, '{doubles-triples,hand-valve,brakes}', 21),

  (v_test,
   'Why should you not use the trailer hand valve to hold a parked combination in place?',
   '[{"key":"a","text":"It holds only on air pressure, which bleeds off, so set the parking brakes instead"},{"key":"b","text":"It applies far more braking force than the parking brakes and can warp the drums"},{"key":"c","text":"It locks the steering axle and can flatten the steer tires if left on overnight"},{"key":"d","text":"It drains the emergency line and disables the whole set until it is recharged"}]'::jsonb,
   'a',
   'The hand valve holds only while service air pressure lasts, and that pressure leaks down over time — a rig held by the hand valve can roll away. Parking means setting the spring (parking) brakes, which hold mechanically without air.',
   'CDL Manual §6.2', '2026-07-17', 2, '{doubles-triples,hand-valve,parking-brakes}', 22),

  (v_test,
   'What does the tractor protection valve do in a combination vehicle?',
   '[{"key":"a","text":"It boosts air pressure to the rearmost trailer to equalize braking across the set"},{"key":"b","text":"It warms the trailer air lines in freezing weather so they do not ice up and block"},{"key":"c","text":"It routes the parking brake control back to the last trailer of the set only"},{"key":"d","text":"It seals off the tractor air and sets the trailer emergency brakes in a breakaway"}]'::jsonb,
   'd',
   'The tractor protection valve guards the tractor''s air: if a trailer tears away or system pressure falls into the danger zone, it seals the tractor supply and lets the trailer emergency (spring) brakes set. It is what keeps a breakaway from draining the tractor and leaving you with no brakes.',
   'CDL Manual §6.2', '2026-07-17', 2, '{doubles-triples,tractor-protection-valve,brakes}', 23),

  (v_test,
   'What are the trailer spring brakes, and when do they apply on their own?',
   '[{"key":"a","text":"Air-applied brakes that release again the moment you press down on the pedal"},{"key":"b","text":"Brakes held off by air that apply on their own when air is lost, as in a breakaway"},{"key":"c","text":"A backup hydraulic braking system used only at speeds below about 20 mph"},{"key":"d","text":"The service brakes running at half their force for gentle low-speed stops"}]'::jsonb,
   'b',
   'Spring (emergency/parking) brakes are held off by air and applied by strong springs. Lose air — a breakaway, a major leak, or draining the system — and the springs set the brakes automatically, which is the failsafe that stops a runaway trailer.',
   'CDL Manual §6.2', '2026-07-17', 2, '{doubles-triples,spring-brakes,emergency-brakes}', 24),

  (v_test,
   'While inspecting a converter dolly, what are you checking on its own brakes and tires?',
   '[{"key":"a","text":"That its tires, wheels, brakes, and air and light lines are sound and secured"},{"key":"b","text":"That the dolly has no brakes at all, since it only rolls freely behind the trailer"},{"key":"c","text":"Only that the dolly tires still hold air; its brakes are covered by the trailer''s"},{"key":"d","text":"That the dolly is built heavier than the trailer it is supporting from below"}]'::jsonb,
   'a',
   'A converter dolly carries its own axle(s), brakes, tires, and air/light lines — all of which you inspect like any other running gear. Cut or dangling lines, flat or damaged tires, and bad brake components on the dolly are as disqualifying as they would be anywhere on the rig.',
   'CDL Manual §7.3', '2026-07-17', 2, '{doubles-triples,converter-dolly,inspection}', 25),

  (v_test,
   'What are you looking for when you inspect the pintle hook and drawbar coupling during a walkaround?',
   '[{"key":"a","text":"That the hook and eye are worn smooth so they swivel together really easily"},{"key":"b","text":"That the hook and drawbar are greased heavily so the connection turns freely"},{"key":"c","text":"That the hook is not cracked or worn, is latched and locked, with no slack"},{"key":"d","text":"That the pintle hook can still be opened by hand even while it is under load"}]'::jsonb,
   'c',
   'The pintle-hook check looks for cracks, excessive wear, a proper latch, and any looseness in the hook-and-eye connection, plus intact safety devices. That coupling carries the entire towed trailer, so wear or a missing latch there is a critical defect.',
   '49 CFR 393.70', '2026-07-17', 2, '{doubles-triples,pintle-hook,inspection}', 26),

  (v_test,
   'When you inspect the fifth wheel and kingpin connection between the dolly and trailer, what confirms it is safe?',
   '[{"key":"a","text":"The trailer can still pivot freely by hand while sitting on the fifth wheel"},{"key":"b","text":"The jaws are closed around the kingpin, the lever is set, and no plate gap shows"},{"key":"c","text":"The kingpin sits up above the fifth-wheel plate so it releases more easily later"},{"key":"d","text":"The fifth wheel is greased so heavily that the two plates never actually touch"}]'::jsonb,
   'b',
   'A safe fifth-wheel coupling shows the locking jaws closed fully around the kingpin, the lock lever seated, and the plates flush with no gap. Any space between the plates or jaws not closed on the pin means the trailer is not truly coupled.',
   '49 CFR 393.70', '2026-07-17', 3, '{doubles-triples,coupling,inspection}', 27),

  (v_test,
   'Why should you check trailer height and alignment before rolling a dolly or tractor under a trailer to couple?',
   '[{"key":"a","text":"So the trailer sits low enough to slide under without lifting and save the fifth wheel"},{"key":"b","text":"To confirm that the trailer is loaded heavier at the front for better stability"},{"key":"c","text":"To make sure the trailer landing gear will retract fully once coupling is done"},{"key":"d","text":"So the fifth wheel meets the kingpin squarely — too low it hits, too high it skips"}]'::jsonb,
   'd',
   'The trailer must sit at the correct height and be lined up straight so the fifth wheel slides under and the kingpin drops squarely into the jaws. A trailer too low gets struck by the fifth-wheel plate; too high and the pin can ride over the jaws instead of locking in.',
   'CDL Manual §7.2', '2026-07-17', 2, '{doubles-triples,coupling,trailer-alignment}', 28),

  (v_test,
   'The manual warns that doubles and triples are especially unstable in one common maneuver. Which one?',
   '[{"key":"a","text":"A quick lane change or a sudden swerve made to avoid a hazard in the road"},{"key":"b","text":"Climbing a long, steady grade at a reduced and constant road speed"},{"key":"c","text":"Idling in line at a scale house with all of the trailers fully loaded"},{"key":"d","text":"Backing slowly and straight into an ordinary loading dock at the yard"}]'::jsonb,
   'a',
   'The rig is most likely to roll or throw a trailer during a fast lane change or an abrupt evasive move, because that is exactly what the crack-the-whip effect amplifies. The manual''s answer is to steer smoothly, look far ahead, and avoid needing a sudden swerve at all.',
   'CDL Manual §7.1', '2026-07-17', 1, '{doubles-triples,emergency-handling,rollover}', 29),

  (v_test,
   'How does an antilock braking system (ABS) help a driver in a combination vehicle?',
   '[{"key":"a","text":"It stops the whole rig in a far shorter distance than brakes without any ABS"},{"key":"b","text":"It applies the trailer brakes automatically a moment before the tractor brakes"},{"key":"c","text":"It keeps the wheels from locking in hard braking so you keep steering control"},{"key":"d","text":"It removes the need to leave any extra following distance on wet or icy roads"}]'::jsonb,
   'c',
   'ABS prevents wheel lockup in hard or panic braking so you keep steering control and are far less likely to skid or jackknife. It does not shorten your stopping distance or replace good following distance — it just helps you stay in control while you stop.',
   '49 CFR 393.55', '2026-07-17', 2, '{doubles-triples,abs,brakes}', 30),

  (v_test,
   'If only the tractor or only one trailer in the set has ABS, how much does it help?',
   '[{"key":"a","text":"It does nothing at all unless every single axle in the combination has ABS"},{"key":"b","text":"Partial ABS is actually more dangerous than none and should be switched off"},{"key":"c","text":"It only helps the driver at lower speeds, below roughly 30 miles per hour"},{"key":"d","text":"Any ABS helps — even on just the tractor or one trailer — so brake normally"}]'::jsonb,
   'd',
   'You get a benefit from whatever ABS is present — tractor-only or one-trailer ABS still improves stability and steering control. With ABS, brake normally and hold steady pressure; do not pump, and do not assume you can stop shorter.',
   '49 CFR 393.55', '2026-07-17', 2, '{doubles-triples,abs,brakes}', 31),

  (v_test,
   'What is the safest overall approach to driving doubles or triples in traffic?',
   '[{"key":"a","text":"Stay in the left lane so the long rig has the most room to maneuver past traffic"},{"key":"b","text":"Keep a big space cushion, look far ahead, change lanes early, slow before curves"},{"key":"c","text":"Match the flow of traffic exactly, since a long rig is safest at the same speed"},{"key":"d","text":"Brake hard and early at each hazard so all the trailers settle before the turn"}]'::jsonb,
   'b',
   'The whole doubles/triples playbook is space and smoothness: a big cushion, eyes far down the road, early and gentle lane changes, and slowing before curves and ramps so you never ask the trailers for a sudden move. That is how you keep a rig with the most coupling points and the least stability under control.',
   'CDL Manual §7.1', '2026-07-17', 1, '{doubles-triples,space-management,driving}', 32);

  -- Keep the informational counter in step with the seeded bank.
  update public.tests
     set question_count = (select count(*) from public.questions where test_id = v_test)
   where id = v_test;
end $$;
