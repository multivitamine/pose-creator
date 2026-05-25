import { NextRequest, NextResponse } from 'next/server';
import { getShotWithImages } from '@/lib/db';
import { reconcileShot } from '@/lib/jobs';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// Poll all running jobs once and finalize the finished ones. Fallback for local
// dev and any missed webhook; safe to call repeatedly. Returns the updated shot.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const result = await reconcileShot(id);
    const shot = await getShotWithImages(id);
    return NextResponse.json({ ...result, shot });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
