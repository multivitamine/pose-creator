import { NextRequest, NextResponse } from 'next/server';
import { getSettings, updateSettings, type Settings } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ settings: await getSettings() });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const fields: Partial<Settings> = {};
    for (const k of ['mannequin_prompt', 'output_prompt', 'default_aspect', 'default_resolution'] as const) {
      if (typeof body[k] === 'string') fields[k] = body[k];
    }
    return NextResponse.json({ settings: await updateSettings(fields) });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
