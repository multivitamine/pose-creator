import { NextRequest, NextResponse } from 'next/server';
import { setSelected, deleteImage, recomputeStatus } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// Toggle the selected (saved) flag on an image.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { shot_id } = await setSelected(id, !!body.selected);
    const status = await recomputeStatus(shot_id);
    return NextResponse.json({ selected: !!body.selected, status });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// Delete an image (row + R2 object).
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { shot_id } = await deleteImage(id);
    const status = await recomputeStatus(shot_id);
    return NextResponse.json({ ok: true, status });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
