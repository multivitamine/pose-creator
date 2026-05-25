import { NextResponse } from 'next/server';
import { findDuplicateImageIds, deleteImage, recomputeStatus } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// One-off cleanup for the finalize-race duplicates: images that share a task_id are
// the same generated/mannequin result inserted more than once. We keep the oldest
// copy of each and remove the rest (DB row + its distinct R2 object).
//
//   GET  -> preview: how many duplicates would be removed (no changes)
//   POST -> apply: delete them and recompute affected shot statuses
// Safe to run repeatedly; a second run finds nothing.

export async function GET() {
  try {
    const ids = await findDuplicateImageIds();
    return NextResponse.json({ duplicates: ids.length, ids });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST() {
  try {
    const ids = await findDuplicateImageIds();
    const shotIds = new Set<string>();
    for (const id of ids) {
      const { shot_id } = await deleteImage(id);
      shotIds.add(shot_id);
    }
    for (const shotId of shotIds) await recomputeStatus(shotId);
    return NextResponse.json({ deleted: ids.length, shots: shotIds.size });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
