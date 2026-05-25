import { NextRequest, NextResponse } from 'next/server';
import { getShotImages, getSettings, createJob, nextVariationIndex, recomputeStatus, type ModelSlot } from '@/lib/db';
import { createTask, type NodeInfo } from '@/lib/runninghub';
import { r2ToRunningHub } from '@/lib/generate';
import { webhookUrlForTasks } from '@/lib/jobs';
import { DOUBLE_DEFAULTS } from '@/lib/defaults';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// Enqueue `count` output variations for a model slot (DOUBLE workflow:
// source = model source, base = mannequin). Returns immediately.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: shotId } = await params;
    const body = await req.json().catch(() => ({}));
    const slot = String(body.slot || '') as ModelSlot;
    if (slot !== 'A' && slot !== 'B') {
      return NextResponse.json({ error: 'slot must be A or B' }, { status: 400 });
    }
    const count = Math.max(1, Math.min(10, Number(body.count) || 1));
    const settings = await getSettings();

    const images = await getShotImages(shotId);
    const mannequin = images.find((i) => i.role === 'mannequin');
    if (!mannequin) return NextResponse.json({ error: 'shot has no mannequin' }, { status: 400 });
    const source = images.find((i) => i.role === 'model_source' && i.slot === slot);
    if (!source) return NextResponse.json({ error: `no model source for slot ${slot}` }, { status: 400 });

    // Upload inputs to RunningHub once; reuse for every variation.
    const [sourceName, mannequinName] = await Promise.all([
      r2ToRunningHub(source.url, source.content_type, `model-${slot}.png`),
      r2ToRunningHub(mannequin.url, mannequin.content_type, 'mannequin.png'),
    ]);

    const webhookUrl = webhookUrlForTasks();
    const jobs = [];
    for (let i = 0; i < count; i++) {
      const variationIndex = await nextVariationIndex(shotId, slot);
      const nodeInfoList: NodeInfo[] = [
        { nodeId: DOUBLE_DEFAULTS.promptNodeId, fieldName: DOUBLE_DEFAULTS.promptFieldName, fieldValue: settings.output_prompt },
        { nodeId: DOUBLE_DEFAULTS.imageNodeId, fieldName: DOUBLE_DEFAULTS.imageFieldName, fieldValue: sourceName },
        { nodeId: DOUBLE_DEFAULTS.baseImageNodeId, fieldName: DOUBLE_DEFAULTS.baseImageFieldName, fieldValue: mannequinName },
        { nodeId: DOUBLE_DEFAULTS.aspectNodeId, fieldName: DOUBLE_DEFAULTS.aspectFieldName, fieldValue: settings.default_aspect },
        { nodeId: DOUBLE_DEFAULTS.resolutionNodeId, fieldName: DOUBLE_DEFAULTS.resolutionFieldName, fieldValue: settings.default_resolution.toLowerCase() },
      ];
      const taskId = await createTask(DOUBLE_DEFAULTS.workflowId, nodeInfoList, webhookUrl);
      jobs.push(await createJob({ shot_id: shotId, kind: 'output', slot, variation_index: variationIndex, source_image_id: source.id, task_id: taskId }));
    }

    const status = await recomputeStatus(shotId);
    return NextResponse.json({ jobs, status }, { status: 202 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
