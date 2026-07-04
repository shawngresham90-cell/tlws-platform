-- 013: Admin role structure for /admin access.
-- Roles live in a dedicated table keyed to auth.users — NOT in user-editable metadata.
-- owner  > admin > staff. Only owner can grant/revoke roles.

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner','admin','staff')),
  full_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.admin_users
  for each row execute function public.tlws_set_updated_at();

alter table public.admin_users enable row level security;

-- Helper: is the current auth user an active admin (any role)?
-- SECURITY DEFINER so it can read admin_users under RLS; STABLE; search_path pinned.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.is_active = true
  );
$$;

-- Helper: current user's role, or null if not an admin.
create or replace function public.admin_role()
returns text
language sql stable security definer set search_path = ''
as $$
  select a.role from public.admin_users a
  where a.user_id = auth.uid() and a.is_active = true;
$$;

-- RLS: an admin can read their OWN row (needed for the app to check role client-side).
create policy admin_read_self on public.admin_users
  for select to authenticated using (user_id = auth.uid());

-- Owners can read every admin row (for the future user-management screen).
create policy owner_read_all on public.admin_users
  for select to authenticated using (public.admin_role() = 'owner');

-- Only owners can insert/update/delete admin rows. No anon access at all.
create policy owner_write on public.admin_users
  for all to authenticated
  using (public.admin_role() = 'owner')
  with check (public.admin_role() = 'owner');

-- Lock function execution to signed-in users only (not anon).
revoke execute on function public.is_admin() from anon;
revoke execute on function public.admin_role() from anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_role() to authenticated;
