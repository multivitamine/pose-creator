'use client';

import { useEffect, useState } from 'react';

export function CreditsBadge() {
  const [queue, setQueue] = useState<number | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [credits, setCredits] = useState<{ coins: string; money: string; currency: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch('/api/status', { cache: 'no-store' });
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        if (cancelled) return;
        setQueue(j.currentTaskCounts ?? 0);
        const raw = j.raw ?? {};
        if (raw.remainCoins != null || raw.remainMoney != null) {
          setCredits({
            coins: String(raw.remainCoins ?? ''),
            money: String(raw.remainMoney ?? ''),
            currency: String(raw.currency ?? ''),
          });
        }
        setQueueError(null);
      } catch (e: unknown) {
        if (!cancelled) setQueueError(e instanceof Error ? e.message : String(e));
      }
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="text-right text-xs text-neutral-500">
      {queueError ? (
        <div className="text-red-400">queue: error</div>
      ) : (
        <div>queue: {queue == null ? '…' : `${queue} task${queue === 1 ? '' : 's'}`}</div>
      )}
      {credits && (
        <div className="text-neutral-400">
          credits: <span className="font-medium text-neutral-200">{credits.coins}</span>
          {credits.money && <span className="text-neutral-500"> ({credits.money} {credits.currency})</span>}
        </div>
      )}
    </div>
  );
}
