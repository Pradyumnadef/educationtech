import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { initDB, production, demo, run, now } from "./db.ts";
import { session, csrf } from "./security.ts";
import { teacherRoutes } from "./teachers.ts";
import { authRoutes } from "./auth.ts";
import { socialAuth } from "./supabase-auth.ts";
import { storageRoutes } from "./storage.ts";
import { api } from "./api.ts";
if (!process.env.SESSION_SECRET) {
  if (production) throw new Error("SESSION_SECRET is required.");
  process.env.SESSION_SECRET = randomBytes(48).toString("hex");
}
if (production) {
  for (const k of [
    "S3_BUCKET",
    "SCANNER_WEBHOOK_SECRET",
  ])
    if (!process.env[k]) throw new Error(`${k} is required in production.`);
  if (process.env.EMAIL_OTP_PROVIDER === 'supabase') {
    for (const key of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY'])
      if (!process.env[key]) throw new Error(`${key} is required in production.`);
    if (process.env.EMAIL_OTP_READY !== 'true') throw new Error('Configure and verify the email sender before production.');
  } else {
    for (const key of ['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_VERIFY_SERVICE_SID'])
      if (!process.env[key]) throw new Error(`${key} is required in production.`);
  }
  if (
    process.env.SESSION_SECRET.length < 32 ||
    process.env.SESSION_SECRET.startsWith("replace-")
  )
    throw new Error("Use a strong SESSION_SECRET.");
  if (!process.env.APP_ORIGIN?.startsWith("https://"))
    throw new Error("HTTPS APP_ORIGIN is required.");
  if (
    process.env.DEMO_MODE === "true" ||
    process.env.SEED_DEMO === "true" ||
    process.env.LOCAL_OTP === "true"
  )
    throw new Error("Disable demo mode in production.");
}
await initDB();

export const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: production
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            mediaSrc: ["'self'", "blob:"],
            connectSrc: [
              "'self'",
              "https://*.amazonaws.com",
              ...(process.env.S3_ENDPOINT ? [process.env.S3_ENDPOINT] : []),
            ],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(express.json({ limit: "350kb" }));
app.use(cookieParser());
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again in a moment." },
  }),
);
app.use("/api", session, csrf, (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.get("/api/health", (_req, res) => res.json({ ok: true, demo }));
app.use("/api", teacherRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/auth", socialAuth);
app.use("/api/storage", storageRoutes);
app.use("/api", api);
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "This endpoint was not found." }),
);
app.get("/robots.txt", (_req, res) =>
  res
    .type("text")
    .send(
      `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /admin\nDisallow: /auth\nDisallow: /onboarding\nDisallow: /api\nSitemap: ${process.env.APP_ORIGIN || "http://localhost:3000"}/sitemap.xml`,
    ),
);
app.get("/sitemap.xml", (_req, res) =>
  res
    .type("xml")
    .send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${(process.env.APP_ORIGIN || "http://localhost:3000").replace(/[<>&"']/g, "")}</loc></url></urlset>`,
    ),
);
app.use((req, res, next) => {
  if (/^\/(app|admin|auth|onboarding)/.test(req.path))
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});
if (production || process.env.SERVE_BUILD === "true") {
  app.get("/", (_req, res) => res.sendFile(path.resolve("dist/landing.html")));
  app.use(express.static(path.resolve("dist"), { maxAge: "1h", index: false }));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.resolve("dist/index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    configLoader: "native",
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (res.headersSent) return res.end();
    if (err instanceof z.ZodError)
      return res.status(400).json({
        error: err.issues[0]?.message || "Please check your entries.",
      });
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE" || err.code === "23505")
      return res.status(409).json({ error: "This record already exists." });
    if (err.code === "LIMIT_FILE_SIZE")
      return res.status(400).json({ error: "This file is too large." });
    const status = err.status || 500;
    if (status >= 500) console.error("Request failed:", err.message);
    res.status(status).json({
      error:
        status >= 500
          ? "Something went wrong. Please try again shortly."
          : err.message,
    });
  },
);
const port = Number(process.env.PORT) || 3000;
if (!process.env.VERCEL)
  app.listen(
    port,
    process.env.HOST || (production ? "0.0.0.0" : "127.0.0.1"),
    () =>
      console.log(
        `English Tech is ready at http://localhost:${port}${demo ? " (local verification enabled)" : ""}`,
      ),
  );
if (!process.env.VERCEL)
  setInterval(() => {
    Promise.all([
      run("DELETE FROM sessions WHERE expires_at<?", [now()]),
      run("DELETE FROM otps WHERE expires_at<?", [now() - 86400000]),
      run("DELETE FROM rate_limits WHERE expires_at<?", [now()]),
      run("DELETE FROM oauth_flows WHERE expires_at<=?", [now()]),
    ]).catch(console.error);
  }, 3600000).unref();
