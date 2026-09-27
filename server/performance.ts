import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

type Timing = { queries: number; databaseMs: number; poolWaitMs: number };
export const requestTiming = new AsyncLocalStorage<Timing>();
export function recordDatabaseTiming(started: number, waitMs = 0) {
  const timing = requestTiming.getStore();
  if (!timing) return;
  timing.queries++;
  timing.databaseMs += performance.now() - started;
  timing.poolWaitMs += waitMs;
}

// Deliberately excludes URLs, query strings, SQL, cookies and student identifiers.
export const performanceLogging: RequestHandler = (req, res, next) => {
  const started = performance.now();
  const requestId = randomUUID();
  const timing: Timing = { queries: 0, databaseMs: 0, poolWaitMs: 0 };
  res.setHeader("X-Request-Id", requestId);
  let reported = false;
  const report = () => {
    if (reported) return;
    reported = true;
    const durationMs = performance.now() - started;
    const aborted = !res.writableFinished;
    if (process.env.PERFORMANCE_LOGS === "false") return;
    if (!aborted && res.statusCode < 500 && durationMs < 1000 && Math.random() >= 0.01) return;
    const entry = {
      event: "request_performance", requestId, method: req.method,
      route: typeof req.route?.path === "string" ? req.route.path : "unmatched",
      status: res.statusCode, aborted, durationMs: Math.round(durationMs),
      queries: timing.queries, databaseMs: Math.round(timing.databaseMs),
      poolWaitMs: Math.round(timing.poolWaitMs),
    };
    (res.statusCode >= 500 ? console.error : console.log)(JSON.stringify(entry));
  };
  res.once("finish", report);
  res.once("close", report);
  requestTiming.run(timing, next);
};
