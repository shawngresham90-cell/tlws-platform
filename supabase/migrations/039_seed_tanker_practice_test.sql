-- 039_seed_tanker_practice_test.sql
-- CDL Practice Tests — Tanker milestone: Tanker (N endorsement) question bank (32 items).
--
-- ⚠️ COMMITTED; apply AFTER 029 (the questions columns this seed writes).
-- IDEMPOTENT: the tests row inserts-if-absent by slug, and the question insert
-- runs only when the bank is empty — re-running never duplicates or mutates.
--
-- Content rules (hard, from the Practice Tests blueprint — same as 032/034/035/036):
--   * Every question is ORIGINAL wording — written fresh against the AAMVA CDL
--     manual tank-vehicles section (Section 8) structure and 49 CFR Part 383
--     (endorsement definitions and codes), never copied from any DMV test or
--     commercial question bank.
--   * Every question carries a citation (49 CFR section or CDL Manual
--     section) and a verified_date. Verified 2026-07-17.
--   * `choices` is the canonical ARRAY shape: [{"key","text"}, ...] (029).
--   * Answer keys are deliberately balanced across a–d (M5 review rule:
--     a lopsided key lets test-wise students game the choices).
--   * The tests row slug MUST stay 'tanker' — it is the data layer's join
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
  'tanker',
  'Tanker',
  'The N-endorsement knowledge test — liquid surge, baffles and bulkheads, outage, tank inspection, and the driving that keeps a high-center-of-gravity load upright.',
  'tanker',
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
  select id into v_test from public.tests where slug = 'tanker';
  if v_test is null then
    raise exception 'tanker test row missing';
  end if;
  if exists (select 1 from public.questions where test_id = v_test) then
    raise notice 'Tanker bank already seeded — skipping';
    return;
  end if;

  insert into public.questions
    (test_id, prompt, choices, correct_key, explanation, cfr_cite, verified_date, difficulty, tags, sort_order)
  values
  (v_test,
   'Two traits together make tank vehicles the trickiest rigs on the road. Which pair?',
   '[{"key":"a","text":"Extra length and extra width"},{"key":"b","text":"Poor visibility and slow acceleration"},{"key":"c","text":"Air-brake lag and trailer sway"},{"key":"d","text":"A high center of gravity and a liquid load that moves on its own"}]'::jsonb,
   'd',
   'Everything in tanker technique flows from those two facts: the weight rides high, and it shifts by itself. High center of gravity makes the rig easy to tip; surge supplies the push. Control the wave and respect the lean, and the rest of the manual follows.',
   'CDL Manual §8.2', '2026-07-17', 1, '{tanker,fundamentals,rollover,surge}', 1),

  (v_test,
   'A loaded cargo tank carries its weight differently than a van trailer. What is the key difference, and why does it matter?',
   '[{"key":"a","text":"The weight sits lower, which makes jackknifing more likely on ice"},{"key":"b","text":"The weight sits farther forward, which overloads the steer axle"},{"key":"c","text":"The weight constantly shifts rearward, which lightens the steering"},{"key":"d","text":"The weight rides high, so the vehicle can roll over at speeds that would not tip other trucks"}]'::jsonb,
   'd',
   'Tank loads have a high center of gravity — much of the weight rides well above the road. That top-heaviness is why tankers tip in curves and on ramps that a flatbed or van trailer would take without drama.',
   'CDL Manual §8.2', '2026-07-17', 1, '{tanker,high-center-of-gravity,rollover}', 2),

  (v_test,
   'The CDL manual leans hard on rollover prevention for tank drivers. What does it warn about rollovers and driver deaths?',
   '[{"key":"a","text":"More than half of truck-driver deaths in crashes are the result of truck rollovers"},{"key":"b","text":"Rollovers are rare but always fatal"},{"key":"c","text":"Rollovers only kill drivers who are not wearing seat belts"},{"key":"d","text":"About one in every hundred truck-driver deaths involves a rollover"}]'::jsonb,
   'a',
   'The manual''s warning is blunt: over half of truck-driver deaths in crashes come from rollovers. Add a high center of gravity and a shifting liquid load, and rollover prevention becomes the tank driver''s first job.',
   'CDL Manual §8.2', '2026-07-17', 1, '{tanker,rollover}', 3),

  (v_test,
   'What is liquid surge?',
   '[{"key":"a","text":"The pressure rise inside a sealed tank as the cargo warms"},{"key":"b","text":"Foaming at the top of the tank caused by fast loading"},{"key":"c","text":"The wave a partially filled tank sends back and forth as the truck speeds up and slows down"},{"key":"d","text":"The vibration a pump sends through the product during unloading"}]'::jsonb,
   'c',
   'Surge is the moving wave in a partly filled tank: brake, and the liquid keeps going, slamming forward; accelerate, and it piles toward the rear. That mass in motion pushes the truck around, and it is strongest when the tank is well short of full.',
   'CDL Manual §8.2', '2026-07-17', 1, '{tanker,surge}', 4),

  (v_test,
   'You brake to a stop on packed snow with a half-full smooth-bore tank. What can the cargo do to you after the wheels stop?',
   '[{"key":"a","text":"Nothing — a stopped truck cannot be moved by its own cargo"},{"key":"b","text":"Lift the drive axles enough to trigger the low-air warning"},{"key":"c","text":"Slosh upward and vent product through the manhole covers"},{"key":"d","text":"Slam forward and shove the truck ahead — on slick pavement, even out into the intersection"}]'::jsonb,
   'd',
   'The liquid wave keeps traveling after the truck stops. When it hits the front of the tank it drives the truck forward — and on a slippery surface that shove can push a stopped rig into the very intersection you meant to stay out of.',
   'CDL Manual §8.2', '2026-07-17', 2, '{tanker,surge,stopping}', 5),

  (v_test,
   'Because of surge, what is the rule for your brakes at the end of a stop?',
   '[{"key":"a","text":"Release as you reach walking speed so the wave dissipates gradually"},{"key":"b","text":"Pump them rapidly so the liquid never forms a single wave"},{"key":"c","text":"Release, then immediately reapply — the double tap settles the load"},{"key":"d","text":"Hold them firmly until the vehicle is fully stopped, and keep holding while the wave settles"}]'::jsonb,
   'd',
   'Let go early and the returning wave can roll the truck forward again. Keep the brakes applied through the stop and hold them while the liquid finishes moving — that grip is the only thing pinning the rig in place.',
   'CDL Manual §8.3', '2026-07-17', 2, '{tanker,surge,stopping}', 6),

  (v_test,
   'How does hauling a liquid load change the following distance you keep?',
   '[{"key":"a","text":"It does not — stopping distance depends on brakes, not cargo"},{"key":"b","text":"You need much more space, because surge stretches the distance it takes to stop smoothly"},{"key":"c","text":"You can run closer, because the extra weight improves traction"},{"key":"d","text":"Only in curves; on straight road, normal spacing applies"}]'::jsonb,
   'b',
   'A tanker cannot be braked hard without the load fighting back. Leave extra room ahead, start slowing far earlier than you would in a van, and brake gently so the wave stays manageable — space is what buys you that smoothness.',
   'CDL Manual §8.3', '2026-07-17', 1, '{tanker,surge,following-distance}', 7),

  (v_test,
   'Baffles tame part of the surge problem. Which statement about them is true?',
   '[{"key":"a","text":"Baffles stop all liquid movement inside the tank"},{"key":"b","text":"Baffles control side-to-side slosh but not fore-and-aft surge"},{"key":"c","text":"Baffles slow fore-and-aft surge but leave side-to-side slosh — a rollover ingredient — untouched"},{"key":"d","text":"Baffles are required equipment in every tank that hauls liquid"}]'::jsonb,
   'c',
   'Baffle bulkheads break up the wave running front-to-back, but they do nothing about liquid moving side to side. That lateral slosh piles weight toward the outside of a curve — which is why even baffled tankers roll when driven too fast.',
   'CDL Manual §8.2', '2026-07-17', 2, '{tanker,baffles,surge,rollover}', 8),

  (v_test,
   'What is a baffled tank, physically?',
   '[{"key":"a","text":"A tank whose interior bulkheads have holes in them, letting product through while breaking up the wave"},{"key":"b","text":"A tank wrapped in insulation to slow temperature swings"},{"key":"c","text":"A tank with a flexible liner that collapses as product unloads"},{"key":"d","text":"A tank divided into sealed compartments with no openings between them"}]'::jsonb,
   'a',
   'Baffles are bulkheads with holes. Liquid can still flow the length of the tank, but the wave has to fight through each baffle on the way — which slows the fore-and-aft surge that hammers the rig during braking and acceleration.',
   'CDL Manual §8.2', '2026-07-17', 1, '{tanker,baffles,tank-types}', 9),

  (v_test,
   'What separates a bulkhead from a baffle inside a tank?',
   '[{"key":"a","text":"A bulkhead is bolted in; a baffle is welded"},{"key":"b","text":"They are two names for the same divider"},{"key":"c","text":"A bulkhead runs lengthwise; a baffle runs across the tank"},{"key":"d","text":"A bulkhead is solid and seals compartments apart; a baffle has holes that let liquid pass"}]'::jsonb,
   'd',
   'A bulkhead is a solid wall — it divides the tank into isolated compartments. A baffle is the same wall with holes in it: product flows through, but the surge wave is broken up along the way.',
   'CDL Manual §8.2', '2026-07-17', 1, '{tanker,bulkheads,baffles}', 10),

  (v_test,
   'Milk and other food-grade liquids usually move in smooth-bore tanks with no baffles at all. Why?',
   '[{"key":"a","text":"Sanitation rules — baffled interiors are hard to clean, so they are prohibited for those cargoes"},{"key":"b","text":"Food liquids are too thick to surge, so baffles add nothing"},{"key":"c","text":"Baffles would churn the product and ruin it"},{"key":"d","text":"Smooth-bore tanks are cheaper, and food hauling runs on thin margins"}]'::jsonb,
   'a',
   'Sanitation regulations are the reason: every surface in a food tank must be cleanable, and baffles create surfaces and crevices that are not. The trade-off lands on the driver — a smooth-bore food tank surges hardest of all.',
   'CDL Manual §8.2', '2026-07-17', 2, '{tanker,smooth-bore,tank-types,food-grade}', 11),

  (v_test,
   'When does a smooth-bore tanker demand the most caution?',
   '[{"key":"a","text":"At highway cruise, where the liquid settles into a standing wave"},{"key":"b","text":"While starting and stopping — nothing inside the tank slows the fore-and-aft wave"},{"key":"c","text":"During loading, when static electricity peaks"},{"key":"d","text":"In crosswinds, because the smooth shell catches more air"}]'::jsonb,
   'b',
   'With no baffles, the full weight of the wave arrives at each end of the tank undiminished. Every start and every stop sets it moving — so smooth-bore drivers live by gentle brakes, gentle throttle, and extra space.',
   'CDL Manual §8.2', '2026-07-17', 2, '{tanker,smooth-bore,surge}', 12),

  (v_test,
   'You are loading a tank divided by solid bulkheads into separate compartments. What must you keep an eye on besides total weight?',
   '[{"key":"a","text":"The order the compartments were cleaned in"},{"key":"b","text":"Keeping every compartment exactly half full to equalize surge"},{"key":"c","text":"How the load spreads across the axles — a badly placed compartment load can overload the front or rear"},{"key":"d","text":"Filling from the rear compartment forward, which the regulations require"}]'::jsonb,
   'c',
   'Bulkhead compartments let you put weight where you choose — which means you can also put it where it does not belong. Watch axle weight distribution while loading and unloading so no axle group ends up overloaded while the gross weight still looks legal.',
   'CDL Manual §8.2', '2026-07-17', 2, '{tanker,bulkheads,weight-distribution}', 13),

  (v_test,
   'What is outage?',
   '[{"key":"a","text":"The space you leave in a tank so the liquid has room to expand as it warms"},{"key":"b","text":"The time a tank spends empty between loads"},{"key":"c","text":"Product lost to evaporation during a long haul"},{"key":"d","text":"The gap between a tank''s rated and actual capacity"}]'::jsonb,
   'a',
   'Liquids expand as they warm in transit, and a tank loaded to the brim has nowhere to send that growth. Outage is the expansion room you deliberately leave — which is why a cargo tank is never loaded completely full.',
   'CDL Manual §8.2', '2026-07-17', 1, '{tanker,outage}', 14),

  (v_test,
   'Is the right amount of outage the same for every liquid?',
   '[{"key":"a","text":"Yes — federal rules fix outage at a flat percentage for all cargo"},{"key":"b","text":"Yes, as long as the tanks are the same size"},{"key":"c","text":"No — different liquids expand by different amounts, so each product needs its own outage"},{"key":"d","text":"No — outage depends only on trip length, not on the product"}]'::jsonb,
   'c',
   'Expansion varies with the product: some liquids grow far more than others as they warm. You have to know the outage requirement for the specific liquid you are hauling and load to that number, not to a habit.',
   'CDL Manual §8.2', '2026-07-17', 2, '{tanker,outage}', 15),

  (v_test,
   'Hauling a dense liquid, you find the tank is only part full when you hit maximum legal weight. What is going on?',
   '[{"key":"a","text":"The scale is misreading the surge — re-weigh with the product settled"},{"key":"b","text":"Nothing unusual — a heavy liquid reaches the legal weight limits long before it fills the tank''s volume"},{"key":"c","text":"The tank is mislabeled and should be re-certified"},{"key":"d","text":"The load was pumped too cold and will settle to full weight later"}]'::jsonb,
   'b',
   'Tank volume is sized for a range of products. With a dense liquid, legal gross and axle weights arrive well before the tank is full — so you run a partial load, and a partial load means more room for surge. Weight, outage, AND legal limits together decide how much to load.',
   'CDL Manual §8.2', '2026-07-17', 3, '{tanker,outage,weight-limits}', 16),

  (v_test,
   'What does the manual call the most important thing to check a tank vehicle for?',
   '[{"key":"a","text":"Tread depth on the steer tires"},{"key":"b","text":"The date of the last tank pressure test"},{"key":"c","text":"Proper placement of the placard holders"},{"key":"d","text":"Leaks — in the tank itself and in its valves, pipes, and hoses"}]'::jsonb,
   'd',
   'The tank inspection starts and ends with leaks: check the tank body, the intake, discharge, and cut-off valves, and the pipes, connections, and hoses. It is illegal to haul liquid in a leaking tank — and a leak is the defect most likely to put product on the road.',
   'CDL Manual §8.1', '2026-07-17', 1, '{tanker,inspection,leaks}', 17),

  (v_test,
   'During the walkaround, what condition must the manhole covers be in?',
   '[{"key":"a","text":"Closed and latched, with intact gaskets keeping them tight"},{"key":"b","text":"Cracked open slightly so pressure can equalize"},{"key":"c","text":"Removed and stowed if the tank is empty"},{"key":"d","text":"Painted a contrasting color for visibility"}]'::jsonb,
   'a',
   'Manhole covers ride on top of the tank and take the full force of surge in a hard stop. The check is simple: covers closed, latches latched, and the vents clear — an unlatched cover is a spill waiting for the first panic brake.',
   'CDL Manual §8.1', '2026-07-17', 1, '{tanker,inspection,manholes}', 18),

  (v_test,
   'Beyond the standard truck checks, tank vehicles often carry purpose-built gear you must inspect. Which list is that gear?',
   '[{"key":"a","text":"Load bars, edge protectors, and winch straps"},{"key":"b","text":"Vapor recovery kits, grounding cables, emergency shutoffs, and built-in fire extinguishers"},{"key":"c","text":"Sliding fifth wheels, pintle hooks, and safety chains"},{"key":"d","text":"Reefer units, ducting, and temperature recorders"}]'::jsonb,
   'b',
   'Tank work adds its own equipment: vapor recovery kits for loading racks, grounding and bonding cables for static, emergency shutoff systems, and built-in fire extinguishers. If your tank has them, they are part of your inspection — confirm each one is present and working.',
   'CDL Manual §8.1', '2026-07-17', 2, '{tanker,inspection,special-equipment}', 19),

  (v_test,
   'Fifty miles into the run you spot product dripping steadily from a discharge valve. What is the move?',
   '[{"key":"a","text":"Note it on the DVIR at the end of the day and keep to schedule"},{"key":"b","text":"Tighten the valve at speed at the next straightaway"},{"key":"c","text":"Stop as soon as you safely can — hauling liquid in a leaking tank is illegal, and every mile spreads the spill"},{"key":"d","text":"Continue to the consignee, since the product is already sold"}]'::jsonb,
   'c',
   'A leaking tank does not get driven. Get the rig stopped somewhere safe, keep the leak away from people and drains as best you can, and get your carrier on the phone. Driving on means citations, a shutdown, cleanup liability — and a trail of product behind you.',
   'CDL Manual §8.1', '2026-07-17', 2, '{tanker,inspection,leaks}', 20),

  (v_test,
   'Summed up in one sentence, how is a loaded tanker driven?',
   '[{"key":"a","text":"Aggressively enough to stay ahead of the wave"},{"key":"b","text":"Smoothly — gentle starts, gradual stops, and easy lane changes that never wake the load up"},{"key":"c","text":"In the lowest gear that keeps the engine above idle"},{"key":"d","text":"With the trailer brakes doing most of the slowing"}]'::jsonb,
   'b',
   'Every control input reaches the liquid. Smooth acceleration, smooth braking, and smooth steering keep the wave small; jerky inputs build it. The driver who upsets a tanker is usually the one who moved suddenly.',
   'CDL Manual §8.3', '2026-07-17', 1, '{tanker,driving,smoothness}', 21),

  (v_test,
   'What is the manual''s technique for taking a curve in a tanker?',
   '[{"key":"a","text":"Slow to a safe speed before entering, then accelerate slightly through the curve"},{"key":"b","text":"Brake steadily from entry to exit to keep weight on the drive axles"},{"key":"c","text":"Coast through in neutral so no torque reaches the wheels"},{"key":"d","text":"Enter at the posted speed and slow midway if the trailer leans"}]'::jsonb,
   'a',
   'Braking inside a curve both shifts the load and asks the tires for two jobs at once. Do the slowing on the straightaway before the curve, then hold light power through it — the slight acceleration keeps the vehicle settled and the liquid steady.',
   'CDL Manual §8.3', '2026-07-17', 2, '{tanker,driving,curves}', 22),

  (v_test,
   'Highway curves and interchange ramps post advisory speeds. How should a loaded tanker treat those numbers?',
   '[{"key":"a","text":"Match them exactly — they are calculated for heavy trucks"},{"key":"b","text":"Stay well below them — tests show a loaded tanker can roll over at the posted curve speed"},{"key":"c","text":"Exceed them slightly to reduce the time spent leaning in the curve"},{"key":"d","text":"Ignore them; only the truck speed limit applies to commercial vehicles"}]'::jsonb,
   'b',
   'Posted curve speeds are set for low, stable passenger cars. Testing has shown a tanker can roll over at the posted speed of a curve — so the manual''s rule is to take highway curves and on/off ramps well below what the sign says.',
   'CDL Manual §8.3', '2026-07-17', 2, '{tanker,rollover,curves}', 23),

  (v_test,
   'What do wet roads do to the stopping distance of a tank vehicle?',
   '[{"key":"a","text":"Add roughly ten percent"},{"key":"b","text":"Nothing measurable at legal speeds"},{"key":"c","text":"Reduce it slightly, because water cools the brakes"},{"key":"d","text":"They can roughly double it"}]'::jsonb,
   'd',
   'Wet pavement can double the distance the rig needs to stop. Combine that with a liquid load that punishes hard braking and the answer is always the same: slow down early and leave more space in the rain.',
   'CDL Manual §8.3', '2026-07-17', 1, '{tanker,driving,stopping-distance}', 24),

  (v_test,
   'Compared with the same rig loaded, how does an EMPTY tank vehicle stop?',
   '[{"key":"a","text":"Much shorter — less mass means less momentum"},{"key":"b","text":"Identically; brakes are sized for the loaded weight"},{"key":"c","text":"It may take LONGER to stop — with little weight on the tires, an empty tanker has less traction and skids easily"},{"key":"d","text":"Shorter, but only above 45 mph"}]'::jsonb,
   'c',
   'It surprises drivers every time: empty tank vehicles may take longer to stop than full ones. With little weight pressing the tires down there is less traction, and brakes engineered for a full load lock up easily on a light one — an empty tanker is easier to skid than a loaded one.',
   'CDL Manual §8.3', '2026-07-17', 2, '{tanker,driving,stopping-distance,empty}', 25),

  (v_test,
   'Traffic stops dead ahead and you must lose speed NOW in a loaded tanker. Which braking gets you stopped without losing control?',
   '[{"key":"a","text":"Full pedal, held to the floor until the rig stops"},{"key":"b","text":"The trailer hand valve, which straightens the combination"},{"key":"c","text":"Light, steady pressure so the surge never builds"},{"key":"d","text":"Controlled or stab braking — maximum braking without locking the wheels, steering all the way"}]'::jsonb,
   'd',
   'An emergency stop is still a managed stop: controlled braking (as hard as possible without locking the wheels) or stab braking (brake, release on lockup, reapply) puts down maximum brake while the tires keep rolling — and rolling tires are the only ones that still steer.',
   'CDL Manual §8.3', '2026-07-17', 2, '{tanker,driving,emergency-braking}', 26),

  (v_test,
   'Why does a partially filled tank — a split load or a dense product — deserve MORE room ahead than a full one?',
   '[{"key":"a","text":"Partial loads surge hardest, so smooth stops need the most distance exactly when the wave is biggest"},{"key":"b","text":"Partial loads put more weight on each axle, lengthening brake fade"},{"key":"c","text":"It does not; a full tank always needs the most room"},{"key":"d","text":"Partial loads raise the center of gravity above a full tank''s"}]'::jsonb,
   'a',
   'The less full the tank, the more room the wave has to build. Since your defense against surge is braking early and gently, the partially filled tank is the one that needs the biggest space cushion ahead — plan for the wave you are actually carrying.',
   'CDL Manual §8.3', '2026-07-17', 2, '{tanker,surge,space-management}', 27),

  (v_test,
   'Most tanker skids trace back to the driver. What causes them?',
   '[{"key":"a","text":"Worn baffles amplifying the surge"},{"key":"b","text":"Overinflated steer tires"},{"key":"c","text":"Over-braking, over-steering, or over-accelerating for the conditions"},{"key":"d","text":"Tank pressure changes altering the trailer''s weight"}]'::jsonb,
   'c',
   'Skids start when a driver asks the tires for more than the road can give: too much brake, too much steering angle, or too much throttle. In a top-heavy vehicle with a live load the margin is thinner — which is why tanker driving is throttle-and-brake discipline first.',
   'CDL Manual §8.3', '2026-07-17', 1, '{tanker,skids}', 28),

  (v_test,
   'The rig starts to skid. What is the one thing that actually ends it?',
   '[{"key":"a","text":"Full brake application to scrub speed before impact"},{"key":"b","text":"Restoring traction — get off the brake or throttle and let the tires grip again"},{"key":"c","text":"Accelerating out of it to straighten the trailer"},{"key":"d","text":"Countersteering hard and holding the wheel over until the slide stops"}]'::jsonb,
   'b',
   'A skid is tires that have stopped gripping. The cure is to stop demanding what broke the grip: release the brakes or back off the throttle, let the wheels roll free and recover traction, and steer where you want to go as the rig comes back under you.',
   'CDL Manual §8.3', '2026-07-17', 2, '{tanker,skids}', 29),

  (v_test,
   'Federal rules define the tank vehicle that requires an N endorsement by two capacity numbers. Which pair is correct?',
   '[{"key":"a","text":"Any single tank over 60 gallons, with no aggregate minimum"},{"key":"b","text":"Tanks over 119 gallons apiece adding up to 1,000 gallons or more on the vehicle"},{"key":"c","text":"A permanently mounted tank of 500 gallons or more, measured empty"},{"key":"d","text":"Any amount of liquid in bulk, as long as the vehicle is a Class A combination"}]'::jsonb,
   'b',
   'The 49 CFR 383.5 definition has two triggers that must BOTH be met: an individual rated capacity above 119 gallons per tank, and an aggregate rated capacity of 1,000 gallons or more — whether the tanks are permanently or temporarily attached to the vehicle or chassis.',
   '49 CFR 383.5', '2026-07-17', 2, '{tanker,endorsement,definitions}', 30),

  (v_test,
   'You are pulling a flatbed loaded with four 275-gallon liquid totes — 1,100 gallons in all. Do you need the tanker endorsement?',
   '[{"key":"a","text":"No — totes are portable packaging, not tanks"},{"key":"b","text":"No — the endorsement only applies to purpose-built tank trailers"},{"key":"c","text":"Yes — temporarily attached tanks count, and this load clears both capacity thresholds"},{"key":"d","text":"Only if the liquid inside is a hazardous material"}]'::jsonb,
   'c',
   'The definition covers tanks that are permanently OR temporarily attached to the vehicle or chassis. Four 275-gallon totes each exceed the 119-gallon individual threshold and together exceed the 1,000-gallon aggregate — so that flatbed is legally a tank vehicle.',
   '49 CFR 383.5', '2026-07-17', 3, '{tanker,endorsement,ibc}', 31),

  (v_test,
   'A driver whose license shows the X code is authorized to haul what?',
   '[{"key":"a","text":"Tank vehicles and hazardous materials — X combines the N and H endorsements"},{"key":"b","text":"Oversize loads that require a police escort"},{"key":"c","text":"Explosives only, under a special federal permit"},{"key":"d","text":"Double and triple trailers carrying liquid freight"}]'::jsonb,
   'a',
   'X is the combined endorsement: it stands for both tank vehicles and hazardous materials in one code. A driver hauling placarded product in a cargo tank needs both authorities, and X covers them together.',
   '49 CFR 383.93', '2026-07-17', 1, '{tanker,endorsement,x-endorsement}', 32);

  -- Keep the informational counter in step with the seeded bank.
  update public.tests
     set question_count = (select count(*) from public.questions where test_id = v_test)
   where id = v_test;
end $$;
