'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ShotWithImages, Source } from '@/lib/db';
import { shotLabel } from '@/lib/format';
import { StatusBadge } from './StatusBadge';
import { ModelSourceSlot } from './ModelSourceSlot';
import { GenerateControls } from './GenerateControls';
import { ResultsGallery } from './ResultsGallery';
import { ImportUploader } from './ImportUploader';
import { ComparisonSlider } from './ComparisonSlider';
import { orderForCompare } from '@/lib/compare';

export function ShotDetailClient({
  initial,
  initialRunningJobs,
}: {
  initial: ShotWithImages;
  initialRunningJobs: number;
}) {
  const router = useRouter();
  const [shot, setShot] = useState<ShotWithImages>(initial);
  const [runningJobs, setRunningJobs] = useState(initialRunningJobs);
  const [sources, setSources] = useState<Source[]>([]);
  const [mannBusy, setMannBusy] = useState(false);
  const mannInputRef = useRef<HTMLInputElement>(null);
  const [reconciling, setReconciling] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial.mode !== 'generate') return;
    fetch('/api/sources', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setSources(j.sources || []))
      .catch(() => {});
  }, [initial.mode]);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/shots/${shot.id}`, { cache: 'no-store' });
    const j = await r.json();
    if (j.shot) {
      setShot(j.shot);
      setRunningJobs(j.runningJobs ?? 0);
    }
  }, [shot.id]);

  const reconcileNow = useCallback(async () => {
    setReconciling(true);
    try {
      const r = await fetch(`/api/shots/${shot.id}/reconcile`, { method: 'POST' });
      const j = await r.json();
      if (j.shot) {
        setShot(j.shot);
        setRunningJobs(j.running ?? 0);
      }
    } finally {
      setReconciling(false);
    }
  }, [shot.id]);

  // While jobs are running, poll the reconcile endpoint so finished results land
  // even if a webhook was missed (and always, in local dev).
  const isRunning = runningJobs > 0;
  useEffect(() => {
    if (!isRunning) return;
    reconcileNow();
    const iv = setInterval(reconcileNow, 15000);
    return () => clearInterval(iv);
  }, [isRunning, reconcileNow]);

  const base = shot.images.find((i) => i.role === 'base');
  const mannequin = shot.images.find((i) => i.role === 'mannequin');
  const srcA = shot.images.find((i) => i.role === 'model_source' && i.slot === 'A');
  const srcB = shot.images.find((i) => i.role === 'model_source' && i.slot === 'B');

  const generateMannequin = async () => {
    setMannBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/shots/${shot.id}/mannequin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setMannBusy(false);
    }
  };

  // Upload an existing mannequin image instead of generating one (replaces any existing).
  const uploadMannequin = async (file: File) => {
    setMannBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      fd.append('role', 'mannequin');
      const r = await fetch(`/api/shots/${shot.id}/images`, { method: 'POST', body: fd });
      if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setMannBusy(false);
    }
  };

  const deleteShot = async () => {
    if (!confirm(`Delete ${shotLabel(shot)}? This removes its images from storage.`)) return;
    await fetch(`/api/shots/${shot.id}`, { method: 'DELETE' });
    router.push('/');
    router.refresh();
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{shotLabel(shot)}</h1>
          <StatusBadge status={shot.status} />
        </div>
        <div className="flex items-center gap-4">
          {shot.images.length >= 2 && (
            <button
              onClick={() => setComparing(true)}
              className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-700"
            >
              Compare
            </button>
          )}
          <button onClick={deleteShot} className="text-xs text-neutral-500 hover:text-red-400">
            delete shot
          </button>
        </div>
      </div>

      {comparing && (
        <ComparisonSlider images={orderForCompare(shot.images)} onChange={refresh} onClose={() => setComparing(false)} />
      )}

      {isRunning && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-md border border-blue-900 bg-blue-950/30 p-3 text-sm text-blue-200">
          <span>
            {runningJobs} generation{runningJobs === 1 ? '' : 's'} running in the background — you can leave this page;
            results appear as they finish.
          </span>
          <button
            onClick={reconcileNow}
            disabled={reconciling}
            className="shrink-0 rounded-md border border-blue-800 px-3 py-1.5 text-xs hover:border-blue-600 disabled:opacity-50"
          >
            {reconciling ? 'Checking…' : 'Check progress'}
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</div>
      )}

      {shot.mode === 'generate' ? (
        <>
          {/* Base + mannequin */}
          <section className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-sm text-neutral-400">Base image</span>
              <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
                {base ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={base.url} alt="base" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-neutral-600">no base</span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-400">Mannequin</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => mannInputRef.current?.click()}
                    disabled={mannBusy || isRunning}
                    className="text-xs text-neutral-500 hover:text-neutral-200 disabled:opacity-50"
                  >
                    upload
                  </button>
                  <button
                    onClick={generateMannequin}
                    disabled={mannBusy || isRunning || !base}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    {mannBusy ? 'Working…' : mannequin ? 'Regenerate' : 'Generate mannequin'}
                  </button>
                </div>
                <input
                  ref={mannInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadMannequin(f);
                    if (mannInputRef.current) mannInputRef.current.value = '';
                  }}
                />
              </div>
              <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
                {mannequin ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mannequin.url} alt="mannequin" className="h-full w-full object-cover" />
                ) : isRunning ? (
                  <span className="text-xs text-neutral-500">generating in the background…</span>
                ) : (
                  <span className="text-center text-xs text-neutral-600">not generated yet</span>
                )}
              </div>
              {mannequin && (
                <p className="text-xs text-neutral-600">Regenerating replaces the mannequin (existing outputs stay).</p>
              )}
            </div>
          </section>

          {/* Model sources */}
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-medium text-neutral-300">Model sources</h2>
            <div className="grid grid-cols-2 gap-6 sm:max-w-md">
              <ModelSourceSlot shotId={shot.id} slot="A" image={srcA} sources={sources} onChange={refresh} />
              <ModelSourceSlot shotId={shot.id} slot="B" image={srcB} sources={sources} onChange={refresh} />
            </div>
          </section>

          {/* Generation + results */}
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-neutral-300">Results</h2>
            <GenerateControls
              shotId={shot.id}
              hasMannequin={!!mannequin}
              hasA={!!srcA}
              hasB={!!srcB}
              onChange={refresh}
            />
            <ResultsGallery shotId={shot.id} images={shot.images} onChange={refresh} />
          </section>
        </>
      ) : (
        <>
          {/* Import mode: base + uploaded existing results */}
          <section className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-sm text-neutral-400">Base image</span>
              <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
                {base ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={base.url} alt="base" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-neutral-600">no base</span>
                )}
              </div>
            </div>
            <ImportUploader shotId={shot.id} onChange={refresh} />
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-neutral-300">Results</h2>
            <ResultsGallery shotId={shot.id} images={shot.images} onChange={refresh} />
          </section>
        </>
      )}
    </main>
  );
}
