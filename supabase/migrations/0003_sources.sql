-- Reusable model-source library for runninghub-app.
-- These images live under R2 `library/sources/...` and are referenced by shots
-- (not copied). Shot/image deletes never remove library/ objects.

create table rh_sources (
  id uuid primary key default gen_random_uuid(),
  name text,
  r2_key text not null,
  url text not null,
  content_type text,
  created_at timestamptz not null default now()
);

alter table rh_sources disable row level security;
