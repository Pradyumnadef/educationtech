import { Router } from "express";
import { z } from "zod";
import { query, one, run, insert, update, id, now } from "./db.ts";
import {
  auth,
  admin,
  safeUser,
  accessContext,
  canViewContent,
  publicContent,
  audit,
  throttle,
} from "./security.ts";
import { cleanupUploadsIfUnreferenced } from "./storage.ts";
export const api = Router();
const uid = (req: any) => req.user.id;
const text = z.string().trim().min(1).max(200);
const attendanceSessionSchema = z.object({
  title: text,
  groupId: z.string().trim().min(1).max(200),
  locationName: z.string().trim().min(1).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusM: z.number().int().min(10).max(1000),
  startsAt: z.number().int().positive(),
  endsAt: z.number().int().positive(),
});
function distanceMetres(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitudeA)) *
      Math.cos(radians(latitudeB)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
async function savedAttendanceSessions() {
  const rows = await query(
    "SELECT value FROM settings WHERE id LIKE 'attendance-session:%'",
  );
  return rows.map((row: any) => JSON.parse(row.value));
}
async function savedAttendanceRecords() {
  const rows = await query(
    "SELECT value FROM settings WHERE id LIKE 'attendance-record:%'",
  );
  return rows.map((row: any) => JSON.parse(row.value));
}
async function savedStudentProfiles() {
  const rows = await query(
    "SELECT value FROM settings WHERE id LIKE 'student-profile:%'",
  );
  return rows.map((row: any) => JSON.parse(row.value));
}
const documentMimes = new Set([
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
const safePicture = z
  .string()
  .max(200000)
  .refine(
    (v) => !v || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
    "Choose a PNG, JPEG, or WebP image smaller than 150 KB.",
  );
const contentSchema = z.object({
  kind: z.enum(["subject", "folder", "video"]),
  parent_id: z.string().nullable(),
  name: text,
  description: z.string().max(5000).default(""),
  thumbnail: z.string().max(200000).default("math"),
  status: z.enum(["draft", "published"]).default("draft"),
  public: z.number().int().min(0).max(1).default(0),
  duration: z.number().int().min(0).max(86400).default(0),
  tags: z.array(z.string().max(40)).max(20).default([]),
  notes: z.string().max(20000).default(""),
  storage_key: z.string().max(300).default(""),
  caption_key: z.string().max(300).default(""),
  resource_key: z.string().max(300).default(""),
  video_upload_ids: z.array(z.uuid()).max(20).optional(),
  file_upload_ids: z.array(z.uuid()).max(30).optional(),
  publish_at: z.number().nullable().default(null),
});
function bad(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
async function resolveContentAssets(
  body: any,
  ownerId: string,
  existingContentId?: string,
) {
  const videos: any[] = [],
    files: any[] = [];
  for (const [type, ids] of [
    ["video", body.video_upload_ids],
    ["file", body.file_upload_ids],
  ] as const)
    for (const uploadId of ids || []) {
      const upload = existingContentId
        ? await one(
            `SELECT DISTINCT u.* FROM uploads u
             LEFT JOIN content_assets a ON a.upload_id=u.id AND a.content_id=?
             LEFT JOIN content c ON c.id=? AND (c.storage_key=u.storage_key OR c.resource_key=u.storage_key)
             WHERE u.id=? AND u.state='ready' AND (u.owner_id=? OR a.upload_id IS NOT NULL OR c.id IS NOT NULL)`,
            [existingContentId, existingContentId, uploadId, ownerId],
          )
        : await one(
            "SELECT * FROM uploads WHERE id=? AND owner_id=? AND state='ready'",
            [uploadId, ownerId],
          );
      const valid =
        upload &&
        (type === "video"
          ? upload.mime.startsWith("video/")
          : documentMimes.has(upload.mime));
      if (!valid) bad(`An uploaded ${type} is invalid or still processing.`);
      (type === "video" ? videos : files).push(upload);
    }
  return { videos, files };
}
async function saveContentAssets(contentId: string, assets: any) {
  await run("DELETE FROM content_assets WHERE content_id=?", [contentId]);
  for (const [type, rows] of Object.entries(assets) as any)
    for (let index = 0; index < rows.length; index++)
      await insert("content_assets", {
        id: id(),
        content_id: contentId,
        upload_id: rows[index].id,
        asset_type: type === "videos" ? "video" : "file",
        sort_order: index,
      });
}
async function studentAssignment(userId: string, assignmentId: string) {
  return one(
    `SELECT DISTINCT a.* FROM learning_assignments a
     JOIN assignment_targets t ON t.assignment_id=a.id
     LEFT JOIN group_members gm ON gm.group_id=t.group_id AND gm.user_id=?
     WHERE a.id=? AND a.status='published' AND (t.user_id=? OR gm.user_id=?)`,
    [userId, assignmentId, userId, userId],
  );
}
function assignmentDeadline(assignment: any, submission?: any) {
  const timed =
    assignment.time_limit_minutes > 0 && submission?.started_at
      ? Number(submission.started_at) +
        Number(assignment.time_limit_minutes) * 60000
      : Infinity;
  return Math.min(Number(assignment.due_at), timed);
}
async function assignmentResources(assignmentId: string) {
  return query(
    `SELECT u.id,u.filename,u.mime,u.size FROM assignment_resources r
     JOIN uploads u ON u.id=r.upload_id AND u.state='ready'
     WHERE r.assignment_id=? ORDER BY u.created_at`,
    [assignmentId],
  );
}
async function submissionFiles(submissionId: string) {
  return query(
    `SELECT u.id,u.filename,u.mime,u.size FROM submission_files f
     JOIN uploads u ON u.id=f.upload_id AND u.state='ready'
     WHERE f.submission_id=? ORDER BY u.created_at`,
    [submissionId],
  );
}
api.get("/catalog", async (_req, res) => {
  const rows = await query(
    "SELECT id,kind,parent_id,name,description,thumbnail FROM content WHERE public=1 AND status='published' AND (publish_at IS NULL OR publish_at<=?) AND kind='subject' ORDER BY created_at",
    [now()],
  );
  res.json(rows);
});
api.post("/contact", async (req, res) => {
  await throttle(`contact:${req.ip}`, 3, 3600000);
  const b = z
    .object({
      name: text,
      email: z.email(),
      message: z.string().min(10).max(3000),
    })
    .parse(req.body);
  await insert("contacts", { id: id(), ...b, created_at: now() });
  res.json({ ok: true });
});
api.use(auth);
api.get("/learning", async (req, res) => {
  const user = (req as any).user,
    ctx = await accessContext(user);
  const allowed = new Set(
    ctx.nodes
      .filter((n: any) => canViewContent(ctx, n.id))
      .map((n: any) => n.id),
  );
  const content = ctx.nodes
    .filter((n: any) => allowed.has(n.id))
    .map(publicContent);
  const assetRows = await query(
    `SELECT a.content_id,u.id,u.filename,u.mime,u.size,u.created_at,a.asset_type,a.sort_order,'asset' AS route_type
     FROM content_assets a JOIN uploads u ON u.id=a.upload_id AND u.state='ready'
     UNION ALL
     SELECT c.id AS content_id,u.id,u.filename,u.mime,u.size,u.created_at,'video' AS asset_type,-1 AS sort_order,'video' AS route_type
     FROM content c JOIN uploads u ON u.storage_key=c.storage_key AND u.state='ready'
     WHERE c.storage_key<>''
     UNION ALL
     SELECT c.id AS content_id,u.id,u.filename,u.mime,u.size,u.created_at,'file' AS asset_type,-1 AS sort_order,'resource' AS route_type
     FROM content c JOIN uploads u ON u.storage_key=c.resource_key AND u.state='ready'
     WHERE c.resource_key<>''
     ORDER BY content_id,asset_type DESC,sort_order`,
  );
  const assetsByContent = new Map<string, any[]>();
  for (const asset of assetRows) {
    if (!allowed.has(asset.content_id)) continue;
    const assets = assetsByContent.get(asset.content_id) || [];
    if (!assets.some((existing: any) => existing.id === asset.id)) {
      const { route_type, ...safeAsset } = asset;
      assets.push({
        ...safeAsset,
        url:
          route_type === "asset"
            ? `/api/storage/media/${asset.content_id}/asset/${asset.id}`
            : `/api/storage/media/${asset.content_id}/${route_type}`,
      });
    }
    assetsByContent.set(asset.content_id, assets);
  }
  for (const item of content) {
    if (item.kind !== "video") continue;
    const assets = assetsByContent.get(item.id) || [];
    item.assets = assets;
    item.video_count = assets.filter(
      (asset: any) => asset.asset_type === "video",
    ).length;
    item.file_count = assets.filter(
      (asset: any) => asset.asset_type === "file",
    ).length;
  }
  const progress = (
    await query("SELECT * FROM progress WHERE user_id=?", [user.id])
  ).filter((p: any) => allowed.has(p.video_id));
  const announcements = await query(
    "SELECT a.*, CASE WHEN r.id IS NULL THEN 0 ELSE 1 END AS read FROM announcements a LEFT JOIN notification_reads r ON r.announcement_id=a.id AND r.user_id=? ORDER BY a.created_at DESC LIMIT 100",
    [user.id],
  );
  const events = await query(
    "SELECT seconds,created_at FROM watch_events WHERE user_id=? AND created_at>? ORDER BY created_at",
    [user.id, now() - 31 * 86400000],
  );
  const settings = await one("SELECT value FROM settings WHERE id='platform'");
  const assignments = await query(
    `SELECT DISTINCT a.* FROM learning_assignments a
     JOIN assignment_targets t ON t.assignment_id=a.id
     LEFT JOIN group_members gm ON gm.group_id=t.group_id AND gm.user_id=?
     WHERE a.status='published' AND (t.user_id=? OR gm.user_id=?)
     ORDER BY a.due_at`,
    [user.id, user.id, user.id],
  );
  const studentAttendanceRecords = (await savedAttendanceRecords()).filter(
    (record: any) => record.user_id === user.id,
  );
  const attendanceGroups = new Set(
    (
      await query("SELECT group_id FROM group_members WHERE user_id=?", [
        user.id,
      ])
    ).map((membership: any) => membership.group_id),
  );
  const attendance = (await savedAttendanceSessions())
    .filter(
      (session: any) =>
        session.status === "open" &&
        Number(session.ends_at) >= now() &&
        (!session.class_section_id ||
          attendanceGroups.has(session.class_section_id)),
    )
    .sort((a: any, b: any) => Number(a.starts_at) - Number(b.starts_at))
    .map((session: any) => {
      const record = studentAttendanceRecords.find(
        (entry: any) => entry.session_id === session.id,
      );
      return record
        ? {
            ...session,
            record_id: record.id,
            checked_at: record.checked_at,
            distance_m: record.distance_m,
            accuracy_m: record.accuracy_m,
          }
        : session;
    });
  for (const a of assignments) {
    a.resources = await assignmentResources(a.id);
    a.submission = await one(
      "SELECT * FROM assignment_submissions WHERE assignment_id=? AND user_id=?",
      [a.id, user.id],
    );
    if (a.submission) {
      a.submission.files = await submissionFiles(a.submission.id);
      a.effective_deadline = assignmentDeadline(a, a.submission);
    } else a.effective_deadline = Number(a.due_at);
  }
  res.json({
    content,
    progress,
    announcements,
    events,
    assignments,
    attendance,
    settings: settings
      ? JSON.parse(settings.value)
      : {
          name: "English Tech",
          weeklyGoal: 120,
          welcome: "A little progress, every day.",
        },
  });
});
api.post("/attendance/:id/check-in", async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "student") bad("Student access required.", 403);
  const body = z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracyM: z.number().min(0).max(5000),
    })
    .parse(req.body);
  const attendanceRow = await one("SELECT value FROM settings WHERE id=?", [
    `attendance-session:${req.params.id}`,
  ]);
  const attendance = attendanceRow ? JSON.parse(attendanceRow.value) : null;
  if (!attendance) bad("This attendance session was not found.", 404);
  if (attendance.class_section_id) {
    const membership = await one(
      "SELECT id FROM group_members WHERE group_id=? AND user_id=?",
      [attendance.class_section_id, user.id],
    );
    if (!membership)
      bad("This attendance session is for another student group.", 403);
  }
  const time = now();
  if (
    attendance.status !== "open" ||
    time < Number(attendance.starts_at) ||
    time > Number(attendance.ends_at)
  )
    bad("This attendance session is not open.", 409);
  if (body.accuracyM > Math.max(30, Number(attendance.radius_m)))
    bad(
      "Your location accuracy is too low. Move near an open area, enable precise location, and try again.",
      422,
    );
  const distance = distanceMetres(
    Number(attendance.latitude),
    Number(attendance.longitude),
    body.latitude,
    body.longitude,
  );
  if (distance > Number(attendance.radius_m))
    bad(
      `You are ${Math.round(distance)} metres from the attendance location. Move within ${attendance.radius_m} metres and try again.`,
      403,
    );
  const record = {
    id: id(),
    session_id: attendance.id,
    user_id: user.id,
    latitude: body.latitude,
    longitude: body.longitude,
    accuracy_m: body.accuracyM,
    distance_m: distance,
    checked_at: time,
  };
  const saved = await one(
    "INSERT INTO settings(id,value) VALUES (?,?) ON CONFLICT(id) DO NOTHING RETURNING id",
    [
      `attendance-record:${attendance.id}:${user.id}`,
      JSON.stringify(record),
    ],
  );
  if (!saved) bad("Your attendance is already recorded.", 409);
  await audit(user.id, "attendance.check-in", attendance.id, String(distance));
  res.json(record);
});
api.post("/assignments/:id/start", async (req, res) => {
  if ((req as any).user.role !== "student")
    bad("Student access required.", 403);
  const assignment = await studentAssignment(uid(req), req.params.id as string);
  if (!assignment) bad("Assignment not found or not assigned to you.", 404);
  if (Number(assignment.due_at) <= now())
    bad("This assignment has closed.", 409);
  await run(
    `INSERT INTO assignment_submissions(id,assignment_id,user_id,started_at,status,note,feedback,updated_at)
     VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(assignment_id,user_id) DO NOTHING`,
    [id(), assignment.id, uid(req), now(), "in_progress", "", "", now()],
  );
  const submission = await one(
    "SELECT * FROM assignment_submissions WHERE assignment_id=? AND user_id=?",
    [assignment.id, uid(req)],
  );
  res.json({
    ...submission,
    effective_deadline: assignmentDeadline(assignment, submission),
  });
});
api.post("/assignments/:id/submit", async (req, res) => {
  if ((req as any).user.role !== "student")
    bad("Student access required.", 403);
  const b = z
    .object({
      uploadIds: z.array(z.uuid()).min(1).max(5),
      note: z.string().trim().max(3000).default(""),
    })
    .parse(req.body);
  const assignment = await studentAssignment(uid(req), req.params.id as string);
  if (!assignment) bad("Assignment not found or not assigned to you.", 404);
  let submission = await one(
    "SELECT * FROM assignment_submissions WHERE assignment_id=? AND user_id=?",
    [assignment.id, uid(req)],
  );
  if (!submission) {
    await run(
      `INSERT INTO assignment_submissions(id,assignment_id,user_id,started_at,status,note,feedback,updated_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [id(), assignment.id, uid(req), now(), "in_progress", "", "", now()],
    );
    submission = await one(
      "SELECT * FROM assignment_submissions WHERE assignment_id=? AND user_id=?",
      [assignment.id, uid(req)],
    );
  }
  if (assignmentDeadline(assignment, submission) <= now())
    bad("The submission time has ended.", 409);
  const files = [];
  for (const uploadId of b.uploadIds) {
    const upload = await one(
      "SELECT * FROM uploads WHERE id=? AND owner_id=? AND state='ready'",
      [uploadId, uid(req)],
    );
    if (!upload || !documentMimes.has(upload.mime))
      bad("A submission file is invalid or still processing.");
    files.push(upload);
  }
  const previousFiles = await query(
    "SELECT upload_id FROM submission_files WHERE submission_id=?",
    [submission.id],
  );
  await run("DELETE FROM submission_files WHERE submission_id=?", [
    submission.id,
  ]);
  for (const file of files)
    await insert("submission_files", {
      id: id(),
      submission_id: submission.id,
      upload_id: file.id,
    });
  await update(
    "assignment_submissions",
    {
      status: "submitted",
      note: b.note,
      submitted_at: now(),
      updated_at: now(),
    },
    submission.id,
  );
  await audit(uid(req), "assignment.submit", assignment.id);
  const cleanupPending = await cleanupUploadsIfUnreferenced(
    previousFiles.map((file: any) => file.upload_id),
  );
  res.json({ ok: true, cleanupPending });
});
api.get("/search", async (req, res) => {
  const q = z
    .string()
    .max(100)
    .parse(String(req.query.q || ""));
  const ctx = await accessContext((req as any).user);
  const found = ctx.nodes
    .filter(
      (n: any) =>
        n.kind !== "topic" &&
        canViewContent(ctx, n.id) &&
        `${n.name} ${n.description}`.toLowerCase().includes(q.toLowerCase()),
    )
    .slice(0, 40)
    .map(publicContent);
  if ((req as any).user.role === "admin") {
    const students = await query(
      "SELECT id,name,email FROM users WHERE role='student' AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ?) LIMIT 10",
      [`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`],
    );
    found.unshift(
      ...students.map((u: any) => ({
        ...u,
        kind: "student",
        description: u.email,
      })),
    );
  }
  res.json(found);
});
api.get("/videos/:id", async (req, res) => {
  const ctx = await accessContext((req as any).user);
  if (!canViewContent(ctx, req.params.id as string))
    bad("This content is not available.", 403);
  const node = ctx.nodes.find((n: any) => n.id === req.params.id);
  if (node.kind !== "video") bad("Video not found.", 404);
  const assets = await query(
    `SELECT u.id,u.filename,u.mime,u.size,a.asset_type,a.sort_order
     FROM content_assets a JOIN uploads u ON u.id=a.upload_id AND u.state='ready'
     WHERE a.content_id=? ORDER BY a.asset_type DESC,a.sort_order`,
    [node.id],
  );
  res.json({
    ...publicContent(node),
    media: node.storage_key ? `/api/storage/media/${node.id}/video` : null,
    captions: node.caption_key
      ? `/api/storage/media/${node.id}/captions`
      : null,
    resource: node.resource_key
      ? `/api/storage/media/${node.id}/resource`
      : null,
    videos: assets
      .filter((asset: any) => asset.asset_type === "video")
      .map((asset: any) => ({
        ...asset,
        url: `/api/storage/media/${node.id}/asset/${asset.id}`,
      })),
    files: assets
      .filter((asset: any) => asset.asset_type === "file")
      .map((asset: any) => ({
        ...asset,
        url: `/api/storage/media/${node.id}/asset/${asset.id}`,
      })),
    progress: await one(
      "SELECT * FROM progress WHERE user_id=? AND video_id=?",
      [uid(req), node.id],
    ),
  });
});
api.post("/progress/:id", async (req, res) => {
  const b = z
    .object({
      position: z.number().min(0).max(86400),
      seconds: z.number().min(0).max(20).default(0),
      completed: z.boolean().default(false),
    })
    .parse(req.body);
  const ctx = await accessContext((req as any).user);
  if (!canViewContent(ctx, req.params.id as string))
    bad("This lesson is not available.", 403);
  const node = ctx.nodes.find((n: any) => n.id === req.params.id);
  if (node.kind !== "video") bad("Video not found.", 404);
  const prev = await one(
    "SELECT * FROM progress WHERE user_id=? AND video_id=?",
    [uid(req), node.id],
  );
  const elapsed = prev
    ? Math.max(0, (now() - Number(prev.updated_at)) / 1000)
    : 0;
  const watched = Math.min(b.seconds, elapsed, 20);
  const position = Math.min(b.position, node.duration || b.position),
    completed =
      b.completed ||
      !!prev?.completed ||
      (node.duration > 0 && position >= node.duration * 0.95);
  await run(
    `INSERT INTO progress(id,user_id,video_id,position,watched_seconds,completed,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,video_id) DO UPDATE SET position=excluded.position,watched_seconds=progress.watched_seconds+excluded.watched_seconds,completed=CASE WHEN progress.completed=1 THEN 1 ELSE excluded.completed END,updated_at=excluded.updated_at`,
    [id(), uid(req), node.id, position, watched, completed ? 1 : 0, now()],
  );
  if (watched > 0)
    await insert("watch_events", {
      id: id(),
      user_id: uid(req),
      video_id: node.id,
      seconds: watched,
      created_at: now(),
    });
  await run("UPDATE users SET last_active=? WHERE id=?", [now(), uid(req)]);
  res.json({ ok: true, completed });
});
api.get("/onboarding/options", async (_req, res) => {
  res.json({
    groups: await query("SELECT id,name FROM student_groups ORDER BY name"),
  });
});
api.patch("/profile", async (req, res) => {
  const user = (req as any).user;
  const b = z
    .object({
      name: text,
      avatar: safePicture.optional(),
      interests: z.array(z.string().max(80)).max(30).optional(),
      onboarding: z.boolean().optional(),
      groupId: z.string().trim().min(1).max(200).optional(),
      rollNumber: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9][A-Za-z0-9/_-]{0,49}$/, "Use letters, numbers, hyphens, underscores, or slashes for the roll number.")
        .optional(),
    })
    .parse(req.body);
  let studentProfile: any = null;
  if (b.onboarding && user.role === "student") {
    if (user.onboarding)
      bad("Registration details are already complete. Ask your teacher to change your group.", 409);
    if (!b.groupId || !b.rollNumber)
      bad("Name, student group, and roll number are required.");
    const group = await one("SELECT id,name FROM student_groups WHERE id=?", [
      b.groupId,
    ]);
    if (!group) bad("Choose an available student group.");
    const duplicate = (await savedStudentProfiles()).find(
      (profile: any) =>
        profile.user_id !== user.id &&
        profile.group_id === group.id &&
        String(profile.roll_number).toLowerCase() === b.rollNumber!.toLowerCase(),
    );
    if (duplicate)
      bad("That roll number is already registered in this student group.", 409);
    studentProfile = {
      user_id: user.id,
      group_id: group.id,
      group_name: group.name,
      roll_number: b.rollNumber,
      updated_at: now(),
    };
    await run("DELETE FROM group_members WHERE user_id=?", [user.id]);
    await insert("group_members", {
      id: id(),
      group_id: group.id,
      user_id: user.id,
    });
    await run(
      "INSERT INTO settings(id,value) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
      [`student-profile:${user.id}`, JSON.stringify(studentProfile)],
    );
  }
  await update(
    "users",
    {
      name: b.name,
      updated_at: now(),
      ...(b.avatar !== undefined ? { avatar: b.avatar } : {}),
      ...(b.interests ? { interests: JSON.stringify(b.interests) } : {}),
      ...(b.onboarding ? { onboarding: 1 } : {}),
    },
    uid(req),
  );
  res.json({
    ...safeUser(await one("SELECT * FROM users WHERE id=?", [uid(req)])),
    ...(studentProfile || {}),
  });
});
api.post("/notifications/read", async (req, res) => {
  const notifications = await query("SELECT id FROM announcements");
  for (const a of notifications)
    await run(
      "INSERT INTO notification_reads(id,user_id,announcement_id) VALUES (?,?,?) ON CONFLICT(user_id,announcement_id) DO NOTHING",
      [id(), uid(req), a.id],
    );
  res.json({ ok: true });
});
api.use("/admin", admin);
api.get("/admin/overview", async (_req, res) => {
  const students = await query(
    "SELECT id,name,email,phone,status,avatar,interests,created_at,last_active FROM users WHERE role='student' ORDER BY created_at DESC",
  );
  const rawContent = await query(
    "SELECT * FROM content ORDER BY created_at DESC",
  );
  const assetRows = await query(
    `SELECT a.content_id,u.id,u.filename,u.mime,u.size,u.created_at,a.asset_type,a.sort_order
     FROM content_assets a JOIN uploads u ON u.id=a.upload_id AND u.state='ready'
     UNION ALL
     SELECT c.id AS content_id,u.id,u.filename,u.mime,u.size,u.created_at,'video' AS asset_type,-1 AS sort_order
     FROM content c JOIN uploads u ON u.storage_key=c.storage_key AND u.state='ready'
     WHERE c.storage_key<>''
     UNION ALL
     SELECT c.id AS content_id,u.id,u.filename,u.mime,u.size,u.created_at,'file' AS asset_type,-1 AS sort_order
     FROM content c JOIN uploads u ON u.storage_key=c.resource_key AND u.state='ready'
     WHERE c.resource_key<>''
     ORDER BY content_id,asset_type DESC,sort_order`,
  );
  const assetsByContent = new Map<string, any[]>();
  for (const asset of assetRows) {
    const assets = assetsByContent.get(asset.content_id) || [];
    if (!assets.some((existing: any) => existing.id === asset.id))
      assets.push(asset);
    assetsByContent.set(asset.content_id, assets);
  }
  const content = rawContent.map((row: any) => {
    const assets = assetsByContent.get(row.id) || [];
    return {
      ...publicContent(row),
      video_count: assets.filter((asset) => asset.asset_type === "video")
        .length,
      file_count: assets.filter((asset) => asset.asset_type === "file").length,
      assets,
    };
  });
  const groups = await query("SELECT * FROM student_groups ORDER BY name");
  const members = await query("SELECT * FROM group_members");
  const studentProfiles = await savedStudentProfiles();
  for (const student of students) {
    const profile = studentProfiles.find(
      (entry: any) => entry.user_id === student.id,
    );
    const membership = members.find((entry: any) => entry.user_id === student.id);
    const group = groups.find(
      (entry: any) => entry.id === (profile?.group_id || membership?.group_id),
    );
    student.roll_number = profile?.roll_number || "";
    student.group_id = group?.id || "";
    student.group_name = group?.name || profile?.group_name || "";
  }
  const grants = await query("SELECT * FROM access_grants");
  const announcements = await query(
    "SELECT * FROM announcements ORDER BY created_at DESC",
  );
  const progress = await query("SELECT * FROM progress");
  const events = await query("SELECT * FROM watch_events WHERE created_at>?", [
    now() - 31 * 86400000,
  ]);
  const logs = await query(
    "SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 50",
  );
  const settings = await one("SELECT value FROM settings WHERE id='platform'");
  const contacts = await query(
    "SELECT * FROM contacts ORDER BY created_at DESC LIMIT 50",
  );
  const coursework = await query(
    "SELECT * FROM learning_assignments ORDER BY created_at DESC",
  );
  const assignmentTargets = await query("SELECT * FROM assignment_targets");
  const assignmentResourceRows = await query(
    `SELECT r.id,r.assignment_id,u.id AS upload_id,u.filename,u.mime,u.size
     FROM assignment_resources r JOIN uploads u ON u.id=r.upload_id ORDER BY u.created_at`,
  );
  const submissions = await query(
    `SELECT s.*,u.name AS student_name,u.email AS student_email
     FROM assignment_submissions s JOIN users u ON u.id=s.user_id
     ORDER BY s.updated_at DESC`,
  );
  const submissionFileRows = await query(
    `SELECT f.id,f.submission_id,u.id AS upload_id,u.filename,u.mime,u.size
     FROM submission_files f JOIN uploads u ON u.id=f.upload_id ORDER BY u.created_at`,
  );
  for (const s of submissions)
    s.files = submissionFileRows.filter((f: any) => f.submission_id === s.id);
  const attendanceSessions = (await savedAttendanceSessions()).sort(
    (a: any, b: any) => Number(b.created_at) - Number(a.created_at),
  );
  const savedRecords = await savedAttendanceRecords();
  const attendanceRecords = savedRecords
    .map((record: any) => {
      const student = students.find((entry: any) => entry.id === record.user_id);
      return {
        ...record,
        student_name: student?.name || "Removed student",
        student_email: student?.email || "",
        student_roll_number: student?.roll_number || "",
      };
    })
    .sort((a: any, b: any) => Number(b.checked_at) - Number(a.checked_at));
  res.json({
    students,
    content,
    groups,
    members,
    grants,
    announcements,
    progress,
    events,
    logs,
    settings: settings
      ? JSON.parse(settings.value)
      : {
          name: "English Tech",
          supportEmail: "",
          welcome: "",
          weeklyGoal: 120,
        },
    contacts,
    attendance: attendanceSessions.map((session: any) => ({
      ...session,
      attendance_count: attendanceRecords.filter(
        (record: any) => record.session_id === session.id,
      ).length,
      records: attendanceRecords.filter(
        (record: any) => record.session_id === session.id,
      ),
    })),
    coursework: coursework.map((a: any) => ({
      ...a,
      targets: assignmentTargets.filter((t: any) => t.assignment_id === a.id),
      resources: assignmentResourceRows.filter(
        (r: any) => r.assignment_id === a.id,
      ),
      submissions: submissions.filter((s: any) => s.assignment_id === a.id),
    })),
  });
});
api.get("/admin/students", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1),
    q = `%${String(req.query.q || "")
      .slice(0, 100)
      .toLowerCase()}%`;
  const rows = await query(
    "SELECT id,name,email,phone,status,created_at,last_active FROM users WHERE role='student' AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ?) ORDER BY created_at DESC LIMIT 25 OFFSET ?",
    [q, q, (page - 1) * 25],
  );
  res.json(rows);
});
api.post("/admin/attendance", async (req, res) => {
  const body = attendanceSessionSchema.parse(req.body);
  if (body.endsAt <= body.startsAt)
    bad("The attendance closing time must be after its opening time.");
  if (body.endsAt - body.startsAt > 24 * 60 * 60 * 1000)
    bad("An attendance session can remain open for up to 24 hours.");
  const classSection = await one(
    "SELECT id,name FROM student_groups WHERE id=?",
    [body.groupId],
  );
  if (!classSection) bad("Choose an available student group.");
  const session = {
    id: id(),
    teacher_id: uid(req),
    title: body.title,
    class_section_id: classSection.id,
    class_section_name: classSection.name,
    location_name: body.locationName,
    latitude: body.latitude,
    longitude: body.longitude,
    radius_m: body.radiusM,
    starts_at: body.startsAt,
    ends_at: body.endsAt,
    status: "open",
    created_at: now(),
  };
  await insert("settings", {
    id: `attendance-session:${session.id}`,
    value: JSON.stringify(session),
  });
  await audit(uid(req), "attendance.create", session.id, body.title);
  res.json(session);
});
api.patch("/admin/attendance/:id", async (req, res) => {
  const body = z.object({ status: z.enum(["open", "closed"]) }).parse(req.body);
  const key = `attendance-session:${req.params.id}`;
  const row = await one("SELECT value FROM settings WHERE id=?", [key]);
  if (!row) bad("Attendance session not found.", 404);
  const session = { ...JSON.parse(row.value), status: body.status };
  await run("UPDATE settings SET value=? WHERE id=?", [
    JSON.stringify(session),
    key,
  ]);
  await audit(uid(req), "attendance.status", session.id, body.status);
  res.json({ ok: true });
});
api.delete("/admin/attendance/:id", async (req, res) => {
  const key = `attendance-session:${req.params.id}`;
  const row = await one("SELECT value FROM settings WHERE id=?", [key]);
  if (!row) bad("Attendance session not found.", 404);
  await run("DELETE FROM settings WHERE id=? OR id LIKE ?", [
    key,
    `attendance-record:${req.params.id}:%`,
  ]);
  await audit(uid(req), "attendance.delete", req.params.id as string);
  res.json({ ok: true });
});
api.post("/admin/students", async (req, res) => {
  const b = z
    .object({
      name: text,
      email: z.email().toLowerCase(),
      phone: z
        .string()
        .regex(/^\+[1-9]\d{7,14}$/)
        .optional(),
      status: z.enum(["active", "pending", "inactive"]).default("active"),
    })
    .parse(req.body);
  if (await one("SELECT id FROM users WHERE email=?", [b.email]))
    bad("This email is already registered.", 409);
  const user = await insert("users", {
    id: id(),
    role: "student",
    ...b,
    phone: b.phone || null,
    created_at: now(),
    updated_at: now(),
  });
  await audit(uid(req), "student.create", user.id);
  res.json(safeUser(user));
});
api.patch("/admin/students/:id", async (req, res) => {
  const b = z
    .object({
      name: text.optional(),
      status: z.enum(["active", "pending", "inactive"]).optional(),
    })
    .parse(req.body);
  const user = await one("SELECT id FROM users WHERE id=? AND role='student'", [
    req.params.id,
  ]);
  if (!user) bad("Student not found.", 404);
  await update("users", { ...b, updated_at: now() }, user.id);
  if (b.status && b.status !== "active")
    await run("DELETE FROM sessions WHERE user_id=?", [user.id]);
  await audit(uid(req), "student.update", user.id, JSON.stringify(b));
  res.json({ ok: true });
});
api.delete("/admin/students/:id", async (req, res) => {
  const student = await one(
    "SELECT id FROM users WHERE id=? AND role='student'",
    [req.params.id],
  );
  if (!student) bad("Student not found.", 404);
  await run("DELETE FROM settings WHERE id=?", [
    `student-profile:${student.id}`,
  ]);
  await run("DELETE FROM users WHERE id=?", [student.id]);
  await audit(uid(req), "student.delete", student.id);
  res.json({ ok: true });
});
api.post("/admin/students/:id/reset-access", async (req, res) => {
  await run("UPDATE access_grants SET status='revoked' WHERE user_id=?", [
    req.params.id,
  ]);
  await run("DELETE FROM group_members WHERE user_id=?", [req.params.id]);
  await run("DELETE FROM settings WHERE id=?", [
    `student-profile:${req.params.id}`,
  ]);
  await audit(uid(req), "student.reset-access", req.params.id as string);
  res.json({ ok: true });
});
async function validateContent(b: any, recordId?: string) {
  if (b.kind === "subject") {
    if (b.parent_id) bad("Subjects cannot have a parent.");
  } else {
    const parent = await one("SELECT kind FROM content WHERE id=?", [
      b.parent_id,
    ]);
    const allowedParents: Record<string, string[]> = {
      folder: ["subject", "folder"],
      video: ["subject", "folder", "chapter", "topic"],
    };
    const validParent = allowedParents[b.kind]?.includes(parent?.kind);
    if (!validParent || b.parent_id === recordId)
      bad(`Select a valid location for this ${b.kind}.`);
    if (recordId) {
      let ancestorId = b.parent_id;
      const visited = new Set<string>();
      while (ancestorId && !visited.has(ancestorId)) {
        if (ancestorId === recordId)
          bad("A folder cannot be moved inside itself or one of its folders.");
        visited.add(ancestorId);
        const ancestor = await one("SELECT parent_id FROM content WHERE id=?", [
          ancestorId,
        ]);
        ancestorId = ancestor?.parent_id;
      }
    }
  }
  if (b.kind !== "subject") b.public = 0;
  for (const [field, mime] of [
    ["storage_key", "video/"],
    ["caption_key", "text/vtt"],
    ["resource_key", "document"],
  ])
    if (b[field]) {
      const upload = await one(
        "SELECT mime FROM uploads WHERE storage_key=? AND state='ready'",
        [b[field]],
      );
      const valid =
        upload &&
        (mime === "document"
          ? documentMimes.has(upload.mime)
          : upload.mime.startsWith(mime));
      if (!valid)
        bad(
          "An attached file is missing, invalid, or awaiting security scanning.",
        );
    }
  if (
    !["math", "physics", "code", "chemistry", "biology", "english"].includes(
      b.thumbnail,
    ) &&
    !safePicture.safeParse(b.thumbnail).success
  )
    bad("Invalid thumbnail.");
}
api.get("/admin/content/:id", async (req, res) => {
  const item = await one("SELECT * FROM content WHERE id=?", [req.params.id]);
  if (!item) bad("Content not found.", 404);
  const fileFields = ["storage_key", "caption_key", "resource_key"].filter(
    (field) => item[field],
  );
  const uploadedFiles = Object.fromEntries(
    await Promise.all(
      fileFields.map(async (field) => [
        field,
        await one(
          "SELECT id,filename,mime,size,state FROM uploads WHERE storage_key=?",
          [item[field]],
        ),
      ]),
    ),
  );
  const assets = await query(
    `SELECT u.id,u.filename,u.mime,u.size,u.state,u.storage_key,a.asset_type,a.sort_order
     FROM content_assets a JOIN uploads u ON u.id=a.upload_id
     WHERE a.content_id=? ORDER BY a.asset_type DESC,a.sort_order`,
    [item.id],
  );
  for (const [field, type] of [
    ["storage_key", "video"],
    ["resource_key", "file"],
  ]) {
    const upload = uploadedFiles[field];
    if (upload && !assets.some((asset: any) => asset.id === upload.id))
      assets.push({ ...upload, asset_type: type, sort_order: -1 });
  }
  res.json({
    ...item,
    tags: JSON.parse(item.tags),
    uploaded_files: uploadedFiles,
    assets,
  });
});
api.post("/admin/content/folder-import", async (req, res) => {
  const body = z
    .object({
      parentId: z.string().trim().min(1).max(200),
      entries: z
        .array(
          z.object({
            path: z.string().trim().min(3).max(1000),
            uploadId: z.uuid(),
          }),
        )
        .min(1)
        .max(100),
    })
    .parse(req.body);
  const parent = await one(
    "SELECT id,kind,status FROM content WHERE id=? AND kind IN ('subject','folder')",
    [body.parentId],
  );
  if (!parent) bad("Choose an available subject or folder.");

  const normalizedEntries = body.entries.map((entry) => {
    const parts = entry.path
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean);
    if (
      parts.length < 2 ||
      parts.some(
        (part) =>
          part === "." ||
          part === ".." ||
          part.length > 200 ||
          /[\u0000-\u001f]/.test(part),
      )
    )
      bad("The selected folder contains an invalid file path.");
    return { ...entry, parts };
  });
  const rootName = normalizedEntries[0].parts[0];
  if (normalizedEntries.some((entry) => entry.parts[0] !== rootName))
    bad("Choose one folder at a time.");
  if (
    new Set(normalizedEntries.map((entry) => entry.parts.join("/"))).size !==
    normalizedEntries.length
  )
    bad("The selected folder contains duplicate file paths.");

  const uploads = new Map<string, any>();
  for (const entry of normalizedEntries) {
    const upload = await one(
      "SELECT * FROM uploads WHERE id=? AND owner_id=? AND state='ready'",
      [entry.uploadId, uid(req)],
    );
    if (
      !upload ||
      (!upload.mime.startsWith("video/") && !documentMimes.has(upload.mime))
    )
      bad("An uploaded file is invalid or still processing.");
    uploads.set(entry.uploadId, upload);
  }

  const folders = new Map<string, string>();
  const createContent = async (record: Record<string, any>) => {
    const contentId = id();
    await insert("content", {
      id: contentId,
      description: "",
      thumbnail: "english",
      status: "published",
      public: 0,
      duration: 0,
      tags: "[]",
      notes: "",
      storage_key: "",
      caption_key: "",
      resource_key: "",
      publish_at: null,
      created_at: now(),
      updated_at: now(),
      ...record,
    });
    return contentId;
  };

  let rootId = "";
  try {
    rootId = await createContent({
      kind: "folder",
      parent_id: parent.id,
      name: rootName,
    });
    folders.set(rootName, rootId);
    let fileCount = 0;
    for (const entry of normalizedEntries) {
      let folderId = rootId;
      for (let index = 1; index < entry.parts.length - 1; index++) {
        const folderPath = entry.parts.slice(0, index + 1).join("/");
        const existingId = folders.get(folderPath);
        if (existingId) {
          folderId = existingId;
          continue;
        }
        folderId = await createContent({
          kind: "folder",
          parent_id: folderId,
          name: entry.parts[index],
        });
        folders.set(folderPath, folderId);
      }
      const upload = uploads.get(entry.uploadId);
      const assetType = upload.mime.startsWith("video/") ? "video" : "file";
      const materialId = await createContent({
        kind: "video",
        parent_id: folderId,
        name: upload.filename,
        storage_key: assetType === "video" ? upload.storage_key : "",
        resource_key: assetType === "file" ? upload.storage_key : "",
      });
      await insert("content_assets", {
        id: id(),
        content_id: materialId,
        upload_id: upload.id,
        asset_type: assetType,
        sort_order: 0,
      });
      fileCount += 1;
    }
    await audit(
      uid(req),
      "content.folder-import",
      rootId,
      `${rootName}: ${fileCount} files`,
    );
    res.json({ id: rootId, name: rootName, fileCount });
  } catch (error) {
    if (rootId) await run("DELETE FROM content WHERE id=?", [rootId]);
    await cleanupUploadsIfUnreferenced(
      normalizedEntries.map((entry) => entry.uploadId),
    );
    throw error;
  }
});
api.post("/admin/content", async (req, res) => {
  const b = contentSchema.parse(req.body);
  await validateContent(b);
  const assets = await resolveContentAssets(b, uid(req));
  const { video_upload_ids, file_upload_ids, ...content } = b;
  const row = await insert("content", {
    id: id(),
    ...content,
    storage_key: assets.videos[0]?.storage_key || content.storage_key,
    resource_key: assets.files[0]?.storage_key || content.resource_key,
    tags: JSON.stringify(b.tags),
    created_at: now(),
    updated_at: now(),
  });
  await saveContentAssets(row.id, assets);
  await audit(uid(req), "content.create", row.id, b.name);
  res.json(publicContent(row));
});
api.put("/admin/content/:id", async (req, res) => {
  const b = contentSchema.parse(req.body);
  const existing = await one("SELECT * FROM content WHERE id=?", [
    req.params.id,
  ]);
  if (!existing) bad("Content not found.", 404);
  if (b.kind !== existing.kind) bad("Content type cannot be changed.");
  await validateContent(b, req.params.id as string);
  const assets = await resolveContentAssets(
    b,
    uid(req),
    req.params.id as string,
  );
  const previousAssets = await query(
    "SELECT upload_id FROM content_assets WHERE content_id=?",
    [req.params.id],
  );
  const { video_upload_ids, file_upload_ids, ...content } = b;
  await update(
    "content",
    {
      ...content,
      storage_key: assets.videos[0]?.storage_key || content.storage_key,
      resource_key: assets.files[0]?.storage_key || content.resource_key,
      tags: JSON.stringify(b.tags),
      updated_at: now(),
    },
    req.params.id as string,
  );
  await saveContentAssets(req.params.id as string, assets);
  await audit(uid(req), "content.update", req.params.id as string, b.name);
  const replacedKeys = ["storage_key", "caption_key", "resource_key"]
    .filter(
      (field) =>
        existing[field] && existing[field] !== b[field as keyof typeof b],
    )
    .map((field) => existing[field]);
  const replacedUploads = await Promise.all(
    replacedKeys.map((key) =>
      one("SELECT id FROM uploads WHERE storage_key=?", [key]),
    ),
  );
  const cleanupPending = await cleanupUploadsIfUnreferenced([
    ...replacedUploads.filter(Boolean).map((upload: any) => upload.id),
    ...previousAssets.map((upload: any) => upload.upload_id),
  ]);
  res.json({ ok: true, cleanupPending });
});
api.delete("/admin/content/:id", async (req, res) => {
  const allContent = await query(
    "SELECT id,parent_id,storage_key,caption_key,resource_key FROM content",
  );
  if (!allContent.some((item: any) => item.id === req.params.id))
    bad("Content not found.", 404);
  const deletedIds = new Set<string>([req.params.id as string]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of allContent)
      if (
        item.parent_id &&
        deletedIds.has(item.parent_id) &&
        !deletedIds.has(item.id)
      ) {
        deletedIds.add(item.id);
        changed = true;
      }
  }
  const deletedKeys = allContent
    .filter((item: any) => deletedIds.has(item.id))
    .flatMap((item: any) => [
      item.storage_key,
      item.caption_key,
      item.resource_key,
    ])
    .filter(Boolean);
  const deletedUploads = await Promise.all(
    deletedKeys.map((key: string) =>
      one("SELECT id FROM uploads WHERE storage_key=?", [key]),
    ),
  );
  const deletedAssetUploads = await query(
    `SELECT a.upload_id FROM content_assets a WHERE a.content_id IN (${[...deletedIds].map(() => "?").join(",")})`,
    [...deletedIds],
  );
  await run("DELETE FROM content WHERE id=?", [req.params.id]);
  await audit(uid(req), "content.delete", req.params.id as string);
  const cleanupPending = await cleanupUploadsIfUnreferenced([
    ...deletedUploads.filter(Boolean).map((upload: any) => upload.id),
    ...deletedAssetUploads.map((upload: any) => upload.upload_id),
  ]);
  res.json({ ok: true, cleanupPending });
});
api.post("/admin/groups", async (req, res) => {
  const b = z
    .object({
      name: text,
      description: z.string().max(1000).default(""),
    })
    .parse(req.body);
  const row = await insert("student_groups", {
    id: id(),
    name: b.name,
    description: b.description,
    created_at: now(),
  });
  await audit(uid(req), "group.create", row.id);
  res.json(row);
});
api.patch("/admin/groups/:id", async (req, res) => {
  const b = z
    .object({
      name: text,
      description: z.string().max(1000).default(""),
    })
    .parse(req.body);
  const existingGroup = await one("SELECT id FROM student_groups WHERE id=?", [
    req.params.id,
  ]);
  if (!existingGroup) bad("Student group not found.", 404);
  await update(
    "student_groups",
    { name: b.name, description: b.description },
    req.params.id as string,
  );
  for (const row of await query(
    "SELECT id,value FROM settings WHERE id LIKE 'attendance-session:%' OR id LIKE 'student-profile:%'",
  )) {
    const value = JSON.parse(row.value);
    const isAttendance =
      row.id.startsWith("attendance-session:") &&
      value.class_section_id === req.params.id;
    const isProfile =
      row.id.startsWith("student-profile:") && value.group_id === req.params.id;
    if (!isAttendance && !isProfile) continue;
    await run("UPDATE settings SET value=? WHERE id=?", [
      JSON.stringify({
        ...value,
        ...(isAttendance ? { class_section_name: b.name } : {}),
        ...(isProfile ? { group_name: b.name, updated_at: now() } : {}),
      }),
      row.id,
    ]);
  }
  await audit(uid(req), "group.update", req.params.id as string);
  res.json({ ok: true });
});
api.delete("/admin/groups/:id", async (req, res) => {
  await run("DELETE FROM student_groups WHERE id=?", [req.params.id]);
  await audit(uid(req), "group.delete", req.params.id as string);
  res.json({ ok: true });
});
api.put("/admin/groups/:id/members", async (req, res) => {
  const b = z
    .object({ studentId: z.string(), member: z.boolean() })
    .parse(req.body);
  if (
    !(await one("SELECT id FROM users WHERE id=? AND role='student'", [
      b.studentId,
    ]))
  )
    bad("Student not found.");
  if (b.member) {
    const group = await one("SELECT id,name FROM student_groups WHERE id=?", [
      req.params.id,
    ]);
    if (!group) bad("Student group not found.");
    await run("DELETE FROM group_members WHERE user_id=?", [b.studentId]);
    await run(
      "INSERT INTO group_members(id,group_id,user_id) VALUES (?,?,?) ON CONFLICT(group_id,user_id) DO NOTHING",
      [id(), req.params.id, b.studentId],
    );
    const profileRow = await one("SELECT value FROM settings WHERE id=?", [
      `student-profile:${b.studentId}`,
    ]);
    if (profileRow) {
      const profile = JSON.parse(profileRow.value);
      await run("UPDATE settings SET value=? WHERE id=?", [
        JSON.stringify({
          ...profile,
          group_id: group.id,
          group_name: group.name,
          updated_at: now(),
        }),
        `student-profile:${b.studentId}`,
      ]);
    }
  } else {
    await run("DELETE FROM group_members WHERE group_id=? AND user_id=?", [
      req.params.id,
      b.studentId,
    ]);
    const profileRow = await one("SELECT value FROM settings WHERE id=?", [
      `student-profile:${b.studentId}`,
    ]);
    if (profileRow) {
      const profile = JSON.parse(profileRow.value);
      if (profile.group_id === req.params.id)
        await run("UPDATE settings SET value=? WHERE id=?", [
          JSON.stringify({
            ...profile,
            group_id: "",
            group_name: "",
            updated_at: now(),
          }),
          `student-profile:${b.studentId}`,
        ]);
    }
  }
  await audit(
    uid(req),
    "group.membership",
    req.params.id as string,
    JSON.stringify(b),
  );
  res.json({ ok: true });
});
api.post("/admin/assignments", async (req, res) => {
  const b = z
    .object({
      targetType: z.enum(["student", "group"]),
      targetId: z.string(),
      contentIds: z.array(z.string()).min(1).max(200),
      status: z.enum(["assigned", "revoked"]).default("assigned"),
    })
    .parse(req.body);
  const column = b.targetType === "student" ? "user_id" : "group_id";
  const target = await one(
    b.targetType === "student"
      ? "SELECT id FROM users WHERE id=? AND role='student'"
      : "SELECT id FROM student_groups WHERE id=?",
    [b.targetId],
  );
  if (!target) bad("Select a valid student or group.");
  for (const contentId of b.contentIds)
    if (!(await one("SELECT id FROM content WHERE id=?", [contentId])))
      bad("Content was not found.");
  for (const contentId of b.contentIds) {
    await run(
      `INSERT INTO access_grants(id,user_id,group_id,content_id,status,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(${column},content_id) WHERE ${column} IS NOT NULL DO UPDATE SET status=excluded.status,created_at=excluded.created_at`,
      [
        id(),
        b.targetType === "student" ? b.targetId : null,
        b.targetType === "group" ? b.targetId : null,
        contentId,
        b.status,
        now(),
      ],
    );
  }
  await audit(uid(req), "access.assign", b.targetId, JSON.stringify(b));
  res.json({ ok: true });
});
api.patch("/admin/assignments/:id", async (req, res) => {
  const b = z
    .object({ status: z.enum(["assigned", "revoked"]) })
    .parse(req.body);
  await update("access_grants", b, req.params.id as string);
  await audit(uid(req), "access.change", req.params.id as string, b.status);
  res.json({ ok: true });
});
const courseworkSchema = z.object({
  title: text,
  description: z.string().trim().min(1).max(10000),
  quizUrl: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => {
      if (!value) return true;
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    }, "Enter a valid secure HTTPS quiz link.")
    .default(""),
  dueAt: z.number().int().min(1),
  timeLimitMinutes: z.number().int().min(0).max(1440).default(0),
  status: z.enum(["draft", "published"]).default("published"),
  targetType: z.enum(["student", "group"]),
  targetIds: z.array(z.string()).min(1).max(200),
  resourceUploadIds: z.array(z.uuid()).max(10).default([]),
});
async function validateCoursework(
  body: z.infer<typeof courseworkSchema>,
  teacherId: string,
) {
  if (body.dueAt <= now()) bad("Choose a deadline in the future.");
  for (const targetId of body.targetIds) {
    const target = await one(
      body.targetType === "student"
        ? "SELECT id FROM users WHERE id=? AND role='student' AND status!='inactive'"
        : "SELECT id FROM student_groups WHERE id=?",
      [targetId],
    );
    if (!target) bad("One of the selected learners or groups is unavailable.");
  }
  for (const uploadId of body.resourceUploadIds) {
    const upload = await one(
      "SELECT * FROM uploads WHERE id=? AND owner_id=? AND state='ready'",
      [uploadId, teacherId],
    );
    if (!upload || !documentMimes.has(upload.mime))
      bad("An assignment resource is invalid or still processing.");
  }
}
api.post("/admin/coursework", async (req, res) => {
  const b = courseworkSchema.parse(req.body);
  await validateCoursework(b, uid(req));
  const assignment = await insert("learning_assignments", {
    id: id(),
    teacher_id: uid(req),
    title: b.title,
    description: b.description,
    quiz_url: b.quizUrl,
    due_at: b.dueAt,
    time_limit_minutes: b.timeLimitMinutes,
    status: b.status,
    created_at: now(),
    updated_at: now(),
  });
  for (const targetId of b.targetIds)
    await insert("assignment_targets", {
      id: id(),
      assignment_id: assignment.id,
      user_id: b.targetType === "student" ? targetId : null,
      group_id: b.targetType === "group" ? targetId : null,
    });
  for (const uploadId of b.resourceUploadIds)
    await insert("assignment_resources", {
      id: id(),
      assignment_id: assignment.id,
      upload_id: uploadId,
    });
  await audit(uid(req), "coursework.create", assignment.id, b.title);
  res.json(assignment);
});
api.patch("/admin/coursework/:id", async (req, res) => {
  const b = z
    .object({
      status: z.enum(["draft", "published"]),
      dueAt: z.number().int().min(1),
    })
    .parse(req.body);
  const assignment = await one(
    "SELECT id FROM learning_assignments WHERE id=?",
    [req.params.id],
  );
  if (!assignment) bad("Assignment not found.", 404);
  await update(
    "learning_assignments",
    { status: b.status, due_at: b.dueAt, updated_at: now() },
    assignment.id,
  );
  await audit(uid(req), "coursework.update", assignment.id, b.status);
  res.json({ ok: true });
});
api.patch(
  "/admin/coursework/:id/submissions/:submissionId",
  async (req, res) => {
    const b = z
      .object({ feedback: z.string().trim().max(5000) })
      .parse(req.body);
    const submission = await one(
      "SELECT id FROM assignment_submissions WHERE id=? AND assignment_id=?",
      [req.params.submissionId, req.params.id],
    );
    if (!submission) bad("Submission not found.", 404);
    await update(
      "assignment_submissions",
      { feedback: b.feedback, status: "reviewed", updated_at: now() },
      submission.id,
    );
    await audit(uid(req), "coursework.review", req.params.id as string);
    res.json({ ok: true });
  },
);
api.delete("/admin/coursework/:id", async (req, res) => {
  const assignment = await one(
    "SELECT id FROM learning_assignments WHERE id=?",
    [req.params.id],
  );
  if (!assignment) bad("Assignment not found.", 404);
  const attachedUploads = await query(
    `SELECT upload_id FROM assignment_resources WHERE assignment_id=?
     UNION
     SELECT f.upload_id FROM submission_files f
     JOIN assignment_submissions s ON s.id=f.submission_id
     WHERE s.assignment_id=?`,
    [assignment.id, assignment.id],
  );
  await run("DELETE FROM learning_assignments WHERE id=?", [assignment.id]);
  await audit(uid(req), "coursework.delete", assignment.id);
  const cleanupPending = await cleanupUploadsIfUnreferenced(
    attachedUploads.map((upload: any) => upload.upload_id),
  );
  res.json({ ok: true, cleanupPending });
});
api.post("/admin/announcements", async (req, res) => {
  const b = z
    .object({ title: text, body: z.string().min(1).max(5000) })
    .parse(req.body);
  const a = await insert("announcements", {
    id: id(),
    ...b,
    created_at: now(),
  });
  await audit(uid(req), "announcement.create", a.id);
  res.json(a);
});
api.delete("/admin/announcements/:id", async (req, res) => {
  await run("DELETE FROM announcements WHERE id=?", [req.params.id]);
  await audit(uid(req), "announcement.delete", req.params.id as string);
  res.json({ ok: true });
});
api.put("/admin/settings", async (req, res) => {
  const b = z
    .object({
      name: text,
      supportEmail: z.email(),
      welcome: z.string().max(300),
      weeklyGoal: z.number().int().min(10).max(2400),
    })
    .parse(req.body);
  await run(
    "INSERT INTO settings(id,value) VALUES ('platform',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
    [JSON.stringify(b)],
  );
  await audit(uid(req), "settings.update", "platform");
  res.json(b);
});
