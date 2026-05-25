import { listSources } from '@/lib/db';
import { SourcesManager } from '@/components/SourcesManager';

export const dynamic = 'force-dynamic';

export default async function SourcesPage() {
  const sources = await listSources();
  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Source library</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Reusable model sources. Upload them once here, then pick them for slot A/B on any shot.
      </p>
      <SourcesManager initial={sources} />
    </main>
  );
}
