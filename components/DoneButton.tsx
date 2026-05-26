'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ShotStatus } from '@/lib/db';

// Toggles a shot between 'completed' and its derived status. Used in the grid/list
// so the user can mark a shot done without opening it; combined with the overview's
// hide-done toggle, that keeps the working set small.
export function DoneButton({
  shotId,
  status,
  className = '',
}: {
  shotId: string;
  status: ShotStatus;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const done = status === 'completed';

  const click = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (done) {
        await fetch(`/api/shots/${shotId}/recompute`, { method: 'POST' });
      } else {
        await fetch(`/api/shots/${shotId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' }),
        });
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={click}
      disabled={busy}
      title={done ? 'Move back into the working set' : 'Mark this shot completed'}
      className={`rounded-md px-2 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
        done
          ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
          : 'bg-green-900/70 text-green-200 hover:bg-green-800'
      } ${className}`}
    >
      {busy ? '…' : done ? 'Undo done' : 'Done'}
    </button>
  );
}
