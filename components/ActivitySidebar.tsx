'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ActivityJob } from '@/lib/db';

const STATUS_META: Record<string, { text: string; dot: string }> = {
  pending: { text: 'queued', dot: 'bg-neutral-500' },
  running: { text: 'generating', dot: 'bg-blue-400 animate-pulse' },
  done: { text: 'done', dot: 'bg-green-500' },
  error: { text: 'failed', dot: 'bg-red-500' },
};

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function jobLabel(j: ActivityJob): string {
  const shot = j.shot_name?.trim() || `Shot ${j.shot_number}`;
  const what =
    j.kind === 'mannequin'
      ? 'mannequin'
      : `output ${j.slot ?? ''}${j.variation_index ? `#${j.variation_index}` : ''}`.trim();
  return `${shot} · ${what}`;
}

export function ActivitySidebar() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ActivityJob[]>([]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch('/api/activity', { cache: 'no-store' });
        const j = await r.json();
        if (cancelled) return;
        const list: ActivityJob[] = j.jobs || [];
        setJobs(list);
        // If anything is in flight, advance the queue and refresh the page data.
        if (list.some((x) => x.status === 'pending' || x.status === 'running')) {
          await fetch('/api/reconcile', { method: 'POST' }).catch(() => {});
          if (!cancelled) router.refresh();
        }
      } catch {
        // ignore; retry next tick
      }
    };
    tick();
    const iv = setInterval(tick, 12000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [router]);

  const active = jobs.filter((j) => j.status === 'pending' || j.status === 'running').length;

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-neutral-800 bg-neutral-950 lg:flex">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <span className="text-sm font-medium">Activity</span>
        {active > 0 && <span className="text-xs text-blue-300">{active} active</span>}
      </div>
      <div className="flex-1 overflow-y-auto">
        {jobs.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">No generation activity yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-900">
            {jobs.map((j) => {
              const meta = STATUS_META[j.status] ?? STATUS_META.pending;
              return (
                <li key={j.id}>
                  <Link
                    href={`/shots/${j.shot_id}`}
                    className="flex items-start gap-3 px-4 py-2.5 hover:bg-neutral-900/70"
                    title={j.error ?? undefined}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-neutral-200">{jobLabel(j)}</span>
                      <span className="block text-xs text-neutral-500">
                        {meta.text} · {ago(j.updated_at)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
