-- 014: Lock admin auth objects at the GRANT layer (defense in depth).
-- Postgres grants EXECUTE on functions to PUBLIC by default; revoking from anon
-- alone leaves PUBLIC. Revoke from PUBLIC, then grant only to authenticated.
-- Same for admin_users table grants — anon gets nothing.

revoke execute on function public.is_admin() from public;
revoke execute on function public.admin_role() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_role() to authenticated;

-- admin_users: strip all anon grants. RLS already blocks rows, this removes the grant too.
revoke all on public.admin_users from anon;
