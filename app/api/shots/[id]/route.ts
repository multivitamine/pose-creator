import { NextRequest, NextResponse } from 'next/server';
import { getShotWithImages, updateShot, deleteShot, countRunningJobs, type ShotStatus } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const shot = await getShotWithImages(id);
    if (!shot) return NextResponse.json({ error: 'shot not found' }, { status: 404 });
    return NextResponse.json({ shot, runningJobs: await countRunningJobs(id) });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const fields: { name?: string; status?: ShotStatus } = {};
    if (typeof body.name === 'string') fields.name = body.name;
    if (typeof body.status === 'string') fields.status = body.status as ShotStatus;
    await updateShot(id, fields);
    const shot = await getShotWithImages(id);
    return NextResponse.json({ shot });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await deleteShot(id);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
