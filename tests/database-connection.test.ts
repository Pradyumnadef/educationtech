import test from "node:test";
import assert from "node:assert/strict";
import { runtimeDatabaseUrl } from "../server/database-connection.ts";

test("serverless shared-pooler mode preserves credentials and connection options", () => {
  const raw = "postgresql://postgres.project:encoded%40pass%3Aword@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=verify-full";
  const result = new URL(runtimeDatabaseUrl(raw, true)!);
  const original = new URL(raw);
  assert.equal(result.port, "6543");
  for (const key of ["protocol", "username", "password", "hostname", "pathname", "search"] as const)
    assert.equal(result[key], original[key]);
});

test("pooler selection leaves local, direct, custom and explicitly selected session connections alone", () => {
  const raw = "postgres://user:password@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
  assert.equal(runtimeDatabaseUrl(raw, false), raw);
  assert.equal(runtimeDatabaseUrl(raw, true, "session"), raw);
  for (const value of [
    raw.replace("5432", "6543"),
    raw.replace("aws-0-ap-south-1.pooler.supabase.com", "db.project.supabase.co"),
    raw.replace("aws-0-ap-south-1.pooler.supabase.com", "db.example.com"),
    raw.replace("pooler.supabase.com", "pooler.supabase.com.example.com"),
    undefined,
  ]) assert.equal(runtimeDatabaseUrl(value, true), value);
});
