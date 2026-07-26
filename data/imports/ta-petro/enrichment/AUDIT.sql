-- Read-only enrichment audit.
select
  (select count(*) from public.locations) as live_total,
  (select count(*) from public.locations where source='official-ta-petro-20260725-5ebe0e9f') as batch,
  (select count(*) from public.locations where source='official-ta-petro-20260725-5ebe0e9f' and is_published) as published,
  (select count(*) from public.locations where source='official-ta-petro-20260725-5ebe0e9f' and is_indexable) as indexable,
  (select count(*) from public.locations where source='official-ta-petro-20260725-5ebe0e9f' and interstate is not null and btrim(interstate)<>'') as has_interstate,
  (select count(*) from public.locations where source='official-ta-petro-20260725-5ebe0e9f' and exit_number is not null and btrim(exit_number)<>'') as has_exit,
  (select count(*) from public.locations where source='official-ta-petro-20260725-5ebe0e9f' and interstate is not null and interstate !~ '^I-[0-9]+$') as bad_interstate_fmt,
  (select count(*) from public.locations where source='official-ta-petro-20260725-5ebe0e9f' and exit_number is not null and exit_number !~ '^[0-9]+[A-Z]?$') as bad_exit_fmt;

-- corridor coverage unlocked (published batch rows by interstate):
select interstate, count(*) from public.locations
where source='official-ta-petro-20260725-5ebe0e9f' and is_published and interstate is not null and btrim(interstate)<>''
group by 1 order by 2 desc;
