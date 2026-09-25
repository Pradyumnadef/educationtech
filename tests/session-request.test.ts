import assert from "node:assert/strict";
import test from "node:test";
import { createSessionRequest } from "../src/session-request.ts";

test("concurrent session checks share a request but later checks are fresh", async () => {
  let count = 0;
  const request = createSessionRequest(async () => ++count);
  const first = request();
  assert.equal(request(), first);
  assert.deepEqual(await Promise.all([first, request()]), [1, 1]);
  assert.equal(await request(), 2);
});

test("failed session checks can be retried", async () => {
  let count = 0;
  const request = createSessionRequest(async () => {
    if (++count === 1) throw new Error("offline");
    return "recovered";
  });
  await assert.rejects(request(), /offline/);
  assert.equal(await request(), "recovered");
});

test("stalled session checks time out, abort, and allow a fresh attempt", async () => {
  let signal: AbortSignal;
  let count = 0;
  const request = createSessionRequest(async (nextSignal) => {
    signal = nextSignal;
    if (++count === 1) return new Promise<string>(() => {});
    return "recovered";
  }, 20);
  await assert.rejects(request(), /taking too long/);
  assert.equal(signal!.aborted, true);
  assert.equal(await request(), "recovered");
});
