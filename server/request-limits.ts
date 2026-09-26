import { rateLimit, ipKeyGenerator } from "express-rate-limit";

// Mount after session validation. Never trust a raw cookie as an account ID.
export function classroomLimiter() {
  return rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => (req as any).user?.id
      ? `user:${(req as any).user.id}`
      : `ip:${ipKeyGenerator(req.ip || req.socket.remoteAddress || "unknown")}`,
    message: { error: "Too many requests. Please try again in a moment." },
  });
}
