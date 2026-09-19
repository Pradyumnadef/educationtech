import { Router } from "express";
import { z } from "zod";
import { query, one, run, insert, update, id, now } from "./db.ts";
import {
  auth,
  admin,
  safeUser,
  accessContext,
  canAccess,
  publicContent,
  audit,
  throttle,
} from "./security.ts";
export const api = Router();
const uid = (req: any) => req.user.id;
const text = z.string().trim().min(1).max(200);
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
  kind: z.enum(["subject", "chapter", "topic", "video"]),
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
  publish_at: z.number().nullable().default(null),
});
function bad(message: string, status = 400) {
  throw Object.assign(new Error(message), { status });
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
    ctx.nodes.filter((n: any) => canAccess(ctx, n.id)).map((n: any) => n.id),
  );
  const ancestors = new Set<string>();
  for (const node of ctx.nodes.filter((n: any) => allowed.has(n.id))) {
    let p = node.parent_id;
    while (p && !ancestors.has(p)) {
      ancestors.add(p);
      p = ctx.nodes.find((n: any) => n.id === p)?.parent_id;
    }
  }
  const content = ctx.nodes
    .filter(
      (n: any) =>
        allowed.has(n.id) ||
        ancestors.has(n.id) ||
        (n.public &&
          n.kind === "subject" &&
          n.status === "published" &&
          (!n.publish_at || n.publish_at <= now())),
    )
    .map((n: any) =>
      allowed.has(n.id)
        ? { ...publicContent(n), accessible: true }
        : {
            id: n.id,
            name: n.name,
            kind: n.kind,
            parent_id: n.parent_id,
            thumbnail: n.thumbnail,
            description: n.public ? n.description : "",
            accessible: ancestors.has(n.id),
            container: ancestors.has(n.id),
            locked: !ancestors.has(n.id),
          },
    );
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
    settings: settings
      ? JSON.parse(settings.value)
      : {
          name: "English Tech",
          weeklyGoal: 120,
          welcome: "A little progress, every day.",
        },
  });
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
  res.json({ ok: true });
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
        canAccess(ctx, n.id) &&
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
  if (!canAccess(ctx, req.params.id as string))
    bad("This content has not been assigned to your account yet.", 403);
  const node = ctx.nodes.find((n: any) => n.id === req.params.id);
  if (node.kind !== "video") bad("Video not found.", 404);
  res.json({
    ...publicContent(node),
    media: node.storage_key ? `/api/storage/media/${node.id}/video` : null,
    captions: node.caption_key
      ? `/api/storage/media/${node.id}/captions`
      : null,
    resource: node.resource_key
      ? `/api/storage/media/${node.id}/resource`
      : null,
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
  if (!canAccess(ctx, req.params.id as string))
    bad("Your access to this lesson has changed.", 403);
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
api.patch("/profile", async (req, res) => {
  const b = z
    .object({
      name: text,
      avatar: safePicture.optional(),
      interests: z.array(z.string().max(80)).max(30).optional(),
      onboarding: z.boolean().optional(),
    })
    .parse(req.body);
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
  res.json(safeUser(await one("SELECT * FROM users WHERE id=?", [uid(req)])));
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
  const content = (
    await query("SELECT * FROM content ORDER BY created_at DESC")
  ).map(publicContent);
  const groups = await query("SELECT * FROM student_groups ORDER BY name");
  const members = await query("SELECT * FROM group_members");
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
  await run("DELETE FROM users WHERE id=?", [student.id]);
  await audit(uid(req), "student.delete", student.id);
  res.json({ ok: true });
});
api.post("/admin/students/:id/reset-access", async (req, res) => {
  await run("UPDATE access_grants SET status='revoked' WHERE user_id=?", [
    req.params.id,
  ]);
  await run("DELETE FROM group_members WHERE user_id=?", [req.params.id]);
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
    const expected: Record<string, string> = {
      chapter: "subject",
      topic: "chapter",
      video: "topic",
    };
    if (parent?.kind !== expected[b.kind] || b.parent_id === recordId)
      bad(`Select a valid ${expected[b.kind]}.`);
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
  res.json({
    ...item,
    tags: JSON.parse(item.tags),
    uploaded_files: uploadedFiles,
  });
});
api.post("/admin/content", async (req, res) => {
  const b = contentSchema.parse(req.body);
  await validateContent(b);
  const row = await insert("content", {
    id: id(),
    ...b,
    tags: JSON.stringify(b.tags),
    created_at: now(),
    updated_at: now(),
  });
  await audit(uid(req), "content.create", row.id, b.name);
  res.json(publicContent(row));
});
api.put("/admin/content/:id", async (req, res) => {
  const b = contentSchema.parse(req.body);
  const existing = await one("SELECT kind FROM content WHERE id=?", [
    req.params.id,
  ]);
  if (!existing) bad("Content not found.", 404);
  if (b.kind !== existing.kind) bad("Content type cannot be changed.");
  await validateContent(b, req.params.id as string);
  await update(
    "content",
    { ...b, tags: JSON.stringify(b.tags), updated_at: now() },
    req.params.id as string,
  );
  await audit(uid(req), "content.update", req.params.id as string, b.name);
  res.json({ ok: true });
});
api.delete("/admin/content/:id", async (req, res) => {
  await run("DELETE FROM content WHERE id=?", [req.params.id]);
  await audit(uid(req), "content.delete", req.params.id as string);
  res.json({ ok: true });
});
api.post("/admin/groups", async (req, res) => {
  const b = z
    .object({ name: text, description: z.string().max(1000).default("") })
    .parse(req.body);
  const row = await insert("student_groups", {
    id: id(),
    ...b,
    created_at: now(),
  });
  await audit(uid(req), "group.create", row.id);
  res.json(row);
});
api.patch("/admin/groups/:id", async (req, res) => {
  const b = z
    .object({ name: text, description: z.string().max(1000).default("") })
    .parse(req.body);
  await update("student_groups", b, req.params.id as string);
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
  if (b.member)
    await run(
      "INSERT INTO group_members(id,group_id,user_id) VALUES (?,?,?) ON CONFLICT(group_id,user_id) DO NOTHING",
      [id(), req.params.id, b.studentId],
    );
  else
    await run("DELETE FROM group_members WHERE group_id=? AND user_id=?", [
      req.params.id,
      b.studentId,
    ]);
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
  await run("DELETE FROM learning_assignments WHERE id=?", [assignment.id]);
  await audit(uid(req), "coursework.delete", assignment.id);
  res.json({ ok: true });
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
