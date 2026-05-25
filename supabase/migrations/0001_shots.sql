-- Shot-based bulk image workflow schema for runninghub-app.
-- Standalone: tables are prefixed rh_ to avoid collision with the other app
-- sharing this database. Internal single-user tool: RLS disabled, server-side access only.

-- Clean up earlier unprefixed attempt (safe: they were empty).
drop table if exists images cascade;
drop table if exists shots cascade;
drop type if exists shot_status cascade;
drop type if exists image_role cascade;
drop type if exists model_slot cascade;

create type rh_shot_status as enum (
  'base_uploaded',
  'needs_mannequin',
  'needs_model_sources',
  'ready_to_generate',
  'generating',
  'ready_for_review',
  'completed'
);

create type rh_image_role as enum (
  'base',
  'mannequin',
  'model_source',
  'generated',
  'imported'
);

create type rh_model_slot as enum ('A', 'B');

create table rh_shots (
  id uuid primary key default gen_random_uuid(),
  number int not null,
  name text,
  mode text not null default 'generate',           -- 'generate' | 'import'
  status rh_shot_status not null default 'base_uploaded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rh_images (
  id uuid primary key default gen_random_uuid(),
  shot_id uuid not null references rh_shots(id) on delete cascade,
  role rh_image_role not null,
  slot rh_model_slot,                               -- model_source + generated: which model
  variation_index int,                              -- generated: 1..n
  source_image_id uuid references rh_images(id) on delete set null, -- generated -> its model_source
  r2_key text not null,
  url text not null,
  content_type text,
  task_id text,                                     -- RunningHub task id
  selected boolean not null default false,          -- multi-select save flag
  created_at timestamptz not null default now()
);

create index rh_images_shot_id_idx on rh_images (shot_id);
create index rh_images_shot_role_idx on rh_images (shot_id, role);

-- Internal tool, no end-user auth: keep RLS off so the server (anon key) has full access.
alter table rh_shots disable row level security;
alter table rh_images disable row level security;
