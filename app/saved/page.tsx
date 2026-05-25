import { listSelectedImages } from '@/lib/db';
import { SavedGallery } from '@/components/SavedGallery';

export const dynamic = 'force-dynamic';

export default async function SavedPage() {
  const images = await listSelectedImages();
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Saved results</h1>
      <p className="mb-6 text-sm text-neutral-500">Final images you saved across all shots.</p>
      <SavedGallery
        images={images.map((i) => ({
          id: i.id,
          url: i.url,
          shot_id: i.shot_id,
          shot_number: i.shot_number,
          shot_name: i.shot_name,
        }))}
      />
    </main>
  );
}
