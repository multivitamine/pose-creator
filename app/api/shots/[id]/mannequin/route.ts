import { NextRequest, NextResponse } from 'next/server';
import { getShotImages, getSettings, createJob, recomputeStatus } from '@/lib/db';
import { createTask, type NodeInfo } from '@/lib/runninghub';
import { r2ToRunningHub } from '@/lib/generate';
import { webhookUrlForTasks } from '@/lib/jobs';
import { SINGLE_DEFAULTS } from '@/lib/defaults';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// Enqueue a mannequin generation (SINGLE workflow on the base). Returns immediately;
// the result is finalized later by the webhook or reconcile poll.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: shotId } = await params;
    const settings = await getSettings();

    const images = await getShotImages(shotId);
    const base = images.find((i) => i.role === 'base');
    if (!base) return NextResponse.json({ error: 'shot has no base image' }, { status: 400 });

    const uploadedName = await r2ToRunningHub(base.url, base.content_type, 'base.png');
    const nodeInfoList: NodeInfo[] = [
      { nodeId: SINGLE_DEFAULTS.promptNodeId, fieldName: SINGLE_DEFAULTS.promptFieldName, fieldValue: settings.mannequin_prompt },
      { nodeId: SINGLE_DEFAULTS.imageNodeId, fieldName: SINGLE_DEFAULTS.imageFieldName, fieldValue: uploadedName },
      { nodeId: SINGLE_DEFAULTS.aspectNodeId, fieldName: SINGLE_DEFAULTS.aspectFieldName, fieldValue: settings.default_aspect },
      { nodeId: SINGLE_DEFAULTS.resolutionNodeId, fieldName: SINGLE_DEFAULTS.resolutionFieldName, fieldValue: settings.default_resolution.toLowerCase() },
    ];

    const taskId = await createTask(SINGLE_DEFAULTS.workflowId, nodeInfoList, webhookUrlForTasks());
    const job = await createJob({ shot_id: shotId, kind: 'mannequin', task_id: taskId });
    const status = await recomputeStatus(shotId);

    return NextResponse.json({ job, status }, { status: 202 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
