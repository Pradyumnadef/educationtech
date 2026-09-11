import dotenv from 'dotenv';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import pg from 'pg';

// Run once while the application is stopped. Never overwrites cloud records.
dotenv.config({ path: '.env.supabase', quiet: true });
if (!process.env.DATABASE_URL) throw new Error('Supabase connection is required');
const source = new DatabaseSync('data/lumio.sqlite', { readOnly: true });
const target = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true, ca: readFileSync('supabase/prod-ca-2021.crt', 'utf8') },
  connectionTimeoutMillis: 10000,
});
const tables = ['users', 'platform_owner', 'sessions', 'otps', 'rate_limits', 'content', 'student_groups', 'group_members', 'access_grants', 'progress', 'watch_events', 'announcements', 'notification_reads', 'activity_logs', 'settings', 'uploads', 'contacts'];
try {
  await target.connect();
  await target.query('BEGIN');
  await target.query('SELECT pg_advisory_xact_lock(78190324)');
  const copied: Record<string, number> = {};
  for (const table of tables) {
    if (Number((await target.query(`SELECT count(*) AS n FROM public.${table}`)).rows[0].n))
      throw new Error(`Cloud table ${table} is not empty; migration stopped without overwriting data`);
    let rows = source.prepare(`SELECT * FROM ${table}`).all();
    if (table === 'content') {
      const ordered: typeof rows = [], seen = new Set();
      while (rows.length) {
        const next = rows.filter(r => !r.parent_id || seen.has(r.parent_id));
        if (!next.length) throw new Error('Invalid content hierarchy');
        next.forEach(r => { ordered.push(r); seen.add(r.id); });
        rows = rows.filter(r => !seen.has(r.id));
      }
      rows = ordered;
    }
    for (const row of rows) {
      const columns = Object.keys(row);
      await target.query(`INSERT INTO public.${table} (${columns.map(c => `"${c}"`).join(',')}) VALUES (${columns.map((_,i) => `$${i+1}`).join(',')})`, Object.values(row));
    }
    const count = Number((await target.query(`SELECT count(*) AS n FROM public.${table}`)).rows[0].n);
    if (count !== rows.length) throw new Error(`Count mismatch: ${table}`);
    copied[table] = count;
  }
  await target.query('COMMIT');
  console.log('Migration committed; verified row counts:', copied);
} catch (error) {
  await target.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  source.close();
  await target.end();
}
