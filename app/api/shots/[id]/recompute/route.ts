import { NextRequest, NextResponse } from 'next/server';
import { recomputeStatus } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// Re-derive a shot's status from its images (used after a generation batch).
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const status = await recomputeStatus(id);
    return NextResponse.json({ status });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
