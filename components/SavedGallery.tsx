'use client';

import { useState } from 'react';
import Link from 'next/link';
import { shotLabel } from '@/lib/format';

type SavedImage = { id: string; url: string; shot_id: string; shot_number: number; shot_name: string | null };

export function SavedGallery({ images }: { images: SavedImage[] }) {
  const shots = Array.from(new Map(images.map((i) => [i.shot_number, { number: i.shot_number, name: i.shot_name }])).values()).sort(
    (a, b) => a.number - b.number,
  );
  const [filter, setFilter] = useState<number | 'all'>('all');

  const shown = filter === 'all' ? images : images.filter((i) => i.shot_number === filter);

  if (images.length === 0) {
    return <p className="text-sm text-neutral-500">No saved images yet. Save results from a shot to see them here.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-md px-3 py-1 ${filter === 'all' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
        >
          All ({images.length})
        </button>
        {shots.map((s) => (
          <button
            key={s.number}
            onClick={() => setFilter(s.number)}
            className={`rounded-md px-3 py-1 ${filter === s.number ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
          >
            {shotLabel(s)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((img) => (
          <Link
            key={img.id}
            href={`/shots/${img.shot_id}`}
            className="group relative overflow-hidden rounded-md border border-neutral-800 bg-neutral-950"
          >
            <div className="flex aspect-[4/5] items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={`shot ${img.shot_number}`} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
            </div>
            <span className="absolute bottom-1 left-1.5 rounded bg-black/60 px-1.5 text-[10px] text-neutral-200">
              {shotLabel({ number: img.shot_number, name: img.shot_name })}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
