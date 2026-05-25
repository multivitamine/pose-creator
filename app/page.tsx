import Link from 'next/link';
import { listShotsWithImages } from '@/lib/db';
import { ShotsView } from '@/components/ShotsView';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const shots = await listShotsWithImages();
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shots</h1>
          <p className="text-sm text-neutral-500">
            {shots.length} shot{shots.length === 1 ? '' : 's'}. Each base image is one shot.
          </p>
        </div>
        <Link
          href="/upload"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          Upload base images
        </Link>
      </div>
      <ShotsView shots={shots} />
    </main>
  );
}
