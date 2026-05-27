import { NextRequest, NextResponse } from 'next/server';
import { insertImage, recomputeStatus, clearRole, getSource, type ImageRole, type ModelSlot } from '@/lib/db';
import { shotImageKey, uploadBuffer, extFromContentType } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// Add an image to a shot. Four forms:
//  - model source from an uploaded file (file + role=model_source + slot)
//  - model source referencing a library preset (sourceId + role=model_source + slot)
//  - imported result from an uploaded file (file + role=imported)
//  - mannequin from an uploaded file (file + role=mannequin) — upload instead of generating
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: shotId } = await params;
    const form = await req.formData();
    const file = form.get('file');
    const sourceId = form.get('sourceId') as string | null;

    const role = String(form.get('role') || '') as ImageRole;
    if (!['model_source', 'imported', 'mannequin'].includes(role)) {
      return NextResponse.json({ error: 'role must be model_source, imported or mannequin' }, { status: 400 });
    }

    let slot: ModelSlot | null = null;
    if (role === 'model_source') {
      const s = String(form.get('slot') || '');
      if (s !== 'A' && s !== 'B') {
        return NextResponse.json({ error: 'model_source requires slot A or B' }, { status: 400 });
      }
      slot = s;
      // One image per model slot: replace any existing source for this slot.
      await clearRole(shotId, 'model_source', slot);
    }

    // Reference a library preset (no copy) — only valid for model sources.
    if (sourceId && role === 'model_source') {
      const src = await getSource(sourceId);
      if (!src) return NextResponse.json({ error: 'source not found' }, { status: 404 });
      const image = await insertImage({
        shot_id: shotId,
        role,
        slot,
        r2_key: src.r2_key,
        url: src.url,
        content_type: src.content_type,
      });
      const status = await recomputeStatus(shotId);
      return NextResponse.json({ image, status }, { status: 201 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file or sourceId is required' }, { status: 400 });
    }
    // One mannequin per shot: replace the existing one (matches generate/regenerate).
    if (role === 'mannequin') await clearRole(shotId, 'mannequin');
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || 'image/png';
    const key = shotImageKey(shotId, role, extFromContentType(contentType));
    const { url } = await uploadBuffer(key, buffer, contentType);
    const image = await insertImage({ shot_id: shotId, role, slot, r2_key: key, url, content_type: contentType });

    const status = await recomputeStatus(shotId);
    return NextResponse.json({ image, status }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
