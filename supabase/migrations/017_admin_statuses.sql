-- 017: Admin dashboard status vocabularies (Milestone 10)
-- Additive + non-destructive. Extends applications.status and adds a `status`
-- column to founders and sponsors so the admin dashboard can manage lifecycle.
-- Nothing here changes public-facing behavior: /founders still keys off
-- is_public, and the public write routes keep inserting with their defaults.

-- Applications: extend the allowed status set with the admin vocabulary
-- (approved / denied) while keeping every existing CRM value valid.
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications
  add constraint applications_status_check
  check (status in (
    'new', 'contacted', 'qualified', 'enrolled', 'declined', 'no_response', 'approved', 'denied'
  ));

-- Founders: admin lifecycle status for Founders Wall entries. Independent of
-- is_public (which still controls whether a founder shows on the public wall).
alter table public.founders
  add column if not exists status text not null default 'submitted'
  check (status in ('submitted', 'paid', 'approved', 'hidden'));
create index if not exists founders_status on public.founders (status, created_at desc);

-- Sponsors: simple admin status alongside the existing CRM `stage`.
alter table public.sponsors
  add column if not exists status text not null default 'new'
  check (status in ('new', 'contacted', 'paid', 'active'));
create index if not exists sponsors_status on public.sponsors (status, created_at desc);
