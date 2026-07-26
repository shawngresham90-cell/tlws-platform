-- Founders Wall: add Lauren Gresham (Steel Founder, $500).
--
-- NOT YET RUN. This is a prepared, guarded statement awaiting Shawn's go-ahead.
--
-- The Founders Wall is entirely database-backed: /founders reads the `founders`
-- table and the `campaign_progress` view. No figure on the wall exists in the
-- codebase, so no pull request can change it — only this statement can.
--
-- Everything is one transaction. Every step asserts the row count it expects
-- and raises on anything else, so a surprise rolls the whole thing back rather
-- than leaving the wall half-updated.
--
-- Preconditions asserted (measured 2026-07-26, read-only):
--   founders                             26 rows, all is_public
--   no display_name matching 'lauren'    0 rows
--   steel tier                           positions 1..8 filled → Lauren takes 9
--   campaign_settings.goal_cents         1155000  ($11,550)
--   campaign_settings.raised_cents_override 905500 ($9,055)
--
-- After:
--   founders                             27 rows
--   raised_cents_override                955500  ($9,555)
--   remaining (derived, goal − raised)   199500  ($1,995)
--   $9,555 + $1,995 = $11,550  ✓
--
-- amount_cents is stored (admin-only, matching how RUSH's $500 Steel spot is
-- stored) and is NEVER selected by the public reader, so Lauren's individual
-- contribution is not displayed. That matches every other founder on the wall.

begin;

do $$
declare
  n integer;
  existing_goal integer;
  existing_raised integer;
begin
  -- 1. Lauren must not already be on the wall.
  select count(*) into n from public.founders where lower(display_name) like '%lauren%';
  if n <> 0 then
    raise exception 'Precondition failed: % row(s) already match "lauren". Nothing changed.', n;
  end if;

  -- 2. The wall must be in the state this statement was written against.
  select count(*) into n from public.founders;
  if n <> 26 then
    raise exception 'Precondition failed: expected 26 founders, found %. Re-verify before running.', n;
  end if;

  -- 3. Steel position 9 must be free.
  select count(*) into n from public.founders where tier = 'steel' and position = 9;
  if n <> 0 then
    raise exception 'Precondition failed: steel position 9 is already taken. Nothing changed.';
  end if;

  -- 4. The campaign totals must be the ones we are moving from.
  select goal_cents, raised_cents_override
    into existing_goal, existing_raised
    from public.campaign_settings;
  if existing_goal <> 1155000 then
    raise exception 'Precondition failed: goal is % cents, expected 1155000.', existing_goal;
  end if;
  if existing_raised is distinct from 905500 then
    raise exception 'Precondition failed: raised override is %, expected 905500.', existing_raised;
  end if;

  -- 5. Add exactly one founder, at the end of the Steel tier so the existing
  --    recognition order is untouched.
  insert into public.founders (display_name, tier, position, is_public, status, amount_cents)
  values ('Lauren Gresham', 'steel', 9, true, 'approved', 50000);
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Expected to insert exactly 1 founder, inserted %.', n;
  end if;

  -- 6. Move the aggregate total. This single value is the public "raised"
  --    figure; remaining and percentage are derived from it and the goal.
  update public.campaign_settings set raised_cents_override = 955500;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Expected to update exactly 1 settings row, updated %.', n;
  end if;

  -- 7. The arithmetic must reconcile before this commits.
  select count(*) into n from public.founders where is_public;
  if n <> 27 then
    raise exception 'Post-check failed: expected 27 public founders, found %.', n;
  end if;

  perform 1
    from public.campaign_settings
   where goal_cents = 1155000
     and raised_cents_override = 955500
     and goal_cents - raised_cents_override = 199500;
  if not found then
    raise exception 'Post-check failed: $9,555 + $1,995 = $11,550 does not reconcile.';
  end if;
end $$;

commit;
