-- 016: additional application fields captured by the /academy/apply form
-- (Milestone 8). Purely additive — extends the Milestone 2 applications table,
-- no rebuild. Existing rows get NULLs for the new columns.
alter table public.applications
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists age_confirmed boolean;

comment on column public.applications.city is 'Applicant city (step 1)';
comment on column public.applications.state is 'Applicant state, 2-letter code (step 1)';
comment on column public.applications.age_confirmed is 'Applicant confirmed minimum age (step 2)';
