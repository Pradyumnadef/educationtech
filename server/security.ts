import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { one, run, insert, id, now, production, query } from "./db.ts";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 400;
const SESSION_RENEW_WINDOW_MS = 1000 * 60 * 60 * 24 * 30;
function sessionCookie(res: Response, token: string) {
  res.cookie("lumio_session", token, {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    maxAge: SESSION_DURATION_MS,
    path: "/",
  });
}
export function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function passwordHash(value: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(value, salt, 64).toString("hex")}`;
}
export function passwordCheck(value: string, encoded: string) {
  try {
    const [salt, key] = encoded.split(":");
    return timingSafeEqual(
      Buffer.from(key, "hex"),
      scryptSync(value, salt, 64),
    );
  } catch {
    return false;
  }
}
export const safeUser = (u: any) => {
  const { password_hash, ...safe } = u;
  return { ...safe, interests: JSON.parse(u.interests || "[]") };
};
export async function session(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.lumio_session;
    if (token) {
      const s = await one(
        "SELECT * FROM sessions WHERE token_hash=? AND expires_at>?",
        [hash(token), now()],
      );
      if (s) {
        const u = await one("SELECT * FROM users WHERE id=?", [s.user_id]);
        if (u?.status === "active") {
          (req as any).user = u;
          (req as any).session = s;
          if (Number(s.expires_at) - now() < SESSION_RENEW_WINDOW_MS) {
            const expiresAt = now() + SESSION_DURATION_MS;
            await run("UPDATE sessions SET expires_at=? WHERE id=?", [
              expiresAt,
              s.id,
            ]);
            (req as any).session.expires_at = expiresAt;
            sessionCookie(res, token);
          }
        }
      }
    }
    next();
  } catch (e) {
    next(e);
  }
}
export function auth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user)
    return res.status(401).json({ error: "Please sign in to continue." });
  next();
}
export function admin(req: Request, res: Response, next: NextFunction) {
  if ((req as any).user?.role !== "admin")
    return res.status(403).json({ error: "This area is for teachers only." });
  next();
}
export function csrf(req: Request, res: Response, next: NextFunction) {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.origin;
    const expected = process.env.APP_ORIGIN || "http://localhost:3000";
    if (origin && origin !== expected)
      return res.status(403).json({ error: "Request origin is not allowed." });
    if (
      (req as any).session &&
      req.headers["x-csrf-token"] !== (req as any).session.csrf
    )
      return res
        .status(403)
        .json({ error: "Your security token expired. Refresh the page." });
  }
  next();
}
export async function createSession(res: Response, user: any) {
  const token = randomBytes(32).toString("hex"),
    csrf = randomBytes(24).toString("hex");
  await insert("sessions", {
    id: id(),
    user_id: user.id,
    token_hash: hash(token),
    csrf,
    expires_at: now() + SESSION_DURATION_MS,
  });
  sessionCookie(res, token);
  await run("UPDATE users SET last_active=? WHERE id=?", [now(), user.id]);
  return { user: safeUser(user), csrf };
}
export async function audit(
  actor: string,
  action: string,
  target: string,
  detail = "",
) {
  await insert("activity_logs", {
    id: id(),
    actor_id: actor,
    action,
    target_id: target,
    detail,
    created_at: now(),
  });
}
export async function throttle(key: string, limit: number, windowMs: number) {
  const t = now();
  const row = await one(
    `INSERT INTO rate_limits(id,hits,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET hits=CASE WHEN rate_limits.expires_at<=? THEN 1 ELSE rate_limits.hits+1 END, expires_at=CASE WHEN rate_limits.expires_at<=? THEN ? ELSE rate_limits.expires_at END RETURNING hits`,
    [key, t + windowMs, t, t, t + windowMs],
  );
  if (row.hits > limit)
    throw Object.assign(
      new Error("Too many attempts. Please wait a few minutes and try again."),
      { status: 429 },
    );
}
export async function accessContext(user: any) {
  return {
    user,
    grants: await query(
      "SELECT * FROM access_grants WHERE user_id=? OR group_id IN (SELECT group_id FROM group_members WHERE user_id=?)",
      [user.id, user.id],
    ),
    nodes: await query("SELECT * FROM content"),
  };
}
export function canAccess(ctx: any, contentId: string) {
  if (ctx.user.status !== "active") return false;
  if (ctx.user.role === "admin") return true;
  const chain: string[] = [];
  let node = ctx.nodes.find((n: any) => n.id === contentId);
  if (!node) return false;
  let depth = 0;
  while (node && depth++ < 64) {
    if (
      node.status !== "published" ||
      (node.publish_at && node.publish_at > now())
    )
      return false;
    chain.push(node.id);
    node = ctx.nodes.find((n: any) => n.id === node.parent_id);
  }
  const matching = ctx.grants.filter((g: any) => chain.includes(g.content_id));
  if (
    matching.some(
      (g: any) => g.user_id === ctx.user.id && g.status === "revoked",
    )
  )
    return false;
  return matching.some((g: any) => g.status === "assigned");
}
export function canViewContent(ctx: any, contentId: string) {
  if (ctx.user.status !== "active") return false;
  if (ctx.user.role === "admin") return true;
  let node = ctx.nodes.find((entry: any) => entry.id === contentId);
  if (!node) return false;
  let depth = 0;
  while (node && depth++ < 64) {
    if (
      node.status !== "published" ||
      (node.publish_at && Number(node.publish_at) > now())
    )
      return false;
    node = ctx.nodes.find((entry: any) => entry.id === node.parent_id);
  }
  return depth < 64;
}
export function publicContent(node: any) {
  const { storage_key, caption_key, resource_key, ...safe } = node;
  return { ...safe, tags: JSON.parse(node.tags || "[]") };
}
