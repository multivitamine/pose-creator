import Link from 'next/link';
import type { ShotWithImages } from '@/lib/db';
import { shotLabel } from '@/lib/format';
import { StatusBadge } from './StatusBadge';
import { DoneButton } from './DoneButton';

export function ShotCard({ shot }: { shot: ShotWithImages }) {
  const mannequin = shot.images.find((i) => i.role === 'mannequin');
  const base = shot.images.find((i) => i.role === 'base');
  const thumb = mannequin ?? base;
  const resultCount = shot.images.filter((i) => i.role === 'generated' || i.role === 'imported').length;
  const selectedCount = shot.images.filter((i) => i.selected).length;

  return (
    <Link
      href={`/shots/${shot.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/40 transition hover:border-neutral-600"
    >
      <div className="flex aspect-[4/5] items-center justify-center overflow-hidden bg-neutral-950">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb.url} alt={`shot ${shot.number}`} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
        ) : (
          <span className="text-xs text-neutral-600">no image</span>
        )}
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm font-medium">{shotLabel(shot)}</span>
          {shot.mode === 'import' && (
            <span className="text-[10px] uppercase tracking-wide text-neutral-600">import</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={shot.status} />
          <DoneButton shotId={shot.id} status={shot.status} />
        </div>
        <div className="text-xs text-neutral-500">
          {resultCount} result{resultCount === 1 ? '' : 's'}
          {selectedCount > 0 && <span className="text-green-400"> · {selectedCount} saved</span>}
        </div>
      </div>
    </Link>
  );
}
