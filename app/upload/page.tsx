'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MultiDropzone } from '@/components/MultiDropzone';
import { parseShotFromFilename } from '@/lib/format';

type Mode = 'generate' | 'import';

export default function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<Mode>('generate');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const createShots = async () => {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    setDone(0);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('mode', mode);
        fd.append('base', file, file.name);
        const r = await fetch('/api/shots', { method: 'POST', body: fd });
        if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
        setDone((d) => d + 1);
      }
      router.push('/');
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Upload base images</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Each base image becomes a shot named after its file — e.g. <code className="text-neutral-300">shot 6.jpg</code> becomes
        Shot 6. Files without a number get the next sequential number. Pick how this batch should be handled.
      </p>

      <div className="mb-6 flex gap-3">
        {(
          [
            { id: 'generate', title: 'Generate now', desc: 'Build the shot: mannequin → model sources → outputs.' },
            { id: 'import', title: 'Upload existing', desc: 'Attach already-generated images to the shot later.' },
          ] as { id: Mode; title: string; desc: string }[]
        ).map((opt) => (
          <button
            key={opt.id}
            onClick={() => setMode(opt.id)}
            className={`flex-1 rounded-lg border p-4 text-left transition ${
              mode === opt.id
                ? 'border-blue-600 bg-blue-950/30'
                : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-600'
            }`}
          >
            <div className="text-sm font-medium">{opt.title}</div>
            <div className="mt-1 text-xs text-neutral-500">{opt.desc}</div>
          </button>
        ))}
      </div>

      <MultiDropzone files={files} onChange={setFiles} />

      {error && (
        <div className="mt-4 rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</div>
      )}

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={createShots}
          disabled={busy || files.length === 0}
          className="rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white shadow hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {(() => {
            if (busy) {
              const current = parseShotFromFilename(files[done]?.name || '').name;
              return `Creating ${current || 'shot'} (${done + 1}/${files.length})…`;
            }
            if (files.length === 0) return 'Create shots';
            const names = files.map((f) => parseShotFromFilename(f.name).name || 'untitled');
            if (names.length === 1) return `Create ${names[0]}`;
            const head = names.slice(0, 3).join(', ');
            return `Create ${head}${names.length > 3 ? ` +${names.length - 3} more` : ''}`;
          })()}
        </button>
        <span className="text-xs text-neutral-500">Mode: {mode === 'generate' ? 'Generate now' : 'Upload existing'}</span>
      </div>
    </main>
  );
}
