import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

mkdirSync("test-results", { recursive: true });
const directory = mkdtempSync(path.resolve("test-results/owner-test-"));
const origin = "http://localhost:3108";
const setupKey = "isolated-owner-regression-key-2026-abcdef";
const password = "Owner-regression-password-2026!";
let server: ChildProcess;
let output = "";
type Client = { cookie: string; csrf: string };
const guest: Client = { cookie: "", csrf: "" };
let owner = guest,
  teacher = guest,
  student = guest;
let ownerEmail = "",
  ownerId = "",
  teacherId = "";
async function request(
  url: string,
  method = "GET",
  body?: any,
  client = guest,
  extra: Record<string, string> = {},
) {
  const r = await fetch(origin + "/api" + url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(client.cookie
        ? { Cookie: client.cookie, "X-CSRF-Token": client.csrf }
        : {}),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
async function start() {
  server = spawn(process.execPath, ["server/index.ts"], {
    env: {
      ...process.env,
      NODE_ENV: "development",
      PORT: "3108",
      APP_ORIGIN: origin,
      DATA_DIR: directory,
      DATABASE_URL: "",
      LOCAL_OTP: "true",
      DEMO_MODE: "false",
      SEED_DEMO: "true",
      SERVE_BUILD: "true",
      TEACHER_SETUP_KEY: setupKey,
      SESSION_SECRET: "fixed-isolated-test-session-secret-2026",
    },
    windowsHide: true,
    stdio: "pipe",
  });
  server.stderr?.on("data", (b) => (output += b));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await request("/health")).status === 200) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(output || "Test server failed to start");
}
async function stop() {
  if (server && server.exitCode === null) {
    const done = new Promise<void>((r) => server.once("exit", () => r()));
    server.kill();
    await done;
  }
}
before(start);
after(async () => {
  await stop();
  if (directory.startsWith(path.resolve("test-results") + path.sep))
    rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 4,
      retryDelay: 200,
    });
});

test("fresh startup never seeds demo accounts or catalog, even with legacy seed flag", async () => {
  assert.deepEqual((await request("/catalog")).data, []);
  const state = await request("/auth/setup");
  assert.deepEqual(state.data, {
    complete: false,
    available: true,
    requiresKey: true,
  });
  assert.equal(
    (
      await request("/auth/admin", "POST", {
        email: "teacher@lumio.local",
        password: "ChangeMe-Demo-2026!",
      })
    ).status,
    401,
  );
});
test("first teacher requires the private setup key, expected origin, and valid password", async () => {
  const b = { name: "Owner", email: "owner@example.test", password };
  assert.equal((await request("/auth/setup", "POST", b)).status, 403);
  assert.equal(
    (
      await request("/auth/setup", "POST", { ...b, setupKey }, guest, {
        Origin: "https://unexpected.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/auth/setup", "POST", {
        ...b,
        setupKey,
        password: "short",
      })
    ).status,
    400,
  );
  assert.equal((await request("/auth/setup")).data.complete, false);
});
test("two simultaneous first-teacher registrations produce one owner only", async () => {
  const responses = await Promise.all(
    ["one", "two"].map((n) =>
      request("/auth/setup", "POST", {
        name: `Owner ${n}`,
        email: `${n}@example.test`,
        password,
        setupKey,
      }),
    ),
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  const winner = responses.find((r) => r.status === 201)!;
  owner = { cookie: winner.cookie, csrf: winner.data.csrf };
  ownerId = winner.data.user.id;
  ownerEmail = winner.data.user.email;
  assert.equal(
    (await request("/auth/session", "GET", undefined, owner)).data.isOwner,
    true,
  );
  assert.equal(
    (await request("/admin/teachers", "GET", undefined, owner)).data.length,
    1,
  );
  const overview = await request("/admin/overview", "GET", undefined, owner);
  assert.equal(overview.data.students.length, 0);
  assert.equal(overview.data.content.length, 0);
});
test("setup closes durably and rejects replay after a server restart", async () => {
  await stop();
  await start();
  assert.equal((await request("/auth/setup")).data.complete, true);
  assert.equal(
    (
      await request("/auth/setup", "POST", {
        name: "Another owner",
        email: "another@example.test",
        password,
        setupKey,
      })
    ).status,
    409,
  );
  assert.equal(
    (await request("/auth/admin", "POST", { email: ownerEmail, password }))
      .status,
    200,
  );
});
test("owner creates a teacher; credentials are hashed and owner cannot be deactivated", async () => {
  const created = await request(
    "/admin/teachers",
    "POST",
    { name: "New Teacher", email: "teacher@example.test", password },
    owner,
  );
  assert.equal(created.status, 201);
  assert.equal(created.data.password_hash, undefined);
  teacherId = created.data.id;
  assert.equal(
    (
      await request(
        "/admin/teachers",
        "POST",
        { name: "Duplicate", email: "teacher@example.test", password },
        owner,
      )
    ).status,
    409,
  );
  const login = await request("/auth/admin", "POST", {
    email: "teacher@example.test",
    password,
  });
  assert.equal(login.status, 200);
  teacher = { cookie: login.cookie, csrf: login.data.csrf };
  assert.equal(
    (
      await request(
        `/admin/teachers/${ownerId}`,
        "PATCH",
        { status: "inactive" },
        owner,
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("/admin/teachers", "GET", undefined, owner)).data.length,
    2,
  );
});
test("only the owner manages teachers and CSRF checks still apply", async () => {
  assert.equal((await request("/admin/teachers")).status, 401);
  assert.equal(
    (await request("/admin/teachers", "GET", undefined, teacher)).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/admin/teachers",
        "POST",
        { name: "Intruder", email: "intruder@example.test", password },
        teacher,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/admin/teachers/${teacherId}`,
        "PATCH",
        { status: "inactive" },
        owner,
        { "X-CSRF-Token": "wrong" },
      )
    ).status,
    403,
  );
  const sent = await request("/auth/otp/send", "POST", {
    identifier: "student@example.test",
    purpose: "signup",
  });
  const logged = await request("/auth/otp/verify", "POST", {
    challenge: sent.data.challenge,
    code: sent.data.demoCode,
  });
  student = { cookie: logged.cookie, csrf: logged.data.csrf };
  assert.equal(
    (await request("/admin/teachers", "GET", undefined, student)).status,
    403,
  );
  assert.equal(
    (await request("/auth/session", "GET", undefined, student)).data.isOwner,
    false,
  );
});
test("teacher deactivation invalidates sessions, reactivation restores sign-in", async () => {
  assert.equal(
    (
      await request(
        `/admin/teachers/${teacherId}`,
        "PATCH",
        { status: "inactive" },
        owner,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/admin/overview", "GET", undefined, teacher)).status,
    401,
  );
  assert.equal(
    (
      await request("/auth/admin", "POST", {
        email: "teacher@example.test",
        password,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request(
        `/admin/teachers/${teacherId}`,
        "PATCH",
        { status: "active" },
        owner,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/auth/admin", "POST", {
        email: "teacher@example.test",
        password,
      })
    ).status,
    200,
  );
});
test("teacher can securely reset a forgotten password by email OTP", async () => {
  const unknown = await request("/auth/password/forgot", "POST", {
    email: "unknown@example.test",
  });
  assert.equal(unknown.status, 200);
  assert.equal(unknown.data.demoCode, undefined);

  const sent = await request("/auth/password/forgot", "POST", {
    email: "teacher@example.test",
  });
  assert.equal(sent.status, 200);
  assert.match(sent.data.demoCode, /^\d{6}$/);
  assert.equal(
    (
      await request("/auth/password/reset", "POST", {
        challenge: sent.data.challenge,
        code: "000000",
        password: "A-new-teacher-password-2026!",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/auth/password/reset", "POST", {
        challenge: sent.data.challenge,
        code: sent.data.demoCode,
        password: "A-new-teacher-password-2026!",
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/admin/overview", "GET", undefined, teacher)).status,
    401,
  );
  assert.equal(
    (
      await request("/auth/admin", "POST", {
        email: "teacher@example.test",
        password,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/auth/admin", "POST", {
        email: "teacher@example.test",
        password: "A-new-teacher-password-2026!",
      })
    ).status,
    200,
  );
});
