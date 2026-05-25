'use client';

import { useState } from 'react';
import { MultiDropzone } from './MultiDropzone';

export function ImportUploader({ shotId, onChange }: { shotId: string; onChange: () => void | Promise<void> }) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = async () => {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    setDone(0);
    try {
      for (const f of files) {
        const fd = new FormData();
        fd.append('file', f, f.name);
        fd.append('role', 'imported');
        const r = await fetch(`/api/shots/${shotId}/images`, { method: 'POST', body: fd });
        if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
        setDone((d) => d + 1);
      }
      setFiles([]);
      await onChange();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <h2 className="mb-3 text-sm font-medium text-neutral-300">Upload existing generated images</h2>
      <MultiDropzone files={files} onChange={setFiles} />
      {error && <div className="mt-3 text-xs text-red-400">{error}</div>}
      <button
        onClick={upload}
        disabled={busy || files.length === 0}
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? `Uploading ${done}/${files.length}…` : `Add ${files.length || ''} image${files.length === 1 ? '' : 's'}`}
      </button>
    </div>
  );
}
