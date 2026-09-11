import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import path from "node:path";
import { canAccess, passwordHash, passwordCheck } from "../server/security.ts";
// A separate server and database make destructive regression tests safe to repeat.
mkdirSync(path.resolve("test-results"), { recursive: true });
const dir = mkdtempSync(path.resolve("test-results/lumio-test-"));
const origin = "http://localhost:3107";
let server: ChildProcess;
let output = "";
type Client = { cookie: string; csrf: string };
const guest: Client = { cookie: "", csrf: "" };
let teacher: Client, student: Client;
async function request(
  url: string,
  method = "GET",
  body?: any,
  client = guest,
  headers: Record<string, string> = {},
) {
  const r = await fetch(origin + "/api" + url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(client.cookie
        ? { Cookie: client.cookie, "X-CSRF-Token": client.csrf }
        : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  return {
    status: r.status,
    data,
    cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
before(async () => {
  const fixture = spawnSync(process.execPath, ["tests/fixtures/seed.ts"], {
    env: {
      ...process.env,
      NODE_ENV: "development",
      DATA_DIR: dir,
      DATABASE_URL: "",
      DEMO_MODE: "true",
      SEED_DEMO: "true",
      DEMO_ADMIN_EMAIL: "teacher@test.local",
      DEMO_ADMIN_PASSWORD: "Regression-password-2026!",
      DEMO_STUDENT_EMAIL: "student@test.local",
    },
    windowsHide: true,
    encoding: "utf8",
  });
  assert.equal(fixture.status, 0, fixture.stderr);
  server = spawn(process.execPath, ["server/index.ts"], {
    env: {
      ...process.env,
      NODE_ENV: "development",
      PORT: "3107",
      APP_ORIGIN: origin,
      DATA_DIR: dir,
      DATABASE_URL: "",
      DEMO_MODE: "true",
      SEED_DEMO: "true",
      SERVE_BUILD: "true",
      DEMO_ADMIN_EMAIL: "teacher@test.local",
      DEMO_ADMIN_PASSWORD: "Regression-password-2026!",
      DEMO_STUDENT_EMAIL: "student@test.local",
    },
    windowsHide: true,
    stdio: "pipe",
  });
  server.stdout?.on("data", (d) => (output += d));
  server.stderr?.on("data", (d) => (output += d));
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await request("/health")).status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, output);
  const a = await request("/auth/admin", "POST", {
    email: "teacher@test.local",
    password: "Regression-password-2026!",
  });
  assert.equal(a.status, 200, JSON.stringify(a.data));
  teacher = { cookie: a.cookie, csrf: a.data.csrf };
  const send = await request("/auth/otp/send", "POST", {
    identifier: "student@test.local",
    purpose: "login",
  });
  const verify = await request("/auth/otp/verify", "POST", {
    challenge: send.data.challenge,
    code: send.data.demoCode,
  });
  assert.equal(verify.status, 200);
  student = { cookie: verify.cookie, csrf: verify.data.csrf };
});
after(async () => {
  if (server) {
    server.kill();
    await new Promise((r) => setTimeout(r, 500));
  }
  if (dir.startsWith(path.resolve("test-results") + path.sep))
    rmSync(dir, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 500,
    });
});
test("passwords are salted, hashed, and verified", () => {
  const a = passwordHash("a long password"),
    b = passwordHash("a long password");
  assert.notEqual(a, b);
  assert.ok(passwordCheck("a long password", a));
  assert.equal(passwordCheck("wrong", a), false);
});
test("authorization graph: nested grants, direct revocations, draft and future parent gates", () => {
  const user = { id: "s", role: "student", status: "active" },
    nodes = [
      { id: "subject", parent_id: null, status: "published" },
      { id: "course", parent_id: "subject", status: "published" },
      { id: "video", parent_id: "course", status: "published" },
    ],
    ctx = {
      user,
      nodes,
      grants: [{ group_id: "g", content_id: "subject", status: "assigned" }],
    };
  assert.ok(canAccess(ctx, "video"));
  assert.equal(
    canAccess(
      {
        ...ctx,
        grants: [
          ...ctx.grants,
          { user_id: "s", content_id: "course", status: "revoked" },
        ],
      },
      "video",
    ),
    false,
  );
  assert.equal(
    canAccess(
      {
        ...ctx,
        nodes: nodes.map((n) =>
          n.id === "course" ? { ...n, status: "draft" } : n,
        ),
      },
      "video",
    ),
    false,
  );
  assert.equal(
    canAccess(
      {
        ...ctx,
        nodes: nodes.map((n) =>
          n.id === "course" ? { ...n, publish_at: Date.now() + 60000 } : n,
        ),
      },
      "video",
    ),
    false,
  );
  assert.equal(
    canAccess({ ...ctx, user: { ...user, status: "inactive" } }, "video"),
    false,
  );
  assert.equal(canAccess(ctx, "missing"), false);
});
test("private routes require authentication and teacher role", async () => {
  assert.equal((await request("/learning")).status, 401);
  assert.equal(
    (await request("/admin/overview", "GET", undefined, student)).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/admin/students",
        "POST",
        { name: "No", email: "no@test.local" },
        student,
      )
    ).status,
    403,
  );
  assert.equal((await request("/storage/media/algebra-1/video")).status, 401);
});
test("CSRF and unexpected request origins are rejected", async () => {
  assert.equal(
    (
      await request("/profile", "PATCH", { name: "Hijacked" }, student, {
        "X-CSRF-Token": "incorrect",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/auth/otp/send",
        "POST",
        { identifier: "evil@test.local" },
        guest,
        { Origin: "https://evil.example" },
      )
    ).status,
    403,
  );
});
test("student payloads contain only their progress and no storage secrets", async () => {
  const r = await request("/learning", "GET", undefined, student);
  assert.equal(r.status, 200);
  assert.ok(r.data.progress.every((p: any) => p.user_id === "user-1"));
  assert.ok(r.data.content.some((c: any) => c.id === "algebra-1"));
  assert.equal(
    r.data.content.some((c: any) => c.id === "calculus-1"),
    false,
  );
  assert.equal(JSON.stringify(r.data).includes("storage_key"), false);
  assert.equal(
    (await request("/videos/calculus-1", "GET", undefined, student)).status,
    403,
  );
  assert.equal(
    (await request("/search?q=derivative", "GET", undefined, student)).data
      .length,
    0,
  );
});
test("profile input cannot escalate a role or overwrite another user", async () => {
  const r = await request(
    "/profile",
    "PATCH",
    {
      name: "Alex Morgan",
      role: "admin",
      id: "user-0",
      status: "active",
      interests: ["Calculus"],
    },
    student,
  );
  assert.equal(r.status, 200);
  assert.equal(r.data.role, "student");
  assert.equal(r.data.id, "user-1");
  assert.equal(
    (await request("/videos/calculus-1", "GET", undefined, student)).status,
    403,
  );
});
test("invalid OTP fails; a valid OTP is single-use; resend has a cooldown", async () => {
  const send = await request("/auth/otp/send", "POST", {
    identifier: "new-learner@test.local",
    purpose: "signup",
  });
  assert.equal(send.status, 200);
  const wrong = send.data.demoCode === "111111" ? "222222" : "111111";
  assert.equal(
    (
      await request("/auth/otp/verify", "POST", {
        challenge: send.data.challenge,
        code: wrong,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/auth/otp/send", "POST", {
        identifier: "new-learner@test.local",
        purpose: "signup",
      })
    ).status,
    429,
  );
  const verified = await request("/auth/otp/verify", "POST", {
    challenge: send.data.challenge,
    code: send.data.demoCode,
  });
  assert.equal(verified.status, 200);
  assert.equal(verified.data.user.onboarding, 0);
  assert.equal(
    (
      await request("/auth/otp/verify", "POST", {
        challenge: send.data.challenge,
        code: send.data.demoCode,
      })
    ).status,
    400,
  );
  const c = { cookie: verified.cookie, csrf: verified.data.csrf };
  await request(
    "/profile",
    "PATCH",
    { name: "New learner", interests: ["Mathematics"], onboarding: true },
    c,
  );
  const learn = await request("/learning", "GET", undefined, c);
  assert.equal(
    learn.data.content.filter((c: any) => c.kind === "video").length,
    0,
  );
});
test("OTP attempt limit cannot be bypassed with a correct code after five failures", async () => {
  const send = await request("/auth/otp/send", "POST", {
    identifier: "attempts@test.local",
    purpose: "signup",
  });
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await request("/auth/otp/verify", "POST", {
          challenge: send.data.challenge,
          code: "000000",
        })
      ).status,
      400,
    );
  assert.equal(
    (
      await request("/auth/otp/verify", "POST", {
        challenge: send.data.challenge,
        code: send.data.demoCode,
      })
    ).status,
    400,
  );
});
test("individual revocation overrides a group grant and restoration works", async () => {
  assert.equal(
    (await request("/videos/algebra-1", "GET", undefined, student)).status,
    200,
  );
  await request(
    "/admin/assignments",
    "POST",
    {
      targetType: "student",
      targetId: "user-1",
      contentIds: ["algebra-1"],
      status: "revoked",
    },
    teacher,
  );
  assert.equal(
    (await request("/videos/algebra-1", "GET", undefined, student)).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/progress/algebra-1",
        "POST",
        { position: 1, completed: true },
        student,
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("/storage/media/algebra-1/video", "GET", undefined, student))
      .status,
    403,
  );
  await request(
    "/admin/assignments",
    "POST",
    {
      targetType: "student",
      targetId: "user-1",
      contentIds: ["algebra-1"],
      status: "assigned",
    },
    teacher,
  );
  assert.equal(
    (await request("/videos/algebra-1", "GET", undefined, student)).status,
    200,
  );
});
test("full hierarchy CRUD rejects invalid parents and hides drafts", async () => {
  const s = await request(
    "/admin/content",
    "POST",
    {
      kind: "subject",
      parent_id: null,
      name: "Test subject",
      status: "published",
    },
    teacher,
  );
  assert.equal(s.status, 200);
  const wrong = await request(
    "/admin/content",
    "POST",
    { kind: "video", parent_id: s.data.id, name: "Wrong parent" },
    teacher,
  );
  assert.equal(wrong.status, 400);
  let parent = s.data.id;
  let videoId = "";
  for (const kind of ["course", "chapter", "topic", "video"]) {
    const r = await request(
      "/admin/content",
      "POST",
      { kind, parent_id: parent, name: `Test ${kind}`, status: "published" },
      teacher,
    );
    assert.equal(r.status, 200, JSON.stringify(r.data));
    parent = r.data.id;
    if (kind === "video") videoId = r.data.id;
  }
  await request(
    "/admin/assignments",
    "POST",
    { targetType: "student", targetId: "user-1", contentIds: [s.data.id] },
    teacher,
  );
  assert.equal(
    (await request(`/videos/${videoId}`, "GET", undefined, student)).status,
    200,
  );
  await request(
    `/admin/content/${s.data.id}`,
    "PUT",
    { kind: "subject", parent_id: null, name: "Test subject", status: "draft" },
    teacher,
  );
  assert.equal(
    (await request(`/videos/${videoId}`, "GET", undefined, student)).status,
    403,
  );
  assert.equal(
    (await request(`/admin/content/${s.data.id}`, "DELETE", undefined, teacher))
      .status,
    200,
  );
  assert.equal(
    (await request(`/admin/content/${videoId}`, "GET", undefined, teacher))
      .status,
    404,
  );
});
test("progress is owned by session and watch time is bounded by real elapsed time", async () => {
  const r = await request(
    "/progress/python-4",
    "POST",
    { position: 5, seconds: 20, user_id: "user-2" },
    student,
  );
  assert.equal(r.status, 200);
  const d = (await request("/learning", "GET", undefined, student)).data;
  const p = d.progress.find((p: any) => p.video_id === "python-4");
  assert.equal(p.user_id, "user-1");
  assert.equal(p.watched_seconds, 0);
  await request(
    "/progress/python-4",
    "POST",
    { position: 10, seconds: 20, completed: true },
    student,
  );
  const next = (
    await request("/learning", "GET", undefined, student)
  ).data.progress.find((p: any) => p.video_id === "python-4");
  assert.ok(next.watched_seconds < 3);
  assert.equal(next.completed, 1);
});
test("upload validation rejects unsafe formats, size violations, and forged media", async () => {
  assert.equal(
    (
      await request(
        "/storage/prepare",
        "POST",
        { filename: "shell.html", mime: "text/html", size: 100 },
        teacher,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/storage/prepare",
        "POST",
        { filename: "x.mp4", mime: "video/mp4", size: 3 * 1024 ** 3 },
        teacher,
      )
    ).status,
    400,
  );
  const prep = await request(
    "/storage/prepare",
    "POST",
    { filename: "fake.mp4", mime: "video/mp4", size: 24 },
    teacher,
  );
  const f = new FormData();
  f.append(
    "file",
    new Blob(["this is not a video file!"], { type: "video/mp4" }),
    "fake.mp4",
  );
  const r = await fetch(origin + prep.data.url, {
    method: "POST",
    headers: {
      Cookie: teacher.cookie,
      "X-CSRF-Token": teacher.csrf,
      Origin: origin,
    },
    body: f,
  });
  assert.equal(r.status, 400);
});
test("real private upload supports authorized byte ranges and rejects anonymous requests", async () => {
  const bytes = Buffer.alloc(64);
  bytes.write("ftyp", 4);
  const prep = await request(
    "/storage/prepare",
    "POST",
    { filename: "format-fixture.mp4", mime: "video/mp4", size: 64 },
    teacher,
  );
  const f = new FormData();
  f.append(
    "file",
    new Blob([bytes], { type: "video/mp4" }),
    "format-fixture.mp4",
  );
  const up = await fetch(origin + prep.data.url, {
    method: "POST",
    headers: {
      Cookie: teacher.cookie,
      "X-CSRF-Token": teacher.csrf,
      Origin: origin,
    },
    body: f,
  });
  assert.equal(up.status, 200);
  const asset = (await up.json()) as any;
  const v = (
    await request("/admin/content/python-4", "GET", undefined, teacher)
  ).data;
  assert.equal(
    (
      await request(
        "/admin/content/python-4",
        "PUT",
        { ...v, storage_key: asset.key },
        teacher,
      )
    ).status,
    200,
  );
  const r = await fetch(origin + "/api/storage/media/python-4/video", {
    headers: { Cookie: student.cookie, Range: "bytes=0-15" },
  });
  assert.equal(r.status, 206);
  assert.equal(r.headers.get("content-range"), "bytes 0-15/64");
  assert.equal((await r.arrayBuffer()).byteLength, 16);
  assert.equal((await request("/storage/media/python-4/video")).status, 401);
});
test("announcements persist, students mark their own notifications read", async () => {
  const a = await request(
    "/admin/announcements",
    "POST",
    { title: "A test update", body: "A new lesson is ready." },
    teacher,
  );
  assert.equal(a.status, 200);
  assert.equal(
    (await request("/notifications/read", "POST", {}, student)).status,
    200,
  );
  const notes = (await request("/learning", "GET", undefined, student)).data
    .announcements;
  assert.equal(notes.find((n: any) => n.id === a.data.id).read, 1);
  await request(
    `/admin/announcements/${a.data.id}`,
    "DELETE",
    undefined,
    teacher,
  );
});
test("deactivation invalidates live sessions immediately", async () => {
  await request(
    "/admin/students/user-1",
    "PATCH",
    { status: "inactive" },
    teacher,
  );
  assert.equal(
    (await request("/learning", "GET", undefined, student)).status,
    401,
  );
  await request(
    "/admin/students/user-1",
    "PATCH",
    { status: "active" },
    teacher,
  );
  assert.equal(
    (await request("/learning", "GET", undefined, student)).status,
    401,
  );
});
test("group membership adds inherited access and removing membership revokes it", async () => {
  const send = await request("/auth/otp/send", "POST", {
    identifier: "group-learner@test.local",
    purpose: "signup",
  });
  const verified = await request("/auth/otp/verify", "POST", {
    challenge: send.data.challenge,
    code: send.data.demoCode,
  });
  const learner = { cookie: verified.cookie, csrf: verified.data.csrf };
  const group = await request(
    "/admin/groups",
    "POST",
    { name: "Regression class", description: "A bounded test group." },
    teacher,
  );
  assert.equal(group.status, 200);
  assert.equal(
    (await request("/videos/calculus-1", "GET", undefined, learner)).status,
    403,
  );
  await request(
    "/admin/assignments",
    "POST",
    { targetType: "group", targetId: group.data.id, contentIds: ["calculus"] },
    teacher,
  );
  await request(
    `/admin/groups/${group.data.id}/members`,
    "PUT",
    { studentId: verified.data.user.id, member: true },
    teacher,
  );
  assert.equal(
    (await request("/videos/calculus-1", "GET", undefined, learner)).status,
    200,
  );
  await request(
    `/admin/groups/${group.data.id}/members`,
    "PUT",
    { studentId: verified.data.user.id, member: false },
    teacher,
  );
  assert.equal(
    (await request("/videos/calculus-1", "GET", undefined, learner)).status,
    403,
  );
  await request(`/admin/groups/${group.data.id}`, "DELETE", undefined, teacher);
});
test("an expired OTP cannot create an account", async () => {
  const challenge = await request("/auth/otp/send", "POST", {
    identifier: "expired@test.local",
    purpose: "signup",
  });
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(path.join(dir, "lumio.sqlite"));
  db.prepare("UPDATE otps SET expires_at=? WHERE id=?").run(
    Date.now() - 1000,
    challenge.data.challenge,
  );
  db.close();
  assert.equal(
    (
      await request("/auth/otp/verify", "POST", {
        challenge: challenge.data.challenge,
        code: challenge.data.demoCode,
      })
    ).status,
    400,
  );
});
test("production startup refuses demo authentication", () => {
  const r = spawnSync(process.execPath, ["server/index.ts"], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      EMAIL_OTP_PROVIDER: "twilio",
      DATABASE_URL: "postgres://unused:unused@127.0.0.1:6543/unused",
      DATA_DIR: dir,
      SESSION_SECRET: "regression-only-strong-secret-1234567890",
      APP_ORIGIN: "https://learn.example.com",
      S3_BUCKET: "fixture",
      TWILIO_ACCOUNT_SID: "fixture",
      TWILIO_AUTH_TOKEN: "fixture",
      TWILIO_VERIFY_SERVICE_SID: "fixture",
      SCANNER_WEBHOOK_SECRET: "fixture",
      DEMO_MODE: "true",
      SEED_DEMO: "false",
    },
    windowsHide: true,
    encoding: "utf8",
    timeout: 5000,
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Disable demo mode in production/);
});
