// Server-only Cloudflare R2 access (S3-compatible). Uploads image buffers and
// returns their public URL; deletes keys on cascade. Never import client-side.
import { S3Client, PutObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.R2_BUCKET_NAME || 'dw-images';
const PUBLIC_BASE = (process.env.VITE_R2_PUBLIC_URL || '').replace(/\/+$/, '');

let s3: S3Client | null = null;
function client(): S3Client {
  if (s3) return s3;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 env vars missing (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)');
  }
  s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  return s3;
}

export function publicUrl(key: string): string {
  return `${PUBLIC_BASE}/${encodeURI(key)}`;
}

export function extFromContentType(contentType?: string): string {
  switch ((contentType || '').toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'png';
  }
}

// Key scheme: shots/{shotId}/{role}/{uuid}.{ext}
export function shotImageKey(shotId: string, role: string, ext: string): string {
  return `shots/${shotId}/${role}/${crypto.randomUUID()}.${ext}`;
}

// Reusable source-library key: library/sources/{uuid}.{ext}
export function sourceLibraryKey(ext: string): string {
  return `library/sources/${crypto.randomUUID()}.${ext}`;
}

export async function uploadBuffer(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<{ key: string; url: string }> {
  await client().send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
  return { key, url: publicUrl(key) };
}

export async function deleteKeys(keys: string[]): Promise<void> {
  const list = keys.filter(Boolean);
  if (list.length === 0) return;
  // DeleteObjects handles up to 1000 keys per call.
  for (let i = 0; i < list.length; i += 1000) {
    await client().send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: list.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
}
