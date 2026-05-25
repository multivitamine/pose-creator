'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
};

export function MultiDropzone({ files, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const add = useCallback(
    (incoming: FileList | null) => {
      if (!incoming) return;
      const imgs = Array.from(incoming).filter((f) => f.type.startsWith('image/'));
      if (imgs.length) onChange([...files, ...imgs]);
    },
    [files, onChange],
  );

  const removeAt = (idx: number) => onChange(files.filter((_, i) => i !== idx));

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex h-40 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition ${
          dragging ? 'border-blue-400 bg-blue-500/5' : 'border-neutral-700 hover:border-neutral-500'
        }`}
      >
        <div className="text-center text-sm text-neutral-500">
          <div>Drop base images here</div>
          <div className="text-xs">or click to select (multiple allowed)</div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            add(e.target.files);
            if (inputRef.current) inputRef.current.value = '';
          }}
        />
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {files.map((f, idx) => (
            <div key={idx} className="group relative overflow-hidden rounded-md border border-neutral-800 bg-neutral-950">
              <div className="flex aspect-square items-center justify-center">
                {previews[idx] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previews[idx]} alt={f.name} className="h-full w-full object-cover" />
                )}
              </div>
              <span className="block truncate px-1.5 py-1 text-[10px] text-neutral-400" title={f.name}>
                {f.name}
              </span>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-neutral-200 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
