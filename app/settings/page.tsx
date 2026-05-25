import { getSettings } from '@/lib/db';
import { SettingsForm } from '@/components/SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Prompts and defaults used for generation. Changes apply to future generations across all shots.
      </p>
      <SettingsForm initial={settings} />
    </main>
  );
}
