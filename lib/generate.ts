// Server-only helpers bridging stored R2 images and RunningHub generation.
import sharp from 'sharp';
import { uploadImage, submitAndFetch, type NodeInfo } from './runninghub';

// RunningHub's upload endpoint rejects files over 10MB. Generated images (PNGs)
// often exceed that, so recompress oversized inputs to JPEG before uploading.
const RH_UPLOAD_LIMIT = 9.5 * 1024 * 1024;

async function fitForRunningHub(
  buf: Buffer,
  contentType: string,
  name: string,
): Promise<{ buffer: Buffer; contentType: string; name: string }> {
  if (buf.byteLength <= RH_UPLOAD_LIMIT) return { buffer: buf, contentType, name };
  const baseName = name.replace(/\.[^.]+$/, '');
  for (const [maxWidth, quality] of [[null, 90], [null, 80], [2560, 85], [2048, 80], [1536, 75]] as const) {
    let pipeline = sharp(buf).rotate();
    if (maxWidth) pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
    const out = await pipeline.jpeg({ quality }).toBuffer();
    if (out.byteLength <= RH_UPLOAD_LIMIT) {
      return { buffer: out, contentType: 'image/jpeg', name: `${baseName}.jpg` };
    }
  }
  // Last resort: smallest reasonable rendition.
  const out = await sharp(buf).rotate().resize({ width: 1280, withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
  return { buffer: out, contentType: 'image/jpeg', name: `${baseName}.jpg` };
}

// RunningHub occasionally returns a transient task-status error (code 805,
// APIKEY_TASK_STATUS_ERROR) early in a task's life. Re-submitting as a fresh
// task succeeds, so retry a bounded number of times on transient failures only.
function isTransient(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  return /code 805|APIKEY_TASK_STATUS_ERROR|did not complete within/.test(m);
}

export async function submitWithRetry(
  workflowId: string,
  nodeInfoList: NodeInfo[],
  signal?: AbortSignal,
  attempts = 3,
): Promise<{ buffer: Buffer; contentType: string; fileUrl: string; taskId: string }> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await submitAndFetch(workflowId, nodeInfoList, signal);
    } catch (err) {
      lastErr = err;
      if (signal?.aborted || !isTransient(err) || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw lastErr;
}

// Download an image stored in R2 (public URL) and upload it to RunningHub,
// returning the RunningHub fileName to use as a NodeInfo fieldValue.
export async function r2ToRunningHub(
  url: string,
  contentType: string | null,
  name: string,
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch R2 image (${res.status})`);
  const raw = Buffer.from(await res.arrayBuffer());
  const fitted = await fitForRunningHub(raw, contentType || 'image/png', name);
  const bytes = new Uint8Array(fitted.buffer.byteLength);
  bytes.set(fitted.buffer);
  const file = new File([bytes], fitted.name, { type: fitted.contentType });
  return uploadImage(file, fitted.name);
}
