-- ⚠️ NOT EXECUTED. Prepared for review only. Requires explicit authorization
-- before running — it writes is_indexable, which the autonomous publication run
-- was NOT authorized to change.
--
-- Optional structured-data rollout: set is_indexable = true for the 304
-- published TA/Petro rows.
--
-- What this actually changes (verified against the app, 2026-07-25):
--   * locations.is_indexable is a MANUAL OVERRIDE. Its only live consumer is the
--     ItemList JSON-LD on directory listing pages (src/lib/directory/seo.ts):
--     only entries with is_indexable=true are emitted as ItemList items.
--   * It does NOT drive detail-page robots meta, and it does NOT drive sitemap
--     inclusion. Both of those use the deterministic isDetailIndexable() gate
--     (src/lib/directory/detail.ts), which all 304 rows ALREADY pass (each has
--     address+city+state, a valid category, and >=3 substance signals). So the
--     304 detail pages are already index-eligible and already sitemap-eligible;
--     this rollout only adds them to the ItemList structured data.
--
-- Guarantees: scoped by the checkpoint's exact source label AND is_published=true
-- AND is_indexable=false; sets ONLY is_indexable; exact ROW_COUNT=304 guard with
-- auto-rollback on mismatch. Idempotent (a completed rollout matches 0 and aborts
-- on the guard). Never touches is_published, coordinates, or any other field.
--
-- Source label: official-ta-petro-20260725-5ebe0e9f (from ../sql/CHECKPOINT.md).

do $$
declare n integer;
begin
  update public.locations
     set is_indexable = true
   where source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and is_indexable = false
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 304 then
    raise exception 'INDEXABILITY ROLLOUT GUARD: expected 304, matched %. Rolled back.', n;
  end if;
  raise notice 'is_indexable set true on % TA/Petro rows.', n;
end $$;
