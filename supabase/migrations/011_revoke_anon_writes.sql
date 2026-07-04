-- 011: Defense in depth — revoke Supabase's DEFAULT anon/authenticated write grants.
-- RLS already blocks writes (no INSERT/UPDATE/DELETE policies exist), but leaving the
-- raw table grants in place is belt-without-suspenders. After this, anon has NO write
-- permission at the grant layer AND is blocked by RLS. All writes go through the
-- service role (Edge Functions / server routes), which bypasses both.

do $$
declare t text;
begin
  foreach t in array array[
    'locations','location_reviews','applications','application_events',
    'founders','sponsors','sponsor_touches','tests','questions','test_attempts',
    'leads','lead_magnets','lead_magnet_claims','content_pages'
  ]
  loop
    execute format('revoke insert, update, delete on public.%I from anon, authenticated;', t);
  end loop;
end $$;
