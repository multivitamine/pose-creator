// Server-only: finalize generation jobs (download RunningHub result -> R2 -> DB)
// and reconcile running jobs by polling. Shared by the webhook + reconcile routes.
import { fetchTaskOutput, createTask, accountStatus } from './runninghub';
import { shotImageKey, uploadBuffer, extFromContentType } from './r2';
import {
  clearRole,
  insertImage,
  updateJob,
  markJobRunning,
  claimJobForFinalize,
  recomputeStatus,
  listRunningJobsForShot,
  listPendingJobs,
  listShotIdsWithActiveJobs,
  type Job,
} from './db';

// Max tasks RunningHub may run concurrently for the account (tier-limited).
const MAX_CONCURRENT = Math.max(1, Number(process.env.RUNNINGHUB_MAX_CONCURRENT || 1));

// Submit queued (pending) jobs to RunningHub up to the concurrency limit. Gated by
// the account's live running count and resilient to TASK_QUEUE_MAXED. Called after
// enqueue and whenever a job finishes, so the queue drains on its own.
export async function dispatchPending(): Promise<void> {
  let current = 0;
  try {
    const st = await accountStatus();
    current = Number(st.currentTaskCounts) || 0;
  } catch {
    // If we can't read status, fall back to optimistically filling the limit.
  }
  let free = MAX_CONCURRENT - current;
  if (free <= 0) return;

  const pending = await listPendingJobs(free);
  const webhookUrl = webhookUrlForTasks();
  for (const job of pending) {
    if (free <= 0) break;
    if (!job.payload) {
      await updateJob(job.id, { status: 'error', error: 'missing payload' });
      continue;
    }
    try {
      const taskId = await createTask(job.payload.workflowId, job.payload.nodeInfoList, webhookUrl);
      await markJobRunning(job.id, taskId);
      free--;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/TASK_QUEUE_MAXED/i.test(msg)) break; // account full — leave pending for the next pass
      await updateJob(job.id, { status: 'error', error: msg });
    }
  }
}

// Public webhook URL RunningHub should call back, or undefined for local dev
// (no public URL) so we rely on the reconcile poll instead.
export function webhookUrlForTasks(): string | undefined {
  const base = (process.env.APP_URL || '').replace(/\/+$/, '');
  const secret = process.env.WEBHOOK_SECRET || '';
  if (!base || base.includes('localhost') || base.includes('127.0.0.1') || !secret) return undefined;
  return `${base}/api/webhooks/runninghub?token=${encodeURIComponent(secret)}`;
}

// Download the finished result and persist it as the job's image, then close the job.
// Returns true if this caller finalized the job, false if another concurrent pass
// (poll or webhook) already claimed it — in which case we do nothing, so the result
// is never inserted twice. On its own failure it marks the job 'error' and rethrows.
export async function finalizeJob(job: Job, fileUrl: string): Promise<boolean> {
  // Claim the job first; lose the race -> bail before downloading or inserting.
  if (!(await claimJobForFinalize(job.id))) return false;

  try {
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`fetch result ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/png';
    const ext = extFromContentType(contentType);

    if (job.kind === 'mannequin') {
      await clearRole(job.shot_id, 'mannequin'); // regeneration replaces the old one
      const key = shotImageKey(job.shot_id, 'mannequin', ext);
      const { url } = await uploadBuffer(key, buffer, contentType);
      await insertImage({ shot_id: job.shot_id, role: 'mannequin', r2_key: key, url, content_type: contentType, task_id: job.task_id });
    } else {
      const key = shotImageKey(job.shot_id, 'generated', ext);
      const { url } = await uploadBuffer(key, buffer, contentType);
      await insertImage({
        shot_id: job.shot_id,
        role: 'generated',
        slot: job.slot,
        variation_index: job.variation_index,
        source_image_id: job.source_image_id,
        r2_key: key,
        url,
        content_type: contentType,
        task_id: job.task_id,
      });
    }

    await updateJob(job.id, { status: 'done', error: null });
  } catch (e) {
    // Don't leave the job stuck in 'finalizing' if the download/upload fails.
    await updateJob(job.id, { status: 'error', error: e instanceof Error ? e.message : String(e) });
    throw e;
  }

  await recomputeStatus(job.shot_id);
  await dispatchPending(); // a slot just freed — submit the next queued job
  return true;
}

// Poll each running job once; finalize the done ones, flag failures.
export async function reconcileShot(shotId: string): Promise<{ finalized: number; failed: number; running: number }> {
  const jobs = await listRunningJobsForShot(shotId);
  let finalized = 0;
  let failed = 0;
  let running = 0;
  for (const job of jobs) {
    if (!job.task_id) continue;
    let outcome;
    try {
      outcome = await fetchTaskOutput(job.task_id);
    } catch {
      running++; // transient error; leave the job running for the next pass
      continue;
    }
    if (outcome.state === 'done') {
      try {
        if (await finalizeJob(job, outcome.fileUrl)) finalized++;
        // false => another pass already claimed it; nothing to count.
      } catch {
        failed++; // finalizeJob already marked the job 'error'
      }
    } else if (outcome.state === 'error') {
      await updateJob(job.id, { status: 'error', error: outcome.message });
      failed++;
    } else {
      running++;
    }
  }
  await dispatchPending(); // submit queued jobs into any freed slots
  await recomputeStatus(shotId);
  return { finalized, failed, running };
}

// Reconcile every shot that still has active jobs (used by the overview so
// "generating" statuses resolve without opening each shot).
export async function reconcileAll(): Promise<{ running: number; shots: number }> {
  const ids = await listShotIdsWithActiveJobs();
  let running = 0;
  for (const id of ids) {
    const r = await reconcileShot(id);
    running += r.running;
  }
  return { running, shots: ids.length };
}
