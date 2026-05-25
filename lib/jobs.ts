// Server-only: finalize generation jobs (download RunningHub result -> R2 -> DB)
// and reconcile running jobs by polling. Shared by the webhook + reconcile routes.
import { fetchTaskOutput } from './runninghub';
import { shotImageKey, uploadBuffer, extFromContentType } from './r2';
import {
  clearRole,
  insertImage,
  updateJob,
  recomputeStatus,
  listRunningJobsForShot,
  type Job,
} from './db';

// Public webhook URL RunningHub should call back, or undefined for local dev
// (no public URL) so we rely on the reconcile poll instead.
export function webhookUrlForTasks(): string | undefined {
  const base = (process.env.APP_URL || '').replace(/\/+$/, '');
  const secret = process.env.WEBHOOK_SECRET || '';
  if (!base || base.includes('localhost') || base.includes('127.0.0.1') || !secret) return undefined;
  return `${base}/api/webhooks/runninghub?token=${encodeURIComponent(secret)}`;
}

// Download the finished result and persist it as the job's image, then close the job.
export async function finalizeJob(job: Job, fileUrl: string): Promise<void> {
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
  await recomputeStatus(job.shot_id);
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
        await finalizeJob(job, outcome.fileUrl);
        finalized++;
      } catch (e) {
        await updateJob(job.id, { status: 'error', error: e instanceof Error ? e.message : String(e) });
        failed++;
      }
    } else if (outcome.state === 'error') {
      await updateJob(job.id, { status: 'error', error: outcome.message });
      failed++;
    } else {
      running++;
    }
  }
  await recomputeStatus(shotId);
  return { finalized, failed, running };
}
