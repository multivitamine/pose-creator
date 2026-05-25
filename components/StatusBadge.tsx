import type { ShotStatus } from '@/lib/db';

// Pipeline order, used by the overview status filter.
export const STATUS_ORDER: ShotStatus[] = [
  'base_uploaded',
  'needs_mannequin',
  'needs_model_sources',
  'ready_to_generate',
  'generating',
  'ready_for_review',
  'completed',
];

export function statusLabel(status: ShotStatus): string {
  return MAP[status].label;
}

const MAP: Record<ShotStatus, { label: string; className: string }> = {
  base_uploaded: { label: 'Base uploaded', className: 'bg-neutral-800 text-neutral-300' },
  needs_mannequin: { label: 'Needs mannequin', className: 'bg-amber-950 text-amber-300 border border-amber-900' },
  needs_model_sources: { label: 'Needs model sources', className: 'bg-amber-950 text-amber-300 border border-amber-900' },
  ready_to_generate: { label: 'Ready to generate', className: 'bg-blue-950 text-blue-300 border border-blue-900' },
  generating: { label: 'Generating…', className: 'bg-blue-900/60 text-blue-200 border border-blue-700 animate-pulse' },
  ready_for_review: { label: 'Ready for review', className: 'bg-violet-950 text-violet-300 border border-violet-900' },
  completed: { label: 'Completed', className: 'bg-green-950 text-green-300 border border-green-900' },
};

export function StatusBadge({ status }: { status: ShotStatus }) {
  const { label, className } = MAP[status];
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {label}
    </span>
  );
}
