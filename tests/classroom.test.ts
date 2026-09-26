import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { classroomLimiter } from "../server/request-limits.ts";

test("100 verified accounts on one IP can each load a PDF without sharing a quota", async () => {
  const app = express();
  // Stand-in for the session middleware: only pre-verified fixture identities.
  app.use((req, _res, next) => {
    const account = req.headers["x-test-account"];
    if (typeof account === "string" && /^student-\d+$/.test(account))
      (req as any).user = { id: account };
    next();
  });
  app.use(classroomLimiter());
  app.get("/file", (_req, res) => res.status(206).send("pdf range"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const port = (server.address() as any).port;
  const fetchFile = async (account: string) => {
    const response = await fetch(`http://127.0.0.1:${port}/file`, {
      headers: { "x-test-account": account },
    });
    await response.text();
    return response.status;
  };
  try {
    const results = await Promise.all(Array.from({length: 100}, async (_, index) => {
      const statuses = [];
      for (let part = 0; part < 12; part++) statuses.push(await fetchFile(`student-${index}`));
      return statuses;
    }));
    assert.equal(results.flat().length, 1200);
    assert.ok(results.flat().every(status => status === 206));
    const flood = [];
    for (let i = 0; i < 301; i++) flood.push(await fetchFile("student-199"));
    assert.equal(flood.at(-1), 429);
    assert.equal(await fetchFile("student-100"), 206);
    assert.equal(await fetchFile("unverified"), 206);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
