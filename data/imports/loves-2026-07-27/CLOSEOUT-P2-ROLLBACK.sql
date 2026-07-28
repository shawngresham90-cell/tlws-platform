-- Phase 2 rollback — VALUE-MATCHED, per record. Prepared BEFORE any write.
-- Each pair unpublishes then deletes ONLY a row still carrying the exact
-- staged identity/coordinates/values with this run's source tag.

begin;

-- #340
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-340-las-vegas-nv' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #340' and lat = 36.381561 and lng = -114.896529 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-340-las-vegas-nv' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #340' and lat = 36.381561 and lng = -114.896529
   and not is_published and not is_featured;

-- #607
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-607-jonesboro-ar' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #607' and lat = 35.803403 and lng = -90.635167 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-607-jonesboro-ar' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #607' and lat = 35.803403 and lng = -90.635167
   and not is_published and not is_featured;

-- #577
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-577-shorter-al' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #577' and lat = 32.404387 and lng = -85.956505 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-577-shorter-al' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #577' and lat = 32.404387 and lng = -85.956505
   and not is_published and not is_featured;

-- #305
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-305-toms-brook-va' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #305' and lat = 38.96563 and lng = -78.439457 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-305-toms-brook-va' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #305' and lat = 38.96563 and lng = -78.439457
   and not is_published and not is_featured;

-- #249
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-249-williamsville-il' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #249' and lat = 39.960959 and lng = -89.562296 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-249-williamsville-il' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #249' and lat = 39.960959 and lng = -89.562296
   and not is_published and not is_featured;

-- #314
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-314-christiana-tn' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #314' and lat = 35.724209 and lng = -86.319661 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-314-christiana-tn' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #314' and lat = 35.724209 and lng = -86.319661
   and not is_published and not is_featured;

-- #328
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-328-chandler-az' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #328' and lat = 33.279875 and lng = -111.962298 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-328-chandler-az' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #328' and lat = 33.279875 and lng = -111.962298
   and not is_published and not is_featured;

-- #375
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-375-hearne-tx' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #375' and lat = 30.895404 and lng = -96.60271 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-375-hearne-tx' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #375' and lat = 30.895404 and lng = -96.60271
   and not is_published and not is_featured;

-- #388
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-388-batesville-ms' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #388' and lat = 34.35134 and lng = -89.91601 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-388-batesville-ms' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #388' and lat = 34.35134 and lng = -89.91601
   and not is_published and not is_featured;

-- #669
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-669-new-london-mo' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #669' and lat = 39.573995 and lng = -91.402271 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-669-new-london-mo' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #669' and lat = 39.573995 and lng = -91.402271
   and not is_published and not is_featured;

-- #677
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-677-west-point-ms' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #677' and lat = 33.584476 and lng = -88.658088 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-677-west-point-ms' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #677' and lat = 33.584476 and lng = -88.658088
   and not is_published and not is_featured;

-- #738
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-738-sulphur-springs-tx' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #738' and lat = 33.117433 and lng = -95.636795 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-738-sulphur-springs-tx' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #738' and lat = 33.117433 and lng = -95.636795
   and not is_published and not is_featured;

-- #739
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-739-donna-tx' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #739' and lat = 26.182717 and lng = -98.06724 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-739-donna-tx' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #739' and lat = 26.182717 and lng = -98.06724
   and not is_published and not is_featured;

-- #23
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-23-lamar-co' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #23' and lat = 38.095707 and lng = -102.62027 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-23-lamar-co' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #23' and lat = 38.095707 and lng = -102.62027
   and not is_published and not is_featured;

-- #778
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-778-ellabell-ga' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #778' and lat = 32.183641 and lng = -81.458046 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-778-ellabell-ga' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #778' and lat = 32.183641 and lng = -81.458046
   and not is_published and not is_featured;

-- #476
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-476-davenport-ia' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #476' and lat = 41.604403 and lng = -90.623937 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-476-davenport-ia' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #476' and lat = 41.604403 and lng = -90.623937
   and not is_published and not is_featured;

-- #414
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-414-haubstadt-in' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #414' and lat = 38.17337 and lng = -87.55159 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-414-haubstadt-in' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #414' and lat = 38.17337 and lng = -87.55159
   and not is_published and not is_featured;

-- #393
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-393-mccomb-ms' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #393' and lat = 31.190892 and lng = -90.485619 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-393-mccomb-ms' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #393' and lat = 31.190892 and lng = -90.485619
   and not is_published and not is_featured;

-- #690
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-690-circleville-oh' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #690' and lat = 39.556927 and lng = -82.95828 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-690-circleville-oh' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #690' and lat = 39.556927 and lng = -82.95828
   and not is_published and not is_featured;

-- #823
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-823-klamath-falls-or' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #823' and lat = 42.258046 and lng = -121.799445 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-823-klamath-falls-or' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #823' and lat = 42.258046 and lng = -121.799445
   and not is_published and not is_featured;

-- #539
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'love-s-travel-stop-539-andrews-tx' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #539' and lat = 32.306081 and lng = -102.541849 and is_published;
delete from public.locations
 where detail_slug = 'love-s-travel-stop-539-andrews-tx' and source = 'loves-master-2026-07-27'
   and name = 'Love''s Travel Stop #539' and lat = 32.306081 and lng = -102.541849
   and not is_published and not is_featured;

commit;
