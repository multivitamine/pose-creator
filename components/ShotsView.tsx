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
  const [query, setQuery] = useState('');

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

  // Search by shot number (substring) or name (case-insensitive), on top of the
  // status filter. Empty query matches everything.
  const q = query.trim();
  const matchesQuery = (s: ShotWithImages) =>
    !q || String(s.number).includes(q) || (s.name?.toLowerCase().includes(q.toLowerCase()) ?? false);
  const shown = shots.filter((s) => (filter === 'all' || s.status === filter) && matchesQuery(s));

  // Enter jumps to the shot: an exact number match wins, else a lone result.
  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !q) return;
    const target = shots.find((s) => String(s.number) === q) ?? (shown.length === 1 ? shown[0] : undefined);
    if (target) router.push(`/shots/${target.id}`);
  };

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
        <div className="flex shrink-0 items-center gap-2">
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search #"
              aria-label="Search shots by number"
              className="w-32 rounded-md border border-neutral-800 bg-neutral-900/50 px-3 py-1.5 text-sm text-neutral-200 placeholder-neutral-500 outline-none transition focus:border-neutral-600"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-1 text-neutral-500 hover:text-neutral-200"
              >
                ×
              </button>
            )}
          </div>
          <div className="inline-flex gap-1 rounded-md border border-neutral-800 bg-neutral-900/50 p-1 text-sm">
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
      </div>

      {shown.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-500">
          {q ? `No shots match “${q}”.` : 'No shots with this status.'}
        </p>
      ) : view === 'grid' ? (
        <ShotGrid shots={shown} />
      ) : (
        <ShotList shots={shown} />
      )}
    </>
  );
}
