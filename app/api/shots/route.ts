import { NextRequest, NextResponse } from 'next/server';
import { createShot, insertImage, recomputeStatus, listShotsWithImages, type ShotMode } from '@/lib/db';
import { shotImageKey, uploadBuffer, extFromContentType } from '@/lib/r2';
import { parseShotFromFilename } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// List all shots (with their images) for the overview.
export async function GET() {
  try {
    const shots = await listShotsWithImages();
    return NextResponse.json({ shots });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// Create a shot from an uploaded base image. multipart: base (File), mode ('generate'|'import').
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const base = form.get('base');
    if (!(base instanceof File)) {
      return NextResponse.json({ error: 'base image is required' }, { status: 400 });
    }
    const mode: ShotMode = form.get('mode') === 'import' ? 'import' : 'generate';

    // Shot identity comes from the uploaded filename: "shot 6.jpg" -> Shot 6.
    // An explicit name/number from the form overrides; missing number falls back to next sequential.
    const parsed = parseShotFromFilename(base.name || '');
    const explicitName = (form.get('name') as string | null)?.trim() || null;
    const explicitNumber = Number(form.get('number'));
    const number = Number.isFinite(explicitNumber) && explicitNumber > 0 ? explicitNumber : parsed.number ?? undefined;

    const shot = await createShot({ mode, name: explicitName ?? parsed.name ?? undefined, number });

    const buffer = Buffer.from(await base.arrayBuffer());
    const contentType = base.type || 'image/png';
    const key = shotImageKey(shot.id, 'base', extFromContentType(contentType));
    const { url } = await uploadBuffer(key, buffer, contentType);
    await insertImage({ shot_id: shot.id, role: 'base', r2_key: key, url, content_type: contentType });

    const status = await recomputeStatus(shot.id);
    return NextResponse.json({ shot: { ...shot, status } }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
