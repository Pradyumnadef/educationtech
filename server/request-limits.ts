import { rateLimit, ipKeyGenerator } from "express-rate-limit";

// Mount after session validation. Never trust a raw cookie as an account ID.
export function classroomLimiter() {
  return rateLimit({
    windowMs: 60000,
    // A class of 100 needs ~500 anonymous requests to open the sign-in
    // page and complete OTP login. Account/challenge limits remain separate.
    limit: (req) => (req as any).user?.id ? 300 : 600,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => (req as any).user?.id
      ? `user:${(req as any).user.id}`
      : `ip:${ipKeyGenerator(req.ip || req.socket.remoteAddress || "unknown")}`,
    message: { error: "Too many requests. Please try again in a moment." },
  });
}
