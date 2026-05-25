'use client';

import { useState } from 'react';
import type { ShotImage } from '@/lib/db';
import { ComparisonSlider, type CompareImage } from './ComparisonSlider';

function label(img: ShotImage, importedIdx?: number): string {
  switch (img.role) {
    case 'base':
      return 'Base';
    case 'mannequin':
      return 'Mannequin';
    case 'model_source':
      return `Source ${img.slot}`;
    case 'imported':
      return `Imported ${importedIdx ?? ''}`.trim();
    default:
      return `Gen ${img.slot ?? ''}#${img.variation_index ?? ''}`;
  }
}

// Order images for the comparison picker: base, mannequin, sources, generated, imported.
function orderForCompare(images: ShotImage[]): CompareImage[] {
  const order: Record<string, number> = { base: 0, mannequin: 1, model_source: 2, generated: 3, imported: 4 };
  let imported = 0;
  return [...images]
    .sort((a, b) => (order[a.role] - order[b.role]) || (a.variation_index ?? 0) - (b.variation_index ?? 0))
    .map((img) => ({ id: img.id, url: img.url, label: label(img, img.role === 'imported' ? ++imported : undefined) }));
}

export function ResultsGallery({
  shotId: _shotId,
  images,
  onChange,
}: {
  shotId: string;
  images: ShotImage[];
  onChange: () => void | Promise<void>;
}) {
  const [comparing, setComparing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const results = images.filter((i) => i.role === 'generated' || i.role === 'imported');

  const toggleSelected = async (img: ShotImage) => {
    setBusyId(img.id);
    try {
      await fetch(`/api/images/${img.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected: !img.selected }),
      });
      await onChange();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (img: ShotImage) => {
    if (!confirm('Delete this image from the shot and storage?')) return;
    setBusyId(img.id);
    try {
      await fetch(`/api/images/${img.id}`, { method: 'DELETE' });
      await onChange();
    } finally {
      setBusyId(null);
    }
  };

  const tile = (img: ShotImage, cap: string) => (
    <div
      key={img.id}
      className={`group relative overflow-hidden rounded-md border bg-neutral-950 ${
        img.selected ? 'border-green-500 ring-1 ring-green-500' : 'border-neutral-800'
      }`}
    >
      <div className="flex aspect-[4/5] items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.url} alt={cap} className="h-full w-full object-cover" />
      </div>
      <button
        onClick={() => toggleSelected(img)}
        disabled={busyId === img.id}
        className={`absolute left-1.5 top-1.5 rounded px-2 py-0.5 text-[11px] font-medium ${
          img.selected ? 'bg-green-600 text-white' : 'bg-black/60 text-neutral-200 opacity-0 group-hover:opacity-100'
        }`}
      >
        {img.selected ? '✓ saved' : 'save'}
      </button>
      <button
        onClick={() => remove(img)}
        disabled={busyId === img.id}
        className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 text-xs text-neutral-200 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
      >
        ✕
      </button>
      <span className="absolute bottom-1 left-1.5 text-[10px] text-neutral-400">{cap}</span>
    </div>
  );

  const canCompare = images.length >= 2;

  return (
    <div className="flex flex-col gap-4">
      {(canCompare || results.length > 0) && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-500">
            {results.length > 0
              ? `${results.filter((i) => i.selected).length} saved of ${results.length} result${results.length === 1 ? '' : 's'}`
              : 'Compare any two images in this shot'}
          </p>
          {canCompare && (
            <button
              onClick={() => setComparing(true)}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:border-neutral-500"
            >
              Compare
            </button>
          )}
        </div>
      )}

      {(['A', 'B'] as const).map((slot) => {
        const outs = results
          .filter((i) => i.role === 'generated' && i.slot === slot)
          .sort((a, b) => (a.variation_index ?? 0) - (b.variation_index ?? 0));
        if (outs.length === 0) return null;
        return (
          <div key={slot}>
            <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Model {slot} · {outs.length}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {outs.map((img) => tile(img, `Gen ${slot}#${img.variation_index}`))}
            </div>
          </div>
        );
      })}

      {results.some((i) => i.role === 'imported') && (
        <div>
          <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Imported</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {results.filter((i) => i.role === 'imported').map((img, idx) => tile(img, `Imported ${idx + 1}`))}
          </div>
        </div>
      )}

      {comparing && <ComparisonSlider images={orderForCompare(images)} onClose={() => setComparing(false)} />}
    </div>
  );
}
