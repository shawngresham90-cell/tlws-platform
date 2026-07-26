-- Publication of enriched parking rows — GUARDED TEMPLATE, ONE STATE PER RUN.
--
-- NOT EXECUTABLE AS COMMITTED. `:state` and the id list must be filled in, and
-- ENRICH-TEMPLATE.sql must have run successfully for those ids first.
--
-- Publication only. Flips is_published false -> true on rows matched by exact
-- id. It inserts nothing, writes no coordinate, and never touches is_featured
-- or is_indexable.
--
-- The load-bearing guard is COORDINATES-REQUIRED: a row with no lat/lng cannot
-- be published, because an unmappable parking page is the exact failure this
-- whole milestone exists to fix.
--
-- Run one state per transaction. A bad state fails alone.

begin;

create temporary table _publish (id uuid primary key) on commit drop;

insert into _publish (id) values
  -- ('00000000-0000-0000-0000-000000000000'),
  ;

do $$
declare
  n integer;
  batch integer;
  target_state char(2) := 'XX';   -- <-- set the state
begin
  select count(*) into batch from _publish;
  if batch = 0 then
    raise exception 'Nothing to publish: _publish is empty.';
  end if;

  -- 1. Every id resolves to a live row in the target state.
  select count(*) into n
    from _publish p join public.locations l on l.id = p.id
   where l.deleted_at is null and l.state = target_state;
  if n <> batch then
    raise exception 'Precondition failed: % of % ids are missing, deleted, or not in %.', batch - n, batch, target_state;
  end if;

  -- 2. COORDINATES REQUIRED. No coordinate, no publication.
  select count(*) into n
    from _publish p join public.locations l on l.id = p.id
   where l.lat is null or l.lng is null or l.lat = 0 or l.lng = 0;
  if n <> 0 then
    raise exception 'Precondition failed: % row(s) have no usable coordinate. Publication requires one.', n;
  end if;

  -- 3. Provenance must be present — a coordinate with no recorded source is
  --    not evidence.
  select count(*) into n
    from _publish p join public.locations l on l.id = p.id
   where l.geocode_source is null or l.geocode_confidence <> 'high';
  if n <> 0 then
    raise exception 'Precondition failed: % row(s) lack high-confidence geocode provenance.', n;
  end if;

  -- 4. Category must be one the application renders.
  select count(*) into n
    from _publish p join public.locations l on l.id = p.id
   where l.category_slug is null
      or l.category_slug not in ('parking','truck-stops','weigh-stations','cat-scales',
                                 'tire-repair','truck-washes','hotels-truck-parking',
                                 'cdl-schools','roadside-service');
  if n <> 0 then
    raise exception 'Precondition failed: % row(s) have no renderable category.', n;
  end if;

  -- 5. No held/excluded network, including as a landmark in the name.
  select count(*) into n
    from _publish p join public.locations l on l.id = p.id
   where l.name ~* '(love''?s|pilot|flying\s*j|sapp\s*bros|goasis|thornton)';
  if n <> 0 then
    raise exception 'Precondition failed: % row(s) name a held network.', n;
  end if;

  -- 6. Nothing already published (idempotency: re-running must be a no-op,
  --    not a double count).
  select count(*) into n
    from _publish p join public.locations l on l.id = p.id
   where l.is_published;
  if n <> 0 then
    raise exception 'Precondition failed: % row(s) are already published.', n;
  end if;

  -- 7. Duplicate recheck INSIDE the transaction, against live data — the set
  --    may have changed since the manifest was written.
  select count(*) into n from (
    select l.detail_slug
      from _publish p join public.locations l on l.id = p.id
     group by l.detail_slug having count(*) > 1
  ) d;
  if n <> 0 then
    raise exception 'Precondition failed: % duplicate detail_slug(s) inside the batch.', n;
  end if;

  select count(*) into n
    from _publish p
    join public.locations l on l.id = p.id
    join public.locations other
      on other.detail_slug = l.detail_slug
     and other.id <> l.id
     and other.deleted_at is null
     and other.is_published;
  if n <> 0 then
    raise exception 'Precondition failed: % row(s) collide with an already-published detail_slug.', n;
  end if;

  -- 8. Coordinate-proximity collision against the published set. Two rows
  --    within ~150 m are either a duplicate or a colocation that must be
  --    reviewed by hand before publishing.
  select count(*) into n
    from _publish p
    join public.locations l on l.id = p.id
    join public.locations other
      on other.id <> l.id
     and other.deleted_at is null
     and other.is_published
     and other.lat is not null
     and abs(other.lat - l.lat) < 0.0015
     and abs(other.lng - l.lng) < 0.0015;
  if n <> 0 then
    raise exception 'Precondition failed: % row(s) sit within ~150 m of a published location. Review before publishing.', n;
  end if;

  -- 9. Publish. is_featured and is_indexable are deliberately absent.
  update public.locations
     set is_published = true,
         updated_at   = now()
   where id in (select id from _publish)
     and lat is not null and lng is not null;   -- coordinates-required, enforced at write time
  get diagnostics n = row_count;
  if n <> batch then
    raise exception 'Expected to publish exactly % row(s), published %.', batch, n;
  end if;

  -- 10. Post-checks: published, still unfeatured, indexability untouched.
  select count(*) into n
    from _publish p join public.locations l on l.id = p.id
   where not l.is_published;
  if n <> 0 then
    raise exception 'Post-check failed: % row(s) did not publish.', n;
  end if;

  select count(*) into n
    from _publish p join public.locations l on l.id = p.id
   where l.is_featured;
  if n <> 0 then
    raise exception 'Post-check failed: % row(s) became featured. Publication must never feature.', n;
  end if;
end $$;

commit;
