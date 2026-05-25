import { NextResponse } from 'next/server';
import { reconcileAll } from '@/lib/jobs';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// Reconcile all shots with active jobs. Polled by the overview while anything is generating.
export async function POST() {
  try {
    return NextResponse.json(await reconcileAll());
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
