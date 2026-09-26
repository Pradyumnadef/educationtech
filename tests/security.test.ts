import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
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
test("100 existing students sign in and use learning, attendance, search, progress and PDF ranges", async () => {
  const database = new DatabaseSync(path.join(dir, "lumio.sqlite"));
  const timestamp = Date.now();
  const clients: Client[] = [];
  try {
    for (let index = 0; index < 100; index++) {
      const userId = `classroom-${index}`;
      const token = `classroom-test-token-${index}`;
      database.prepare("INSERT INTO users(id,role,name,email,onboarding,created_at,updated_at) VALUES (?,'student',?,?,1,?,?)")
        .run(userId, userId, `${userId}@test.local`, timestamp, timestamp);
      database.prepare("INSERT INTO sessions(id,user_id,token_hash,csrf,expires_at) VALUES (?,?,?,?,?)")
        .run(userId, userId, createHash("sha256").update(token).digest("hex"), "test-csrf", timestamp + 3600000);
      clients.push({cookie: `lumio_session=${token}`, csrf: "test-csrf"});
      database.prepare("INSERT INTO group_members(id,group_id,user_id) VALUES (?,'group-1',?)").run(userId,userId);
    }
    database.prepare("INSERT INTO content(id,kind,name,status,created_at,updated_at) VALUES ('classroom-subject','subject','Classroom','published',?,?)").run(timestamp,timestamp);
    database.prepare("INSERT INTO content(id,parent_id,kind,name,status,created_at,updated_at) VALUES ('classroom-file','classroom-subject','video','PDF','published',?,?)").run(timestamp,timestamp);
    const bytes = Buffer.from("%PDF-1.4 classroom range verification " + "a".repeat(4096));
    mkdirSync(path.join(dir, "media"), {recursive:true});
    writeFileSync(path.join(dir, "media", "classroom-upload"), bytes);
    database.prepare("INSERT INTO uploads(id,owner_id,storage_key,filename,mime,size,state,created_at) VALUES ('classroom-upload','classroom-0','local/classroom-upload','classroom.pdf','application/pdf',?,'ready',?)").run(bytes.length,timestamp);
    database.prepare("INSERT INTO content_assets(id,content_id,upload_id,asset_type) VALUES ('classroom-asset','classroom-file','classroom-upload','file')").run();
  } finally { database.close(); }
  await Promise.all(clients.map(async (_client, index) => {
    for (const endpoint of ["/auth/session", "/auth/setup", "/auth/options"])
      assert.equal((await request(endpoint)).status,200, `Sign-in page: ${endpoint}`);
    const send = await request("/auth/otp/send", "POST", {identifier:`classroom-${index}@test.local`,purpose:"login"});
    assert.equal(send.status, 200, JSON.stringify(send.data));
    const verified = await request("/auth/otp/verify", "POST", {challenge:send.data.challenge,code:send.data.demoCode});
    assert.equal(verified.status, 200, JSON.stringify(verified.data));
    assert.equal(verified.data.user.id, `classroom-${index}`);
    clients[index] = {cookie:verified.cookie,csrf:verified.data.csrf};
  }));
  const session = await request("/admin/attendance", "POST", {
    title:"Classroom load test",groupId:"group-1",locationName:"Test campus",
    latitude:20,longitude:85,radiusM:50,startsAt:Date.now()-1000,endsAt:Date.now()+3600000,
  }, teacher);
  assert.equal(session.status,200,JSON.stringify(session.data));
  const started = Date.now();
  const statuses = await Promise.all(clients.map(async client => {
    const results = [];
    for (const endpoint of ["/auth/session", "/learning", "/attendance", "/search?q=Classroom", "/videos/classroom-file"]) {
      const response = await request(endpoint, "GET", undefined, client);
      results.push(response.status);
    }
    const progress = await request("/progress/classroom-file", "POST", {position:10,seconds:0,completed:true}, client);
    results.push(progress.status);
    const saved = await request("/learning", "GET", undefined, client);
    assert.ok(saved.data.progress.some((entry: any) => entry.video_id === "classroom-file" && entry.completed === 1));
    results.push(saved.status);
    const checkedIn = await request(`/attendance/${session.data.id}/check-in`, "POST", {
      latitude:20,longitude:85,accuracyM:5,
    }, client);
    assert.equal(checkedIn.status,200,JSON.stringify(checkedIn.data));
    results.push(checkedIn.status);
    const attendance = await request("/attendance","GET",undefined,client);
    assert.ok(attendance.data.attendance.some((entry:any) => entry.id===session.data.id && entry.record_id===checkedIn.data.id));
    results.push(attendance.status);
    for (let part = 0; part < 8; part++) {
      const response = await fetch(origin + "/api/storage/media/classroom-file/asset/classroom-upload", {
        headers: {Cookie:client.cookie, Range:`bytes=${part * 256}-${part * 256 + 255}`},
      });
      assert.equal((await response.arrayBuffer()).byteLength, 256);
      results.push(response.status);
    }
    return results;
  }));
  assert.ok(statuses.every(result => result.slice(0,9).every(status => status === 200) &&
    result.slice(9).every(status => status === 206)), JSON.stringify(statuses));
  console.log(`Classroom load: 100 accounts, 500 sign-in page/OTP requests + ${statuses.flat().length} workspace requests; workspace completed in ${Date.now()-started}ms (isolated SQLite fixture, local OTP)`);
  const analysis = await request("/admin/overview","GET",undefined,teacher);
  assert.equal(analysis.data.attendance.find((entry:any)=>entry.id===session.data.id).records.length,100);
  assert.equal((await request(`/admin/attendance/${session.data.id}`,"PATCH",{status:"closed"},teacher)).status,200);
  await Promise.all(clients.map(async client => {
    const attendance = await request("/attendance","GET",undefined,client);
    assert.equal(attendance.status,200);
    assert.ok(!attendance.data.attendance.some((entry:any)=>entry.id===session.data.id));
  }));
  const changes = new DatabaseSync(path.join(dir, "lumio.sqlite"));
  try {
    changes.prepare("UPDATE content SET status='draft' WHERE id='classroom-subject'").run();
    const hidden = await request("/storage/media/classroom-file/asset/classroom-upload", "GET", undefined, clients[0]);
    assert.equal(hidden.status, 403, "Draft ancestors must deny subsequent PDF requests");
    changes.prepare("UPDATE users SET status='inactive' WHERE id='classroom-0'").run();
    assert.equal((await request("/attendance", "GET", undefined, clients[0])).status, 401);
  } finally { changes.close(); }
});
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
    headers: r.headers,
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
test("returning sessions receive the app shell before JavaScript; guests receive the public homepage", async () => {
  const publicPage = await fetch(origin + "/");
  const publicHtml = await publicPage.text();
  assert.equal(publicPage.status, 200);
  assert.doesNotMatch(publicHtml, /data-app-boot/);
  assert.match(publicHtml, /<h1/);
  for (const cookie of [student.cookie, teacher.cookie, "lumio_session=expired-session"]) {
    const response = await fetch(origin + "/", { headers: { Cookie: cookie } });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /data-app-boot/);
    assert.doesNotMatch(html, /<h1/);
    assert.match(response.headers.get("cache-control") || "", /no-store/);
    assert.match(response.headers.get("vary") || "", /Cookie/i);
  }
  const expired = await request("/auth/session", "GET", undefined, {cookie: "lumio_session=expired-session", csrf: ""});
  assert.equal(expired.status, 200);
  assert.equal(expired.data.user, null);
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
      { id: "chapter", parent_id: "subject", status: "published" },
      { id: "video", parent_id: "chapter", status: "published" },
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
          { user_id: "s", content_id: "chapter", status: "revoked" },
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
          n.id === "chapter" ? { ...n, status: "draft" } : n,
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
          n.id === "chapter" ? { ...n, publish_at: Date.now() + 60000 } : n,
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
test("session responses do not expose joined session secrets", async () => {
  for (const client of [teacher, student]) {
    const session = await request("/auth/session", "GET", undefined, client);
    assert.equal(session.status, 200);
    assert.ok(session.data.user.id);
    assert.equal(session.data.csrf, client.csrf);
    for (const key of ["password_hash", "session_id", "session_csrf", "session_expires_at", "token_hash"])
      assert.equal(key in session.data.user, false, key);
  }
});
test("guest explore exposes only published content under public subjects", async () => {
  const explore = await request("/explore");
  assert.equal(explore.status, 200);
  assert.equal(explore.headers.get("cache-control"), "no-store");
  assert.ok(explore.data.content.some((item: any) => item.id === "english"));
  assert.ok(explore.data.content.some((item: any) => item.id === "motion-1"));
  assert.equal(JSON.stringify(explore.data).includes("storage_key"), false);
  assert.equal(JSON.stringify(explore.data).includes("password_hash"), false);
  assert.equal(JSON.stringify(explore.data).includes('"notes"'), false);

  const publicFolderPayload = {
    kind: "folder",
    parent_id: "english",
    name: "Guest visibility folder",
    description: "Visibility test",
    thumbnail: "english",
    status: "published",
    public: 1,
    duration: 0,
    tags: [],
    notes: "",
    storage_key: "",
    caption_key: "",
    resource_key: "",
    publish_at: null,
  };
  const publicFolder = await request(
    "/admin/content",
    "POST",
    publicFolderPayload,
    teacher,
  );
  assert.equal(publicFolder.status, 200, JSON.stringify(publicFolder.data));
  const publicMaterial = await request(
    "/admin/content",
    "POST",
    {
      ...publicFolderPayload,
      kind: "video",
      parent_id: publicFolder.data.id,
      name: "Guest visibility material",
    },
    teacher,
  );
  assert.equal(publicMaterial.status, 200, JSON.stringify(publicMaterial.data));
  assert.ok(
    (await request("/explore")).data.content.some(
      (item: any) => item.id === publicMaterial.data.id,
    ),
  );
  assert.equal(
    (
      await request(
        `/admin/content/${publicFolder.data.id}`,
        "PUT",
        { ...publicFolderPayload, public: 0 },
        teacher,
      )
    ).status,
    200,
  );
  const afterPrivateParent = await request("/explore");
  assert.equal(
    afterPrivateParent.data.content.some(
      (item: any) => item.id === publicFolder.data.id,
    ),
    false,
  );
  assert.equal(
    afterPrivateParent.data.content.some(
      (item: any) => item.id === publicMaterial.data.id,
    ),
    false,
  );
  assert.equal(
    (
      await request(
        `/admin/content/${publicFolder.data.id}`,
        "DELETE",
        undefined,
        teacher,
      )
    ).status,
    200,
  );

  const hidden = await request(
    "/admin/content",
    "POST",
    {
      kind: "subject",
      parent_id: null,
      name: "Private promotion draft",
      description: "Must never appear to guests.",
      thumbnail: "english",
      status: "published",
      public: 0,
      duration: 0,
      tags: [],
      notes: "",
      storage_key: "",
      caption_key: "",
      resource_key: "",
      publish_at: null,
    },
    teacher,
  );
  assert.equal(hidden.status, 200);
  assert.equal(
    (await request("/explore")).data.content.some(
      (item: any) => item.id === hidden.data.id,
    ),
    false,
  );
  assert.equal(
    (
      await request(
        `/admin/content/${hidden.data.id}`,
        "DELETE",
        undefined,
        teacher,
      )
    ).status,
    200,
  );
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
test("students can access every published subject", async () => {
  const r = await request("/learning", "GET", undefined, student);
  assert.equal(r.status, 200);
  assert.ok(r.data.progress.every((p: any) => p.user_id === "user-1"));
  assert.ok(r.data.content.some((c: any) => c.id === "motion-1"));
  assert.ok(r.data.content.some((c: any) => c.id === "calculus-1"));
  assert.equal(JSON.stringify(r.data).includes("storage_key"), false);
  assert.equal(
    (await request("/videos/calculus-1", "GET", undefined, student)).status,
    200,
  );
  assert.equal(
    (await request("/search?q=derivative", "GET", undefined, student)).data
      .length > 0,
    true,
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
    200,
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
  const onboardingOptions = await request(
    "/onboarding/options",
    "GET",
    undefined,
    c,
  );
  assert.deepEqual(
    onboardingOptions.data.groups.map((group: any) => group.name),
    ["Section-A"],
  );
  assert.equal(
    (
      await request(
        "/profile",
        "PATCH",
        { name: "New learner", onboarding: true },
        c,
      )
    ).status,
    400,
  );
  const completedProfile = await request(
    "/profile",
    "PATCH",
    {
      name: "New learner",
      rollNumber: "NEW-001",
      groupId: "group-1",
      interests: ["Mathematics"],
      onboarding: true,
    },
    c,
  );
  assert.equal(completedProfile.status, 200, JSON.stringify(completedProfile.data));
  assert.equal(completedProfile.data.roll_number, "NEW-001");
  assert.equal(completedProfile.data.group_id, "group-1");
  const adminOverview = await request("/admin/overview", "GET", undefined, teacher);
  const registeredStudent = adminOverview.data.students.find(
    (entry: any) => entry.email === "new-learner@test.local",
  );
  assert.equal(registeredStudent.roll_number, "NEW-001");
  assert.equal(registeredStudent.group_name, "Section-A");
  const learn = await request("/learning", "GET", undefined, c);
  assert.ok(
    learn.data.content.some((entry: any) => entry.id === "uhv"),
  );
  assert.ok(
    learn.data.content.some((entry: any) => entry.id === "english"),
  );
  assert.ok(
    learn.data.content.some((entry: any) => entry.id === "calculus-1"),
  );
  assert.equal(
    learn.data.content.some((entry: any) => entry.id === "organic"),
    true,
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
test("legacy content grants do not restrict universal subject access", async () => {
  assert.equal(
    (await request("/videos/motion-1", "GET", undefined, student)).status,
    200,
  );
  await request(
    "/admin/assignments",
    "POST",
    {
      targetType: "student",
      targetId: "user-1",
      contentIds: ["motion-1"],
      status: "revoked",
    },
    teacher,
  );
  assert.equal(
    (await request("/videos/motion-1", "GET", undefined, student)).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/progress/motion-1",
        "POST",
        { position: 1, completed: true },
        student,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/storage/media/motion-1/video", "GET", undefined, student))
      .status,
    404,
  );
  await request(
    "/admin/assignments",
    "POST",
    {
      targetType: "student",
      targetId: "user-1",
      contentIds: ["motion-1"],
      status: "assigned",
    },
    teacher,
  );
  assert.equal(
    (await request("/videos/motion-1", "GET", undefined, student)).status,
    200,
  );
});
test("timed assignments enforce targeting, private document uploads, and submission deadlines", async () => {
  const created = await request(
    "/admin/coursework",
    "POST",
    {
      title: "Secure worksheet",
      description: "Complete the attached practice questions.",
      quizUrl: "https://forms.gle/exampleQuiz",
      dueAt: Date.now() + 3600000,
      timeLimitMinutes: 30,
      status: "published",
      targetType: "student",
      targetIds: ["user-1"],
      resourceUploadIds: [],
    },
    teacher,
  );
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const assignmentId = created.data.id;
  assert.equal(created.data.quiz_url, "https://forms.gle/exampleQuiz");
  const unsafeLink = await request(
    "/admin/coursework",
    "POST",
    {
      title: "Unsafe link",
      description: "This must be rejected.",
      quizUrl: "javascript:alert(1)",
      dueAt: Date.now() + 3600000,
      targetType: "student",
      targetIds: ["user-1"],
    },
    teacher,
  );
  assert.equal(unsafeLink.status, 400);
  const learning = await request("/learning", "GET", undefined, student);
  const attendanceOnly = await request("/attendance", "GET", undefined, student);
  assert.equal(attendanceOnly.status, 200);
  assert.deepEqual(Object.keys(attendanceOnly.data), ["attendance"]);
  assert.deepEqual(attendanceOnly.data.attendance, learning.data.attendance);
  assert.ok(learning.data.assignments.some((a: any) => a.id === assignmentId));
  assert.equal(
    (await request(`/assignments/${assignmentId}/start`, "POST")).status,
    401,
  );
  const started = await request(
    `/assignments/${assignmentId}/start`,
    "POST",
    {},
    student,
  );
  assert.equal(started.status, 200);
  assert.ok(
    started.data.effective_deadline <= started.data.started_at + 30 * 60000,
  );
  const startedAgain = await request(
    `/assignments/${assignmentId}/start`,
    "POST",
    {},
    student,
  );
  assert.equal(startedAgain.data.started_at, started.data.started_at);
  assert.equal(
    (
      await request(
        "/storage/prepare",
        "POST",
        {
          filename: "answer.mp4",
          mime: "video/mp4",
          size: 10,
          purpose: "submission",
        },
        student,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/storage/prepare",
        "POST",
        {
          filename: "lesson.pdf",
          mime: "application/pdf",
          size: 10,
          purpose: "content",
        },
        student,
      )
    ).status,
    403,
  );
  const bytes = new TextEncoder().encode(
    "%PDF-1.4\nEnglish Tech assignment answer",
  );
  const prepared = await request(
    "/storage/prepare",
    "POST",
    {
      filename: "answer.pdf",
      mime: "application/pdf",
      size: bytes.length,
      purpose: "submission",
    },
    student,
  );
  assert.equal(prepared.status, 200, JSON.stringify(prepared.data));
  const form = new FormData();
  form.append(
    "file",
    new Blob([bytes], { type: "application/pdf" }),
    "answer.pdf",
  );
  const uploaded = await fetch(origin + prepared.data.url, {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: student.cookie,
      "X-CSRF-Token": student.csrf,
    },
    body: form,
  });
  assert.equal(uploaded.status, 200, await uploaded.text());
  const completed = await request(
    `/storage/complete/${prepared.data.id}`,
    "POST",
    {},
    student,
  );
  assert.equal(completed.status, 200);
  const submitted = await request(
    `/assignments/${assignmentId}/submit`,
    "POST",
    { uploadIds: [prepared.data.id], note: "My completed work" },
    student,
  );
  assert.equal(submitted.status, 200, JSON.stringify(submitted.data));
  const after = await request("/learning", "GET", undefined, student);
  const assignment = after.data.assignments.find(
    (a: any) => a.id === assignmentId,
  );
  assert.equal(assignment.submission.note, "My completed work");
  assert.equal(assignment.submission.files[0].filename, "answer.pdf");
  assert.equal(
    (
      await request(
        `/storage/submission/${assignment.submission.id}/file/${prepared.data.id}`,
      )
    ).status,
    401,
  );
  const privateFile = await fetch(
    origin +
      `/api/storage/submission/${assignment.submission.id}/file/${prepared.data.id}`,
    {
      headers: { Cookie: student.cookie },
    },
  );
  assert.equal(privateFile.status, 200);
  await request(
    `/admin/coursework/${assignmentId}`,
    "PATCH",
    { status: "published", dueAt: 1 },
    teacher,
  );
  assert.equal(
    (
      await request(
        `/assignments/${assignmentId}/submit`,
        "POST",
        { uploadIds: [prepared.data.id] },
        student,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        `/admin/coursework/${assignmentId}`,
        "DELETE",
        undefined,
        teacher,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        `/storage/preview/${prepared.data.id}`,
        "GET",
        undefined,
        teacher,
      )
    ).status,
    404,
  );
});
test("nested content folders inherit access, reject cycles, and hide drafts", async () => {
  const s = await request(
    "/admin/content",
    "POST",
    {
      kind: "subject",
      parent_id: null,
      name: "UHV Test subject",
      status: "published",
    },
    teacher,
  );
  assert.equal(s.status, 200);
  const directSubjectVideo = await request(
    "/admin/content",
    "POST",
    { kind: "video", parent_id: s.data.id, name: "Subject file" },
    teacher,
  );
  assert.equal(directSubjectVideo.status, 200);
  let parent = s.data.id;
  let firstFolderId = "";
  let lastFolderId = "";
  let videoId = "";
  for (const [index, kind] of [
    "folder",
    "folder",
    "folder",
    "video",
  ].entries()) {
    const r = await request(
      "/admin/content",
      "POST",
      {
        kind,
        parent_id: parent,
        name: `Test ${kind} ${index}`,
        status: "published",
      },
      teacher,
    );
    assert.equal(r.status, 200, JSON.stringify(r.data));
    parent = r.data.id;
    if (kind === "folder") {
      if (!firstFolderId) firstFolderId = r.data.id;
      lastFolderId = r.data.id;
    }
    if (kind === "video") videoId = r.data.id;
  }
  const wrong = await request(
    "/admin/content",
    "POST",
    {
      kind: "folder",
      parent_id: videoId,
      name: "Folder inside a file",
    },
    teacher,
  );
  assert.equal(wrong.status, 400);
  const cycle = await request(
    `/admin/content/${firstFolderId}`,
    "PUT",
    {
      kind: "folder",
      parent_id: lastFolderId,
      name: "Cyclic folder",
      status: "published",
    },
    teacher,
  );
  assert.equal(cycle.status, 400);
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
    { kind: "subject", parent_id: null, name: "UHV Test subject", status: "draft" },
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
test("attendance enforces time, GPS radius, accuracy, ownership, and one check-in", async () => {
  const created = await request(
    "/admin/attendance",
    "POST",
    {
      title: "Secure attendance",
      groupId: "group-1",
      locationName: "Test campus",
      latitude: 20,
      longitude: 85,
      radiusM: 50,
      startsAt: Date.now() - 60000,
      endsAt: Date.now() + 600000,
    },
    teacher,
  );
  assert.equal(created.status, 200, JSON.stringify(created.data));
  assert.equal(created.data.subject_name, undefined);
  assert.equal(created.data.class_section_name, "Section-A");
  const sessionId = created.data.id;
  const outsiderChallenge = await request("/auth/otp/send", "POST", {
    identifier: "jamie@lumio.local",
    purpose: "login",
  });
  const outsiderLogin = await request("/auth/otp/verify", "POST", {
    challenge: outsiderChallenge.data.challenge,
    code: outsiderChallenge.data.demoCode,
  });
  const outsider = {
    cookie: outsiderLogin.cookie,
    csrf: outsiderLogin.data.csrf,
  };
  const outsiderLearning = await request(
    "/learning",
    "GET",
    undefined,
    outsider,
  );
  assert.equal((await request("/attendance")).status, 401);
  assert.deepEqual((await request("/attendance", "GET", undefined, outsider)).data.attendance,
    outsiderLearning.data.attendance);
  assert.equal(
    outsiderLearning.data.attendance.some(
      (session: any) => session.id === sessionId,
    ),
    false,
  );
  assert.equal(
    (
      await request(
        `/attendance/${sessionId}/check-in`,
        "POST",
        { latitude: 20, longitude: 85, accuracyM: 5 },
        outsider,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/attendance/${sessionId}/check-in`,
        "POST",
        { latitude: 20.01, longitude: 85.01, accuracyM: 10 },
        student,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/attendance/${sessionId}/check-in`,
        "POST",
        { latitude: 20, longitude: 85, accuracyM: 100 },
        student,
      )
    ).status,
    422,
  );
  const checkIn = await request(
    `/attendance/${sessionId}/check-in`,
    "POST",
    { latitude: 20.0001, longitude: 85.0001, accuracyM: 8 },
    student,
  );
  assert.equal(checkIn.status, 200, JSON.stringify(checkIn.data));
  assert.ok(checkIn.data.distance_m < 50);
  assert.equal(
    (
      await request(
        `/attendance/${sessionId}/check-in`,
        "POST",
        { latitude: 20, longitude: 85, accuracyM: 5 },
        student,
      )
    ).status,
    409,
  );
  const learning = await request("/learning", "GET", undefined, student);
  assert.ok(
    learning.data.attendance.some(
      (session: any) => session.id === sessionId && session.record_id,
    ),
  );
  const overview = await request("/admin/overview", "GET", undefined, teacher);
  const session = overview.data.attendance.find(
    (entry: any) => entry.id === sessionId,
  );
  assert.equal(session.records.length, 1);
  assert.equal(session.records[0].user_id, "user-1");
  assert.equal(
    (
      await request(
        `/admin/attendance/${sessionId}`,
        "PATCH",
        { status: "closed" },
        teacher,
      )
    ).status,
    200,
  );
  const hiddenAttendance = await request("/learning", "GET", undefined, student);
  assert.deepEqual((await request("/attendance", "GET", undefined, student)).data.attendance,
    hiddenAttendance.data.attendance);
  assert.equal(
    hiddenAttendance.data.attendance.some(
      (entry: any) => entry.id === sessionId,
    ),
    false,
  );
  assert.equal(
    (
      await request(
        `/admin/attendance/${sessionId}`,
        "PATCH",
        { status: "open" },
        teacher,
      )
    ).status,
    200,
  );
  const reopenedAttendance = await request("/learning", "GET", undefined, student);
  assert.deepEqual((await request("/attendance", "GET", undefined, student)).data.attendance,
    reopenedAttendance.data.attendance);
  assert.equal(
    reopenedAttendance.data.attendance.some(
      (entry: any) => entry.id === sessionId,
    ),
    true,
  );
  const expired = await request(
    "/admin/attendance",
    "POST",
    {
      title: "Expired attendance",
      groupId: "group-1",
      locationName: "Test campus",
      latitude: 20,
      longitude: 85,
      radiusM: 50,
      startsAt: Date.now() - 120000,
      endsAt: Date.now() - 60000,
    },
    teacher,
  );
  assert.equal(expired.status, 200, JSON.stringify(expired.data));
  const withoutExpired = await request("/learning", "GET", undefined, student);
  assert.deepEqual((await request("/attendance", "GET", undefined, student)).data.attendance,
    withoutExpired.data.attendance);
  assert.equal(
    withoutExpired.data.attendance.some(
      (entry: any) => entry.id === expired.data.id,
    ),
    false,
  );
  assert.equal(
    (
      await request(
        `/admin/attendance/${expired.data.id}`,
        "DELETE",
        undefined,
        teacher,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/admin/attendance",
        "POST",
        {
          title: "Not allowed",
          groupId: "group-1",
          locationName: "Campus",
          latitude: 20,
          longitude: 85,
          radiusM: 50,
          startsAt: Date.now(),
          endsAt: Date.now() + 60000,
        },
        student,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/admin/attendance/${sessionId}`,
        "DELETE",
        undefined,
        teacher,
      )
    ).status,
    200,
  );
});
test("progress is owned by session and watch time is bounded by real elapsed time", async () => {
  const r = await request(
    "/progress/motion-4",
    "POST",
    { position: 5, seconds: 20, user_id: "user-2" },
    student,
  );
  assert.equal(r.status, 200);
  const d = (await request("/learning", "GET", undefined, student)).data;
  const p = d.progress.find((p: any) => p.video_id === "motion-4");
  assert.equal(p.user_id, "user-1");
  assert.equal(p.watched_seconds, 0);
  await request(
    "/progress/motion-4",
    "POST",
    { position: 10, seconds: 20, completed: true },
    student,
  );
  const next = (
    await request("/learning", "GET", undefined, student)
  ).data.progress.find((p: any) => p.video_id === "motion-4");
  assert.ok(next.watched_seconds < 3);
  assert.equal(next.completed, 1);
});
test("upload validation rejects unsafe formats, size violations, and forged media", async () => {
  assert.equal((await request("/storage/limits")).status, 401);
  const limits = await request("/storage/limits", "GET", undefined, teacher);
  assert.equal(limits.status, 200);
  assert.equal(limits.data.video, 2 * 1024 ** 3);
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
  const oversized = await request(
    "/storage/prepare",
    "POST",
    { filename: "x.mp4", mime: "video/mp4", size: 3 * 1024 ** 3 },
    teacher,
  );
  assert.equal(oversized.status, 400);
  assert.match(oversized.data.error, /up to 2048 MB/);
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
  const documentBytes = Buffer.alloc(64);
  documentBytes.write("%PDF-1.4", 0);
  const documentPrep = await request(
    "/storage/prepare",
    "POST",
    { filename: "lesson-notes.pdf", mime: "application/pdf", size: 64 },
    teacher,
  );
  const documentForm = new FormData();
  documentForm.append(
    "file",
    new Blob([documentBytes], { type: "application/pdf" }),
    "lesson-notes.pdf",
  );
  const documentUpload = await fetch(origin + documentPrep.data.url, {
    method: "POST",
    headers: {
      Cookie: teacher.cookie,
      "X-CSRF-Token": teacher.csrf,
      Origin: origin,
    },
    body: documentForm,
  });
  assert.equal(documentUpload.status, 200);
  const v = (
    await request("/admin/content/motion-4", "GET", undefined, teacher)
  ).data;
  assert.equal(
    (
      await request(
        "/admin/content/motion-4",
        "PUT",
        {
          ...v,
          storage_key: asset.key,
          video_upload_ids: [prep.data.id],
          file_upload_ids: [documentPrep.data.id],
        },
        teacher,
      )
    ).status,
    200,
  );
  const saved = (
    await request("/admin/content/motion-4", "GET", undefined, teacher)
  ).data;
  assert.equal(saved.uploaded_files.storage_key.id, prep.data.id);
  assert.equal(saved.uploaded_files.storage_key.filename, "format-fixture.mp4");
  assert.equal(saved.assets.length, 2);
  assert.deepEqual(saved.assets.map((item: any) => item.asset_type).sort(), [
    "file",
    "video",
  ]);
  const folderImport = await request(
    "/admin/content/folder-import",
    "POST",
    {
      parentId: "uhv",
      entries: [
        {
          path: "Communication Course/Week 1/format-fixture.mp4",
          uploadId: prep.data.id,
        },
        {
          path: "Communication Course/lesson-notes.pdf",
          uploadId: documentPrep.data.id,
        },
      ],
    },
    teacher,
  );
  assert.equal(folderImport.status, 200, JSON.stringify(folderImport.data));
  assert.equal(folderImport.data.name, "Communication Course");
  assert.equal(folderImport.data.fileCount, 2);
  const importedOverview = await request(
    "/admin/overview",
    "GET",
    undefined,
    teacher,
  );
  const importedRoot = importedOverview.data.content.find(
    (item: any) => item.id === folderImport.data.id,
  );
  const importedWeek = importedOverview.data.content.find(
    (item: any) =>
      item.parent_id === importedRoot.id && item.name === "Week 1",
  );
  assert.equal(importedRoot.name, "Communication Course");
  assert.equal(importedRoot.parent_id, "uhv");
  assert.ok(importedWeek);
  assert.ok(
    importedOverview.data.content.some(
      (item: any) =>
        item.parent_id === importedWeek.id &&
        item.name === "format-fixture.mp4" &&
        item.video_count === 1,
    ),
  );
  assert.ok(
    importedOverview.data.content.some(
      (item: any) =>
        item.parent_id === importedRoot.id &&
        item.name === "lesson-notes.pdf" &&
        item.file_count === 1,
    ),
  );
  const overviewMaterial = (
    await request("/admin/overview", "GET", undefined, teacher)
  ).data.content.find((item: any) => item.id === "motion-4");
  assert.equal(overviewMaterial.video_count, 1);
  assert.equal(overviewMaterial.file_count, 1);
  assert.deepEqual(
    overviewMaterial.assets.map((item: any) => item.filename).sort(),
    ["format-fixture.mp4", "lesson-notes.pdf"],
  );
  const studentMaterial = (
    await request("/learning", "GET", undefined, student)
  ).data.content.find((item: any) => item.id === "motion-4");
  assert.equal(studentMaterial.video_count, 1);
  assert.equal(studentMaterial.file_count, 1);
  assert.deepEqual(
    studentMaterial.assets.map((item: any) => item.filename).sort(),
    ["format-fixture.mp4", "lesson-notes.pdf"],
  );
  assert.ok(
    studentMaterial.assets.every((item: any) =>
      item.url.startsWith("/api/storage/media/motion-4/"),
    ),
  );
  assert.equal("storage_key" in studentMaterial.assets[0], false);
  const guestExplore = (await request("/explore")).data;
  const guestImportedMaterial = guestExplore.content.find(
    (item: any) =>
      item.parent_id === importedRoot.id && item.name === "lesson-notes.pdf",
  );
  assert.ok(guestImportedMaterial);
  const guestPdf = guestImportedMaterial.assets.find(
    (asset: any) => asset.mime === "application/pdf",
  );
  const guestPdfPreview = await fetch(origin + guestPdf.url, {
    headers: { Range: "bytes=0-7" },
  });
  assert.equal(guestPdfPreview.status, 206);
  assert.equal((await guestPdfPreview.arrayBuffer()).byteLength, 8);
  const preview = await fetch(origin + `/api/storage/preview/${prep.data.id}`, {
    headers: { Cookie: teacher.cookie, Range: "bytes=0-7" },
  });
  assert.equal(preview.status, 206);
  assert.equal(preview.headers.get("content-range"), "bytes 0-7/64");
  assert.equal((await preview.arrayBuffer()).byteLength, 8);
  const teacherDownload = await fetch(
    origin + `/api/storage/preview/${documentPrep.data.id}?download=1`,
    { headers: { Cookie: teacher.cookie } },
  );
  assert.equal(teacherDownload.status, 200);
  assert.match(
    teacherDownload.headers.get("content-disposition") || "",
    /^attachment;/,
  );
  assert.equal(
    (
      await request(
        `/storage/preview/${prep.data.id}`,
        "GET",
        undefined,
        student,
      )
    ).status,
    403,
  );
  const r = await fetch(origin + "/api/storage/media/motion-4/video", {
    headers: { Cookie: student.cookie, Range: "bytes=0-15" },
  });
  assert.equal(r.status, 206);
  assert.equal(r.headers.get("content-range"), "bytes 0-15/64");
  assert.equal((await r.arrayBuffer()).byteLength, 16);
  const videoDownload = await fetch(
    origin + "/api/storage/media/motion-4/video?download=1",
    { headers: { Cookie: student.cookie } },
  );
  assert.equal(videoDownload.status, 403);
  assert.equal(
    (await videoDownload.json()).error,
    "Downloads are not available in the student workspace.",
  );
  const lesson = (await request("/videos/motion-4", "GET", undefined, student))
    .data;
  assert.equal(lesson.videos.length, 1);
  assert.equal(lesson.files.length, 1);
  const pdfPreview = await fetch(origin + lesson.files[0].url, {
    headers: { Cookie: student.cookie },
  });
  assert.equal(pdfPreview.status, 200);
  assert.match(pdfPreview.headers.get("content-disposition") || "", /^inline;/);
  const pdfDownload = await fetch(
    origin + `${lesson.files[0].url}?download=1`,
    {
      headers: { Cookie: student.cookie },
    },
  );
  assert.equal(pdfDownload.status, 403);
  assert.equal(
    (await pdfDownload.json()).error,
    "Downloads are not available in the student workspace.",
  );
  assert.equal(
    (
      await request(
        lesson.files[0].url.replace("/api", ""),
        "GET",
        undefined,
        student,
      )
    ).status,
    200,
  );
  assert.equal((await request("/storage/media/motion-4/video")).status, 401);
  assert.equal(
    (
      await request(
        `/admin/content/${folderImport.data.id}`,
        "DELETE",
        undefined,
        teacher,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/admin/content/motion-4",
        "PUT",
        {
          ...saved,
          storage_key: "",
          resource_key: "",
          video_upload_ids: [],
          file_upload_ids: [],
          uploaded_files: undefined,
        },
        teacher,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        `/storage/preview/${prep.data.id}`,
        "GET",
        undefined,
        teacher,
      )
    ).status,
    404,
  );
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
test("renamed and newly created groups support registration and attendance", async () => {
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
    {
      name: "Section-B",
      description: "ETW students.",
    },
    teacher,
  );
  assert.equal(group.status, 200);
  assert.equal(
    (
      await request(
        `/admin/groups/${group.data.id}`,
        "PATCH",
        {
          name: "Second Year",
          description: "Renamed ETW students.",
        },
        teacher,
      )
    ).status,
    200,
  );
  const options = await request("/onboarding/options", "GET", undefined, learner);
  const renamed = options.data.groups.find(
    (entry: any) => entry.id === group.data.id,
  );
  assert.equal(renamed.name, "Second Year");
  const completed = await request(
    "/profile",
    "PATCH",
    {
      name: "Group learner",
      rollNumber: "SECOND-001",
      groupId: group.data.id,
      interests: [],
      onboarding: true,
    },
    learner,
  );
  assert.equal(completed.status, 200, JSON.stringify(completed.data));
  assert.equal(completed.data.group_id, group.data.id);
  const attendance = await request(
    "/admin/attendance",
    "POST",
    {
      title: "Second Year attendance",
      groupId: group.data.id,
      locationName: "Test campus",
      latitude: 20,
      longitude: 85,
      radiusM: 50,
      startsAt: Date.now() - 60000,
      endsAt: Date.now() + 600000,
    },
    teacher,
  );
  assert.equal(attendance.status, 200, JSON.stringify(attendance.data));
  assert.equal(attendance.data.class_section_name, "Second Year");
  assert.equal(
    (
      await request(
        `/admin/groups/${group.data.id}`,
        "PATCH",
        {
          name: "Second Year ETW",
          description: "Renamed again after attendance was created.",
        },
        teacher,
      )
    ).status,
    200,
  );
  const overview = await request("/admin/overview", "GET", undefined, teacher);
  assert.equal(
    overview.data.attendance.find(
      (session: any) => session.id === attendance.data.id,
    ).class_section_name,
    "Second Year ETW",
  );
  assert.equal(
    (await request("/videos/calculus-1", "GET", undefined, learner)).status,
    200,
  );
  assert.equal(
    (await request("/videos/motion-1", "GET", undefined, learner)).status,
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
    200,
  );
  await request(
    `/admin/attendance/${attendance.data.id}`,
    "DELETE",
    undefined,
    teacher,
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
