-- A transient 'finalizing' state lets one reconcile/webhook pass atomically claim
-- a finished job (running -> finalizing) before downloading + inserting its image,
-- so concurrent passes can't both finalize and create duplicate images.

alter type rh_job_status add value if not exists 'finalizing';
