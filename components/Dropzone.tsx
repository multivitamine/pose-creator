'use client';

import { useCallback, useRef, useState } from 'react';

type Props = {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
};

export function Dropzone({ label, file, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const setFile = useCallback(
    (f: File | null) => {
      onChange(f);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(f ? URL.createObjectURL(f) : null);
    },
    [onChange, previewUrl],
  );

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm text-neutral-400">{label}</label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) setFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex h-56 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition ${
          dragging ? 'border-blue-400 bg-blue-500/5' : 'border-neutral-700 hover:border-neutral-500'
        }`}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="preview" className="max-h-full max-w-full rounded object-contain" />
        ) : (
          <div className="text-center text-sm text-neutral-500">
            <div>Drop an image here</div>
            <div className="text-xs">or click to select</div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </div>
      {file && (
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span className="truncate">{file.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setFile(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="text-neutral-400 hover:text-red-400"
          >
            clear
          </button>
        </div>
      )}
    </div>
  );
}
