'use client';

import { useState } from 'react';
import type { ModelSlot } from '@/lib/db';

type Props = {
  shotId: string;
  hasMannequin: boolean;
  hasA: boolean;
  hasB: boolean;
  onChange: () => void | Promise<void>;
};

export function GenerateControls({ shotId, hasMannequin, hasA, hasB, onChange }: Props) {
  const [count, setCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = hasMannequin && (hasA || hasB);

  // Enqueue `count` variations for each given slot; returns as soon as the jobs
  // are queued (generation runs in the background).
  const enqueue = async (slots: ModelSlot[]) => {
    setBusy(true);
    setError(null);
    try {
      for (const slot of slots) {
        const r = await fetch(`/api/shots/${shotId}/outputs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slot, count }),
        });
        if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
      }
      await onChange();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const activeSlots: ModelSlot[] = [...(hasA ? (['A'] as const) : []), ...(hasB ? (['B'] as const) : [])];

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-neutral-400">
          Variations per source
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            disabled={busy}
            onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
            className="w-16 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm"
          />
        </label>
        <button
          onClick={() => enqueue(activeSlots)}
          disabled={!ready || busy}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Queuing…' : `Generate ${count}× per source`}
        </button>
        {hasA && (
          <button
            onClick={() => enqueue(['A'])}
            disabled={!hasMannequin || busy}
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500 disabled:opacity-50"
          >
            +{count} for A
          </button>
        )}
        {hasB && (
          <button
            onClick={() => enqueue(['B'])}
            disabled={!hasMannequin || busy}
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500 disabled:opacity-50"
          >
            +{count} for B
          </button>
        )}
      </div>

      {!ready && (
        <p className="mt-3 text-xs text-neutral-600">
          {hasMannequin ? 'Add at least one model source to generate.' : 'Generate the mannequin first.'}
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      {ready && !error && (
        <p className="mt-3 text-xs text-neutral-600">
          Generation runs in the background — you can leave this page and come back; results appear as they finish.
        </p>
      )}
    </div>
  );
}
