'use client';

import { useState } from 'react';
import { ASPECT_RATIOS, RESOLUTIONS, DEFAULT_SINGLE_PROMPT, DEFAULT_DOUBLE_PROMPT } from '@/lib/defaults';
import type { Settings } from '@/lib/db';

export function SettingsForm({ initial }: { initial: Settings }) {
  const [s, setS] = useState<Settings>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setS((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      });
      if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
      setS((await r.json()).settings);
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const promptField = (
    label: string,
    hint: string,
    key: 'mannequin_prompt' | 'output_prompt',
    fallback: string,
  ) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-neutral-300">{label}</label>
        <button onClick={() => set(key, fallback)} className="text-xs text-neutral-500 hover:text-neutral-200">
          reset to default
        </button>
      </div>
      <p className="text-xs text-neutral-500">{hint}</p>
      <textarea
        value={s[key]}
        onChange={(e) => set(key, e.target.value)}
        rows={6}
        className="w-full rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm focus:border-neutral-600 focus:outline-none"
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {promptField(
        'Mannequin prompt',
        'Used when generating a mannequin from the base image (SINGLE workflow).',
        'mannequin_prompt',
        DEFAULT_SINGLE_PROMPT,
      )}
      {promptField(
        'Output prompt',
        'Used when reposing a model source onto the mannequin (DOUBLE workflow).',
        'output_prompt',
        DEFAULT_DOUBLE_PROMPT,
      )}

      <div className="grid max-w-md grid-cols-2 gap-4">
        <label className="flex flex-col gap-2 text-sm text-neutral-400">
          Default aspect ratio
          <select
            value={s.default_aspect}
            onChange={(e) => set('default_aspect', e.target.value)}
            className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-2 text-sm"
          >
            {ASPECT_RATIOS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-neutral-400">
          Default resolution
          <select
            value={s.default_resolution}
            onChange={(e) => set('default_resolution', e.target.value)}
            className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-2 text-sm"
          >
            {RESOLUTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</div>}

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white shadow hover:bg-blue-500 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span className="text-sm text-green-400">Saved.</span>}
      </div>
    </div>
  );
}
