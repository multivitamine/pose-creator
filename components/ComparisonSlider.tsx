'use client';

import { useRef, useState } from 'react';

export type CompareImage = { id: string; url: string; label: string };

export function ComparisonSlider({ images, onClose }: { images: CompareImage[]; onClose: () => void }) {
  const [leftId, setLeftId] = useState(images[0]?.id ?? '');
  const [rightId, setRightId] = useState(images[1]?.id ?? images[0]?.id ?? '');
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);

  const left = images.find((i) => i.id === leftId);
  const right = images.find((i) => i.id === rightId);

  const move = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };

  const picker = (value: string, onChange: (v: string) => void, label: string) => (
    <label className="flex items-center gap-2 text-xs text-neutral-400">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
      >
        {images.map((img) => (
          <option key={img.id} value={img.id}>
            {img.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 pb-3">
        <div className="flex flex-wrap gap-4">
          {picker(leftId, setLeftId, 'Left')}
          {picker(rightId, setRightId, 'Right')}
        </div>
        <button onClick={onClose} className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:border-neutral-500">
          close
        </button>
      </div>

      <div
        ref={ref}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) move(e.clientX);
        }}
        className="relative mx-auto w-full max-w-4xl flex-1 cursor-ew-resize select-none overflow-hidden rounded-lg bg-neutral-950"
      >
        {right && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={right.url} alt={right.label} draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
        )}
        {left && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={left.url}
            alt={left.label}
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          />
        )}
        {/* divider */}
        <div className="pointer-events-none absolute bottom-0 top-0" style={{ left: `${pos}%` }}>
          <div className="h-full w-0.5 -translate-x-1/2 bg-white/80" />
          <div className="absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-black/50" />
        </div>
        {/* labels */}
        <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-neutral-200">{left?.label}</span>
        <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-neutral-200">{right?.label}</span>
      </div>
    </div>
  );
}
