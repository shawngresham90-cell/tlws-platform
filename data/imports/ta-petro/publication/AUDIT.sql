-- Read-only audit for the TA/Petro publication. Safe to run any time.
-- Target after full publication: batch 304, published 304, unpublished 0,
-- indexable 0, live 1556, pre-existing 1252, 0 dup keys, 0 missing coords.

select
  (select count(*) from public.locations) as live_total,
  (select count(*) from public.locations where source='official-ta-petro-20260725-5ebe0e9f') as batch_total,
  (select count(*) from public.locations where source='official-ta-petro-20260725-5ebe0e9f' and is_published) as batch_published,
  (select count(*) from public.locations where source='official-ta-petro-20260725-5ebe0e9f' and not is_published) as batch_unpublished,
  (select count(*) from public.locations where source='official-ta-petro-20260725-5ebe0e9f' and is_indexable) as batch_indexable,
  (select count(*) from public.locations where source is distinct from 'official-ta-petro-20260725-5ebe0e9f') as preexisting_rows,
  (select count(*) from public.locations where source='official-ta-petro-20260725-5ebe0e9f' and (lat is null or lng is null)) as batch_missing_coords,
  (select count(*) from public.locations where source='official-ta-petro-20260725-5ebe0e9f' and geo is not null) as batch_geo,
  (select count(*) from public.locations where source='official-ta-petro-20260725-5ebe0e9f' and (is_featured)) as batch_featured,
  (select count(*) from public.locations where is_published and source='official-ta-petro-20260725-5ebe0e9f'
     and name ~* '(love|sapp|pilot|flying\s*j|goasis|thornton)') as excluded_network_published,
  (select count(*) from (select detail_slug from public.locations where deleted_at is null
     group by detail_slug having count(*)>1) d) as dup_detail_slug,
  (select count(*) from (select type,state,city,slug from public.locations where deleted_at is null
     group by 1,2,3,4 having count(*)>1) k) as dup_unique_key;

-- Per-state reconciliation:
select upper(state) st, count(*) total,
       count(*) filter (where is_published) published,
       count(*) filter (where not is_published) unpublished
from public.locations where source='official-ta-petro-20260725-5ebe0e9f' group by 1 order by 1;
