'use client';

import { useState } from 'react';
import { MultiDropzone } from './MultiDropzone';
import type { Source } from '@/lib/db';

export function SourcesManager({ initial }: { initial: Source[] }) {
  const [sources, setSources] = useState<Source[]>(initial);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const j = await (await fetch('/api/sources', { cache: 'no-store' })).json();
    setSources(j.sources || []);
  };

  const upload = async () => {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    setDone(0);
    try {
      for (const f of files) {
        const fd = new FormData();
        fd.append('file', f, f.name);
        const r = await fetch('/api/sources', { method: 'POST', body: fd });
        if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
        setDone((d) => d + 1);
      }
      setFiles([]);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this source from the library? Shots already using it keep their reference.')) return;
    await fetch(`/api/sources/${id}`, { method: 'DELETE' });
    await refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      {sources.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {sources.map((src) => (
            <div key={src.id} className="group relative overflow-hidden rounded-md border border-neutral-800 bg-neutral-950">
              <div className="flex aspect-[4/5] items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src.url} alt={src.name ?? 'source'} className="h-full w-full object-cover" />
              </div>
              <span className="block truncate px-1.5 py-1 text-[10px] text-neutral-400" title={src.name ?? ''}>
                {src.name ?? 'untitled'}
              </span>
              <button
                onClick={() => remove(src.id)}
                className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-neutral-200 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-300">Add sources</h2>
        <MultiDropzone files={files} onChange={setFiles} />
        {error && <div className="mt-3 text-xs text-red-400">{error}</div>}
        <button
          onClick={upload}
          disabled={busy || files.length === 0}
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? `Uploading ${done}/${files.length}…` : `Add ${files.length || ''} source${files.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}
