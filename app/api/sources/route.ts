import { NextRequest, NextResponse } from 'next/server';
import { listSources, createSource } from '@/lib/db';
import { sourceLibraryKey, uploadBuffer, extFromContentType } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ sources: await listSources() });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// Upload a reusable model source into the library.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    const name = (form.get('name') as string | null)?.trim() || file.name.replace(/\.[^.]+$/, '') || null;
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || 'image/png';
    const key = sourceLibraryKey(extFromContentType(contentType));
    const { url } = await uploadBuffer(key, buffer, contentType);
    const source = await createSource({ name, r2_key: key, url, content_type: contentType });
    return NextResponse.json({ source }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
