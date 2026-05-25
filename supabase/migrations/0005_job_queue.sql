-- Add a 'pending' state and a payload so jobs can be queued locally and only
-- submitted to RunningHub as concurrency frees up (avoids TASK_QUEUE_MAXED).

alter type rh_job_status add value if not exists 'pending';
alter table rh_jobs add column if not exists payload jsonb;
