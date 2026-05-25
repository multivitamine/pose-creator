import { NextRequest, NextResponse } from 'next/server';
import { getJobByTaskId, updateJob } from '@/lib/db';
import { fetchTaskOutput } from '@/lib/runninghub';
import { finalizeJob } from '@/lib/jobs';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// RunningHub calls this when a task finishes. Public endpoint, guarded by a token.
export async function POST(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!process.env.WEBHOOK_SECRET || token !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    // Be tolerant about where the task id lives in the payload.
    const taskId =
      (body.taskId as string) ||
      ((body.data as Record<string, unknown>)?.taskId as string) ||
      ((body.eventData as Record<string, unknown>)?.taskId as string) ||
      (body.task_id as string);

    if (!taskId) return NextResponse.json({ ok: true, note: 'no taskId in payload' });

    const job = await getJobByTaskId(String(taskId));
    if (!job || job.status !== 'running') return NextResponse.json({ ok: true });

    // Confirm the outcome from RunningHub (payload may not include the file URL).
    const outcome = await fetchTaskOutput(String(taskId));
    if (outcome.state === 'done') {
      await finalizeJob(job, outcome.fileUrl);
    } else if (outcome.state === 'error') {
      await updateJob(job.id, { status: 'error', error: outcome.message });
    }
    // 'running' -> leave it; the reconcile poll will catch it.

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
