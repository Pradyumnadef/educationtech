# English Tech: GitHub and Vercel handoff

## 1. Finish local owner setup

Open http://localhost:3000/auth/setup and create your own teacher account. There is no default email or password. Add further teachers through Teachers in the owner workspace. The local database is deliberately excluded from GitHub; an empty production database will require a separate first-owner setup.

## 2. Put the project on GitHub

Create a repository and upload the contents of this folder. `package.json`, `vercel.json`, `api/`, `src/`, and `server/` must be at the repository root. Keep `.env`, `.env.production`, `data/`, `node_modules/`, backups, and test-results out of the repository. The included .gitignore protects these when using Git. Uploading through the browser requires you to omit them yourself. No demo videos are included.

## 3. Connect your backend before enabling online accounts

The app currently uses local SQLite or external PostgreSQL through DATABASE_URL. Vercel does not provide durable local file storage for SQLite or uploaded videos. Configure external PostgreSQL with verified TLS (`DATABASE_SSL=true` where applicable) and private S3-compatible object storage. Do not copy the local SQLite file into a Vercel function.

Production requires NODE_ENV=production, APP_ORIGIN set to your exact HTTPS origin, DATABASE_URL, SESSION_SECRET, Twilio Verify credentials, S3_BUCKET, and SCANNER_WEBHOOK_SECRET. Set LOCAL_OTP=false, DEMO_MODE=false, and SEED_DEMO=false. Supply AWS credentials or an appropriate cloud identity. Set TEACHER_SETUP_KEY to a random value of 32 or more characters for first-owner registration. The actual keys belong in Vercel Environment Variables, never in source files.

Google sign-in has **not** been implemented. When integrating it, verify the Google identity server-side and link it to existing database users. Never turn a Google-authenticated user into a teacher based only on a browser claim or email string. Teacher roles must remain controlled by the owner. Keep password login until that integration is implemented and tested.

## 4. Import into Vercel

Import your GitHub repository. This is a Vite/React frontend with an Express API; use Node.js 24. The included vercel.json builds the frontend and maps API requests to api/index.ts. The API does not open a listening port on Vercel. Missing service configuration returns a clear 503 response instead of creating a temporary database or bypassing authentication.

A build succeeding does not mean the external integrations are connected. Complete the Environment Variables first, then redeploy. Visit /auth/setup, use the private setup key, and create the production owner. Remove the setup key afterward; the database singleton prevents setup from reopening.

## 5. Keep scanning outside Vercel Functions

The current scanner uses ffprobe and a continuously running ClamAV service. Run that worker on a separate suitable host, or implement and test an equivalent cloud scanning service. Uploads remain quarantined until a genuine clean scan approves them. Do not automatically approve scans to make uploads appear to work.

The current media gateway rechecks access and relays byte ranges. Vercel Functions have response, bandwidth, and duration limits; this adapter uses a 60-second maximum. Test realistic video sizes and playback seeking on the chosen plan. For long lessons or larger usage, a dedicated streaming gateway or a carefully authorized streaming service is needed. A static deployment cannot preserve this behavior by itself.

The hourly local cleanup timer is disabled on Vercel. Schedule equivalent cleanup of expired sessions, OTPs, and rate-limit records through a managed database job or authenticated scheduled function.

## 6. Verify before inviting students

Test owner setup, blocked second-owner attempts, teacher sign-in, owner-only teacher creation/deactivation, student authentication, uploads and scan completion, private playback, access revocation, progress, announcements, backups, and restore against the deployed services. Live Vercel/PostgreSQL/Google/S3 integrations have not been exercised in this local task.

Official references:
- https://vercel.com/docs/functions/runtimes
- https://vercel.com/docs/functions/limitations
- https://vercel.com/docs/project-configuration/vercel-json


## Existing English-Tech Supabase project

The current local installation has been migrated to the English-Tech Supabase project. Reuse this project and its existing owner when deploying. Read supabase/README.md; the local .env holds private connection values, and the downloadable source intentionally excludes them. The remaining deployment requirements above still apply. Live PostgreSQL connectivity and profile persistence have now been verified; Vercel, Google, real OTP delivery, and cloud media delivery have not.
