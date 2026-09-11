# English-Tech Supabase connection

Project: cbfeamcsymukjsfmvviq (English-Tech), Mumbai, Free plan. Supabase reported $0/month when created.

## Connected and verified

The local website now uses Supabase PostgreSQL through the Session pooler with TLS certificate verification. The existing teacher, owner claim, session, rate limits, and audit record were copied in a transaction. All source/destination row counts matched. The old SQLite file remains as a rollback snapshot and no longer receives website writes.

The 17 application tables store profiles, authentication records, courses/topics/video metadata, access assignments, student groups, progress, watch events, announcements, reads, contacts, settings, uploads metadata, and audit records. This does not record unsent form keystrokes or every interface click. Passwords and OTPs are stored as hashes.

The backend uses english_tech_server, a role with only table CRUD and schema usage permissions. It cannot create tables or roles. Each application table has RLS enabled, an explicit policy limited to that server role, and no grants to anon/authenticated. Existing Express authorization enforces student ownership and teacher permissions. Supabase Auth users are separate from the application's public.users table; Google sign-in remains outstanding.

## Private configuration

.env contains DATABASE_URL, DATABASE_SSL=true, DATABASE_MANAGED_SCHEMA=true, and DATABASE_CA_FILE=supabase/prod-ca-2021.crt. The private .env.supabase file is used by the one-time migration script. Neither file belongs in GitHub or the source download. The included certificate is public, downloaded from the SSL certificate link in the Supabase dashboard.

For Vercel, copy the private environment values into Vercel Environment Variables. Use the project's Transaction pooler connection (port 6543 on the same verified pooler hostname) for serverless deployment. Keep certificate verification enabled. DATABASE_MANAGED_SCHEMA prevents runtime DDL because migrations are administered separately. Use the SAME project to preserve your owner; do not register a second owner. Vercel deployment itself is not verified yet.

## Verification

Production build and 25 isolated regression tests passed. A profile save in the running website changed the remote users.updated_at value; the old SQLite value stayed unchanged. The migrated owner session opened the teacher dashboard successfully. Supabase's security advisor returned no findings after the server policies were added.

## Remaining work

Video/image/resource file bytes still use the existing local/S3 storage adapter; only metadata is in Supabase tables. Connect private cloud object storage and scanning before production uploads. Production OTP delivery, Google sign-in, hosting, backups, and monitoring remain separate integrations. The website is not production-deployed by this database connection.
