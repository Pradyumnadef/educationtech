import "dotenv/config";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import pg from "pg";
// App timestamps are milliseconds and must match SQLite's numeric JSON values.
pg.types.setTypeParser(20, (value) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number))
    throw new Error("Database integer exceeds supported range");
  return number;
});
export const production = process.env.NODE_ENV === "production";
export const demo =
  !production &&
  (process.env.LOCAL_OTP === "true" || process.env.DEMO_MODE === "true");
export const dataDir = path.resolve(
  process.env.DATA_DIR ||
    (process.env.VERCEL ? path.join(tmpdir(), "english-tech") : "data"),
);
mkdirSync(dataDir, { recursive: true });
if (production && !process.env.DATABASE_URL)
  throw new Error("Production requires DATABASE_URL");
const pool = process.env.DATABASE_URL
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      ssl:
        process.env.DATABASE_SSL === "true"
          ? {
              rejectUnauthorized: true,
              ...(process.env.DATABASE_CA_FILE
                ? { ca: readFileSync(process.env.DATABASE_CA_FILE, "utf8") }
                : {}),
            }
          : undefined,
    })
  : null;
const sqlite = pool
  ? null
  : new (await import("node:sqlite")).DatabaseSync(
      path.join(dataDir, "lumio.sqlite"),
    );
sqlite?.exec(
  "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;",
);
export async function query<T = any>(
  sql: string,
  params: any[] = [],
): Promise<T[]> {
  if (pool) {
    let n = 0;
    return (
      await pool.query(
        sql.replace(/\?/g, () => `$${++n}`),
        params,
      )
    ).rows;
  }
  return sqlite!.prepare(sql).all(...params) as T[];
}
export async function run(sql: string, params: any[] = []) {
  if (pool) {
    let n = 0;
    await pool.query(
      sql.replace(/\?/g, () => `$${++n}`),
      params,
    );
  } else sqlite!.prepare(sql).run(...params);
}
export async function one(sql: string, params: any[] = []) {
  return (await query(sql, params))[0];
}
export const id = () => randomUUID();
export const now = () => Date.now();
export async function insert(table: string, record: Record<string, any>) {
  const keys = Object.keys(record);
  await run(
    `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
    Object.values(record),
  );
  return record;
}
export async function update(
  table: string,
  record: Record<string, any>,
  recordId: string,
) {
  const keys = Object.keys(record);
  if (keys.length)
    await run(
      `UPDATE ${table} SET ${keys.map((k) => `${k}=?`).join(",")} WHERE id=?`,
      [...Object.values(record), recordId],
    );
}
export async function initDB() {
  if (pool && process.env.DATABASE_MANAGED_SCHEMA === "true") {
    await query("SELECT id FROM platform_owner LIMIT 1");
    return;
  }
  const schema = `
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('admin','student')), name TEXT NOT NULL, email TEXT UNIQUE, phone TEXT UNIQUE, password_hash TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','pending','inactive')), avatar TEXT NOT NULL DEFAULT '', interests TEXT NOT NULL DEFAULT '[]', onboarding INTEGER NOT NULL DEFAULT 0, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, last_active BIGINT);
CREATE TABLE IF NOT EXISTS platform_owner (id INTEGER PRIMARY KEY CHECK(id=1), user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT UNIQUE NOT NULL, csrf TEXT NOT NULL, expires_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS otps (id TEXT PRIMARY KEY, identifier TEXT NOT NULL, code_hash TEXT NOT NULL, purpose TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, consumed INTEGER NOT NULL DEFAULT 0, expires_at BIGINT NOT NULL, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits (id TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS content (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('subject','folder','chapter','topic','video')), parent_id TEXT REFERENCES content(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', thumbnail TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')), public INTEGER NOT NULL DEFAULT 0, duration INTEGER NOT NULL DEFAULT 0, tags TEXT NOT NULL DEFAULT '[]', notes TEXT NOT NULL DEFAULT '', storage_key TEXT NOT NULL DEFAULT '', caption_key TEXT NOT NULL DEFAULT '', resource_key TEXT NOT NULL DEFAULT '', publish_at BIGINT, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS student_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '', created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS group_members (id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES student_groups(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, UNIQUE(group_id,user_id));
CREATE TABLE IF NOT EXISTS access_grants (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, group_id TEXT REFERENCES student_groups(id) ON DELETE CASCADE, content_id TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE, status TEXT NOT NULL CHECK(status IN ('assigned','revoked')), created_at BIGINT NOT NULL, CHECK((user_id IS NOT NULL AND group_id IS NULL) OR (user_id IS NULL AND group_id IS NOT NULL)));
CREATE TABLE IF NOT EXISTS progress (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, video_id TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE, position REAL NOT NULL DEFAULT 0, watched_seconds REAL NOT NULL DEFAULT 0, completed INTEGER NOT NULL DEFAULT 0, updated_at BIGINT NOT NULL, UNIQUE(user_id,video_id));
CREATE TABLE IF NOT EXISTS watch_events (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, video_id TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE, seconds REAL NOT NULL DEFAULT 0, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS announcements (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS notification_reads (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE, UNIQUE(user_id,announcement_id));
CREATE TABLE IF NOT EXISTS activity_logs (id TEXT PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, target_id TEXT, detail TEXT NOT NULL DEFAULT '', created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), storage_key TEXT NOT NULL UNIQUE, filename TEXT NOT NULL, mime TEXT NOT NULL, size BIGINT NOT NULL, state TEXT NOT NULL, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS content_assets (id TEXT PRIMARY KEY, content_id TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE, upload_id TEXT NOT NULL REFERENCES uploads(id) ON DELETE CASCADE, asset_type TEXT NOT NULL CHECK(asset_type IN ('video','file')), sort_order INTEGER NOT NULL DEFAULT 0, UNIQUE(content_id,upload_id));
CREATE TABLE IF NOT EXISTS learning_assignments (id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', quiz_url TEXT NOT NULL DEFAULT '', due_at BIGINT NOT NULL, time_limit_minutes INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')), created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS assignment_targets (id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES learning_assignments(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, group_id TEXT REFERENCES student_groups(id) ON DELETE CASCADE, CHECK((user_id IS NOT NULL AND group_id IS NULL) OR (user_id IS NULL AND group_id IS NOT NULL)));
CREATE TABLE IF NOT EXISTS assignment_resources (id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES learning_assignments(id) ON DELETE CASCADE, upload_id TEXT NOT NULL REFERENCES uploads(id) ON DELETE CASCADE, UNIQUE(assignment_id,upload_id));
CREATE TABLE IF NOT EXISTS assignment_submissions (id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES learning_assignments(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, started_at BIGINT NOT NULL, submitted_at BIGINT, status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','submitted','reviewed')), note TEXT NOT NULL DEFAULT '', feedback TEXT NOT NULL DEFAULT '', updated_at BIGINT NOT NULL, UNIQUE(assignment_id,user_id));
CREATE TABLE IF NOT EXISTS submission_files (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE, upload_id TEXT NOT NULL REFERENCES uploads(id) ON DELETE CASCADE, UNIQUE(submission_id,upload_id));
CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS oauth_flows (id TEXT PRIMARY KEY, browser_hash TEXT NOT NULL, state TEXT NOT NULL, action TEXT NOT NULL, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, expires_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS external_identities (id TEXT PRIMARY KEY, provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at BIGINT NOT NULL, UNIQUE(provider,subject));
CREATE TABLE IF NOT EXISTS otp_bindings (id TEXT PRIMARY KEY REFERENCES otps(id) ON DELETE CASCADE, provider TEXT NOT NULL, user_id TEXT REFERENCES users(id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS idx_oauth_expiry ON oauth_flows(expires_at);
CREATE INDEX IF NOT EXISTS idx_identity_user ON external_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_content_parent ON content(parent_id);
CREATE INDEX IF NOT EXISTS idx_access_user ON access_grants(user_id,content_id);
CREATE INDEX IF NOT EXISTS idx_access_group ON access_grants(group_id,content_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_student_grant ON access_grants(user_id,content_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_group_grant ON access_grants(group_id,content_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_group_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_time ON watch_events(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_identifier ON otps(identifier,created_at);
CREATE INDEX IF NOT EXISTS idx_content_status ON content(kind,status);
CREATE INDEX IF NOT EXISTS idx_content_assets_content ON content_assets(content_id,asset_type,sort_order);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role,created_at);
CREATE INDEX IF NOT EXISTS idx_assignment_due ON learning_assignments(status,due_at);
CREATE INDEX IF NOT EXISTS idx_assignment_target_user ON assignment_targets(user_id,assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_target_group ON assignment_targets(group_id,assignment_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_assignment_student_target ON assignment_targets(assignment_id,user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_assignment_group_target ON assignment_targets(assignment_id,group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_submission_student ON assignment_submissions(user_id,assignment_id);
`;
  for (const statement of schema.split(";").filter((s) => s.trim()))
    await run(statement);
}
// The singleton claim and account are committed together. PostgreSQL's
// transaction lock also serializes requests across separate app instances.
export async function createInitialTeacher(user: Record<string, any>) {
  const keys = Object.keys(user);
  const values = Object.values(user);
  const alreadySet = () =>
    Object.assign(
      new Error("Teacher setup is already complete. Please sign in."),
      { status: 409 },
    );
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(78190324)");
      const existing = await client.query(
        "SELECT id FROM platform_owner UNION ALL SELECT 1 FROM users WHERE role='admin' LIMIT 1",
      );
      if (existing.rows.length) throw alreadySet();
      await client.query(
        `INSERT INTO users (${keys.join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
        values,
      );
      await client.query(
        "INSERT INTO platform_owner(id,user_id) VALUES (1,$1)",
        [user.id],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    sqlite!.exec("BEGIN IMMEDIATE");
    try {
      if (
        sqlite!
          .prepare(
            "SELECT id FROM platform_owner UNION ALL SELECT 1 FROM users WHERE role='admin' LIMIT 1",
          )
          .get()
      )
        throw alreadySet();
      sqlite!
        .prepare(
          `INSERT INTO users (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
        )
        .run(...values);
      sqlite!
        .prepare("INSERT INTO platform_owner(id,user_id) VALUES (1,?)")
        .run(user.id);
      sqlite!.exec("COMMIT");
    } catch (error) {
      sqlite!.exec("ROLLBACK");
      throw error;
    }
  }
  return user;
}
export async function closeDB() {
  await pool?.end();
  sqlite?.close();
}
