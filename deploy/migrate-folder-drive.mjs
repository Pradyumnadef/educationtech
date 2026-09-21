import fs from "node:fs";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const ssl =
  process.env.DATABASE_SSL === "true"
    ? {
        rejectUnauthorized: true,
        ...(process.env.DATABASE_CA_FILE
          ? { ca: fs.readFileSync(process.env.DATABASE_CA_FILE, "utf8") }
          : {}),
      }
    : undefined;
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl,
});

await client.connect();
try {
  const before = await client.query(
    "SELECT kind, COUNT(*)::int AS count FROM content GROUP BY kind ORDER BY kind",
  );
  console.log("Before:", before.rows);
  await client.query(
    fs.readFileSync("supabase/folder-drive-migration.sql", "utf8"),
  );
  const after = await client.query(
    "SELECT kind, COUNT(*)::int AS count FROM content GROUP BY kind ORDER BY kind",
  );
  console.log("After:", after.rows);
} finally {
  await client.end();
}
