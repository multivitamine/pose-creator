// Server-only data layer over Supabase for shots and images.
import { getSupabase } from './supabase';
import { deleteKeys } from './r2';
import { DEFAULT_SINGLE_PROMPT, DEFAULT_DOUBLE_PROMPT } from './defaults';

export type ShotStatus =
  | 'base_uploaded'
  | 'needs_mannequin'
  | 'needs_model_sources'
  | 'ready_to_generate'
  | 'generating'
  | 'ready_for_review'
  | 'completed';

export type ImageRole = 'base' | 'mannequin' | 'model_source' | 'generated' | 'imported';
export type ModelSlot = 'A' | 'B';
export type ShotMode = 'generate' | 'import';

export type Shot = {
  id: string;
  number: number;
  name: string | null;
  mode: ShotMode;
  status: ShotStatus;
  created_at: string;
  updated_at: string;
};

export type ShotImage = {
  id: string;
  shot_id: string;
  role: ImageRole;
  slot: ModelSlot | null;
  variation_index: number | null;
  source_image_id: string | null;
  r2_key: string;
  url: string;
  content_type: string | null;
  task_id: string | null;
  selected: boolean;
  created_at: string;
};

export type ShotWithImages = Shot & { images: ShotImage[] };

const SHOTS = 'rh_shots';
const IMAGES = 'rh_images';
const SETTINGS = 'rh_settings';
const SOURCES = 'rh_sources';

// Only objects this app owns (shots/...) are deletable on cascade. Shared
// library images (library/...) referenced by a shot must never be removed here.
function ownedKeys(keys: string[]): string[] {
  return keys.filter((k) => k.startsWith('shots/'));
}

export type Settings = {
  mannequin_prompt: string;
  output_prompt: string;
  default_aspect: string;
  default_resolution: string;
};

// Read the single settings row, lazily seeding it from the code defaults on first access.
export async function getSettings(): Promise<Settings> {
  const sb = getSupabase();
  const { data, error } = await sb.from(SETTINGS).select('*').eq('id', 1).maybeSingle();
  if (error) throw new Error(error.message);
  let row = data as Partial<Settings> | null;
  if (!row) {
    const seed = { id: 1, mannequin_prompt: DEFAULT_SINGLE_PROMPT, output_prompt: DEFAULT_DOUBLE_PROMPT };
    const { data: inserted, error: insErr } = await sb.from(SETTINGS).insert(seed).select('*').single();
    if (insErr) throw new Error(insErr.message);
    row = inserted as Partial<Settings>;
  }
  return {
    mannequin_prompt: row.mannequin_prompt?.trim() || DEFAULT_SINGLE_PROMPT,
    output_prompt: row.output_prompt?.trim() || DEFAULT_DOUBLE_PROMPT,
    default_aspect: row.default_aspect || '4:5',
    default_resolution: row.default_resolution || '2K',
  };
}

export async function updateSettings(fields: Partial<Settings>): Promise<Settings> {
  const sb = getSupabase();
  await getSettings(); // ensure the row exists
  const { error } = await sb
    .from(SETTINGS)
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) throw new Error(error.message);
  return getSettings();
}

// ---- source library (reusable model sources) ----

export type Source = {
  id: string;
  name: string | null;
  r2_key: string;
  url: string;
  content_type: string | null;
  created_at: string;
};

export async function listSources(): Promise<Source[]> {
  const { data, error } = await getSupabase().from(SOURCES).select('*').order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Source[];
}

export async function getSource(id: string): Promise<Source | null> {
  const { data, error } = await getSupabase().from(SOURCES).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Source) ?? null;
}

export async function createSource(src: {
  name?: string | null;
  r2_key: string;
  url: string;
  content_type?: string | null;
}): Promise<Source> {
  const { data, error } = await getSupabase().from(SOURCES).insert(src).select('*').single();
  if (error) throw new Error(error.message);
  return data as Source;
}

export async function deleteSource(id: string): Promise<void> {
  const src = await getSource(id);
  if (!src) return;
  await deleteKeys([src.r2_key]); // explicit library management may delete library/ objects
  const { error } = await getSupabase().from(SOURCES).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---- generation jobs (durable queue) ----

const JOBS = 'rh_jobs';

export type JobKind = 'mannequin' | 'output';
export type JobStatus = 'running' | 'done' | 'error';

export type Job = {
  id: string;
  shot_id: string;
  kind: JobKind;
  slot: ModelSlot | null;
  variation_index: number | null;
  source_image_id: string | null;
  task_id: string | null;
  status: JobStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type NewJob = {
  shot_id: string;
  kind: JobKind;
  task_id: string;
  slot?: ModelSlot | null;
  variation_index?: number | null;
  source_image_id?: string | null;
};

export async function createJob(job: NewJob): Promise<Job> {
  const { data, error } = await getSupabase().from(JOBS).insert(job).select('*').single();
  if (error) throw new Error(error.message);
  return data as Job;
}

export async function getJobByTaskId(taskId: string): Promise<Job | null> {
  const { data, error } = await getSupabase().from(JOBS).select('*').eq('task_id', taskId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Job) ?? null;
}

export async function listRunningJobsForShot(shotId: string): Promise<Job[]> {
  const { data, error } = await getSupabase()
    .from(JOBS)
    .select('*')
    .eq('shot_id', shotId)
    .eq('status', 'running')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Job[];
}

export async function countRunningJobs(shotId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from(JOBS)
    .select('id', { count: 'exact', head: true })
    .eq('shot_id', shotId)
    .eq('status', 'running');
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function updateJob(id: string, fields: Partial<Pick<Job, 'status' | 'error'>>): Promise<void> {
  const { error } = await getSupabase()
    .from(JOBS)
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// Next output variation index for a slot, counting both stored images and queued jobs.
export async function nextVariationIndex(shotId: string, slot: ModelSlot): Promise<number> {
  const images = await getShotImages(shotId);
  const fromImages = images
    .filter((i) => i.role === 'generated' && i.slot === slot)
    .reduce((m, i) => Math.max(m, i.variation_index ?? 0), 0);
  const { data, error } = await getSupabase()
    .from(JOBS)
    .select('variation_index')
    .eq('shot_id', shotId)
    .eq('slot', slot)
    .eq('kind', 'output');
  if (error) throw new Error(error.message);
  const fromJobs = (data ?? []).reduce((m: number, j: { variation_index: number | null }) => Math.max(m, j.variation_index ?? 0), 0);
  return Math.max(fromImages, fromJobs) + 1;
}

// ---- shots ----

export async function listShots(): Promise<Shot[]> {
  const { data, error } = await getSupabase().from(SHOTS).select('*').order('number', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Shot[];
}

export async function listShotsWithImages(): Promise<ShotWithImages[]> {
  const shots = await listShots();
  if (shots.length === 0) return [];
  const { data, error } = await getSupabase()
    .from(IMAGES)
    .select('*')
    .in('shot_id', shots.map((s) => s.id));
  if (error) throw new Error(error.message);
  const byShot = new Map<string, ShotImage[]>();
  for (const img of (data ?? []) as ShotImage[]) {
    (byShot.get(img.shot_id) ?? byShot.set(img.shot_id, []).get(img.shot_id)!).push(img);
  }
  return shots.map((s) => ({ ...s, images: byShot.get(s.id) ?? [] }));
}

export async function getShot(id: string): Promise<Shot | null> {
  const { data, error } = await getSupabase().from(SHOTS).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Shot) ?? null;
}

export async function getShotWithImages(id: string): Promise<ShotWithImages | null> {
  const shot = await getShot(id);
  if (!shot) return null;
  const images = await getShotImages(id);
  return { ...shot, images };
}

async function nextShotNumber(): Promise<number> {
  const { data, error } = await getSupabase()
    .from(SHOTS)
    .select('number')
    .order('number', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return ((data?.[0]?.number as number | undefined) ?? 0) + 1;
}

export async function createShot(opts: { mode: ShotMode; name?: string; number?: number }): Promise<Shot> {
  const number = opts.number ?? (await nextShotNumber());
  const { data, error } = await getSupabase()
    .from(SHOTS)
    .insert({ number, mode: opts.mode, name: opts.name ?? null, status: 'base_uploaded' })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Shot;
}

export async function updateShot(
  id: string,
  fields: Partial<Pick<Shot, 'name' | 'status'>>,
): Promise<void> {
  const { error } = await getSupabase()
    .from(SHOTS)
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteShot(id: string): Promise<void> {
  const images = await getShotImages(id);
  await deleteKeys(ownedKeys(images.map((i) => i.r2_key)));
  const { error } = await getSupabase().from(SHOTS).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---- images ----

export async function getShotImages(shotId: string): Promise<ShotImage[]> {
  const { data, error } = await getSupabase()
    .from(IMAGES)
    .select('*')
    .eq('shot_id', shotId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ShotImage[];
}

export type NewImage = {
  shot_id: string;
  role: ImageRole;
  r2_key: string;
  url: string;
  content_type?: string | null;
  slot?: ModelSlot | null;
  variation_index?: number | null;
  source_image_id?: string | null;
  task_id?: string | null;
};

export async function insertImage(img: NewImage): Promise<ShotImage> {
  const { data, error } = await getSupabase().from(IMAGES).insert(img).select('*').single();
  if (error) throw new Error(error.message);
  return data as ShotImage;
}

export async function deleteImage(id: string): Promise<{ shot_id: string }> {
  const { data: img, error: e1 } = await getSupabase()
    .from(IMAGES)
    .select('r2_key, shot_id')
    .eq('id', id)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (!img) throw new Error('image not found');
  await deleteKeys(ownedKeys([img.r2_key as string]));
  const { error } = await getSupabase().from(IMAGES).delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { shot_id: img.shot_id as string };
}

export async function setSelected(id: string, selected: boolean): Promise<{ shot_id: string }> {
  const { data, error } = await getSupabase()
    .from(IMAGES)
    .update({ selected })
    .eq('id', id)
    .select('shot_id')
    .single();
  if (error) throw new Error(error.message);
  return { shot_id: data.shot_id as string };
}

// Replace the existing mannequin (regeneration): delete old mannequin rows + R2 objects.
export async function clearRole(shotId: string, role: ImageRole, slot?: ModelSlot): Promise<void> {
  let query = getSupabase().from(IMAGES).select('id, r2_key').eq('shot_id', shotId).eq('role', role);
  if (slot) query = query.eq('slot', slot);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; r2_key: string }[];
  if (rows.length === 0) return;
  await deleteKeys(ownedKeys(rows.map((r) => r.r2_key)));
  const { error: delErr } = await getSupabase().from(IMAGES).delete().in('id', rows.map((r) => r.id));
  if (delErr) throw new Error(delErr.message);
}

// ---- status derivation ----

// Derive a shot's status from the images present. 'generating' is set explicitly
// by the outputs route during a run and is not produced here.
export function deriveStatus(mode: ShotMode, images: ShotImage[]): ShotStatus {
  const has = (r: ImageRole) => images.some((i) => i.role === r);
  const anySelected = images.some((i) => i.selected);
  const resultCount = images.filter((i) => i.role === 'generated' || i.role === 'imported').length;

  if (mode === 'import') {
    if (resultCount === 0) return 'base_uploaded';
    return anySelected ? 'completed' : 'ready_for_review';
  }

  // Results take precedence: once outputs exist the shot is reviewable.
  if (resultCount > 0) return anySelected ? 'completed' : 'ready_for_review';
  if (!has('mannequin')) return 'needs_mannequin';
  const modelSources = images.filter((i) => i.role === 'model_source').length;
  if (modelSources === 0) return 'needs_model_sources';
  return 'ready_to_generate';
}

export async function recomputeStatus(shotId: string): Promise<ShotStatus> {
  const shot = await getShot(shotId);
  if (!shot) throw new Error('shot not found');
  // Any running job keeps the shot in 'generating'.
  if ((await countRunningJobs(shotId)) > 0) {
    await updateShot(shotId, { status: 'generating' });
    return 'generating';
  }
  const images = await getShotImages(shotId);
  const status = deriveStatus(shot.mode, images);
  await updateShot(shotId, { status });
  return status;
}

export async function listSelectedImages(): Promise<(ShotImage & { shot_number: number; shot_name: string | null })[]> {
  const shots = await listShots();
  const byId = new Map(shots.map((s) => [s.id, s]));
  const { data, error } = await getSupabase()
    .from(IMAGES)
    .select('*')
    .eq('selected', true)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ShotImage[]).map((img) => ({
    ...img,
    shot_number: byId.get(img.shot_id)?.number ?? 0,
    shot_name: byId.get(img.shot_id)?.name ?? null,
  }));
}
