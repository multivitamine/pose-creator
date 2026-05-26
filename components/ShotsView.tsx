'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ShotWithImages, ShotStatus } from '@/lib/db';
import { ShotGrid } from './ShotGrid';
import { ShotList } from './ShotList';
import { STATUS_ORDER, statusLabel } from './StatusBadge';

type View = 'grid' | 'list';
type Filter = ShotStatus | 'all';

export function ShotsView({
  shots,
  includeCompleted = false,
  hiddenCompletedCount = 0,
}: {
  shots: ShotWithImages[];
  includeCompleted?: boolean;
  hiddenCompletedCount?: number;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>('grid');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const v = localStorage.getItem('shotsView');
    if (v === 'grid' || v === 'list') setView(v);
  }, []);

  // While any shot is generating, reconcile in the background and refresh the
  // list so statuses resolve here without having to open each shot.
  const anyGenerating = shots.some((s) => s.status === 'generating');
  useEffect(() => {
    if (!anyGenerating) return;
    let cancelled = false;
    const tick = async () => {
      try {
        await fetch('/api/reconcile', { method: 'POST' });
        if (!cancelled) router.refresh();
      } catch {
        // ignore; will retry next tick
      }
    };
    tick();
    const iv = setInterval(tick, 15000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [anyGenerating, router]);

  const choose = (v: View) => {
    setView(v);
    localStorage.setItem('shotsView', v);
  };

  // Counts per status, in pipeline order, only for statuses that exist.
  const counts = useMemo(() => {
    const m = new Map<ShotStatus, number>();
    for (const s of shots) m.set(s.status, (m.get(s.status) ?? 0) + 1);
    return m;
  }, [shots]);

  const shown = filter === 'all' ? shots : shots.filter((s) => s.status === filter);

  if (shots.length === 0) return <ShotGrid shots={shots} />;

  const chip = (key: Filter, label: string, count: number) => (
    <button
      key={key}
      onClick={() => setFilter(key)}
      className={`rounded-full px-3 py-1 text-xs transition ${
        filter === key ? 'bg-neutral-700 text-white' : 'bg-neutral-900/60 text-neutral-400 hover:text-neutral-200'
      }`}
    >
      {label} <span className="text-neutral-500">{count}</span>
    </button>
  );

  const toggleDone = () => router.push(includeCompleted ? '/' : '/?done=1');

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex flex-wrap gap-1.5">
          {chip('all', 'All', shots.length)}
          {STATUS_ORDER.filter((s) => counts.has(s)).map((s) => chip(s, statusLabel(s), counts.get(s) ?? 0))}
          <button
            onClick={toggleDone}
            title={includeCompleted ? 'Hide completed shots to speed up the overview' : 'Load completed shots into the overview'}
            className={`rounded-full px-3 py-1 text-xs transition ${
              includeCompleted
                ? 'bg-green-900/60 text-green-200 hover:bg-green-900'
                : 'bg-neutral-900/60 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {includeCompleted ? 'Hide done' : 'Show done'}
            {!includeCompleted && hiddenCompletedCount > 0 && (
              <span className="ml-1 text-neutral-500">{hiddenCompletedCount}</span>
            )}
          </button>
        </div>
        <div className="inline-flex shrink-0 gap-1 rounded-md border border-neutral-800 bg-neutral-900/50 p-1 text-sm">
          {(['grid', 'list'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => choose(v)}
              className={`rounded px-3 py-1 capitalize transition ${
                view === v ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-500">No shots with this status.</p>
      ) : view === 'grid' ? (
        <ShotGrid shots={shown} />
      ) : (
        <ShotList shots={shown} />
      )}
    </>
  );
}
