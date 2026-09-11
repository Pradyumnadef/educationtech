import { Router } from "express";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSignedUrl as signCdnUrl } from "@aws-sdk/cloudfront-signer";
import multer from "multer";
import {
  mkdirSync,
  createReadStream,
  statSync,
  openSync,
  readSync,
  closeSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { z } from "zod";
import { one, run, insert, id, now, dataDir, production } from "./db.ts";
import { auth, admin, accessContext, canAccess, hash } from "./security.ts";
import { promoteUpload } from "./promote-upload.ts";
export const storageRoutes = Router();
const mediaDir = path.join(dataDir, "media");
mkdirSync(mediaDir, { recursive: true });
const bucket = process.env.S3_BUCKET;
const s3 = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: !!process.env.S3_ENDPOINT,
});
const formats: Record<string, number> = {
  "video/mp4": 2 * 1024 ** 3,
  "video/webm": 2 * 1024 ** 3,
  "video/quicktime": 2 * 1024 ** 3,
  "image/png": 5 * 1024 ** 2,
  "image/jpeg": 5 * 1024 ** 2,
  "image/webp": 5 * 1024 ** 2,
  "text/vtt": 1024 ** 2,
  "application/pdf": 25 * 1024 ** 2,
  "application/msword": 25 * 1024 ** 2,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": 25 * 1024 ** 2,
  "application/vnd.ms-excel": 25 * 1024 ** 2,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": 25 * 1024 ** 2,
  "application/vnd.ms-powerpoint": 25 * 1024 ** 2,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": 25 * 1024 ** 2,
  "text/plain": 5 * 1024 ** 2,
  "text/csv": 10 * 1024 ** 2,
};
const documentFormats = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);
storageRoutes.post("/prepare", auth, async (req, res) => {
  const b = z
    .object({
      filename: z.string().min(1).max(180),
      mime: z.string(),
      size: z.number().int().positive(),
      purpose: z.enum(["content", "assignment", "submission"]).default("content"),
    })
    .parse(req.body);
  const user = (req as any).user;
  if (user.role === "student" && b.purpose !== "submission")
    return res.status(403).json({ error: "Students can only upload assignment answers." });
  if (user.role === "student" && !documentFormats.has(b.mime))
    return res.status(400).json({ error: "Choose a PDF, Word, Excel, PowerPoint, text, or CSV file." });
  if (b.purpose !== "content" && !documentFormats.has(b.mime))
    return res.status(400).json({ error: "Choose a supported document file." });
  if (!formats[b.mime] || b.size > formats[b.mime])
    return res
      .status(400)
      .json({ error: "Unsupported file format or file is too large." });
  const uploadId = id(),
    key = `quarantine/${uploadId}`;
  await insert("uploads", {
    id: uploadId,
    owner_id: (req as any).user.id,
    storage_key: key,
    filename: b.filename,
    mime: b.mime,
    size: b.size,
    state: "pending",
    created_at: now(),
  });
  if (bucket) {
    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: b.mime,
        ContentLength: b.size,
      }),
      { expiresIn: 600 },
    );
    return res.json({ id: uploadId, url, method: "PUT", cloud: true });
  }
  if (production)
    return res.status(503).json({ error: "Cloud storage is not configured." });
  res.json({
    id: uploadId,
    url: `/api/storage/local/${uploadId}`,
    method: "POST",
    cloud: false,
  });
});
const upload = multer({
  dest: mediaDir,
  limits: { fileSize: 2 * 1024 ** 3, files: 1 },
});
function signature(file: string, mime: string) {
  const fd = openSync(file, "r");
  const b = Buffer.alloc(24);
  readSync(fd, b, 0, 24, 0);
  closeSync(fd);
  return signatureBytes(b, mime);
}
function signatureBytes(bytes: Uint8Array, mime: string) {
  const b = Buffer.from(bytes);
  if (mime === "video/mp4" || mime === "video/quicktime")
    return b.toString("ascii", 4, 8) === "ftyp";
  if (mime === "video/webm")
    return b.subarray(0, 4).toString("hex") === "1a45dfa3";
  if (mime === "image/png")
    return b.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
  if (mime === "image/jpeg")
    return b[0] === 255 && b[1] === 216 && b[2] === 255;
  if (mime === "image/webp") return b.toString("ascii", 8, 12) === "WEBP";
  if (mime === "application/pdf") return b.toString("ascii", 0, 5) === "%PDF-";
  if ([
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ].includes(mime)) return b.subarray(0, 4).toString("hex") === "504b0304";
  if (["application/msword", "application/vnd.ms-excel", "application/vnd.ms-powerpoint"].includes(mime))
    return b.subarray(0, 8).toString("hex") === "d0cf11e0a1b11ae1";
  if (["text/plain", "text/csv"].includes(mime)) return !b.includes(0);
  return b.toString().startsWith("WEBVTT");
}
storageRoutes.post(
  "/local/:id",
  auth,
  (req, res, next) => {
    if (production || bucket) return res.sendStatus(404);
    next();
  },
  upload.single("file"),
  async (req, res) => {
    const row = await one("SELECT * FROM uploads WHERE id=? AND owner_id=?", [
      req.params.id,
      (req as any).user.id,
    ]);
    const f = req.file;
    if (
      !row ||
      row.state !== "pending" ||
      !f ||
      f.size !== Number(row.size) ||
      !signature(f.path, row.mime)
    ) {
      if (f) unlinkSync(f.path);
      return res
        .status(400)
        .json({ error: "The file did not pass format validation." });
    }
    renameSync(f.path, path.join(mediaDir, row.id));
    await run("UPDATE uploads SET state='ready',storage_key=? WHERE id=?", [
      `local/${row.id}`,
      row.id,
    ]);
    res.json({ key: `local/${row.id}`, state: "ready" });
  },
);
storageRoutes.post("/complete/:id", auth, async (req, res) => {
  const row = await one("SELECT * FROM uploads WHERE id=? AND owner_id=?", [
    req.params.id,
    (req as any).user.id,
  ]);
  if (!row) return res.sendStatus(404);
  if (bucket && row.state === "pending") {
    const meta = await s3.send(
      new HeadObjectCommand({ Bucket: bucket, Key: row.storage_key }),
    );
    if (
      meta.ContentLength !== Number(row.size) ||
      meta.ContentType !== row.mime
    )
      return res.status(400).json({
        error: "Uploaded file does not match the declared size and format.",
      });
    await run("UPDATE uploads SET state='scanning' WHERE id=?", [row.id]);
    if (process.env.INLINE_UPLOAD_VALIDATION === "true") {
      const object = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: row.storage_key,
          Range: "bytes=0-23",
        }),
      );
      const bytes = await (object.Body as any)?.transformToByteArray?.();
      if (!bytes || !signatureBytes(bytes, row.mime) || !meta.ETag) {
        await run("UPDATE uploads SET state='rejected' WHERE id=?", [row.id]);
      } else {
        await promoteUpload({ ...row, state: "scanning" }, meta.ETag);
      }
    }
  }
  const updated = await one("SELECT * FROM uploads WHERE id=?", [row.id]);
  res.json({ key: updated.storage_key, state: updated.state });
});
storageRoutes.post("/scan-result", async (req, res) => {
  const secret = process.env.SCANNER_WEBHOOK_SECRET;
  if (
    !secret ||
    hash(String(req.headers.authorization || "")) !== hash(`Bearer ${secret}`)
  )
    return res.sendStatus(403);
  const b = z
    .object({
      uploadId: z.uuid(),
      clean: z.boolean(),
      etag: z.string().min(1).optional(),
    })
    .parse(req.body);
  const row = await one(
    "SELECT * FROM uploads WHERE id=? AND state='scanning'",
    [b.uploadId],
  );
  if (!row)
    return res
      .status(409)
      .json({ error: "This upload is not awaiting a scan." });
  if (b.clean) {
    if (!b.etag)
      return res
        .status(400)
        .json({ error: "The scanned object ETag is required." });
    await promoteUpload(row, b.etag);
  } else
    await run("UPDATE uploads SET state='rejected' WHERE id=?", [b.uploadId]);
  res.json({ ok: true });
});
storageRoutes.get("/status/:id", auth, async (req, res) => {
  const row = await one("SELECT storage_key,state FROM uploads WHERE id=? AND owner_id=?", [
    req.params.id, (req as any).user.id,
  ]);
  if (!row) return res.sendStatus(404);
  res.json(row);
});
async function deliverDownload(row: any, req: any, res: any) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Type", row.mime);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${row.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
  );
  if (bucket && !row.storage_key.startsWith("local/")) {
    const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: row.storage_key }));
    if (out.ContentLength) res.setHeader("Content-Length", out.ContentLength);
    const stream = out.Body as Readable;
    res.on("close", () => stream.destroy());
    stream.on("error", () => res.destroy());
    return stream.pipe(res);
  }
  const localPath = path.join(mediaDir, row.id);
  res.setHeader("Content-Length", statSync(localPath).size);
  return createReadStream(localPath).pipe(res);
}
storageRoutes.get("/assignment/:assignmentId/resource/:uploadId", auth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    const allowed = await one(
      `SELECT a.id FROM learning_assignments a JOIN assignment_targets t ON t.assignment_id=a.id
       LEFT JOIN group_members gm ON gm.group_id=t.group_id AND gm.user_id=?
       WHERE a.id=? AND a.status='published' AND (t.user_id=? OR gm.user_id=?)`,
      [user.id, req.params.assignmentId, user.id, user.id],
    );
    if (!allowed) return res.status(403).json({ error: "This assignment is not available to you." });
  }
  const row = await one(
    `SELECT u.* FROM assignment_resources r JOIN uploads u ON u.id=r.upload_id AND u.state='ready'
     WHERE r.assignment_id=? AND u.id=?`,
    [req.params.assignmentId, req.params.uploadId],
  );
  if (!row) return res.status(404).json({ error: "File not found." });
  await deliverDownload(row, req, res);
});
storageRoutes.get("/submission/:submissionId/file/:uploadId", auth, async (req, res) => {
  const user = (req as any).user;
  const row = await one(
    `SELECT u.*,s.user_id FROM submission_files f
     JOIN uploads u ON u.id=f.upload_id AND u.state='ready'
     JOIN assignment_submissions s ON s.id=f.submission_id
     WHERE f.submission_id=? AND u.id=?`,
    [req.params.submissionId, req.params.uploadId],
  );
  if (!row) return res.status(404).json({ error: "File not found." });
  if (user.role !== "admin" && row.user_id !== user.id)
    return res.status(403).json({ error: "You cannot access this submission." });
  await deliverDownload(row, req, res);
});
// Every byte-range request checks the current session and grants. The private object URL never leaves the server.
storageRoutes.get("/media/:id/:type", auth, async (req, res) => {
  const ctx = await accessContext((req as any).user);
  const video = ctx.nodes.find((n: any) => n.id === req.params.id);
  if (!video || !canAccess(ctx, video.id))
    return res
      .status(403)
      .json({ error: "This content has not been assigned to your account." });
  const type = req.params.type;
  const key =
    type === "video"
      ? video.storage_key
      : type === "captions"
        ? video.caption_key
        : type === "resource"
          ? video.resource_key
          : "";
  if (!key)
    return res
      .status(404)
      .json({ error: "This resource is not available yet." });
  const row = await one(
    "SELECT * FROM uploads WHERE storage_key=? AND state='ready'",
    [key],
  );
  if (!row)
    return res.status(404).json({ error: "This file is still processing." });
  const check = setInterval(async () => {
    try {
      const user = await one(
        "SELECT * FROM users WHERE id=? AND status='active'",
        [(req as any).user.id],
      );
      const live = await one(
        "SELECT id FROM sessions WHERE id=? AND expires_at>?",
        [(req as any).session.id, now()],
      );
      if (!user || !live || !canAccess(await accessContext(user), video.id))
        res.destroy();
    } catch {
      res.destroy();
    }
  }, 2000);
  res.on("close", () => clearInterval(check));
  res.on("finish", () => clearInterval(check));
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Type", row.mime);
  res.setHeader("Accept-Ranges", "bytes");
  if (type === "resource")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${row.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
    );
  const range = req.headers.range;
  if (range && !/^bytes=\d+-\d*$/.test(range)) return res.sendStatus(416);
  if (bucket && process.env.CDN_DOMAIN && !key.startsWith("local/")) {
    const privateKey = Buffer.from(
      process.env.CDN_PRIVATE_KEY_BASE64 || "",
      "base64",
    ).toString("utf8");
    const signed = signCdnUrl({
      url: `https://${process.env.CDN_DOMAIN}/${key.split("/").map(encodeURIComponent).join("/")}`,
      keyPairId: process.env.CDN_KEY_PAIR_ID!,
      privateKey,
      dateLessThan: new Date(Date.now() + 60000).toISOString(),
    });
    const controller = new AbortController();
    res.on("close", () => controller.abort());
    const response = await fetch(signed, {
      headers: range ? { Range: range } : {},
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok || !response.body)
      return res
        .status(response.status === 416 ? 416 : 502)
        .json({ error: "Video delivery is temporarily unavailable." });
    res.status(response.status);
    for (const h of ["content-length", "content-range"]) {
      const value = response.headers.get(h);
      if (value) res.setHeader(h, value);
    }
    const stream = Readable.fromWeb(response.body as any);
    stream.on("error", () => res.destroy());
    stream.pipe(res);
    return;
  }
  if (bucket && !key.startsWith("local/")) {
    const out = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key, Range: range }),
    );
    if (out.ContentRange) {
      res.status(206);
      res.setHeader("Content-Range", out.ContentRange);
    }
    if (out.ContentLength) res.setHeader("Content-Length", out.ContentLength);
    const stream = out.Body as Readable;
    res.on("close", () => stream.destroy());
    stream.on("error", () => res.destroy());
    stream.pipe(res);
    return;
  }
  const localPath = path.join(mediaDir, row.id);
  const size = statSync(localPath).size;
  let start = 0,
    end = size - 1;
  if (range) {
    const p = range.slice(6).split("-");
    start = Number(p[0]);
    end = p[1] ? Math.min(Number(p[1]), size - 1) : size - 1;
    if (start >= size || start > end) {
      res.setHeader("Content-Range", `bytes */${size}`);
      return res.sendStatus(416);
    }
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
  }
  res.setHeader("Content-Length", end - start + 1);
  const stream = createReadStream(localPath, { start, end });
  res.on("close", () => stream.destroy());
  stream.on("error", () => res.destroy());
  stream.pipe(res);
});
