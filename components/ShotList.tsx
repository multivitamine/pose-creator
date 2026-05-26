import Link from 'next/link';
import type { ShotWithImages } from '@/lib/db';
import { shotLabel } from '@/lib/format';
import { StatusBadge } from './StatusBadge';
import { DoneButton } from './DoneButton';

export function ShotList({ shots }: { shots: ShotWithImages[] }) {
  return (
    <div className="divide-y divide-neutral-800 overflow-hidden rounded-lg border border-neutral-800">
      {shots.map((shot) => {
        const thumb =
          shot.images.find((i) => i.role === 'mannequin') ?? shot.images.find((i) => i.role === 'base');
        const results = shot.images.filter((i) => i.role === 'generated' || i.role === 'imported').length;
        const saved = shot.images.filter((i) => i.selected).length;
        return (
          <Link
            key={shot.id}
            href={`/shots/${shot.id}`}
            className="flex items-center gap-4 bg-neutral-900/30 px-3 py-2 transition hover:bg-neutral-900/70"
          >
            <div className="flex h-14 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-neutral-950">
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb.url} alt={shotLabel(shot)} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[9px] text-neutral-600">—</span>
              )}
            </div>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {shotLabel(shot)}
              {shot.mode === 'import' && <span className="ml-2 text-[10px] uppercase tracking-wide text-neutral-600">import</span>}
            </span>
            <span className="hidden shrink-0 text-xs text-neutral-500 sm:block">
              {results} result{results === 1 ? '' : 's'}
              {saved > 0 && <span className="text-green-400"> · {saved} saved</span>}
            </span>
            <StatusBadge status={shot.status} />
            <DoneButton shotId={shot.id} status={shot.status} />
          </Link>
        );
      })}
    </div>
  );
}
