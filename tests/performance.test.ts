import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { performanceLogging, recordDatabaseTiming, requestTiming } from "../server/performance.ts";

test("concurrent request measurements stay isolated and never log request secrets", async () => {
  const app = express();
  app.use(performanceLogging);
  app.get("/file/:id", async (req, res) => {
    const started = performance.now();
    await new Promise(resolve => setTimeout(resolve, req.params.id === "secret-one" ? 20 : 5));
    recordDatabaseTiming(started, 3);
    assert.equal(requestTiming.getStore()?.queries, 1);
    res.status(500).json({error:"fixture"});
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as {port:number}).port;
  const original = console.error;
  const logs: string[] = [];
  console.error = entry => logs.push(String(entry));
  try {
    const responses = await Promise.all(["secret-one", "secret-two"].map(id => fetch(`http://127.0.0.1:${port}/file/${id}?token=private-token`, {headers:{Cookie:"private-cookie"}})));
    await Promise.all(responses.map(r => r.text()));
    assert.notEqual(responses[0].headers.get("x-request-id"), responses[1].headers.get("x-request-id"));
    assert.equal(logs.length, 2);
    for (const line of logs) {
      assert.doesNotMatch(line, /secret-one|secret-two|private-token|private-cookie/);
      const entry = JSON.parse(line);
      assert.equal(entry.route, "/file/:id");
      assert.equal(entry.queries, 1);
      assert.equal(entry.poolWaitMs, 3);
      assert.equal(entry.aborted, false);
    }
  } finally {
    console.error = original;
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
