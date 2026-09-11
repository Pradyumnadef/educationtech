import { Router } from "express";
import { randomInt, createHmac } from "node:crypto";
import { z } from "zod";
import { sendEmailOtp, verifyEmailOtp } from './supabase-auth.ts';
import { one, insert, run, id, now, demo } from "./db.ts";
import {
  auth,
  createSession,
  passwordCheck,
  passwordHash,
  safeUser,
  throttle,
} from "./security.ts";
export const authRoutes = Router();
const identifierSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(
    (v) => z.email().safeParse(v).success || /^\+[1-9]\d{7,14}$/.test(v),
    "Enter a valid email or phone number with country code.",
  );
const otpHash = (challenge: string, code: string) =>
  createHmac("sha256", process.env.SESSION_SECRET!)
    .update(`${challenge}:${code}`)
    .digest("hex");
async function twilio(action: string, body: Record<string, string>) {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid)
    throw Object.assign(
      new Error(
        "Verification delivery is not configured. Please contact your teacher.",
      ),
      { status: 503 },
    );
  const r = await fetch(
    `https://verify.twilio.com/v2/Services/${sid}/${action}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body),
      signal: AbortSignal.timeout(15000),
    },
  );
  const data = (await r.json()) as any;
  if (!r.ok)
    throw Object.assign(
      new Error("Verification could not be completed. Try again shortly."),
      { status: 400 },
    );
  return data;
}
authRoutes.get("/session", async (req, res) =>
  res.json({
    user: (req as any).user ? safeUser((req as any).user) : null,
    csrf: (req as any).session?.csrf,
    demo,
    isOwner: !!(
      (req as any).user &&
      (await one("SELECT user_id FROM platform_owner WHERE id=1"))?.user_id ===
        (req as any).user.id
    ),
    platform: JSON.parse(
      (await one("SELECT value FROM settings WHERE id='platform'"))?.value ||
        '{"name":"English Tech"}',
    ),
  }),
);
authRoutes.post("/otp/send", async (req, res) => {
  const { identifier, purpose } = z
    .object({
      identifier: identifierSchema,
      purpose: z.enum(["login", "signup", "email", "phone"]).default("login"),
    })
    .parse(req.body);
  if (["email", "phone"].includes(purpose) && !(req as any).user)
    return res.status(401).json({ error: "Please sign in." });
  await throttle(`otp-ip:${req.ip}`, 15, 900000);
  await throttle(`otp:${identifier}`, 5, 900000);
  const recent = await one(
    "SELECT * FROM otps WHERE identifier=? ORDER BY created_at DESC LIMIT 1",
    [identifier],
  );
  if (recent && now() - Number(recent.created_at) < 60000)
    return res.status(429).json({
      error: "Please wait 60 seconds before requesting another code.",
    });
  const challenge = id(),
    code = String(randomInt(100000, 1000000));
  const provider = demo ? 'local' : identifier.includes('@') && process.env.EMAIL_OTP_PROVIDER === 'supabase' ? 'supabase' : 'twilio';
  if (provider === 'supabase') await sendEmailOtp(identifier);
  else if (!demo)
    await twilio("Verifications", {
      To: identifier,
      Channel: identifier.includes("@") ? "email" : "sms",
    });
  await run("UPDATE otps SET consumed=1 WHERE identifier=?", [identifier]);
  await insert("otps", {
    id: challenge,
    identifier,
    code_hash: otpHash(challenge, code),
    purpose,
    attempts: 0,
    consumed: 0,
    expires_at: now() + 300000,
    created_at: now(),
  });
  await insert('otp_bindings', { id: challenge, provider, user_id: ['email','phone'].includes(purpose) ? (req as any).user.id : null });
  res.json({ challenge, expiresIn: 300, ...(demo ? { demoCode: code } : {}) });
});
authRoutes.post("/otp/verify", async (req, res) => {
  const { challenge, code } = z
    .object({
      challenge: z.uuid(),
      code: z.string().regex(/^\d{6,8}$/, "Enter the verification code from your email."),
    })
    .parse(req.body);
  await throttle(`verify:${req.ip}`, 30, 900000);
  const otp = await one(
    "UPDATE otps SET attempts=attempts+1 WHERE id=? AND consumed=0 AND expires_at>? AND attempts<5 RETURNING *",
    [challenge, now()],
  );
  if (!otp)
    return res.status(400).json({
      error:
        "This code has expired or reached its attempt limit. Request a new code.",
    });
  const binding = await one('SELECT * FROM otp_bindings WHERE id=?', [challenge]);
  if (['email','phone'].includes(otp.purpose) && (!binding?.user_id || binding.user_id !== (req as any).user?.id))
    return res.status(403).json({ error: 'This verification belongs to another session.' });
  const provider = binding?.provider || (demo ? 'local' : 'twilio');
  const valid = provider === 'supabase' ? await verifyEmailOtp(otp.identifier, code) : provider === 'local' && demo
    ? otp.code_hash === otpHash(challenge, code)
    : (await twilio("VerificationCheck", { To: otp.identifier, Code: code }))
        .status === "approved";
  if (!valid)
    return res
      .status(400)
      .json({ error: "That code is not correct. Please try again." });
  const claimed = await one(
    "UPDATE otps SET consumed=1 WHERE id=? AND consumed=0 RETURNING id",
    [challenge],
  );
  if (!claimed)
    return res.status(400).json({ error: "This code has already been used." });
  if (["email", "phone"].includes(otp.purpose)) {
    const u = (req as any).user;
    if (!u) return res.status(401).json({ error: "Please sign in." });
    if ((otp.purpose === "email") !== otp.identifier.includes("@"))
      return res
        .status(400)
        .json({ error: "Verification type does not match." });
    const duplicate = await one(
      `SELECT id FROM users WHERE ${otp.purpose}=? AND id<>?`,
      [otp.identifier, u.id],
    );
    if (duplicate)
      return res
        .status(409)
        .json({ error: "This contact is already linked to another account." });
    await run(`UPDATE users SET ${otp.purpose}=?,updated_at=? WHERE id=?`, [
      otp.identifier,
      now(),
      u.id,
    ]);
    return res.json({
      user: safeUser(await one("SELECT * FROM users WHERE id=?", [u.id])),
    });
  }
  let user = await one("SELECT * FROM users WHERE email=? OR phone=?", [
    otp.identifier,
    otp.identifier,
  ]);
  if (user?.role === "admin")
    return res.status(403).json({ error: "Please use teacher sign in." });
  if (!user) {
    if (otp.purpose === "login")
      return res.status(404).json({
        error: "No student account found. Create an account to get started.",
      });
    user = await insert("users", {
      id: id(),
      role: "student",
      name: "New learner",
      email: otp.identifier.includes("@") ? otp.identifier : null,
      phone: otp.identifier.includes("@") ? null : otp.identifier,
      status: "active",
      avatar: "",
      interests: "[]",
      onboarding: 0,
      created_at: now(),
      updated_at: now(),
    });
  }
  if (user.status !== "active")
    return res.status(403).json({
      error:
        "Your account is awaiting approval or has been deactivated. Contact your teacher.",
    });
  res.json(await createSession(res, user));
});
authRoutes.post("/admin", async (req, res) => {
  const { email, password } = z
    .object({
      email: z.email().toLowerCase(),
      password: z.string().min(1).max(200),
    })
    .parse(req.body);
  await throttle(`admin-ip:${req.ip}`, 20, 900000);
  await throttle(`admin:${email}`, 8, 900000);
  const user = await one("SELECT * FROM users WHERE email=? AND role='admin'", [
    email,
  ]);
  const valid = passwordCheck(
    password,
    user?.password_hash || passwordHash("not-a-valid-password"),
  );
  if (!user || !valid || user.status !== "active")
    return res.status(401).json({ error: "Email or password is incorrect." });
  res.json(await createSession(res, user));
});
authRoutes.post("/logout", auth, async (req, res) => {
  await run("DELETE FROM sessions WHERE id=?", [(req as any).session.id]);
  res.clearCookie("lumio_session", { path: "/" });
  res.json({ ok: true });
});
authRoutes.post("/password", auth, async (req, res) => {
  const { currentPassword, password } = z
    .object({
      currentPassword: z.string(),
      password: z.string().min(12).max(200),
    })
    .parse(req.body);
  const user = (req as any).user;
  if (
    user.role !== "admin" ||
    !passwordCheck(currentPassword, user.password_hash)
  )
    return res.status(400).json({ error: "Current password is incorrect." });
  await run("UPDATE users SET password_hash=?,updated_at=? WHERE id=?", [
    passwordHash(password),
    now(),
    user.id,
  ]);
  await run("DELETE FROM sessions WHERE user_id=? AND id<>?", [
    user.id,
    (req as any).session.id,
  ]);
  res.json({ ok: true });
});
