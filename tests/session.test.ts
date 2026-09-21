import assert from "node:assert/strict";
import test from "node:test";
import { postSignInPath } from "../src/session.ts";

test("post-sign-in navigation preserves safe workspace deep links", () => {
  const student = { id: "student", role: "student", onboarding: 1 };
  const teacher = { id: "teacher", role: "admin", onboarding: 1 };

  assert.equal(
    postSignInPath(student, "/app/videos?module=module-1"),
    "/app/videos?module=module-1",
  );
  assert.equal(
    postSignInPath(teacher, "/admin/materials?q=grammar"),
    "/admin/materials?q=grammar",
  );
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
