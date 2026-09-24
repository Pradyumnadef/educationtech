import assert from "node:assert/strict";
import test from "node:test";
import { postSignInPath, resumePath } from "../src/session.ts";

test("website entry and sign-in always open Overview", () => {
  const student = { id: "student", role: "student", onboarding: 1 };
  const teacher = { id: "teacher", role: "admin", onboarding: 1 };

  assert.equal(
    postSignInPath(student, "/app/videos?module=module-1"),
    "/app",
  );
  assert.equal(
    postSignInPath(teacher, "/admin/materials?q=grammar"),
    "/admin",
  );
  assert.equal(resumePath(student), "/app");
  assert.equal(resumePath(teacher), "/admin");
  assert.equal(resumePath(null), "/");
  assert.equal(postSignInPath(student, "/admin/settings"), "/app");
  assert.equal(postSignInPath(teacher, "https://evil.example"), "/admin");
});

test("unfinished student onboarding overrides a requested workspace route", () => {
  assert.equal(
    postSignInPath(
      { id: "new-student", role: "student", onboarding: 0 },
      "/app/videos?module=module-1",
    ),
    "/onboarding",
  );
});
