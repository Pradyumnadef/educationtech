import { Router, type Request } from "express";
import { z } from "zod";
import { timingSafeEqual, createHash } from "node:crypto";
import {
  one,
  query,
  insert,
  run,
  update,
  now,
  id,
  production,
  createInitialTeacher,
} from "./db.ts";
import {
  auth,
  admin,
  audit,
  createSession,
  passwordHash,
  safeUser,
  throttle,
} from "./security.ts";

export const teacherRoutes = Router();
const teacherSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.email().trim().toLowerCase(),
  password: z
    .string()
    .min(12, "Use at least 12 characters for your password.")
    .max(200),
});
const configuredKey = () => process.env.TEACHER_SETUP_KEY || "";
function localSetup(req: Request) {
  return (
    !production &&
    !configuredKey() &&
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
      req.socket.remoteAddress || "",
    ) &&
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
      process.env.APP_ORIGIN || "http://localhost:3000",
    )
  );
}
async function setupComplete() {
  return !!(await one(
    "SELECT id FROM platform_owner UNION ALL SELECT 1 FROM users WHERE role='admin' LIMIT 1",
  ));
}
teacherRoutes.get("/auth/setup", async (req, res) => {
  const complete = await setupComplete();
  res.json({
    complete,
    available: !complete && (localSetup(req) || configuredKey().length >= 32),
    requiresKey: !localSetup(req),
  });
});
teacherRoutes.post("/auth/setup", async (req, res) => {
  await throttle(`teacher-setup:${req.ip}`, 10, 900000);
  if (await setupComplete())
    return res
      .status(409)
      .json({ error: "Teacher setup is already complete. Please sign in." });
  if (
    req.headers.origin !== (process.env.APP_ORIGIN || "http://localhost:3000")
  )
    return res
      .status(403)
      .json({ error: "Open setup from your website address." });
  if (!localSetup(req)) {
    const key = configuredKey();
    const supplied =
      typeof req.body.setupKey === "string" ? req.body.setupKey : "";
    const digest = (s: string) => createHash("sha256").update(s).digest();
    if (key.length < 32 || !timingSafeEqual(digest(key), digest(supplied)))
      return res
        .status(403)
        .json({ error: "A valid owner setup key is required." });
  }
  const b = teacherSchema.parse(req.body);
  const user = await createInitialTeacher({
    id: id(),
    name: b.name,
    email: b.email,
    password_hash: passwordHash(b.password),
    role: "admin",
    status: "active",
    avatar: "",
    interests: "[]",
    onboarding: 1,
    created_at: now(),
    updated_at: now(),
  });
  await audit(user.id, "owner.create", user.id);
  res.status(201).json(await createSession(res, user));
});

teacherRoutes.use("/admin/teachers", auth, admin, async (req, res, next) => {
  const owner = await one("SELECT user_id FROM platform_owner WHERE id=1");
  if (owner?.user_id !== (req as any).user.id)
    return res
      .status(403)
      .json({ error: "Only the account owner can manage teachers." });
  next();
});
teacherRoutes.get("/admin/teachers", async (_req, res) => {
  const rows = await query(
    "SELECT u.id,u.name,u.email,u.status,u.created_at,u.last_active,CASE WHEN o.user_id IS NULL THEN 0 ELSE 1 END AS is_owner FROM users u LEFT JOIN platform_owner o ON o.user_id=u.id WHERE u.role='admin' ORDER BY u.created_at",
  );
  res.json(rows);
});
teacherRoutes.post("/admin/teachers", async (req, res) => {
  await throttle(`teacher-create:${(req as any).user.id}`, 20, 3600000);
  const b = teacherSchema.parse(req.body);
  if (await one("SELECT id FROM users WHERE email=?", [b.email]))
    return res
      .status(409)
      .json({ error: "This email already belongs to an account." });
  const user = await insert("users", {
    id: id(),
    name: b.name,
    email: b.email,
    password_hash: passwordHash(b.password),
    role: "admin",
    status: "active",
    avatar: "",
    interests: "[]",
    onboarding: 1,
    created_at: now(),
    updated_at: now(),
  });
  await audit((req as any).user.id, "teacher.create", user.id);
  res.status(201).json(safeUser(user));
});
teacherRoutes.patch("/admin/teachers/:id", async (req, res) => {
  const b = z
    .object({
      name: z.string().trim().min(2).max(200).optional(),
      status: z.enum(["active", "inactive"]).optional(),
    })
    .parse(req.body);
  const teacher = await one(
    "SELECT id FROM users WHERE id=? AND role='admin'",
    [req.params.id],
  );
  if (!teacher) return res.status(404).json({ error: "Teacher not found." });
  const owner = await one("SELECT user_id FROM platform_owner WHERE id=1");
  if (teacher.id === owner?.user_id)
    return res
      .status(403)
      .json({
        error:
          "Update your own name in Profile. The owner account cannot be deactivated here.",
      });
  await update("users", { ...b, updated_at: now() }, teacher.id);
  if (b.status === "inactive")
    await run("DELETE FROM sessions WHERE user_id=?", [teacher.id]);
  await audit(
    (req as any).user.id,
    "teacher.update",
    teacher.id,
    JSON.stringify(b),
  );
  res.json({ ok: true });
});
teacherRoutes.delete("/admin/teachers/:id", async (req, res) => {
  const teacher = await one(
    "SELECT id,name,email FROM users WHERE id=? AND role='admin'",
    [req.params.id],
  );
  if (!teacher) return res.status(404).json({ error: "Teacher not found." });
  const owner = await one("SELECT user_id FROM platform_owner WHERE id=1");
  if (!owner?.user_id)
    return res.status(409).json({ error: "The account owner is unavailable." });
  if (teacher.id === owner.user_id)
    return res
      .status(403)
      .json({ error: "The protected owner account cannot be removed." });

  // Keep shared learning material available after a teacher leaves. The user
  // deletion then cascades through their sessions and linked identities.
  await run("UPDATE uploads SET owner_id=? WHERE owner_id=?", [
    owner.user_id,
    teacher.id,
  ]);
  await run(
    "UPDATE learning_assignments SET teacher_id=?,updated_at=? WHERE teacher_id=?",
    [owner.user_id, now(), teacher.id],
  );
  await run("DELETE FROM users WHERE id=? AND role='admin'", [teacher.id]);
  await audit(
    (req as any).user.id,
    "teacher.delete",
    teacher.id,
    JSON.stringify({ name: teacher.name, email: teacher.email }),
  );
  res.json({ ok: true });
});
