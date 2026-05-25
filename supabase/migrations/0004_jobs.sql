-- Durable generation jobs queue. Each job is one RunningHub task whose result
-- is finalized later by a webhook (production) or a reconcile poll (fallback/local).

create type rh_job_kind as enum ('mannequin', 'output');
create type rh_job_status as enum ('running', 'done', 'error');

create table rh_jobs (
  id uuid primary key default gen_random_uuid(),
  shot_id uuid not null references rh_shots(id) on delete cascade,
  kind rh_job_kind not null,
  slot rh_model_slot,                              -- output jobs
  variation_index int,                             -- output jobs
  source_image_id uuid references rh_images(id) on delete set null,
  task_id text,                                    -- RunningHub task id
  status rh_job_status not null default 'running',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rh_jobs_shot_idx on rh_jobs (shot_id);
create index rh_jobs_status_idx on rh_jobs (status);
create index rh_jobs_task_idx on rh_jobs (task_id);

alter table rh_jobs disable row level security;
