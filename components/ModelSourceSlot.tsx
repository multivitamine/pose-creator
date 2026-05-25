'use client';

import { useRef, useState } from 'react';
import type { ShotImage, Source } from '@/lib/db';

type Props = {
  shotId: string;
  slot: 'A' | 'B';
  image?: ShotImage;
  sources: Source[];
  onChange: () => void | Promise<void>;
};

export function ModelSourceSlot({ shotId, slot, image, sources, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (body: FormData) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/shots/${shotId}/images`, { method: 'POST', body });
      if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
      setPicking(false);
      await onChange();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const uploadFile = (file: File) => {
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('role', 'model_source');
    fd.append('slot', slot);
    return send(fd);
  };

  const pickSource = (sourceId: string) => {
    const fd = new FormData();
    fd.append('sourceId', sourceId);
    fd.append('role', 'model_source');
    fd.append('slot', slot);
    return send(fd);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-400">Model source {slot}</span>
        <div className="flex gap-3 text-xs text-neutral-500">
          {sources.length > 0 && (
            <button onClick={() => setPicking((v) => !v)} className="hover:text-neutral-200">
              {picking ? 'cancel' : 'from library'}
            </button>
          )}
          {image && (
            <button onClick={() => inputRef.current?.click()} className="hover:text-neutral-200">
              upload
            </button>
          )}
        </div>
      </div>

      {picking ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-2">
          {sources.length === 0 ? (
            <p className="p-3 text-xs text-neutral-500">No sources in the library yet.</p>
          ) : (
            <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
              {sources.map((src) => (
                <button
                  key={src.id}
                  onClick={() => pickSource(src.id)}
                  disabled={busy}
                  className="group overflow-hidden rounded border border-neutral-800 hover:border-blue-500 disabled:opacity-50"
                  title={src.name ?? ''}
                >
                  <span className="flex aspect-[4/5] items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src.url} alt={src.name ?? 'source'} className="h-full w-full object-cover" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => !busy && inputRef.current?.click()}
          className="flex aspect-[4/5] cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-neutral-700 bg-neutral-950 hover:border-neutral-500"
        >
          {busy ? (
            <span className="text-xs text-neutral-500">saving…</span>
          ) : image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image.url} alt={`model ${slot}`} className="h-full w-full object-cover" />
          ) : (
            <span className="text-center text-xs text-neutral-500">
              click to upload
              <br />
              model source {slot}
              {sources.length > 0 && (
                <>
                  <br />
                  <span className="text-neutral-600">or “from library” above</span>
                </>
              )}
            </span>
          )}
        </div>
      )}

      {error && <span className="text-xs text-red-400">{error}</span>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadFile(f);
          if (inputRef.current) inputRef.current.value = '';
        }}
      />
    </div>
  );
}
