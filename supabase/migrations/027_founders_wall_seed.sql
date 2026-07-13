-- 027: Founders Wall seed — authoritative founder roster.
--
-- DATA SEED. Committed but NOT applied to production; apply only after explicit
-- approval. Requires migration 026 (nullable amount_cents + founders.position).
--
-- Source of truth: founder screenshots provided by the site owner (2026-07-13).
-- NOT scraped from the legacy website (egress-blocked). No names guessed, no
-- amounts invented — amount_cents is intentionally left NULL (aggregate model;
-- the public "raised" total lives in campaign_settings, see migration 026).
--
-- Roster: 25 founder SPOTS sold — Iron 2, Steel 7, Brick 16.
--   Unique founder names: 24 (informational only).
--   "Jose Cotto" holds TWO spots on purpose — one Steel (pos 2) and one Brick
--   (pos 8) — purchased as two separate founder spots. This is NOT a duplicate
--   error: keep both records, display both, merge neither, remove neither.
--   Counted as 1 Steel spot + 1 Brick spot (2 spots, 1 unique person). Tier
--   availability and wall occupancy use SPOTS SOLD; unique names is separate.
--
-- Idempotency: the whole roster inserts only when the founders table is empty,
-- so re-application cannot create extra rows.

insert into public.founders (display_name, tier, position, is_public)
select v.display_name, v.tier, v.position, true
from (
  values
    -- IRON
    ('David Gresham',        'iron',  1),
    ('Thomas Fields',        'iron',  2),
    -- STEEL
    ('Gary Ford',            'steel', 1),
    ('Jose Cotto',           'steel', 2),  -- intentional 2nd spot holder (also Brick #8); keep both
    ('Greg Walker',          'steel', 3),
    ('Mario Capston',        'steel', 4),
    ('Jon Blankenship',      'steel', 5),
    ('Ricky M. Rosenbalm',   'steel', 6),
    ('Idle Demon',           'steel', 7),
    -- BRICK
    ('Sam Tusk',             'brick', 1),
    ('Chris Nalley',         'brick', 2),
    ('Terry Hostetler',      'brick', 3),
    ('Billy Joe Poole',      'brick', 4),
    ('J.A. Gresham',         'brick', 5),
    ('R.A. Harper',          'brick', 6),
    ('Steve Snyder',         'brick', 7),
    ('Jose Cotto',           'brick', 8),  -- intentional 2nd spot holder (also Steel #2); keep both
    ('Sean Conway',          'brick', 9),
    ('David Chasteen',       'brick', 10),
    ('Clint E. Ingram',      'brick', 11),
    ('Bryce Jennex',         'brick', 12),
    ('Will Bethstern',       'brick', 13),
    ('Shell Faroods',        'brick', 14),
    ('Phil Tuts',            'brick', 15),
    ('Joe Wise',             'brick', 16)
) as v(display_name, tier, position)
where not exists (select 1 from public.founders);
