import "dotenv/config";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createConnection } from "node:net";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  createWriteStream,
  createReadStream,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { query, run, initDB } from "./db.ts";
import { promoteUpload } from "./promote-upload.ts";
const exec = promisify(execFile);
const s3 = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: !!process.env.S3_ENDPOINT,
});
await initDB();
async function clamav(filename: string) {
  const socket = createConnection({
    host: process.env.CLAMAV_HOST || "clamav",
    port: Number(process.env.CLAMAV_PORT) || 3310,
  });
  socket.setTimeout(600000, () =>
    socket.destroy(new Error("Antivirus scan timed out.")),
  );
  const result = new Promise<string>((resolve, reject) => {
    let response = "";
    socket.on("data", (b) => {
      response += b.toString();
      if (response.includes("\0")) resolve(response.replaceAll("\0", ""));
    });
    socket.on("error", reject);
    socket.on("end", () =>
      response
        ? resolve(response)
        : reject(new Error("Antivirus returned no result.")),
    );
  });
  result.catch(() => {});
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("error", reject);
  });
  socket.write("zINSTREAM\0");
  const framing = new Transform({
    transform(chunk, _, callback) {
      const n = Buffer.alloc(4);
      n.writeUInt32BE(chunk.length);
      callback(null, Buffer.concat([n, chunk]));
    },
    flush(callback) {
      callback(null, Buffer.alloc(4));
    },
  });
  try {
    await pipeline(
      createReadStream(filename, { highWaterMark: 65536 }),
      framing,
      socket,
      { end: false },
    );
    const verdict = await result;
    return verdict.endsWith(": OK");
  } finally {
    socket.destroy();
  }
}
async function validate(filename: string, mime: string) {
  if (mime.startsWith("video/")) {
    const r = await exec(
      process.env.FFPROBE_PATH || "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type",
        "-of",
        "json",
        filename,
      ],
      { timeout: 120000 },
    );
    return JSON.parse(r.stdout).streams?.some(
      (s: any) => s.codec_type === "video",
    );
  }
  const b = readFileSync(filename);
  if (mime === "application/pdf")
    return b.subarray(0, 5).toString() === "%PDF-";
  if (mime === "text/vtt")
    return (
      b.toString().startsWith("WEBVTT") && !b.toString().includes("<script")
    );
  if (mime === "image/png")
    return b.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
  if (mime === "image/jpeg") return b[0] === 255 && b[1] === 216;
  if (mime === "image/webp") return b.toString("ascii", 8, 12) === "WEBP";
  return false;
}
console.log("Private media scanner started.");
async function scanBatch() {
  const rows = await query(
    "SELECT * FROM uploads WHERE state='scanning' ORDER BY created_at LIMIT 5",
  );
  for (const row of rows) {
    const folder = mkdtempSync(path.join(tmpdir(), "lumio-scan-"));
    try {
      const file = path.join(folder, "object");
      const object = await s3.send(
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: row.storage_key,
        }),
      );
      if (object.ContentLength !== Number(row.size))
        throw new Error("Object size mismatch");
      await pipeline(object.Body as Readable, createWriteStream(file));
      const clean = (await validate(file, row.mime)) && (await clamav(file));
      if (clean) await promoteUpload(row, object.ETag || "");
      else
        await run(
          "UPDATE uploads SET state='rejected' WHERE id=? AND state='scanning'",
          [row.id],
        );
      console.log(`Upload ${row.id}: ${clean ? "ready" : "rejected"}`);
    } catch (e: any) {
      console.error(`Scan ${row.id} deferred: ${e.message}`);
    } finally {
      if (folder.startsWith(path.join(tmpdir(), "lumio-scan-")))
        rmSync(folder, { recursive: true, force: true });
    }
  }
}
for (;;) {
  await scanBatch();
  await new Promise((r) => setTimeout(r, 10000));
}
