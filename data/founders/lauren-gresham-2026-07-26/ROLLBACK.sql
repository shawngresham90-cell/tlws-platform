-- Undo the Lauren Gresham addition, returning the wall to exactly its prior
-- state: 26 founders, $9,055 raised, $2,495 remaining.
--
-- Guarded the same way as the forward statement — if the wall is not in the
-- state this expects, nothing changes.

begin;

do $$
declare
  n integer;
begin
  select count(*) into n
    from public.founders
   where display_name = 'Lauren Gresham' and tier = 'steel' and position = 9;
  if n <> 1 then
    raise exception 'Rollback precondition failed: expected exactly 1 Lauren Gresham steel #9 row, found %.', n;
  end if;

  delete from public.founders
   where display_name = 'Lauren Gresham' and tier = 'steel' and position = 9;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Expected to delete exactly 1 row, deleted %.', n;
  end if;

  update public.campaign_settings set raised_cents_override = 905500;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Expected to update exactly 1 settings row, updated %.', n;
  end if;

  select count(*) into n from public.founders;
  if n <> 26 then
    raise exception 'Post-rollback check failed: expected 26 founders, found %.', n;
  end if;
end $$;

commit;
