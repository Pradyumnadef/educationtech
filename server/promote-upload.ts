import {
  S3Client,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { run } from "./db.ts";
const s3 = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: !!process.env.S3_ENDPOINT,
});
// A signed PUT can be replayed until it expires. Approved media must therefore
// move to a different key. The ETag condition binds approval to scanned bytes.
export async function promoteUpload(row: any, scannedEtag: string) {
  if (!row.storage_key.startsWith("quarantine/") || !scannedEtag)
    throw new Error("Invalid quarantine object.");
  const key = `media/${row.id}`;
  await s3.send(
    new CopyObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      CopySource: `${process.env.S3_BUCKET}/${row.storage_key}`,
      CopySourceIfMatch: scannedEtag,
      ContentType: row.mime,
      MetadataDirective: "REPLACE",
    }),
  );
  await run(
    "UPDATE uploads SET state='ready',storage_key=? WHERE id=? AND state='scanning'",
    [key, row.id],
  );
  await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: row.storage_key,
    }),
  );
  return key;
}
