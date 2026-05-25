// Cleanup old objects in the Cloudflare R2 bucket (dw-images).
//
// Lists every object older than the cutoff (default: 3 months), writes a
// manifest of them, and ONLY deletes when you explicitly pass --delete.
//
// Usage (run from the project root):
//   node --env-file=.env scripts/cleanup-r2.mjs                 # dry run: list + write manifest, delete nothing
//   node --env-file=.env scripts/cleanup-r2.mjs --months=3      # change the age cutoff
//   node --env-file=.env scripts/cleanup-r2.mjs --prefix=foo/   # only consider keys under a prefix
//   node --env-file=.env scripts/cleanup-r2.mjs --delete        # actually delete (after reviewing the manifest)
//
// The manifest is written to scripts/deleted-manifest.json (and .csv). Each
// entry has the object key, its public URL, size, and last-modified date so
// you can match it against your Supabase rows later.

import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- args ----
const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const getOpt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};

const DELETE = hasFlag('delete');
const MONTHS = Number(getOpt('months', '3'));
const PREFIX = getOpt('prefix', undefined);

// ---- env ----
const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  VITE_R2_PUBLIC_URL,
} = process.env;

for (const [k, v] of Object.entries({
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
})) {
  if (!v) {
    console.error(`Missing ${k}. Run with: node --env-file=.env scripts/cleanup-r2.mjs`);
    process.exit(1);
  }
}

const publicBase = (VITE_R2_PUBLIC_URL || '').replace(/\/+$/, '');

// Cutoff = now minus MONTHS calendar months.
const cutoff = new Date();
cutoff.setMonth(cutoff.getMonth() - MONTHS);

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

console.log(`Bucket:        ${R2_BUCKET_NAME}`);
console.log(`Cutoff:        objects modified before ${cutoff.toISOString()} (${MONTHS} months ago)`);
if (PREFIX) console.log(`Prefix:        ${PREFIX}`);
console.log(`Mode:          ${DELETE ? 'DELETE (objects will be removed!)' : 'DRY RUN (nothing deleted)'}`);
console.log('');

// ---- scan ----
let scanned = 0;
let totalBytes = 0;
const old = []; // { key, url, size, lastModified }
let continuationToken;

do {
  const res = await s3.send(
    new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: PREFIX,
      ContinuationToken: continuationToken,
    }),
  );
  for (const obj of res.Contents || []) {
    scanned++;
    if (obj.LastModified && obj.LastModified < cutoff) {
      const key = obj.Key;
      old.push({
        key,
        url: publicBase ? `${publicBase}/${encodeURI(key)}` : null,
        size: obj.Size,
        lastModified: obj.LastModified.toISOString(),
      });
      totalBytes += obj.Size || 0;
    }
  }
  continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
} while (continuationToken);

const mb = (totalBytes / (1024 * 1024)).toFixed(1);
console.log(`Scanned ${scanned} objects. ${old.length} are older than the cutoff (${mb} MB).`);

// ---- manifest ----
const manifestJson = join(__dirname, 'deleted-manifest.json');
const manifestCsv = join(__dirname, 'deleted-manifest.csv');

writeFileSync(
  manifestJson,
  JSON.stringify(
    {
      bucket: R2_BUCKET_NAME,
      cutoff: cutoff.toISOString(),
      months: MONTHS,
      generatedAt: new Date().toISOString(),
      deleted: DELETE,
      count: old.length,
      totalBytes,
      objects: old,
    },
    null,
    2,
  ),
);

const csvEscape = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
writeFileSync(
  manifestCsv,
  ['key,url,size,lastModified']
    .concat(old.map((o) => [o.key, o.url, o.size, o.lastModified].map(csvEscape).join(',')))
    .join('\n'),
);

console.log(`Manifest written:\n  ${manifestJson}\n  ${manifestCsv}`);

if (old.length === 0) {
  console.log('Nothing to delete.');
  process.exit(0);
}

if (!DELETE) {
  console.log('\nDRY RUN complete. Review the manifest, then re-run with --delete to remove these objects.');
  process.exit(0);
}

// ---- delete (batches of up to 1000) ----
let deleted = 0;
for (let i = 0; i < old.length; i += 1000) {
  const batch = old.slice(i, i + 1000);
  const res = await s3.send(
    new DeleteObjectsCommand({
      Bucket: R2_BUCKET_NAME,
      Delete: { Objects: batch.map((o) => ({ Key: o.key })), Quiet: true },
    }),
  );
  deleted += batch.length - (res.Errors?.length || 0);
  for (const err of res.Errors || []) {
    console.error(`  failed: ${err.Key} -> ${err.Code} ${err.Message}`);
  }
  console.log(`Deleted ${Math.min(i + batch.length, old.length)}/${old.length}...`);
}

console.log(`\nDone. Deleted ${deleted} objects. Use deleted-manifest.json to clean up matching Supabase rows.`);
