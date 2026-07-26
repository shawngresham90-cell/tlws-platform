-- Proof that an UNPUBLISHED founder is invisible to the anonymous role.
--
-- All 27 founders currently on the wall are published, so there is no existing
-- unpublished row to test against — and fabricating one is not acceptable: the
-- brief for this change is explicit that no founder row may be modified.
--
-- So this probe inserts a throwaway unpublished row, checks it from the anon
-- role, and then ROLLS THE WHOLE TRANSACTION BACK. Nothing is ever committed:
-- no row is added, changed or deleted, and the founder digest afterwards is
-- identical to the digest before. The final SELECT in this file re-proves that.
--
-- Read the output, not the exit status: the rollback at the end is intended.

begin;

-- A row that is deliberately NOT public, carrying values in exactly the
-- columns a public caller must never reach.
insert into public.founders
  (display_name, tier, "position", is_public, status, amount_cents,
   payment_provider, payment_ref)
-- (`status` must be one of submitted/paid/approved/hidden — see
--  founders_status_check — so the probe uses 'submitted'.)
values
  ('ZZ Rollback Probe — never committed', 'brick', 999, false, 'submitted', 123456,
   'stripe', 'probe-ref-do-not-use');

-- As postgres: 28 rows exist inside this transaction.
select count(*) as rows_inside_txn,
       count(*) filter (where is_public) as published,
       count(*) filter (where not is_public) as unpublished
from public.founders;

set local role anon;

-- (1) The unpublished row must be invisible by name.
--     Expected: 0.
select count(*) as anon_can_see_the_probe
from public.founders
where display_name = 'ZZ Rollback Probe — never committed';

-- (2) It must be invisible even when asking for unpublished rows directly.
--     Expected: 0.
select count(*) as anon_can_see_any_unpublished
from public.founders
where is_public = false;

-- (3) anon's total is still just the 27 published founders, not 28.
--     Expected: 27.
select count(*) as anon_total_visible from public.founders;

-- (4) And the probe's payment columns are unreachable regardless of RLS,
--     because the column grant is gone. Expected: denied.
do $$
begin
  begin
    execute 'select amount_cents, payment_ref from public.founders limit 1';
    raise exception 'PROBE FAILED: anon read restricted payment columns.';
  exception when insufficient_privilege then
    raise notice 'Denied as expected: anon cannot read amount_cents / payment_ref.';
  end;
end $$;

reset role;

-- Discard everything above. The probe row never existed.
rollback;

-- ---------------------------------------------------------------------------
-- Post-probe: prove nothing was committed. Expected: 27 founders, and the
-- digest ab4b8597a81da1675e4b0daa3e0763d3 recorded before the probe.
select count(*) as total_founders,
       count(*) filter (where not is_public) as unpublished_rows,
       md5(string_agg(md5(to_jsonb(f)::text), '' order by f.id)) as all_27_digest
from public.founders f;
