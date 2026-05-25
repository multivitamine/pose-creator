import Link from 'next/link';
import type { ShotWithImages } from '@/lib/db';
import { ShotCard } from './ShotCard';

export function ShotGrid({ shots }: { shots: ShotWithImages[] }) {
  if (shots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-800 py-20 text-center">
        <p className="text-sm text-neutral-400">No shots yet.</p>
        <Link
          href="/upload"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          Upload base images
        </Link>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {shots.map((shot) => (
        <ShotCard key={shot.id} shot={shot} />
      ))}
    </div>
  );
}
