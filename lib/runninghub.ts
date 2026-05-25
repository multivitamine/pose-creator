import { RUNNINGHUB_BASE_URL, RUNNINGHUB_UPLOAD_URL } from './defaults';

export type NodeInfo = {
  nodeId: string;
  fieldName: string;
  fieldValue: string | number;
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 120;

function apiKey(): string {
  const key = (process.env.RUNNINGHUB_API_KEY || '').trim();
  if (!key) throw new Error('RUNNINGHUB_API_KEY is not set in .env.local');
  return key;
}

export async function uploadImage(file: File, filename?: string): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds RunningHub 10MB upload limit (${buf.byteLength} bytes)`);
  }

  const form = new FormData();
  form.append('apiKey', apiKey());
  form.append('fileType', 'image');
  form.append(
    'file',
    new Blob([buf], { type: 'application/octet-stream' }),
    filename || file.name || 'upload.png',
  );

  const res = await fetch(`${RUNNINGHUB_UPLOAD_URL}/task/openapi/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`Upload HTTP ${res.status}: ${await res.text()}`);
  const payload = await res.json();
  if (payload.code !== 0 && payload.code != null) {
    throw new Error(`Upload failed: ${payload.msg || JSON.stringify(payload)}`);
  }
  const fileName = payload?.data?.fileName;
  if (!fileName) throw new Error(`Upload returned no fileName: ${JSON.stringify(payload)}`);
  return fileName as string;
}

export async function accountStatus(): Promise<{ currentTaskCounts: number; raw: unknown }> {
  const res = await fetch(`${RUNNINGHUB_BASE_URL}/uc/openapi/accountStatus`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ apikey: apiKey() }),
  });
  if (!res.ok) throw new Error(`Status HTTP ${res.status}: ${await res.text()}`);
  const payload = await res.json();
  if (payload.code !== 0) throw new Error(payload.msg || JSON.stringify(payload));
  const data = payload.data || {};
  return { currentTaskCounts: Number(data.currentTaskCounts || 0), raw: data };
}

// Create a RunningHub task and return its taskId (no polling). When webhookUrl
// is provided, RunningHub will POST to it on completion.
export async function createTask(
  workflowId: string,
  nodeInfoList: NodeInfo[],
  webhookUrl?: string,
): Promise<string> {
  const body: Record<string, unknown> = { apiKey: apiKey(), workflowId, nodeInfoList };
  if (webhookUrl) body.webhookUrl = webhookUrl;
  const res = await fetch(`${RUNNINGHUB_BASE_URL}/task/openapi/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Create HTTP ${res.status}: ${await res.text()}`);
  const payload = await res.json();
  if (payload.code !== 0) throw new Error(`create task failed: ${payload.msg || JSON.stringify(payload)}`);
  const taskId = payload?.data?.taskId;
  if (!taskId) throw new Error(`create returned no taskId: ${JSON.stringify(payload)}`);
  return String(taskId);
}

export type TaskOutcome =
  | { state: 'running' }
  | { state: 'done'; fileUrl: string }
  | { state: 'error'; message: string };

// Single non-blocking check of a task's status/output. Used by the webhook
// handler and the reconcile fallback (no internal looping/sleeping).
export async function fetchTaskOutput(taskId: string): Promise<TaskOutcome> {
  const res = await fetch(`${RUNNINGHUB_BASE_URL}/task/openapi/outputs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ apiKey: apiKey(), taskId }),
  });
  if (!res.ok) throw new Error(`Outputs HTTP ${res.status}: ${await res.text()}`);
  const payload = await res.json();
  const code = payload.code;
  const msg = payload.msg || '';
  const data = payload.data;

  if (msg === 'APIKEY_TASK_IS_QUEUED' || msg === 'APIKEY_TASK_IS_RUNNING') return { state: 'running' };
  if (code === 0 && Array.isArray(data) && data.length > 0) {
    const url = data[0].fileUrl || data[0].url;
    if (!url) return { state: 'error', message: 'output has no fileUrl' };
    return { state: 'done', fileUrl: url as string };
  }
  if (code === 0 && Array.isArray(data) && data.length === 0) return { state: 'error', message: 'completed with no outputs' };
  if (code === 0 && data == null) return { state: 'running' };
  if (code != null && code !== 0) return { state: 'error', message: `code ${code}: ${msg}` };
  return { state: 'running' };
}

async function pollOutputs(taskId: string, signal?: AbortSignal): Promise<string> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    if (signal?.aborted) throw new Error('Aborted');
    await sleep(POLL_INTERVAL_MS);
    if (signal?.aborted) throw new Error('Aborted');

    const res = await fetch(`${RUNNINGHUB_BASE_URL}/task/openapi/outputs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey(), taskId }),
    });
    if (!res.ok) throw new Error(`Outputs HTTP ${res.status}: ${await res.text()}`);
    const payload = await res.json();
    const code = payload.code;
    const msg = payload.msg || '';
    const data = payload.data;

    if (msg === 'APIKEY_TASK_IS_QUEUED' || msg === 'APIKEY_TASK_IS_RUNNING') continue;
    if (code === 0 && Array.isArray(data) && data.length > 0) {
      const first = data[0];
      const url = first.fileUrl || first.url;
      if (!url) throw new Error(`Task ${taskId} output has no fileUrl: ${JSON.stringify(first)}`);
      return url as string;
    }
    if (code === 0 && Array.isArray(data) && data.length === 0) {
      throw new Error(`Task ${taskId} completed with no outputs`);
    }
    if (code === 0 && data == null) continue;
    if (code != null && code !== 0) {
      throw new Error(`RunningHub task failed (code ${code}): ${msg || JSON.stringify(payload)}`);
    }
  }
  throw new Error(`RunningHub task ${taskId} did not complete within 10 minutes`);
}

export async function submitAndFetch(
  workflowId: string,
  nodeInfoList: NodeInfo[],
  signal?: AbortSignal,
): Promise<{ buffer: Buffer; contentType: string; fileUrl: string; taskId: string }> {
  const taskId = await createTask(workflowId, nodeInfoList);
  const fileUrl = await pollOutputs(taskId, signal);

  const res = await fetch(fileUrl, { signal });
  if (!res.ok) throw new Error(`Result fetch HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') || 'image/png';
  const buf = Buffer.from(await res.arrayBuffer());
  return { buffer: buf, contentType, fileUrl, taskId };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
