-- Single-row settings for runninghub-app generation defaults.
-- Seeded lazily from code defaults on first read (see lib/db.ts getSettings).

create table rh_settings (
  id int primary key default 1 check (id = 1),
  mannequin_prompt text,
  output_prompt text,
  default_aspect text not null default '4:5',
  default_resolution text not null default '2K',
  updated_at timestamptz not null default now()
);

alter table rh_settings disable row level security;
