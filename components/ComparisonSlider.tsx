'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CompareImage } from '@/lib/compare';

const isResult = (img?: CompareImage) => img?.role === 'generated' || img?.role === 'imported';

export function ComparisonSlider({
  images,
  onChange,
  onClose,
}: {
  images: CompareImage[];
  onChange?: () => void | Promise<void>;
  onClose: () => void;
}) {
  const generations = images.filter(isResult);
  // Left defaults to a reference (mannequin/base); right to the first generation to review.
  const [leftId, setLeftId] = useState(() => images.find((i) => !isResult(i))?.id ?? images[0]?.id ?? '');
  const [rightId, setRightId] = useState(() => generations[0]?.id ?? images[0]?.id ?? '');
  const [pos, setPos] = useState(50);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Keep selections valid as the image set changes (e.g., after a deny/delete).
  useEffect(() => {
    if (!images.some((i) => i.id === leftId)) setLeftId(images.find((i) => !isResult(i))?.id ?? images[0]?.id ?? '');
    if (!images.some((i) => i.id === rightId)) setRightId(generations[0]?.id ?? images[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  const left = images.find((i) => i.id === leftId);
  const right = images.find((i) => i.id === rightId);
  const genIndex = generations.findIndex((i) => i.id === rightId);

  const step = useCallback(
    (dir: 1 | -1) => {
      if (generations.length === 0) return;
      const from = genIndex === -1 ? (dir === 1 ? -1 : 0) : genIndex;
      const next = (from + dir + generations.length) % generations.length;
      setRightId(generations[next].id);
    },
    [genIndex, generations],
  );

  const accept = useCallback(async () => {
    if (!right || !isResult(right) || busy) return;
    setBusy(true);
    try {
      await fetch(`/api/images/${right.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected: !right.selected }),
      });
      await onChange?.();
    } finally {
      setBusy(false);
    }
  }, [right, busy, onChange]);

  const deny = useCallback(async () => {
    if (!right || !isResult(right) || busy) return;
    setBusy(true);
    try {
      // advance first so we land on the next generation after it's removed
      step(1);
      await fetch(`/api/images/${right.id}`, { method: 'DELETE' });
      await onChange?.();
    } finally {
      setBusy(false);
    }
  }, [right, busy, onChange, step]);

  // Keyboard: ←/→ navigate generations, A/Enter accept, D delete, Esc close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'a' || e.key === 'Enter') { e.preventDefault(); accept(); }
      else if (e.key === 'd') { e.preventDefault(); deny(); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, accept, deny, onClose]);

  const move = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };

  const picker = (value: string, onChangeId: (v: string) => void, lbl: string) => (
    <label className="flex items-center gap-2 text-xs text-neutral-400">
      {lbl}
      <select
        value={value}
        onChange={(e) => onChangeId(e.target.value)}
        className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
      >
        {images.map((img) => (
          <option key={img.id} value={img.id}>{img.label}</option>
        ))}
      </select>
    </label>
  );

  const rightIsResult = isResult(right);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4">
      {/* top bar: pickers + review actions */}
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex flex-wrap items-center gap-4">
          {picker(leftId, setLeftId, 'Left')}
          {picker(rightId, setRightId, 'Right')}
          {generations.length > 0 && (
            <span className="text-xs text-neutral-500">
              {genIndex >= 0 ? `${genIndex + 1} / ${generations.length}` : `${generations.length} results`} · ←/→ to step
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => step(-1)} disabled={generations.length === 0} className="rounded-md border border-neutral-700 px-2 py-1.5 text-sm text-neutral-300 hover:border-neutral-500 disabled:opacity-40">←</button>
          <button onClick={() => step(1)} disabled={generations.length === 0} className="rounded-md border border-neutral-700 px-2 py-1.5 text-sm text-neutral-300 hover:border-neutral-500 disabled:opacity-40">→</button>
          <button
            onClick={accept}
            disabled={!rightIsResult || busy}
            className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
              right?.selected ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-neutral-800 text-neutral-100 hover:bg-neutral-700'
            }`}
          >
            {right?.selected ? '✓ Saved' : 'Accept (A)'}
          </button>
          <button
            onClick={deny}
            disabled={!rightIsResult || busy}
            className="rounded-md border border-red-900 px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/50 disabled:opacity-40"
          >
            Deny (D)
          </button>
          <button onClick={onClose} className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:border-neutral-500">close</button>
        </div>
      </div>

      <div
        ref={ref}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); move(e.clientX); }}
        onPointerMove={(e) => { if (e.buttons === 1) move(e.clientX); }}
        className="relative mx-auto w-full max-w-4xl flex-1 cursor-ew-resize select-none overflow-hidden rounded-lg bg-neutral-950"
      >
        {right && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={right.url} alt={right.label} draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
        )}
        {left && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={left.url} alt={left.label} draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-contain" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
        )}
        <div className="pointer-events-none absolute bottom-0 top-0" style={{ left: `${pos}%` }}>
          <div className="h-full w-0.5 -translate-x-1/2 bg-white/80" />
          <div className="absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-black/50" />
        </div>
        <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-neutral-200">{left?.label}</span>
        <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-neutral-200">
          {right?.label}{right?.selected ? ' · saved' : ''}
        </span>
      </div>
    </div>
  );
}
